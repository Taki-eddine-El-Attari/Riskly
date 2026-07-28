import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base

class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(String(64), primary_key=True, default=lambda: uuid.uuid4().hex)
    user_id = Column(ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    user_agent = Column(String(255), nullable=True)
    ip_address = Column(String(45), nullable=True)

    user = relationship("User")