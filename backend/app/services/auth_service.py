"""Logique métier de l'authentification Telegram + session."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_session_token,
    read_session_token,
    verify_telegram_auth,
)
from app.models.user import User
from app.repositories.user_repo import UserRepository
from app.schemas.user import TelegramAuthData


class AuthService:
    def __init__(self, db: Session) -> None:
        self.users = UserRepository(db)

    def authenticate_telegram(self, data: TelegramAuthData) -> tuple[User, str]:
        """Vérifie les données Telegram, crée/retrouve l'utilisateur,
        et renvoie (utilisateur, jeton de session)."""
        if not settings.telegram_bot_token:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "TELEGRAM_BOT_TOKEN non configuré côté serveur.",
            )

        # On ne signe que les champs réellement envoyés par Telegram.
        fields = data.model_dump(exclude_none=True)
        if not verify_telegram_auth(
            fields, settings.telegram_bot_token, settings.telegram_auth_max_age
        ):
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED,
                "Vérification Telegram échouée (signature invalide ou expirée).",
            )

        user = self.users.upsert_from_telegram(data)
        token = create_session_token(user.id)
        return user, token

    def user_from_session(self, token: str | None) -> User:
        """Résout l'utilisateur à partir du cookie de session signé."""
        if not token:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Non authentifié.")

        user_id = read_session_token(token, settings.cookie_max_age)
        if user_id is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session invalide.")

        user = self.users.get_by_id(int(user_id))
        if user is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Utilisateur introuvable.")
        return user
