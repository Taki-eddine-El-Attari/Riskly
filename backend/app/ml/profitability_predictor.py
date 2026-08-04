from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    roc_auc_score,
)
from sklearn.model_selection import GroupShuffleSplit

from app.ml.feature_builder import (
    PROFITABILITY_XGBOOST_FEATURES,
    build_profitability_features,
    build_profitability_features_training,
    validate_inference_input,
    WarmupFeatureConfig,
)

logger = logging.getLogger(__name__)


class ProfitabilityPredictor:
    

    DEFAULT_PARAMS = {
        "objective": "binary:logistic",
        "eval_metric": ["logloss", "auc", "error"],
        "max_depth": 5,
        "learning_rate": 0.05,
        "n_estimators": 100,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "scale_pos_weight": 1,
        "random_state": 42,
        "n_jobs": -1,
        "tree_method": "hist",
        "enable_categorical": True,
    }

    def __init__(self, model_params: dict[str, Any] | None = None) -> None:
        self.params = model_params or self.DEFAULT_PARAMS.copy()
        self.model: xgb.XGBClassifier | None = None
        self.feature_names: list[str] = PROFITABILITY_XGBOOST_FEATURES.copy()
        self.metadata: dict[str, Any] = {}

    def train(self, raw_df: pd.DataFrame,early_stopping_rounds: int = 30, test_size: float = 0.2,verbose: bool = True,) -> dict[str, Any]:

        logger.info("Début de l'entraînement du modèle de profitabilité") 
       
        df_features = build_profitability_features_training(raw_df)

        meta_cols = ["domain_name", "success_label"]
        X = df_features.drop(columns=meta_cols, errors="ignore")
        y = df_features["success_label"].astype(int)
        groups = df_features["domain_name"]

        
        missing = set(self.feature_names) - set(X.columns)
        for col in missing:
            X[col] = 0.0
        X = X[self.feature_names]

        if X.isna().any().any():
            nan_cols = X.columns[X.isna().any()].tolist()
            logger.warning("Colonnes avec valeurs manquantes : %s", nan_cols)
            X=X.fillna(0)

      
        gss = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=42)
        train_idx, test_idx = next(gss.split(X, y, groups=groups))
        X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
        y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

        
        counts = y_train.value_counts().sort_index()
        if len(counts) == 2:
            neg, pos = counts.iloc[0], counts.iloc[1]
            self.params["scale_pos_weight"] = neg / pos
            logger.info("Réglage de scale_pos_weight à %.2f", self.params["scale_pos_weight"])

        self.model = xgb.XGBClassifier(**self.params)
        self.model.fit(X_train, y_train, eval_set=[(X_test, y_test)],early_stopping_rounds= early_stopping_rounds, verbose=False)

        metrics = self._evaluate(X_train, X_test, y_train, y_test)

        self.metadata = {
            "params": self.params,
            "feature_names": self.feature_names,
            "metrics": metrics,
            "best_iteration": getattr(self.model, "best_iteration", None),
            "best_score": getattr(self.model, "best_score", None),
        }
        logger.info("Entraînement terminé. Meilleure itération : %s, Meilleur score : %s", self.metadata["best_iteration"], self.metadata["best_score"])

        return metrics

    def _evaluate(
        self,
        X_train: pd.DataFrame,
        X_test: pd.DataFrame,
        y_train: pd.Series,
        y_test: pd.Series,
    ) -> dict[str, Any]:
        y_pred_train = self.model.predict(X_train)
        y_pred_test = self.model.predict(X_test)
        y_proba_test = self.model.predict_proba(X_test)[:, 1]

        return {
             "train_accuracy": round(accuracy_score(y_train, y_pred_train), 4),
            "test_accuracy": round(accuracy_score(y_test, y_pred_test), 4),
            "test_roc_auc": round(roc_auc_score(y_test, y_proba_test), 4),
            "confusion_matrix": confusion_matrix(y_test, y_pred_test).tolist(),
            "classification_report": classification_report(
                y_test, y_pred_test, output_dict=True
            ),
        }

        logger.info(
            "Accuracy train : %.2f%% | test : %.2f%% | AUC : %.4f",
            metrics["train_accuracy"] * 100,
            metrics["test_accuracy"] * 100,
            metrics["test_roc_auc"],
        )
        return metrics
    def predict(self, traffic_rows: list[dict]) -> np.ndarray:

        X = build_profitability_features(traffic_rows)

        return self.model.predict(X)
    
    def predict_proba(self, traffic_rows: list[dict]) -> np.ndarray:
        
        X = self._transform(traffic_rows)
        return self.model.predict_proba(X)[:, 1]

    def predict_with_explanation(self, traffic_rows: list[dict]) -> dict[str, Any]:
        X = self._transform(traffic_rows)
        proba = self.model.predict_proba(X)[:, 1]
        threshold = self.metadata.get("threshold", 0.5)
        label = (proba >= threshold).astype(int)

        importance = self.model.feature_importances_
        top3_idx = np.argsort(importance)[-3:][::-1]
        top3 = [
            {"feature": self.feature_names[i], "importance": round(float(importance[i]), 4)}
            for i in top3_idx
        ]

        return {
            "success_proba": round(float(proba[0]), 4),
            "predicted_label": int(label[0]),
            "top_features": top3,
        }
    
    def _transform(self, traffic_rows: list[dict]) -> pd.DataFrame:
        if self.model is None:
            raise RuntimeError("Le modèle n'est pas entraîné ou chargé.")

        X = build_profitability_features(traffic_rows)
        validate_inference_input(X)
        X = X[self.feature_names]

        # `day_of_week`/`month` sont categorielles avec un jeu de categories
        # fige a l'entrainement (cf. feature_builder.py) : une valeur reelle
        # hors de ce jeu (ex. un mois jamais vu a l'entrainement) devient NaN.
        # Un fillna(0) generalise plante ("0" n'est pas une categorie valide) —
        # on ne remplit que les colonnes numeriques ; XGBoost gere nativement
        # le NaN categoriel comme "valeur manquante" (enable_categorical=True).
        numeric_cols = [
            col for col in X.columns if not isinstance(X[col].dtype, pd.CategoricalDtype)
        ]
        if X[numeric_cols].isna().any().any():
            X[numeric_cols] = X[numeric_cols].fillna(0)

        return X


    def save(self, dir_path: str | Path) -> None:
        path = Path(dir_path)
        path.mkdir(parents=True, exist_ok=True)
        joblib.dump(self.model, path / "model.joblib")
        with open(path / "metadata.json", "w", encoding="utf-8") as f:
            json.dump(self.metadata, f, indent=2, default=str)
        logger.info("Modèle profitabilité sauvegardé dans %s", path)

    def load_bundle(self, pkl_path: str | Path) -> "ProfitabilityPredictor":
        bundle = joblib.load(pkl_path)
        self.model = bundle["model"]
        self.feature_names = list(bundle.get("feature_names", self.feature_names))
        self.metadata = {"threshold": bundle.get("threshold", 0.5)}
        logger.info("Modèle profitabilité (bundle) chargé depuis %s", pkl_path)
        return self

    def load(self, dir_path: str | Path) -> "ProfitabilityPredictor":
        path = Path(dir_path)
        self.model = joblib.load(path / "model.joblib")
        with open(path / "metadata.json", "r", encoding="utf-8") as f:
            self.metadata = json.load(f)

        self.feature_names = self.metadata.get("feature_names", self.feature_names)
        self.params = self.metadata.get("params", self.params)

        logger.info("Modèle profitabilité chargé depuis %s", path)
        return self
    def explain(self, traffic_rows: list[dict]) -> Any:
        try:
            import shap
        except ImportError:
            logger.error("shap n'est pas installé. pip install shap")
            raise

        X = self._transform(traffic_rows)
        explainer = shap.TreeExplainer(self.model)
        shap_values = explainer.shap_values(X)

        return shap.waterfall_plot(shap.Explanation(
            values=shap_values[0],
            base_values=explainer.expected_value,
            data=X.iloc[0],
            feature_names=self.feature_names,
        ), show=False)