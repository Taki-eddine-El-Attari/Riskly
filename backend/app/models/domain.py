from datetime import date, datetime
from typing import List
from sqlalchemy import Date, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDPrimaryKeyMixin

class Domain(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "domain"
    domain_name: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    tld: Mapped[str] = mapped_column(String(20), nullable=False)
    country: Mapped[str] = mapped_column(String(100), nullable=True)
    domain_length: Mapped[int] = mapped_column(Integer, nullable=False)
    hyphen_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    whois_creation_date: Mapped[date] = mapped_column(Date, nullable=True)
    whois_expiration_date: Mapped[date] = mapped_column(Date, nullable=True)
    first_analysis: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    metrics: Mapped[List["DomainMetric"]] = relationship(
        back_populates="domain",
        cascade="all, delete-orphan",
        order_by="DomainMetric.calculated_at.desc()",
    )
    traffic_history: Mapped[List["TrafficHistory"]] = relationship(
        back_populates="domain",
        cascade="all, delete-orphan",
        order_by="TrafficHistory.day_date.desc()",
    )
    reputation_events: Mapped[List["ReputationEvent"]] = relationship(
        back_populates="domain",
        cascade="all, delete-orphan",
    )
    acquisition_results: Mapped[List["AcquisitionResult"]] = relationship(
        back_populates="domain",
        cascade="all, delete-orphan",
    )
    analyses: Mapped[List["Analysis"]] = relationship(
        back_populates="domain",
        cascade="all, delete-orphan",
        order_by="Analysis.requested_at.desc()",
    )

