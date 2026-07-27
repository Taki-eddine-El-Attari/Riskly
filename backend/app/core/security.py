"""Primitives de sécurité : vérification du login Telegram + jetons de session signés."""

from __future__ import annotations

import hashlib
import hmac
import time

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.core.config import settings

_serializer = URLSafeTimedSerializer(settings.secret_key, salt="riskly-session")


def verify_telegram_auth(fields: dict[str, object], bot_token: str, max_age: int) -> bool:
    """Vérifie la signature du Login Widget Telegram.

    `fields` = données envoyées par Telegram (le `hash` inclus, les None exclus).
    L'algorithme officiel :
      1. data_check_string = "clé=valeur" triées par clé, jointes par "\\n" (sans hash) ;
      2. clé secrète = SHA256(bot_token) ;
      3. hash attendu = HMAC-SHA256(data_check_string, clé secrète).
    On compare en temps constant, puis on vérifie la fraîcheur (anti-rejeu).
    """
    received_hash = str(fields.get("hash", ""))
    check = {k: v for k, v in fields.items() if k != "hash"}
    check_string = "\n".join(f"{k}={check[k]}" for k in sorted(check))

    secret_key = hashlib.sha256(bot_token.encode()).digest()
    computed_hash = hmac.new(
        secret_key, check_string.encode(), hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(computed_hash, received_hash):
        return False
    return (time.time() - int(fields.get("auth_date", 0))) < max_age


def create_session_token(user_id: int) -> str:
    """Sérialise l'identifiant utilisateur dans un jeton signé (posé en cookie)."""
    return _serializer.dumps(str(user_id))


def read_session_token(token: str, max_age: int) -> str | None:
    """Renvoie l'identifiant utilisateur si le jeton est valide et non expiré, sinon None."""
    try:
        return _serializer.loads(token, max_age=max_age)
    except (BadSignature, SignatureExpired):
        return None
