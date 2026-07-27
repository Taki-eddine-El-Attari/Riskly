import uuid
from datetime import date, datetime
from typing import  Optional
from sqlalchemy import (
    Date,
    ForeignKey,
    Integer,
    Numeric,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDPrimaryKeyMixin, utcnow
class TrafficHistory(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "traffic_history"
    __table_args__ = (
        UniqueConstraint("domain_id", "day_date", name="uq_traffic_history_domain_day"),
    )

    day_date: Mapped[date] = mapped_column(Date, nullable=False)
    warmup_volume: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    send_volume: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    bounce_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    spam_complaint_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    open_rate: Mapped[Optional[float]] = mapped_column(Numeric(5, 4), nullable=True)
    reply_rate: Mapped[Optional[float]] = mapped_column(Numeric(5, 4), nullable=True)
    domain_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("domain.id"), nullable=False, index=True
    )
    domain: Mapped["Domain"] = relationship(back_populates="traffic_history")
 
