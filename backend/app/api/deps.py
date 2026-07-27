"""Dépendances FastAPI partagées par les endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import Cookie, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.services.auth_service import AuthService


def get_auth_service(db: Annotated[Session, Depends(get_db)]) -> AuthService:
    return AuthService(db)


def get_current_user(
    auth: Annotated[AuthService, Depends(get_auth_service)],
    session_token: Annotated[str | None, Cookie(alias=settings.cookie_name)] = None,
) -> User:
    """Exige une session valide (cookie HttpOnly). Renvoie 401 sinon."""
    return auth.user_from_session(session_token)
