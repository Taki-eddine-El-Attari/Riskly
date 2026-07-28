import uuid
from sqlalchemy import Column, Date, Boolean, Integer, DECIMAL, ForeignKey, DateTime ,Column
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base


class AcquisitionResult(Base):
    __tablename__ = "acquisition_result"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    domain_id = Column(
        UUID(as_uuid=True),
        ForeignKey("domain.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    acquisition_date = Column(Date)
    price_paid = Column(DECIMAL(10, 2))
    go_live_date = Column(Date)
    volume_sent_90d = Column(Integer)
    bounce_rate_90d = Column(DECIMAL(5, 2))
    was_blacklisted_90d = Column(Boolean)
    success_label = Column(Boolean , nullable=False)
    observed_roi = Column(DECIMAL(6, 2))

    domain = relationship("Domain", back_populates="acquisition_result")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    domain = relationship("Domain", back_populates="acquisition_result")


    