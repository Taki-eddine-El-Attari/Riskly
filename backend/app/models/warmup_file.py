import uuid
from typing import Optional
from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class WarmupFile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Métadonnées d'un CSV de warm-up joint à une analyse.

    Le contenu du fichier n'est JAMAIS stocké en base : seul l'`object_key`
    (chemin relatif opaque, à base d'UUID) pointe vers le fichier posé sur le
    volume privé chiffré. `original_name` n'est qu'une métadonnée d'affichage,
    jamais utilisée pour construire un chemin (protection contre le path
    traversal). `sha256` permet de vérifier l'intégrité au téléchargement.
    """

    __tablename__ = "warmup_file"

    # Un fichier de warm-up au plus par analyse (relation 1-1).
    analysis_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("analysis.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    # Propriétaire dénormalisé : autorise le contrôle d'accès sans jointure.
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Nom fourni par l'utilisateur — affichage uniquement.
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    # Lignes de données (en-tête exclu) ; None si le comptage a échoué.
    rows: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Clé de stockage opaque (chemin relatif, jamais exposé au client).
    object_key: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    # Empreinte du contenu, pour vérification d'intégrité.
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)

    analysis: Mapped["Analysis"] = relationship(back_populates="warmup_file")
