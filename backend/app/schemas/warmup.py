import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class WarmupInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    original_name: str = Field(..., description="Nom du fichier fourni par l'utilisateur.")
    size_bytes: int = Field(..., ge=0, description="Taille en octets.")
    rows: Optional[int] = Field(None, ge=0, description="Lignes de données (en-tête exclu).")
    content_type: Optional[str] = None
    sha256: str = Field(..., description="Empreinte SHA-256 du contenu.")
    created_at: Optional[datetime] = None


class WarmupSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    name: str = Field(..., validation_alias="original_name")
    size: int = Field(..., ge=0, validation_alias="size_bytes")
    rows: Optional[int] = Field(None, ge=0)
