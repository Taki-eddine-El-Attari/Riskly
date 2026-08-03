import enum
import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import DateTime, Enum, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDPrimaryKeyMixin, utcnow

class AnalysisStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"

class AnalysisVerdict(str, enum.Enum):
    BON_ACHAT = "Bon achat"
    RISQUE = "Risque"
    A_EVITER = "A eviter"

# `Enum(SomePyEnum)` sérialise par `.name` (ex. "RISQUE") par défaut, pas par
# `.value` — `values_callable` force l'usage de `.value` pour matcher les
# valeurs déjà présentes en base (colonnes varchar, contrainte CHECK sur
# `verdict` avec les libellés exacts "Bon achat"/"Risque"/"A eviter").
def _enum_values(enum_cls):
    return [e.value for e in enum_cls]

class Analysis(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "analysis"
    status: Mapped[AnalysisStatus] = mapped_column(
        Enum(AnalysisStatus, name="analysis_status", values_callable=_enum_values),
        nullable=False,
        default=AnalysisStatus.PENDING,
    )
    profitability_score: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    risk_score: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    authority_score: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    # Sortie brute du modèle de warm-up. NULL = aucun CSV fourni, le modèle
    # n'a pas tourné (à distinguer d'un score de 0, qui serait un vrai résultat).
    email_health_score: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    verdict: Mapped[Optional[AnalysisVerdict]] = mapped_column(
        Enum(AnalysisVerdict, name="analysis_verdict", values_callable=_enum_values),
        nullable=True,
    )

    shap_values: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    domain_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("domain.id"), nullable=False
    )

    domain_metric_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("domain_metric.id"), nullable=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    model_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("model.id"), nullable=True
    )

    domain: Mapped["Domain"] = relationship(back_populates="analyses")
    domain_metric: Mapped[Optional["DomainMetric"]] = relationship(back_populates="analyses")
    user: Mapped["User"] = relationship(back_populates="analyses")
    model: Mapped[Optional["Model"]] = relationship(back_populates="analyses")

    api_logs: Mapped[List["ApiLog"]] = relationship(
        back_populates="analysis",
        cascade="all, delete-orphan",
        order_by="ApiLog.call_date.desc()",
    )

    # CSV de warm-up joint à la demande (0 ou 1). Supprimé avec l'analyse ;
    # le fichier sur disque est nettoyé par le service de stockage.
    warmup_file: Mapped[Optional["WarmupFile"]] = relationship(
        back_populates="analysis",
        uselist=False,
        cascade="all, delete-orphan",
    )

