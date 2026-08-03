import uuid
from datetime import timedelta
from typing import List, Optional
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.exceptions import AnalysisNotFoundError, InvalidAnalysisReferenceError
from app.models.analysis import Analysis, AnalysisStatus, AnalysisVerdict
from app.models.base import utcnow

SORTABLE_COLUMNS = {
    "requested_at": Analysis.requested_at,
    "risk_score": Analysis.risk_score,
    "authority_score": Analysis.authority_score,
}
ACTIVE_STATUSES = (AnalysisStatus.PENDING, AnalysisStatus.RUNNING)


class AnalysisRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, domain_id: uuid.UUID, user_id: uuid.UUID) -> Analysis:
        analysis = Analysis(
            status=AnalysisStatus.PENDING,
            domain_id=domain_id,
            user_id=user_id,
        )
        self.db.add(analysis)
        try:
            self.db.flush()
        except IntegrityError as exc:
            self.db.rollback()
            raise InvalidAnalysisReferenceError(
                domain_id=str(domain_id), user_id=str(user_id)
            ) from exc
        return analysis

    def get_by_id(self, analysis_id: uuid.UUID) -> Optional[Analysis]:
        return self.db.get(Analysis, analysis_id)

    def update_status(self, analysis_id: uuid.UUID, status: AnalysisStatus) -> Analysis:
        analysis = self._require(analysis_id)
        analysis.status = status
        self.db.flush()
        return analysis

    def complete(
        self,
        analysis_id: uuid.UUID,
        domain_metric_id: Optional[uuid.UUID],
        model_id: Optional[uuid.UUID],
        profitability_score: Optional[float],
        risk_score: float,
        authority_score: float,
        verdict: AnalysisVerdict,
        shap_values: Optional[list],
        email_health_score: Optional[float] = None,
    ) -> Analysis:
        analysis = self._require(analysis_id)
        analysis.domain_metric_id = domain_metric_id
        analysis.model_id = model_id
        analysis.profitability_score = profitability_score
        analysis.risk_score = risk_score
        analysis.authority_score = authority_score
        analysis.email_health_score = email_health_score
        analysis.verdict = verdict
        analysis.shap_values = shap_values
        analysis.status = AnalysisStatus.COMPLETED
        analysis.completed_at = utcnow()
        self.db.flush()
        return analysis

    def fail(self, analysis_id: uuid.UUID) -> Analysis:
        analysis = self._require(analysis_id)
        analysis.status = AnalysisStatus.FAILED
        analysis.completed_at = utcnow()
        self.db.flush()
        return analysis

    def get_by_user(
        self,
        user_id: uuid.UUID,
        skip: int = 0,
        limit: int = 50,
        sort_by: str = "requested_at",
        order: str = "desc",
        verdict: Optional[str] = None,
    ) -> List[Analysis]:
        query = self.db.query(Analysis).filter(Analysis.user_id == user_id)
        query = self._filter_by_verdict(query, verdict)
        query = self._sorted(query, sort_by, order)
        return query.offset(skip).limit(limit).all()

    def count_by_user(self, user_id: uuid.UUID, verdict: Optional[str] = None) -> int:
        query = self.db.query(Analysis).filter(Analysis.user_id == user_id)
        return self._filter_by_verdict(query, verdict).count()

    def get_verdict_breakdown(self, user_id: uuid.UUID) -> dict:
        results = (
            self.db.query(Analysis.verdict, func.count(Analysis.id))
            .filter(Analysis.user_id == user_id)
            .group_by(Analysis.verdict)
            .all()
        )
        return {(v.value if v else "inconnu"): count for v, count in results}

    def count_last_30_days(self, user_id: uuid.UUID) -> int:
        cutoff = utcnow() - timedelta(days=30)
        return (
            self.db.query(Analysis)
            .filter(Analysis.user_id == user_id, Analysis.requested_at >= cutoff)
            .count()
        )

    def get_all(
        self, skip: int = 0, limit: int = 50, user_id: Optional[uuid.UUID] = None
    ) -> List[Analysis]:
        query = self.db.query(Analysis)
        if user_id is not None:
            query = query.filter(Analysis.user_id == user_id)
        return query.order_by(Analysis.requested_at.desc()).offset(skip).limit(limit).all()

    def count_all(self, user_id: Optional[uuid.UUID] = None) -> int:
        query = self.db.query(Analysis)
        if user_id is not None:
            query = query.filter(Analysis.user_id == user_id)
        return query.count()

    def delete(self, analysis_id: uuid.UUID) -> bool:
        analysis = self.get_by_id(analysis_id)
        if analysis is None:
            return False
        self.db.delete(analysis)
        self.db.commit()
        return True

    def count_active_by_user(self, user_id: uuid.UUID) -> int:
        return (
            self.db.query(Analysis)
            .filter(Analysis.user_id == user_id, Analysis.status.in_(ACTIVE_STATUSES))
            .count()
        )

    def _require(self, analysis_id: uuid.UUID) -> Analysis:
        analysis = self.get_by_id(analysis_id)
        if analysis is None:
            raise AnalysisNotFoundError(analysis_id=str(analysis_id))
        return analysis

    def _filter_by_verdict(self, query, verdict: Optional[str]):
        if not verdict:
            return query
        return query.filter(Analysis.verdict == AnalysisVerdict(verdict))

    def _sorted(self, query, sort_by: str, order: str):
        column = SORTABLE_COLUMNS.get(sort_by, Analysis.requested_at)
        return query.order_by(column.asc() if order == "asc" else column.desc())
