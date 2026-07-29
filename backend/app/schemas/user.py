import uuid
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, ConfigDict, Field, field_validator


class UserRole(str, Enum):
    superadmin = "superadmin"
    admin = "admin"
    user = "user"


# --- Auth locale (username / mot de passe) -----------------------------------
class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=8, max_length=128)
    entite: str | None = Field(None, max_length=100)

    @field_validator("password")
    @classmethod
    def password_complexity(cls, value: str) -> str:
        if not any(char.isdigit() for char in value):
            raise ValueError("Le mot de passe doit contenir au moins un chiffre.")
        if not any(char.isupper() for char in value):
            raise ValueError("Le mot de passe doit contenir au moins une majuscule.")
        return value


class UserLogin(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=1)


# --- Auth Telegram (Login Widget) --------------------------------------------
class TelegramAuthData(BaseModel):
    """Données brutes renvoyées par le Login Widget Telegram (à vérifier côté serveur)."""

    id: int
    first_name: str
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None
    auth_date: int
    hash: str


# --- Sortie exposée au frontend (miroir de la table `users`) -----------------
class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    username: str
    telegram_id: int | None = None
    telegram_username: str | None = None
    role: UserRole
    auth_method: str
    entite: str | None = None
    created_at: datetime | None = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: uuid.UUID
    exp: datetime
