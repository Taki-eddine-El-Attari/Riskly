

from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any, List, Mapping, Optional, Sequence

import numpy as np
import pandas as pd
import shap

from app.ml.feature_builder import build_risk_features
from app.ml.predictor import _cast_to_model_dtypes, get_risk_predictor
from app.services.decision_matrix import DecisionResult, Verdict




FEATURE_LABELS: dict[str, str] = {
    "domain_age": "âge du domaine",
    "blacklist": "présence sur liste noire",
    "backlink": "nombre de backlinks",
    "rank": "classement (rank)",
    "domain_lenght": "longueur du nom de domaine",
    "nbr_hyp": "nombre de tirets dans le nom",
    "nbr_srv": "nombre de serveurs",
    "backlinks_missing": "donnée backlinks manquante",
    "rank_missing": "donnée de classement manquante",
}



def _label_for(feature_name: str) -> str:
    if feature_name in FEATURE_LABELS:
        return FEATURE_LABELS[feature_name]
    if feature_name.startswith("tld_"):
        return f"extension de domaine .{feature_name[4:]}"
    if feature_name.startswith("country_"):
        return f"pays d'hébergement : {feature_name[8:]}"
    return feature_name


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + np.exp(-x))


# ---------------------------------------------------------------------------
# Structures de sortie
# ---------------------------------------------------------------------------

@dataclass
class FeatureContribution:
    feature: str
    label: str
    value: Any                
    shap_value: float         # contribution signée, EN ESPACE LOG-ODDS
    direction: str            # "augmente_risque" | "diminue_risque"

    def to_dict(self) -> dict:
        value = self.value
        if isinstance(value, (np.floating, np.integer)):
            value = value.item()
        return {
            "feature": str(self.feature),
            "label": self.label,
            "value": value,
            "impact_log_odds": round(self.shap_value, 4),
            "direction": self.direction,
        }


@dataclass
class Explanation:
    base_value_log_odds: float
    malicious_prob: float             
    contributions: List[FeatureContribution] = field(default_factory=list)
    verdict: Optional[Verdict] = None
    verdict_label: Optional[str] = None
    final_score: Optional[float] = None
    summary_text: str = ""

    def to_dict(self) -> dict:
        return {
            "malicious_prob": round(self.malicious_prob, 4),
            "verdict": self.verdict.value if self.verdict else None,
            "verdict_label": self.verdict_label,
            "final_score": round(self.final_score, 4) if self.final_score is not None else None,
            "contributions": [c.to_dict() for c in self.contributions],
            "summary_text": self.summary_text,
        }


# ---------------------------------------------------------------------------
# Explainer
# ---------------------------------------------------------------------------

class RiskExplainer:


    def __init__(self, model: Any, feature_names: Sequence[str], top_k: int = 5) -> None:
        self.model = model
        self.feature_names = list(feature_names)
        self.feature_types = list(model.get_booster().feature_types or [])
        self.top_k = top_k
    
        self._explainer = shap.Explainer(model)

    def explain(
        self,
        domain_info: Mapping[str, Any],
        metric: Optional[Mapping[str, Any]] = None,
        decision: Optional[DecisionResult] = None,
    ) -> Explanation:
        
        X = build_risk_features(dict(domain_info), dict(metric) if metric else None)
        X = _cast_to_model_dtypes(X, self.feature_names, self.feature_types)

        shap_values = self._explainer(X)
        values = np.asarray(shap_values.values)
        base_values = np.asarray(shap_values.base_values)

        if values.ndim == 3:
            values = values[:, :, -1]
            base_values = base_values[..., -1] if base_values.ndim > 0 else base_values

        row_values = values[0]
        base_value = float(np.ravel(base_values)[0])
        margin = base_value + row_values.sum()
        malicious_prob = float(_sigmoid(margin))

        contributions = self._build_contributions(X.iloc[0], row_values)
        summary_text = self._build_summary_text(contributions, malicious_prob, decision)

        return Explanation(
            base_value_log_odds=base_value,
            malicious_prob=malicious_prob,
            contributions=contributions,
            verdict=decision.verdict if decision else None,
            verdict_label=decision.verdict_label if decision else None,
            final_score=decision.final_score if decision else None,
            summary_text=summary_text,
        )

    def _build_contributions(
        self, raw_row: pd.Series, shap_row: np.ndarray
    ) -> List[FeatureContribution]:
        contributions = [
            FeatureContribution(
                feature=name,
                label=_label_for(name),
                value=raw_row[name] if name in raw_row.index else None,
                shap_value=float(shap_row[i]),
                direction="augmente_risque" if shap_row[i] > 0 else "diminue_risque",
            )
            for i, name in enumerate(self.feature_names)
        ]
       
        contributions = [
            c for c in contributions
            if not (str(c.feature).startswith(("tld_", "country_")) and c.value in (0, 0.0))
        ]
        contributions.sort(key=lambda c: abs(c.shap_value), reverse=True)
        return contributions[: self.top_k]

    def _build_summary_text(
        self,
        contributions: List[FeatureContribution],
        malicious_prob: float,
        decision: Optional[DecisionResult],
    ) -> str:
        parts: list[str] = []

        if decision is not None:
            parts.append(f"Verdict : {decision.verdict_label}.")
            if decision.hard_veto:
                parts.append(
                    f"Domaine écarté par veto de sécurité "
                    f"(probabilité de malveillance {malicious_prob:.0%})."
                )
            else:
                parts.append(
                    f"Score final {decision.final_score:.0%} "
                    f"(probabilité de malveillance {malicious_prob:.0%})."
                )
        else:
            parts.append(f"Probabilité de malveillance estimée à {malicious_prob:.0%}.")

        if contributions:
            phrases = []
            for c in contributions:
                verbe = "augmente" if c.direction == "augmente_risque" else "réduit"
                phrases.append(f"{c.label} ({c.value}) {verbe} le risque")
            parts.append("Principaux facteurs : " + "; ".join(phrases) + ".")

        return " ".join(parts)




@lru_cache(maxsize=1)
def get_risk_explainer() -> RiskExplainer:
    predictor = get_risk_predictor()
    return RiskExplainer(model=predictor.model, feature_names=predictor.feature_names)