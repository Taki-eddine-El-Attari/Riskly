import uuid

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import AuthenticationError
from app.models.user import User


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    user_id = request.session.get("user_id")
    if user_id is None:
        raise AuthenticationError("Non authentifié.")

    user = db.query(User).filter(User.id == uuid.UUID(str(user_id))).first()
    if user is None:
        raise AuthenticationError("Utilisateur associé au token introuvable.")

    return user