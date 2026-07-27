import uuid
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.exceptions import AnalysisNotFoundError, InvalidAnalysisReferenceError
from app.models.analysis import Analysis, AnalysisStatus, AnalysisVerdict
from app.models.api_log import ApiLog
from app.models.base import utcnow


def create_analysis(db: Session, domain_id: uuid.UUID, user_id: uuid.UUID) -> Analysis:
    analysis = Analysis(
        status=AnalysisStatus.PENDING,
        domain_id=domain_id,
        user_id=user_id,
    )
    db.add(analysis)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise InvalidAnalysisReferenceError(
            domain_id=str(domain_id), user_id=str(user_id)
        ) from exc
    return analysis


def get_analysis_by_id(db: Session, analysis_id: uuid.UUID) -> Analysis:
    analysis = db.get(Analysis, analysis_id)
    if analysis is None:
        raise AnalysisNotFoundError(analysis_id=str(analysis_id))
    return analysis


def update_analysis_status(db: Session, analysis_id: uuid.UUID, status: AnalysisStatus) -> Analysis:
    analysis = get_analysis_by_id(db, analysis_id)
    analysis.status = status
    db.flush()
    return analysis


def complete_analysis(
    db: Session,
    analysis_id: uuid.UUID,
    domain_metric_id: uuid.UUID,
    model_id: uuid.UUID,
    profitability_score: float,
    risk_score: float,
    authority_score: float,
    verdict: AnalysisVerdict,
    shap_values: dict,
) -> Analysis:
    analysis = get_analysis_by_id(db, analysis_id)
    analysis.domain_metric_id = domain_metric_id
    analysis.model_id = model_id
    analysis.profitability_score = profitability_score
    analysis.risk_score = risk_score
    analysis.authority_score = authority_score
    analysis.verdict = verdict
    analysis.shap_values = shap_values
    analysis.status = AnalysisStatus.COMPLETED
    analysis.completed_at = utcnow()
    db.flush()
    return analysis


def fail_analysis(db: Session, analysis_id: uuid.UUID, error_message: Optional[str] = None) -> Analysis:
    analysis = get_analysis_by_id(db, analysis_id)
    analysis.status = AnalysisStatus.FAILED
    analysis.completed_at = utcnow()
    if error_message:
        db.add(
            ApiLog(
                analysis_id=analysis_id,
                api_source="analysis_pipeline",
                status="failed",
                error_message=error_message,
            )
        )
    db.flush()
    return analysis


def list_analyses_by_user(
    db: Session, user_id: uuid.UUID, limit: int = 50, offset: int = 0
) -> List[Analysis]:
    stmt = (
        select(Analysis)
        .where(Analysis.user_id == user_id)
        .order_by(Analysis.requested_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(db.scalars(stmt).all())