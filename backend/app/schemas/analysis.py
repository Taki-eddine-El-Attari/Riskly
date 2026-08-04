import uuid
from datetime import datetime
from typing import Optional
from enum import Enum
from pydantic import BaseModel, Field, field_validator, ConfigDict

from app.schemas.domain import DomainOut, DomainMetricOut
from app.schemas.warmup import WarmupSummary

MAX_DOMAINS_PER_BATCH = 5


class AnalysisStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class Verdict(str, Enum):
    BON_ACHAT = "Bon achat"
    RISQUE = "Risque"
    A_EVITER = "A eviter"


class VerdictFilter(str, Enum):
    BON_ACHAT = "bon_achat"
    RISQUE = "risque"
    A_EVITER = "a_eviter"


VERDICT_FILTER_TO_STORED: dict["VerdictFilter", Verdict] = {
    VerdictFilter.BON_ACHAT: Verdict.BON_ACHAT,
    VerdictFilter.RISQUE: Verdict.RISQUE,
    VerdictFilter.A_EVITER: Verdict.A_EVITER,
}


class AnalysisCreate(BaseModel):
    domain_name: str = Field(..., min_length=1, max_length=255)


class AnalysisBatchCreate(BaseModel):
    domains: list[str] = Field(..., min_length=1, max_length=MAX_DOMAINS_PER_BATCH)

    @field_validator("domains")
    @classmethod
    def validate_domains(cls, v: list[str]) -> list[str]:
        seen = set()
        result = []
        for domain in v:
            domain = domain.lower().strip()
            if domain and domain not in seen:
                seen.add(domain)
                result.append(domain)
        return result


class ShapFactor(BaseModel):
    feature: str
    value: float
    contribution: float


class AnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: Optional[AnalysisStatus] = None

    risk_score: Optional[float] = Field(None, ge=0, le=100)
    authority_score: Optional[float] = Field(None, ge=0, le=100)
    profitability_score: Optional[float] = Field(None, ge=0, le=100)
    email_health_score: Optional[float] = Field(None, ge=0, le=100)

    verdict: Optional[Verdict] = None
    shap_values: Optional[list[ShapFactor]] = None

    requested_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    is_cached: bool = False
    cache_age_minutes: Optional[int] = None

    domain: Optional[DomainOut] = None
    metric: Optional[DomainMetricOut] = Field(None, validation_alias="domain_metric")
    # Idem pour `warmup_file` → `warmup` (types/analysis.ts::Analysis.warmup).
    warmup: Optional[WarmupSummary] = Field(None, validation_alias="warmup_file")


class AnalysisBatchResponse(BaseModel):
    results: list[AnalysisOut]
    failed_domains: list[str] = Field(default_factory=list)


class AnalysisSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    domain_name: str
    risk_score: Optional[float] = None
    authority_score: Optional[float] = None
    profitability_score: Optional[float] = None
    email_health_score: Optional[float] = None
    verdict: Optional[Verdict] = None
    requested_at: Optional[datetime] = None
    status: Optional[AnalysisStatus] = None
    warmup: Optional[WarmupSummary] = None


class AnalysisList(BaseModel):
    items: list[AnalysisSummary]
    total: int
    page: int
    page_size: int