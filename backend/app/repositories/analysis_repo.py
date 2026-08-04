import uuid
from datetime import datetime, timedelta
from typing import Any, List, Optional
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

class _AnalysisLruCache:
    def __init__(self, maxsize: int = 128, ttl_seconds: int = 300):
        self._cache: dict[str, tuple[Any, datetime]] = {}
        self._maxsize = maxsize
        self._ttl = timedelta(seconds=ttl_seconds)

    def _now(self) -> datetime:
        return utcnow()

    def _is_expired(self, timestamp: datetime) -> bool:
        return (self._now() - timestamp) > self._ttl

    def _evict_if_needed(self) -> None:
        expired_keys = [
            k for k, (_, ts) in self._cache.items()
            if self._is_expired(ts)
        ]
        for k in expired_keys:
            del self._cache[k]

        if len(self._cache) >= self._maxsize:
            oldest = next(iter(self._cache))
            del self._cache[oldest]
    def get(self, key: str) -> Optional[Any]:
        self._evict_if_needed()
        entry = self._cache.get(key)
        if entry is None:
            return None
        value, timestamp = entry
        if self._is_expired(timestamp):
            del self._cache[key]
            return None        
        del self._cache[key]
        self._cache[key] = (value, self._now())
        return value

    def set(self, key: str, value: Any) -> None:
        self._evict_if_needed()
        self._cache[key] = (value, self._now())

    def invalidate(self, key_prefix: Optional[str] = None) -> None:    

        if key_prefix is None :
            self._cache.clear()
            return
        keys_to_delete = [k for k in self._cache if k.startswith(key_prefix)]
        for k in keys_to_delete:
            del self._cache[k]
    def invalidate_analysis(self, analysis_id: uuid.UUID) -> None:
        str_id = str(analysis_id)
        keys_to_delete = [
            k for k in self._cache
            if str_id in k or k.startswith("list:") or k.startswith("count:")
        ]
        for k in keys_to_delete:
            del self._cache[k]

     

class AnalysisRepository:
    def __init__(self, db: Session, cache_maxsize: int = 128):
        self.db = db
        self._cache = _AnalysisLruCache(maxsize=cache_maxsize)

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
        self._cache.invalidate(f"list:user:{user_id}")
        self._cache.invalidate(f"count:user:{user_id}")
        return analysis

    def update_status(self, analysis_id: uuid.UUID, status: AnalysisStatus) -> Analysis:
        analysis = self._require(analysis_id)
        analysis.status = status
        self.db.flush()
        self._cache.invalidate_analysis(analysis_id)
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
        self._cache.invalidate_analysis(analysis_id)
        return analysis

    def fail(self, analysis_id: uuid.UUID) -> Analysis:
        analysis = self._require(analysis_id)
        analysis.status = AnalysisStatus.FAILED
        analysis.completed_at = utcnow()
        self.db.flush()
        
        self._cache.invalidate_analysis(analysis_id)
        return analysis

    def delete(self, analysis_id: uuid.UUID) -> bool:
        analysis = self.get_by_id(analysis_id)
        if analysis is None:
            return False

        user_id = analysis.user_id   

        self.db.delete(analysis)
        self.db.commit()

        self._cache.invalidate_analysis(analysis_id)
        self._cache.invalidate(f"list:user:{user_id}")
        self._cache.invalidate(f"count:user:{user_id}")  
        return True

    def get_by_id(self, analysis_id: uuid.UUID, use_cache: bool = True) -> Optional[Analysis]:
        cache_key = f"analysis:{analysis_id}"
        if use_cache:
            cached = self._cache.get(cache_key)
            if cached is not None:
                return cached

        result = self.db.get(Analysis, analysis_id)
        if result and use_cache:
            self._cache.set(cache_key, result)
        return result    

    def get_by_user(
        self,
        user_id: uuid.UUID,
        skip: int = 0,
        limit: int = 50,
        sort_by: str = "requested_at",
        order: str = "desc",
        verdict: Optional[str] = None,
        use_cache: bool = True
    ) -> List[Analysis]:
        cache_key =f"list:user:{user_id}:skip:{skip}:limit:{limit}:sort_by:{sort_by}:order:{order}:verdict:{verdict}"

        if use_cache:
            cached = self._cache.get(cache_key)
            if cached is not None:
                return cached


        query = self.db.query(Analysis).filter(Analysis.user_id == user_id)
        query = self._filter_by_verdict(query, verdict)
        query = self._sorted(query, sort_by, order)
        result = query.offset(skip).limit(limit).all()
        if use_cache:
            self._cache.set(cache_key, result)
        return result

    def count_by_user(self, user_id: uuid.UUID, verdict: Optional[str] = None,use_cache: bool = True) -> int:

        cache_key = f"count:user:{user_id}:verdict:{verdict}"
        if use_cache:
            cached = self._cache.get(cache_key)
            if cached is not None:
                return cached
        query = self.db.query(Analysis).filter(Analysis.user_id == user_id)
        result = self._filter_by_verdict(query, verdict).count()

        if use_cache:
            self._cache.set(cache_key, result)
        return result
    
    def get_verdict_breakdown(self, user_id: uuid.UUID,use_cache:bool = True) -> dict:

        cache_key = f"verdict_breakdown:user:{user_id}"
        if use_cache:
            cached = self._cache.get(cache_key)
            if cached is not None:
                return cached

        results = (
            self.db.query(Analysis.verdict, func.count(Analysis.id))
            .filter(Analysis.user_id == user_id)
            .group_by(Analysis.verdict)
            .all()
        )
        result = {(v.value if v else "inconnu"): count for v, count in results}
        if use_cache:
            self._cache.set(cache_key, result)
        return result

    def count_last_30_days(self, user_id: uuid.UUID , use_cache: bool = True) -> int:
        cache_key = f"count:last_30_days:user:{user_id}"
        if use_cache:
            cached = self._cache.get(cache_key)
            if cached is not None:
                return cached

        cutoff = utcnow() - timedelta(days=30)
        result = (
            self.db.query(Analysis)
            .filter(Analysis.user_id == user_id, Analysis.requested_at >= cutoff)
            .count()
        )
        if use_cache:
            self._cache.set(cache_key, result)
        return result

    def get_all(
        self, skip: int = 0, limit: int = 50, user_id: Optional[uuid.UUID] = None, use_cache: bool = False
    ) -> List[Analysis]:
        query = self.db.query(Analysis)
        if user_id is not None:
            query = query.filter(Analysis.user_id == user_id)
        if use_cache:
            cache_key = f"list:all:skip:{skip}:limit:{limit}:user_id:{user_id}"
            cached = self._cache.get(cache_key)
            if cached is not None:
                return cached
        result = query.order_by(Analysis.requested_at.desc()).offset(skip).limit(limit).all()
        if use_cache:
            self._cache.set(cache_key, result)
        return result

    def count_all(self, user_id: Optional[uuid.UUID] = None) -> int:
        query = self.db.query(Analysis)
        if user_id is not None:
            query = query.filter(Analysis.user_id == user_id)
        return query.count()


    def count_active_by_user(self, user_id: uuid.UUID, use_cache: bool = True) -> int:
        cache_key = f"count:active:user:{user_id}"
        if use_cache:
            cached = self._cache.get(cache_key)
            if cached is not None:
                return cached
        result = (
            self.db.query(Analysis)
            .filter(Analysis.user_id == user_id, Analysis.status.in_(ACTIVE_STATUSES))
            .count()
        )
        if use_cache:
            self._cache.set(cache_key, result)
        return result
    
    def _require(self, analysis_id: uuid.UUID) -> Analysis:
        analysis = self.get_by_id(analysis_id, use_cache=False)
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

    def cache_stats(self) -> dict:
        
        return {
            "size": len(self._cache._cache),
            "maxsize": self._cache._maxsize,
            "ttl_seconds": self._cache._ttl.total_seconds(),
            "keys": list(self._cache._cache.keys())[:10], 
        }

    def cache_clear(self) -> None:
        
        self._cache.invalidate()