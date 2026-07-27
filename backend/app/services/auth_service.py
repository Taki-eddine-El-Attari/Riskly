from uuid import UUID
from typing import Optional
from fastapi import Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password, verify_password, verify_telegram_auth
from app.core.exceptions import (
    UsernameDejaUtiliseError,
    IdentifiantsInvalidesError,
    MotDePasseFaibleError,
    PermissionInsuffisanteError,
    UtilisateurNonTrouveError,
    ProtectionSuperadminError,
    AutoSuppressionError,
    TelegramAuthError,
)
from app.repositories.user_repo import UserRepository
from app.models.user import User
from app.schemas.user import TelegramAuthData

MIN_PASSWORD_LENGTH = 8


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)

    def register(self, username: str, password: str, entite: Optional[str] = None) -> User:
        if self.user_repo.exists(username):
            raise UsernameDejaUtiliseError(username)

        if len(password) < MIN_PASSWORD_LENGTH:
            raise MotDePasseFaibleError(MIN_PASSWORD_LENGTH)

        return self.user_repo.create(
            username=username.lower().strip(),
            password_hash=hash_password(password),
            role="user",
            entite=entite,
        )

    def login(self, request: Request, username: str, password: str) -> User:
        # register() stocke le username en minuscules → normaliser la recherche.
        user = self.user_repo.get_by_username(username.lower().strip())

        if user is None or not verify_password(password, user.password_hash):
            raise IdentifiantsInvalidesError()

        request.session["user_id"] = str(user.id)
        return user

    def logout(self, request: Request) -> None:
        request.session.clear()

    def authenticate_telegram(self, request: Request, data: TelegramAuthData) -> User:
        """Login/register via le Login Widget Telegram : vérifie la signature,
        crée/retrouve le compte (clé = telegram_id), ouvre la session."""
        if not settings.TELEGRAM_BOT_TOKEN:
            raise TelegramAuthError("Connexion Telegram non configurée côté serveur.")

        fields = data.model_dump(exclude_none=True)
        if not verify_telegram_auth(
            fields, settings.TELEGRAM_BOT_TOKEN, settings.TELEGRAM_AUTH_MAX_AGE
        ):
            raise TelegramAuthError()

        user = self.user_repo.upsert_from_telegram(
            telegram_id=data.id,
            telegram_username=data.username,
            first_name=data.first_name,
        )
        request.session["user_id"] = str(user.id)
        return user

    def create_admin(self, current_user: User, username: str, password: str) -> User:
        if current_user.role != "superadmin":
            raise PermissionInsuffisanteError("Seul le superadmin peut creer des comptes admin")

        if self.user_repo.exists(username):
            raise UsernameDejaUtiliseError(username)

        return self.user_repo.create(
            username=username.lower().strip(),
            password_hash=hash_password(password),
            role="admin",
        )

    def change_password(self, user: User, current_password: str, new_password: str) -> bool:
        if not verify_password(current_password, user.password_hash):
            raise IdentifiantsInvalidesError()

        if len(new_password) < MIN_PASSWORD_LENGTH:
            raise MotDePasseFaibleError(MIN_PASSWORD_LENGTH)

        return self.user_repo.update_password(user.id, hash_password(new_password))

    def reset_password(self, current_user: User, target_user_id: UUID, new_password: str) -> bool:
        if current_user.role not in ("admin", "superadmin"):
            raise PermissionInsuffisanteError()

        target = self.user_repo.get_by_id(target_user_id)
        if target is None:
            raise UtilisateurNonTrouveError()

        if target.role == "superadmin" and current_user.role != "superadmin":
            raise ProtectionSuperadminError("Impossible de modifier le superadmin")

        return self.user_repo.update_password(target_user_id, hash_password(new_password))

    def delete_user(self, current_user: User, target_user_id: UUID) -> bool:
        if current_user.role != "superadmin":
            raise PermissionInsuffisanteError("Seul le superadmin peut supprimer des comptes")

        if str(current_user.id) == str(target_user_id):
            raise AutoSuppressionError()

        target = self.user_repo.get_by_id(target_user_id)
        if target and target.role == "superadmin":
            raise ProtectionSuperadminError("Impossible de supprimer le superadmin")

        return self.user_repo.delete(target_user_id)