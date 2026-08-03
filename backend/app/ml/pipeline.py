from __future__ import annotations

import logging
from typing import Any, Optional

from app.ml.predictor import get_risk_predictor, get_profitability_predictor
from app.services.decision_matrix import DecisionMatrix, DecisionMatrixInput

logger = logging.getLogger(__name__)

class DomainPipeline:

    def __init__(self) -> None:
        self.risk_predictor = get_risk_predictor()
        self.profitability_predictor = get_profitability_predictor()
        self.decision_matrix = DecisionMatrix()

    def evaluate(
        self,
        domain_info: dict[str, Any],
        traffic_history: Optional[list[dict]] = None,
    ) -> dict[str, Any]:

        domain = domain_info.get("domain", "unknown")

       
        risk_pred = self.risk_predictor.predict(domain_info)
        malicious_prob = risk_pred["malicious_proba"]

        logger.info(
            "[%s] STEP 1 — malicious_prob: %.4f (danger: %s)",
            domain, malicious_prob, risk_pred.get("is_dangerous", False)
        )

        
        email_health_prob: Optional[float] = None
        if traffic_history:
            try:
                profit_result = self.profitability_predictor.predict_with_explanation(
                    traffic_history
                )
                email_health_prob = profit_result.get("success_proba")
                logger.info(
                    "[%s] STEP 2 — email_health (from model): %.4f",
                    domain, email_health_prob
                )
            except Exception as exc:
                logger.warning(
                    "[%s] Profitability prediction failed: %s → email_health = None",
                    domain, exc
                )
        else:
            logger.info("[%s] STEP 2 — email_health: None (no traffic data)", domain)

       
        decision = self.decision_matrix.decide(DecisionMatrixInput(
            malicious_prob=malicious_prob,
            email_health_prob=email_health_prob,
            rank=domain_info.get("rank"),
            backlinks_total=domain_info.get("backlink"),
            domain_age_days=domain_info.get("domain_age", 0),
        ))

        logger.info(
            "[%s] STEP 3 — Verdict: %s | final_score: %.4f | hard_veto: %s",
            domain, decision.verdict_label, decision.final_score, decision.hard_veto
        )

    
        return {
            "domain": domain,
            "verdict": decision.verdict.value,
            "verdict_label": decision.verdict_label,
            "verdict_color": decision.verdict_color,
            "hard_veto": decision.hard_veto,
            "confidence": decision.confidence,
            "scores": {
                "malicious_prob": decision.malicious_prob,
                "authority": decision.authority_score,
                "email_health": decision.email_health_score,
                "email_missing": decision.email_was_missing,
                "base_value": decision.base_value_score,
                "security_factor": decision.security_factor,
                "final": decision.final_score,
            },
            "reason": decision.reason,
            "recommendation": decision.recommendation,
            "breakdown": decision.breakdown,
        }