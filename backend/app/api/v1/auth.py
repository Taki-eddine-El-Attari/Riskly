from fastapi import APIRouter, Depends, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.user import UserRead, UserRegister
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)) -> UserRead:
    user = auth_service.register(db, payload)
    return UserRead.model_validate(user)


@router.post("/login", response_model=UserRead)
def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> UserRead:
    user = auth_service.login(
        db, response, email=form_data.username, password=form_data.password
    )
    return UserRead.model_validate(user)