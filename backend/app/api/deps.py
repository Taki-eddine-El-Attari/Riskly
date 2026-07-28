from fastapi import Depends, Request, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.repositories.user_repo import UserRepository
from app.models.user import User

def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    user_id = request.session.get("user_id")
    if user_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Non authentifié")

    user = UserRepository(db).get_by_id(user_id)
    if user is None:
        request.session.clear()   
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session invalide")
    return user