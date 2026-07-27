import uuid
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.models.base import Base


class Model(Base):
    __tablename__ = "model"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    version = Column(String(50))
    algorithm = Column(String(100))
    metrics = Column(JSONB)
    artifact_path = Column(String(255))
    is_active = Column(Boolean, default=True)
    training_date = Column(DateTime(timezone=True))

    analyses = relationship("Analysis", back_populates="model")