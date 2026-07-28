import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base

class ApoLog(Base):
    __tablename__ = "api_log"

    id = Column(UUID(as_uuid=True), primary_key=True , default=uuid.uuid4)
    analysis_id = Column(
        UUID(as_uuid=True),
        ForeignKey("analysis.id", ondelete="CASCADE"),
    )
    api_source = Column(String(100))
    status = Column(String(50),nullable=False)
    error_message = Column(Text)
    payload = Column(JSONB)
    call_date = Column(DateTime(timezone=True), server_default=func.now(),nullable=False)

    analysis = relationship("Analysis", back_populates="api_logs")