"""Accès aux utilisateurs en base (couche persistance)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import TelegramAuthData


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, user_id: int) -> User | None:
        return self.db.get(User, user_id)

    def get_by_telegram_id(self, telegram_id: int) -> User | None:
        return self.db.scalar(select(User).where(User.telegram_id == telegram_id))

    def upsert_from_telegram(self, data: TelegramAuthData) -> User:
        """Crée l'utilisateur au premier login, sinon rafraîchit ses champs volatils."""
        user = self.get_by_telegram_id(data.id)
        if user is None:
            user = User(telegram_id=data.id, role="user")
            self.db.add(user)

        user.username = data.username
        user.first_name = data.first_name
        user.last_name = data.last_name
        user.photo_url = data.photo_url

        self.db.commit()
        self.db.refresh(user)
        return user
