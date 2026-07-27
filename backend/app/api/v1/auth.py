"""Endpoints d'authentification Telegram."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from app.api.deps import get_auth_service, get_current_user
from app.core.config import settings
from app.models.user import User
from app.schemas.user import AuthResponse, TelegramAuthData, UserRead
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.cookie_name,
        value=token,
        max_age=settings.cookie_max_age,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/",
    )


@router.post("/telegram", response_model=AuthResponse)
def login_telegram(
    data: TelegramAuthData,
    response: Response,
    auth: Annotated[AuthService, Depends(get_auth_service)],
) -> AuthResponse:
    """Login/register via le Login Widget Telegram : vérifie, upsert, pose le cookie."""
    user, token = auth.authenticate_telegram(data)
    _set_session_cookie(response, token)
    return AuthResponse(user=UserRead.from_model(user))


@router.get("/me", response_model=UserRead)
def me(user: Annotated[User, Depends(get_current_user)]) -> UserRead:
    """Utilisateur de la session courante (via le cookie)."""
    return UserRead.from_model(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    """Efface le cookie de session."""
    response.delete_cookie(settings.cookie_name, path="/")
