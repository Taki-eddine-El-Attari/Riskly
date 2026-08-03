"""Stockage privé des CSV de warm-up (option ①).

Principes de sécurité appliqués ici :
- Le fichier est écrit sous `settings.WARMUP_STORAGE_DIR`, un volume dédié
  **hors du dépôt** et **jamais servi en statique**. Le volume doit être
  chiffré au repos (chiffrement disque / SSE) — pas de chiffrement applicatif.
- Le nom de stockage est un UUID aléatoire (`object_key`). Le nom fourni par
  l'utilisateur n'entre jamais dans la construction d'un chemin → pas de path
  traversal. Une garde `_resolve` revérifie que tout chemin reste sous la base.
- Validation à l'ingestion : extension autorisée, plafond de taille (streaming,
  jamais tout en mémoire d'un coup au-delà du plafond), contenu réellement
  textuel + parsable en CSV, comptage des lignes, empreinte SHA-256.
- Écriture atomique (fichier temporaire + `os.replace`) avec permissions 0600 ;
  répertoires 0700. Le propriétaire (`user_id`) est vérifié en amont par l'API.
"""

from __future__ import annotations

import csv
import hashlib
import io
import os
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, Iterator

from app.core.config import settings
from app.core.exceptions import (
    InvalidWarmupFileError,
    WarmupFileNotFoundError,
    WarmupFileTooLargeError,
)

# Taille des blocs de lecture (64 Kio).
_CHUNK = 64 * 1024
# Octets échantillonnés pour deviner si le contenu est binaire.
_SNIFF_BYTES = 8192


@dataclass(frozen=True)
class StoredWarmup:
    """Résultat d'un stockage réussi — à persister en base."""

    object_key: str
    size_bytes: int
    rows: int | None
    sha256: str


def _base_dir() -> Path:
    return Path(settings.WARMUP_STORAGE_DIR)


def _resolve(object_key: str) -> Path:
    """Résout `object_key` sous la base et interdit toute évasion de chemin."""
    base = _base_dir().resolve()
    # Un object_key est toujours relatif ; on rejette tout ce qui ressemble à
    # un chemin absolu ou à une remontée de répertoire.
    if object_key.startswith(("/", "\\")) or ".." in Path(object_key).parts:
        raise InvalidWarmupFileError("Clé de stockage invalide.")
    candidate = (base / object_key).resolve()
    if base != candidate and base not in candidate.parents:
        raise InvalidWarmupFileError("Clé de stockage hors du répertoire autorisé.")
    return candidate


def _new_object_key(extension: str) -> str:
    """Clé opaque, éclatée en 2 niveaux pour éviter les répertoires géants."""
    token = uuid.uuid4().hex
    return f"{token[:2]}/{token[2:4]}/{token}.{extension}"


def _check_extension(filename: str) -> str:
    ext = Path(filename or "").suffix.lower().lstrip(".")
    allowed = settings.WARMUP_ALLOWED_EXTENSIONS_SET
    if ext not in allowed:
        raise InvalidWarmupFileError(
            f"Extension non autorisée : .{ext or '?'} "
            f"(attendu : {', '.join('.' + e for e in sorted(allowed))})."
        )
    return ext


def _looks_binary(sample: bytes) -> bool:
    # Un CSV n'a pas d'octet nul ; c'est le signal binaire le plus fiable.
    return b"\x00" in sample


def _count_csv_rows(data: bytes) -> int | None:
    """Compte les lignes de données (en-tête exclu). None si non décodable."""
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return None
    try:
        reader = csv.reader(io.StringIO(text))
        total = sum(1 for row in reader if any(cell.strip() for cell in row))
    except csv.Error:
        return None
    return max(total - 1, 0)  # on retire la ligne d'en-tête


def store_warmup(fileobj: BinaryIO, filename: str) -> StoredWarmup:
    """Valide puis stocke le flux `fileobj`. Lève une RisklyException sinon.

    Le flux est lu par blocs : dès que le plafond est dépassé, on s'arrête et on
    n'écrit rien. Le fichier n'est déplacé à son emplacement final qu'une fois
    entièrement validé (écriture atomique).
    """
    extension = _check_extension(filename)
    max_size = settings.WARMUP_MAX_SIZE_BYTES

    object_key = _new_object_key(extension)
    final_path = _resolve(object_key)
    final_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)

    hasher = hashlib.sha256()
    size = 0
    head = bytearray()
    body = bytearray()  # conservé pour le comptage des lignes
    tmp_path = final_path.with_name(f".{uuid.uuid4().hex}.part")

    try:
        # 0600 dès la création (umask neutralisé par le mode explicite ci-après).
        fd = os.open(tmp_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "wb") as out:
            for chunk in _iter_chunks(fileobj):
                size += len(chunk)
                if size > max_size:
                    raise WarmupFileTooLargeError(max_size)
                if len(head) < _SNIFF_BYTES:
                    head.extend(chunk[: _SNIFF_BYTES - len(head)])
                    if _looks_binary(head):
                        raise InvalidWarmupFileError(
                            "Le contenu ne ressemble pas à un CSV (données binaires)."
                        )
                hasher.update(chunk)
                body.extend(chunk)
                out.write(chunk)

        if size == 0:
            raise InvalidWarmupFileError("Le fichier de warm-up est vide.")

        rows = _count_csv_rows(bytes(body))
        if rows is None:
            raise InvalidWarmupFileError(
                "Le fichier n'a pas pu être décodé comme un CSV UTF-8."
            )

        os.chmod(tmp_path, 0o600)
        os.replace(tmp_path, final_path)  # atomique sur le même volume
    except Exception:
        # Nettoyage systématique du temporaire en cas d'échec.
        tmp_path.unlink(missing_ok=True)
        raise

    return StoredWarmup(
        object_key=object_key,
        size_bytes=size,
        rows=rows,
        sha256=hasher.hexdigest(),
    )


def open_warmup(object_key: str, expected_sha256: str | None = None) -> Iterator[bytes]:
    """Ouvre un fichier stocké et le renvoie par blocs (pour StreamingResponse).

    Si `expected_sha256` est fourni, l'empreinte est recalculée à la volée et
    une incohérence lève une erreur en fin de flux (intégrité).
    """
    path = _resolve(object_key)
    if not path.is_file():
        raise WarmupFileNotFoundError()

    def _generator() -> Iterator[bytes]:
        hasher = hashlib.sha256() if expected_sha256 else None
        with open(path, "rb") as fh:
            while True:
                chunk = fh.read(_CHUNK)
                if not chunk:
                    break
                if hasher is not None:
                    hasher.update(chunk)
                yield chunk
        if hasher is not None and hasher.hexdigest() != expected_sha256:
            raise WarmupFileNotFoundError("Intégrité du fichier compromise.")

    return _generator()


def delete_warmup(object_key: str) -> None:
    """Supprime le fichier du disque (idempotent)."""
    path = _resolve(object_key)
    path.unlink(missing_ok=True)


def _iter_chunks(fileobj: BinaryIO) -> Iterator[bytes]:
    while True:
        chunk = fileobj.read(_CHUNK)
        if not chunk:
            break
        yield chunk
