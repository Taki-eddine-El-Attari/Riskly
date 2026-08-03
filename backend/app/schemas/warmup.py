import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class WarmupInfo(BaseModel):
    """Métadonnées d'un CSV de warm-up (jamais son contenu)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    original_name: str = Field(..., description="Nom du fichier fourni par l'utilisateur.")
    size_bytes: int = Field(..., ge=0, description="Taille en octets.")
    rows: Optional[int] = Field(None, ge=0, description="Lignes de données (en-tête exclu).")
    content_type: Optional[str] = None
    sha256: str = Field(..., description="Empreinte SHA-256 du contenu.")
    created_at: Optional[datetime] = None
