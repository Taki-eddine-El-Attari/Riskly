import uuid
from datetime import datetime
from typing import Optional
from enum import Enum
from pydantic import BaseModel, Field, field_validator, ConfigDict

from app.schemas.domain import DomainOut

MAX_DOMAINS_PER_BATCH = 5


class AnalysisStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"


class Verdict(str, Enum):
    BON_ACHAT = "Bon achat"
    RISQUE = "Risque"
    A_EVITER = "A eviter"


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

    verdict: Optional[Verdict] = None
    shap_values: Optional[list[ShapFactor]] = None

    requested_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    domain: Optional[DomainOut] = None


class AnalysisBatchResponse(BaseModel):
    results: list[AnalysisOut]
    failed_domains: list[str] = Field(default_factory=list)


class AnalysisSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    domain_name: str
    risk_score: Optional[float] = None
    authority_score: Optional[float] = None
    verdict: Optional[Verdict] = None
    requested_at: Optional[datetime] = None
    status: Optional[AnalysisStatus] = None