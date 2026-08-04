from __future__ import annotations

import enum
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.analysis import Analysis, AnalysisStatus
from app.models.base import utcnow

logger = logging.getLogger(__name__)


class CacheBypass(str, enum.Enum):

    DISABLED = "cache desactive (ANALYSIS_CACHE_TTL_HOURS <= 0)"
    FORCED = "rafraichissement explicite demande (force_refresh)"
    WARMUP_ATTACHED = "CSV de warm-up joint : le resultat depend du fichier"
    MISS = "aucune analyse terminee dans la fenetre de fraicheur"


def ttl() -> timedelta:
    
    return timedelta(hours=settings.ANALYSIS_CACHE_TTL_HOURS)


def is_enabled() -> bool:
    return settings.ANALYSIS_CACHE_TTL_HOURS > 0


def cutoff(now: Optional[datetime] = None) -> datetime:
    return (now or utcnow()) - ttl()


def age(analysis: Analysis, now: Optional[datetime] = None) -> Optional[timedelta]:

    if analysis.completed_at is None:
        return None
    completed = analysis.completed_at
    if completed.tzinfo is None:
        completed = completed.replace(tzinfo=timezone.utc)
    return (now or utcnow()) - completed


def is_fresh(analysis: Analysis, now: Optional[datetime] = None) -> bool:
    if analysis.status is not AnalysisStatus.COMPLETED:
        return False
    current_age = age(analysis, now=now)
    return current_age is not None and current_age <= ttl()


def find_fresh_analysis(
    db: Session,
    domain_id: uuid.UUID,
    user_id: Optional[uuid.UUID] = None,
) -> Optional[Analysis]:

    query = db.query(Analysis).filter(
        Analysis.domain_id == domain_id,
        Analysis.status == AnalysisStatus.COMPLETED,
        Analysis.completed_at.is_not(None),
        Analysis.completed_at >= cutoff(),
    )

    if settings.ANALYSIS_CACHE_SCOPE != "global" and user_id is not None:
        query = query.filter(Analysis.user_id == user_id)

    return query.order_by(Analysis.completed_at.desc()).first()


def get_cached_analysis(
    db: Session,
    domain_id: uuid.UUID,
    user_id: Optional[uuid.UUID] = None,
    *,
    has_warmup: bool = False,
    force_refresh: bool = False,
    domain_name: str = "",
) -> Optional[Analysis]:

    label = domain_name or str(domain_id)

    if not is_enabled():
        _log_bypass(label, CacheBypass.DISABLED)
        return None
    if force_refresh:
        _log_bypass(label, CacheBypass.FORCED)
        return None
    if has_warmup:
        _log_bypass(label, CacheBypass.WARMUP_ATTACHED)
        return None

    hit = find_fresh_analysis(db, domain_id=domain_id, user_id=user_id)
    if hit is None:
        _log_bypass(label, CacheBypass.MISS)
        return None

    hit_age = age(hit)
    logger.info(
        "[%s] cache HIT -> analyse %s (%s d'anciennete, TTL %sh)",
        label, hit.id, _humanize(hit_age), settings.ANALYSIS_CACHE_TTL_HOURS,
    )
    return hit


def _log_bypass(label: str, reason: CacheBypass) -> None:
    logger.info("[%s] cache MISS -> %s", label, reason.value)


def _humanize(delta: Optional[timedelta]) -> str:
    if delta is None:
        return "inconnue"
    minutes = int(delta.total_seconds() // 60)
    if minutes < 60:
        return f"{minutes} min"
    return f"{minutes // 60} h {minutes % 60:02d}"
