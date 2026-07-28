from datetime import datetime
from sqlalchemy.orm import Session
from app.models.session import UserSession

def create(db: Session, user_id: int, expires_at: datetime, user_agent=None, ip_address=None) -> UserSession:
    session = UserSession(user_id=user_id, expires_at=expires_at,
                          user_agent=user_agent, ip_address=ip_address)
    db.add(session)
    db.flush()          
    return session

def get_valid(db: Session, session_id: str) -> UserSession | None:
    session = db.query(UserSession).filter(UserSession.id == session_id).first()
    if session is None or session.expires_at < datetime.utcnow():
        return None
    return session

def delete(db: Session, session_id: str) -> None:
    db.query(UserSession).filter(UserSession.id == session_id).delete()