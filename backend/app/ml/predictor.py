from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Mapping, Optional

import joblib
import pandas as pd

from app.core.config import settings
from app.ml.feature_builder import build_risk_features
from app.ml.profitability_predictor import ProfitabilityPredictor

@dataclass
class RiskPrediction:
    malicious_prob: float  
    label: int                
    def to_dict(self) -> dict:
        return {"malicious_prob": round(self.malicious_prob, 4), "label": self.label}


def _cast_to_model_dtypes(
    df: pd.DataFrame, feature_names: list[str], feature_types: list[str]
) -> pd.DataFrame:
    
    df = df.reindex(columns=feature_names, fill_value=0)
    for col, ftype in zip(feature_names, feature_types):
        if ftype == "c":
            df[col] = df[col].astype("category")
        elif ftype in ("int", "i"):
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).astype("int64")
        elif ftype == "float":
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0).astype("float64")
    return df


class RiskPredictor:

    def __init__(self, model_path: str, threshold: float = 0.5):
        self.model = joblib.load(model_path)
        self.threshold = threshold

        self.feature_names: list[str] = list(self.model.feature_names_in_)
        self.feature_types: list[str] = list(self.model.get_booster().feature_types or [])

    def predict(
        self,
        domain_info: Mapping[str, Any],
        metric: Optional[Mapping[str, Any]] = None,
    ) -> RiskPrediction:
       
        X = build_risk_features(dict(domain_info), dict(metric) if metric else None)
        X = _cast_to_model_dtypes(X, self.feature_names, self.feature_types)
        proba = float(self.model.predict_proba(X)[0, 1])
        label = int(proba >= self.threshold)
        return RiskPrediction(malicious_prob=proba, label=label)

    def predict_batch(self, domain_infos: list[Mapping[str, Any]]) -> list[RiskPrediction]:
        frames = [build_risk_features(dict(d)) for d in domain_infos]
        X = pd.concat(frames, ignore_index=True)
        X = _cast_to_model_dtypes(X, self.feature_names, self.feature_types)
        probas = self.model.predict_proba(X)[:, 1]
        return [
            RiskPrediction(malicious_prob=float(p), label=int(p >= self.threshold))
            for p in probas
        ]



@lru_cache(maxsize=1)
def get_risk_predictor() -> RiskPredictor:
   
    return RiskPredictor(
        model_path=settings.RISK_MODEL_PATH,
        threshold=getattr(settings, "RISK_MODEL_THRESHOLD", 0.5),
    )


@lru_cache(maxsize=1)
def get_profitability_predictor() -> ProfitabilityPredictor:

    predictor = ProfitabilityPredictor()
    predictor.load_bundle(settings.PROFITABILITY_MODEL_PATH)
    return predictor