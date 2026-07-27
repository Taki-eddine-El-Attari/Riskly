import uuid
from datetime import date, datetime
from typing import  Optional
from sqlalchemy import (
    Date,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDPrimaryKeyMixin, utcnow

class ReputationEvent(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "reputation_event"
    source: Mapped[str] = mapped_column(String(100), nullable=False)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    detection_date: Mapped[date] = mapped_column(Date, nullable=False)
    exit_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    domain_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("domain.id"), nullable=False, index=True
    )
    domain: Mapped["Domain"] = relationship(back_populates="reputation_events")
 