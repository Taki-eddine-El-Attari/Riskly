from __future__ import annotations

import asyncio
import csv
import dataclasses
import io
import logging
from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import LimiteConcurrenceAtteinteError, PredictionError
from app.repositories.domain_repo import DomainRepository
from app.repositories.analysis_repo import AnalysisRepository
from app.repositories import warmup_repo
from app.models.features import DomainMetric
from app.models.analysis import Analysis, AnalysisVerdict
from app.models.api_log import ApiLog
from app.collectors.rank import RankCollector
from app.collectors.backlinks import BacklinksCollector
from app.collectors.whois_rdap import WhoisCollector
from app.collectors.blacklist import BlacklistCollector
from app.collectors.network import GeoCollector, NameserverCollector
from app.services import warmup_storage_service as storage
from app.services.scoring_service import quick_score
from app.services.decision_matrix import Verdict as ScoringVerdict
from app.core import cache

logger = logging.getLogger(__name__)

# Le moteur de décision distingue 4 niveaux, la base n'en a que 3 : un domaine
# "pas rentable" et un domaine "dangereux" (veto sécurité) finissent tous les
# deux "à éviter" pour l'utilisateur.
_VERDICT_MAP = {
    ScoringVerdict.WORTH_BUYING: AnalysisVerdict.BON_ACHAT,
    ScoringVerdict.RISKY: AnalysisVerdict.RISQUE,
    ScoringVerdict.NOT_WORTH_IT: AnalysisVerdict.A_EVITER,
    ScoringVerdict.DANGEROUS: AnalysisVerdict.A_EVITER,
}


async def analyze_domain(
    db: Session,
    domain_name: str,
    user_id: Optional[UUID] = None,
    warmup_file: Optional[UploadFile] = None,
    force_refresh: bool = False,
) -> Analysis:
    analysis_repo = AnalysisRepository(db)

    domain_name = domain_name.lower().strip()
    domain_repo = DomainRepository(db)
    domain = domain_repo.get_or_create(domain_name)

    cached = cache.get_cached_analysis(
        db, domain_id=domain.id, user_id=user_id,
        has_warmup=warmup_file is not None,
        force_refresh=force_refresh,
        domain_name=domain_name,
    )
    if cached is not None:
        hit_age = cache.age(cached)
        cached.is_cached = True
        cached.cache_age_minutes = int(hit_age.total_seconds() // 60) if hit_age else None
        return cached

    if user_id is not None:
        active_count = analysis_repo.count_active_by_user(user_id)
        if active_count >= settings.MAX_CONCURRENT_ANALYSES:
            raise LimiteConcurrenceAtteinteError(settings.MAX_CONCURRENT_ANALYSES)

    analysis = analysis_repo.create(domain_id=domain.id, user_id=user_id)

    traffic_rows = None
    warmup_bytes: Optional[bytes] = None
    if warmup_file is not None:
        warmup_bytes = await warmup_file.read()
        traffic_rows = _parse_traffic_csv(warmup_bytes, domain_name)
        logger.info(
            "[%s] warmup_csv recu: %s octets -> %s ligne(s) exploitable(s)",
            domain_name, len(warmup_bytes), len(traffic_rows) if traffic_rows else 0,
        )

    try:
        whois, blacklist, rank_data, backlinks_data, geo, nameservers = await _collect_all(
            domain_name
        )

        logger.info(
            "[%s] whois=%s blacklist=%s rank=%s backlink=%s country=%s ns=%s",
            domain_name,
            "ok" if whois else "echec",
            blacklist.is_blacklisted if blacklist else "echec",
            rank_data.rank_value,
            backlinks_data.backlink_count,
            geo.country,
            nameservers.count,
        )

        domain_repo.update_static_fields(
            domain_id=domain.id,
            tld=domain_name.rsplit(".", 1)[-1] if "." in domain_name else None,
            country=geo.country,
            domain_length=len(domain_name),
            hyphen_count=domain_name.count("-"),
            whois_creation_date=whois.whois_creation_date if whois else None,
            whois_expiration_date=whois.whois_expiration_date if whois else None,
        )
        domain = domain_repo.get_by_id(domain.id)

        domain_age_days = None
        if whois and whois.whois_creation_date:
            domain_age_days = (date.today() - whois.whois_creation_date).days

        domain_info = {
            "domain_name": domain_name,
            "tld": domain.tld,
            "country": domain.country,
            "domain_length": domain.domain_length,
            "hyphen_count": domain.hyphen_count,
            "domain_age": domain_age_days or 0,
            "rank": rank_data.rank_value,
            "backlink": backlinks_data.backlink_count,
            "is_blacklisted": bool(blacklist.is_blacklisted) if blacklist else False,
            "ns_server_count": nameservers.count,
        }

        metric = DomainMetric(
            domain_id=domain.id,
            is_blacklisted=domain_info["is_blacklisted"],
            rank_value=rank_data.rank_value,
            rank_source=rank_data.rank_source,
            backlink_count=backlinks_data.backlink_count,
            referring_domains_count=backlinks_data.referring_domains_count,
            nb_server_count=nameservers.count,
        )
        db.add(metric)
        db.flush()

        scoring = quick_score(domain_name, domain_info, traffic_rows=traffic_rows)
        decision = scoring.decision
        explanation = scoring.explanation

        if decision.verdict is ScoringVerdict.INSUFFICIENT_DATA:
            logger.info(
                "[%s] modele -> AUCUN VERDICT : %s (email_health=%s)",
                domain_name, decision.reason,
                "absent (aucun CSV warm-up)" if decision.email_was_missing
                else f"{decision.email_health_score * 100:.2f}",
            )
        else:
            logger.info(
                "[%s] modele -> verdict=%s risk=%.2f authority=%.2f email_health=%s "
                "profitability=%.2f",
                domain_name, decision.verdict.value, decision.malicious_prob * 100,
                decision.authority_score * 100,
                "absent (aucun CSV warm-up)" if decision.email_was_missing
                else f"{decision.email_health_score * 100:.2f}",
                decision.final_score * 100,
            )

        shap_values = None
        if explanation is not None:
            shap_values = [
                {
                    "feature": c.feature,
                    "value": float(c.value) if isinstance(c.value, (int, float)) else 0.0,
                    "contribution": c.shap_value,
                }
                for c in explanation.contributions
            ]

        # Aucun signal externe exploitable : on ne publie NI score de risque,
        # NI verdict. Les laisser à 0 afficherait "risque faible / à éviter"
        # avec l'aplomb d'une mesure, alors que rien n'a pu être mesuré.
        undecidable = decision.verdict is ScoringVerdict.INSUFFICIENT_DATA

        analysis_repo.complete(
            analysis_id=analysis.id,
            domain_metric_id=metric.id,
            model_id=None,
            profitability_score=None if undecidable else round(decision.final_score * 100, 2),
            risk_score=None if undecidable else round(decision.malicious_prob * 100, 2),
            authority_score=None if undecidable else round(decision.authority_score * 100, 2),
            # None (et non 0) quand aucun CSV n'a été fourni : le frontend
            # doit pouvoir distinguer "non évalué" de "évalué à zéro". Le
            # warm-up, lui, reste valide même sans signal externe.
            email_health_score=(
                None if decision.email_was_missing
                else round(decision.email_health_score * 100, 2)
            ),
            verdict=None if undecidable else _VERDICT_MAP[decision.verdict],
            shap_values=None if undecidable else shap_values,
        )

        await _log_collector_result(db, analysis.id, "rank", rank_data)
        await _log_collector_result(db, analysis.id, "backlinks", backlinks_data)
        await _log_result(db, analysis.id, "whois", whois is not None, _to_payload(whois))
        await _log_result(db, analysis.id, "blacklist", blacklist is not None, _to_payload(blacklist))
        await _log_result(db, analysis.id, "geo", geo.country is not None, _to_payload(geo))
        await _log_result(
            db, analysis.id, "nameservers", nameservers.count is not None, _to_payload(nameservers)
        )
        await _log_result(
            db, analysis.id, "model", True,
            {
                "verdict": decision.verdict.value,
                "risk_score": round(decision.malicious_prob * 100, 2),
                "authority_score": round(decision.authority_score * 100, 2),
                "profitability_score": round(decision.final_score * 100, 2),
            },
        )

    except Exception as exc:
        # `get_db()` fait un rollback sur toute exception qui remonte jusqu'à
        # la route : sans commit ici, l'analyse "échouée" disparaîtrait au
        # lieu de rester visible (avec son statut FAILED) dans l'historique.
        analysis_repo.fail(analysis.id)
        db.commit()
        raise PredictionError(f"Échec de l'analyse : {exc}") from exc

    if warmup_file is not None and warmup_bytes is not None:
        _attach_warmup(db, analysis.id, user_id, warmup_file, warmup_bytes)

    return analysis_repo.get_by_id(analysis.id)


async def _collect_all(domain_name: str):
    loop = asyncio.get_running_loop()
    whois_collector = WhoisCollector()
    blacklist_collector = BlacklistCollector()

    results = await asyncio.gather(
        loop.run_in_executor(None, whois_collector.fetch, domain_name),
        loop.run_in_executor(None, blacklist_collector.fetch, domain_name),
        RankCollector().collect(domain_name),
        BacklinksCollector().collect(domain_name),
        GeoCollector().collect(domain_name),
        NameserverCollector().collect(domain_name),
        return_exceptions=True,
    )
    whois_result, blacklist_result, rank_data, backlinks_data, geo, nameservers = results

    whois = None if isinstance(whois_result, Exception) else whois_result
    blacklist = None if isinstance(blacklist_result, Exception) else blacklist_result

    return whois, blacklist, rank_data, backlinks_data, geo, nameservers


def _parse_traffic_csv(raw: bytes, domain_name: str) -> Optional[list[dict]]:
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        return None

    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for row in reader:
        row = dict(row)
        # Ligne vide (uniquement des virgules) : frequent en fin de fichier
        # exporte depuis Excel/LibreOffice. `build_profitability_features`
        # se base sur la DERNIERE ligne pour predire : une ligne fantome sans
        # date y serait prise a la place de la vraie derniere journee.
        if not (row.get("day_date") or "").strip():
            continue
        row.setdefault("domain_name", domain_name)
        rows.append(row)
    return rows or None


def _attach_warmup(
    db: Session,
    analysis_id: UUID,
    user_id: Optional[UUID],
    warmup_file: UploadFile,
    content: bytes,
) -> None:
    try:
        stored = storage.store_warmup(io.BytesIO(content), warmup_file.filename or "")
        warmup_repo.create_warmup_file(
            db,
            analysis_id=analysis_id,
            user_id=user_id,
            original_name=(warmup_file.filename or "warmup.csv")[:255],
            content_type=warmup_file.content_type,
            size_bytes=stored.size_bytes,
            rows=stored.rows,
            object_key=stored.object_key,
            sha256=stored.sha256,
        )
    except Exception:
        # Le CSV de warm-up est une pièce jointe optionnelle : son échec ne
        # doit pas faire perdre l'analyse déjà calculée.
        pass


async def _log_collector_result(db: Session, analysis_id: UUID, source: str, data) -> None:
    raw_response = getattr(data, "raw_response", None)
    a_echoue = raw_response is not None and "error" in raw_response
    log = ApiLog(
        analysis_id=analysis_id,
        api_source=source,
        status="echec" if a_echoue else "succes",
        error_message=raw_response.get("error") if a_echoue else None,
        payload=raw_response,
    )
    db.add(log)
    db.flush()


def _to_payload(obj) -> Optional[dict]:
    if obj is None:
        return None
    if hasattr(obj, "model_dump"):
        return obj.model_dump(mode="json")
    if dataclasses.is_dataclass(obj):
        return dataclasses.asdict(obj)
    return None


async def _log_result(
    db: Session, analysis_id: UUID, source: str, success: bool, payload: Optional[dict]
) -> None:
    log = ApiLog(
        analysis_id=analysis_id,
        api_source=source,
        status="succes" if success else "echec",
        error_message=None if success else f"{source}: aucune donnee collectee",
        payload=payload,
    )
    db.add(log)
    db.flush()