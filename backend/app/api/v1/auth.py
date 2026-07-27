from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import TelegramAuthData, UserLogin, UserRead, UserRegister
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    return AuthService(db)


# --- Auth locale (username / mot de passe) -----------------------------------
@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(
    payload: UserRegister,
    svc: AuthService = Depends(get_auth_service),
) -> User:
    return svc.register(payload.name, payload.password)


@router.post("/login", response_model=UserRead)
def login(
    payload: UserLogin,
    request: Request,
    svc: AuthService = Depends(get_auth_service),
) -> User:
    return svc.login(request, payload.name, payload.password)


# --- Auth Telegram (Login Widget) --------------------------------------------
@router.post("/telegram", response_model=UserRead)
def login_telegram(
    data: TelegramAuthData,
    request: Request,
    svc: AuthService = Depends(get_auth_service),
) -> User:
    return svc.authenticate_telegram(request, data)


# --- Commun ------------------------------------------------------------------
@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    svc: AuthService = Depends(get_auth_service),
) -> None:
    svc.logout(request)
