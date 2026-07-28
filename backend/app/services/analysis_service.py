from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import LimiteConcurrenceAtteinteError
from app.repositories.domain_repo import DomainRepository
from app.repositories.analysis_repo import AnalysisRepository
from app.models.features import DomainMetric
from app.models.analysis import Analysis
from app.models.api_log import ApiLog
from app.models.user import User
from app.collectors.rank import RankCollector
from app.collectors.backlinks import BacklinksCollector
from app.services.scoring_service import calculate_authority_score
from app.services.decision_matrix import compute_verdict

async def analyze_domain(
    db: Session,
    domain_name: str,
    user_id: Optional[UUID] = None,
) -> Analysis:

    if user_id is not None :
        analysis_repo = AnalysisRepository(db)
        active_count = analysis_repo.count_active_by_user(user_id)
        if active_count >= settings.MAX_CONCURRENT_ANALYSES:
          raise LimiteConcurrenceAtteinteError(settings.MAX_CONCURRENT_ANALYSES)
    domain_name = domain_name.lower().strip()
    domain_repo = DomainRepository(db)
    domain = domain_repo.get_or_create(domain_name)

    rank_collector = RankCollector()
    backlinks_collector = BacklinksCollector()

    rank_data = await rank_collector.collect(domain_name)
    backlinks_data = await backlinks_collector.collect(domain_name)

    

    metric = DomainMetric(
        domain_id=domain.id,
        rank_value=rank_data.rank_value,
        rank_source=rank_data.rank_source,
        backlink_count=backlinks_data.backlink_count,
        referring_domains_count=backlinks_data.referring_domains_count,
        toxic_backlink_ratio=backlinks_data.toxic_backlink_ratio,
    )
    db.add(metric)
    db.commit()
    db.refresh(metric)

    
    authority_score = calculate_authority_score(
        rank_value=rank_data.rank_value,
        backlink_ratio=getattr(backlinks_data, "quality_estimate", None),
        whois_creation_date=domain.whois_creation_date,
    )

  
    risk_score = None
    shap_values = None

    
    verdict = compute_verdict(risk_score, authority_score) if risk_score is not None else None

    alerts = _evaluate_alerts(rank_data, metric)

    status = "partial" if risk_score is None else "completed"

    analysis = Analysis(
        user_id=user_id,
        domain_id=domain.id,
        domain_metric_id=metric.id,
        status=status,
        risk_score=risk_score,
        authority_score=authority_score,
        verdict=verdict,
        shap_values=shap_values,
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    await _log_collector_result(db, analysis.id, "rank", rank_data)
    await _log_collector_result(db, analysis.id, "backlinks", backlinks_data)

    return analysis


def _evaluate_alerts(rank_data, metric: DomainMetric) -> list[dict]:
  
    alerts = []

    if rank_data.rank_value == 0:
        alerts.append({
            "feature": "authority",
            "condition": "rank = 0",
            "message": "Aucune autorite detectee",
        })

    if metric.is_blacklisted:
        alerts.append({
            "feature": "blacklist",
            "condition": "is_blacklisted = true",
            "message": "Domaine actuellement blackliste",
        })

    return alerts


async def _log_collector_result(db: Session, analysis_id: UUID, source: str, data) -> None:
    a_echoue = data.raw_response is not None and "error" in (data.raw_response or {})
    log = ApiLog(
        analysis_id=analysis_id,
        api_source=source,
        status="echec" if a_echoue else "succes",
        error_message=data.raw_response.get("error") if a_echoue else None,
        payload=data.raw_response,
    )
    db.add(log)
    db.commit()