
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from app.ml.explainer import Explanation, get_risk_explainer
from app.ml.predictor import get_profitability_predictor, get_risk_predictor
from app.services.decision_matrix import DecisionMatrixInput, DecisionResult, get_decision_matrix

logger = logging.getLogger(__name__)


@dataclass
class ScoringRequest:
    domain: str
    domain_info: Dict[str, Any]
    traffic_rows: Optional[List[Dict[str, Any]]] = None


@dataclass
class ScoringResponse:
    domain: str
    decision: DecisionResult
    explanation: Optional[Explanation] = None
    raw_predictions: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "domain": self.domain,
            "decision": self.decision.to_dict(),
            "explanation": self.explanation.to_dict() if self.explanation else None,
            "raw_predictions": self.raw_predictions,
        }


class ScoringService:
    def __init__(self) -> None:
        self.risk_predictor = get_risk_predictor()
        self.profitability_predictor = get_profitability_predictor()
        self.decision_matrix = get_decision_matrix()
        self.explainer = get_risk_explainer()

    def score(self, request: ScoringRequest) -> ScoringResponse:
        logger.info("Scoring domain: %s", request.domain)

        risk_pred = self.risk_predictor.predict(request.domain_info)

        email_health_prob, profit_raw = self._get_email_health(request)

        decision = self.decision_matrix.decide(DecisionMatrixInput(
            malicious_prob=risk_pred.malicious_prob,
            email_health_prob=email_health_prob,
            rank=request.domain_info.get("rank"),
            backlinks_total=request.domain_info.get("backlink"),
            domain_age_days=request.domain_info.get("domain_age", 0),
            ns_server_count=request.domain_info.get("ns_server_count"),
        ))

        explanation = self._explain(request.domain_info, decision)

        return ScoringResponse(
            domain=request.domain,
            decision=decision,
            explanation=explanation,
            raw_predictions={
                "risk": risk_pred.to_dict(),
                "profitability": profit_raw,
            },
        )

    def _get_email_health(
        self, request: ScoringRequest
    ) -> tuple[Optional[float], Optional[Dict[str, Any]]]:
        if not request.traffic_rows:
            logger.info("[%s] No traffic data → email_health = None", request.domain)
            return None, None

        try:
            result = self.profitability_predictor.predict_with_explanation(
                request.traffic_rows
            )
            proba = result.get("success_proba")
            logger.info(
                "[%s] modele warm-up -> email_health=%.4f (label=%s, seuil=%s) "
                "sur %s jour(s) de trafic | top features: %s",
                request.domain,
                proba if proba is not None else float("nan"),
                result.get("predicted_label"),
                self.profitability_predictor.metadata.get("threshold"),
                len(request.traffic_rows),
                ", ".join(
                    f"{f['feature']}={f['importance']}"
                    for f in result.get("top_features", [])
                ),
            )
            return proba, result
        except Exception as exc:
            logger.warning("[%s] Profitability failed: %s", request.domain, exc)
            return None, None

    def _explain(
        self, domain_info: Dict[str, Any], decision: DecisionResult
    ) -> Optional[Explanation]:
        try:
            return self.explainer.explain(domain_info, decision=decision)
        except Exception as exc:
            logger.warning("SHAP failed: %s", exc)
            return None

_scoring_service: ScoringService | None = None

def get_scoring_service() -> ScoringService:
    global _scoring_service
    if _scoring_service is None:
        _scoring_service = ScoringService()
    return _scoring_service


def quick_score(
    domain: str,
    domain_info: Dict[str, Any],
    traffic_rows: Optional[List[Dict[str, Any]]] = None,
) -> ScoringResponse:
    return get_scoring_service().score(
        ScoringRequest(
            domain=domain,
            domain_info=domain_info,
            traffic_rows=traffic_rows,
        )
    )