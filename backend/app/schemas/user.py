"""Schemas Pydantic pour l'authentification et l'exposition des utilisateurs."""

from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import BaseModel

if TYPE_CHECKING:
    from app.models.user import User


class TelegramAuthData(BaseModel):
    """Données brutes renvoyées par le Login Widget Telegram (à vérifier)."""

    id: int
    first_name: str
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None
    auth_date: int
    hash: str


class UserRead(BaseModel):
    """Utilisateur exposé au frontend (miroir de frontend/src/types/auth.ts)."""

    id: str
    telegramId: int
    username: str | None
    displayName: str
    photoUrl: str | None
    role: str
    entity: str | None

    @classmethod
    def from_model(cls, user: "User") -> "UserRead":
        return cls(
            id=str(user.id),
            telegramId=user.telegram_id,
            username=user.username,
            displayName=user.display_name,
            photoUrl=user.photo_url,
            role=user.role,
            entity=user.entity,
        )


class AuthResponse(BaseModel):
    """Réponse des endpoints d'auth : uniquement l'utilisateur (jamais de token :
    la session vit dans un cookie HttpOnly)."""

    user: UserRead
