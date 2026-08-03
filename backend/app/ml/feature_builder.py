from __future__ import annotations

import logging
from dataclasses import dataclass

import pandas as pd

logger = logging.getLogger(__name__)

RISK_FEATURE_ORDER = [
    "domain_age", "blacklist", "backlink", "rank",
    "domain_lenght", "nbr_hyp", "tld", "country", "nbr_srv",
]

PROFITABILITY_FEATURE_ORDER = [
    "warmup_volume", "sent_volume", "total_volume",
    "bounce_count", "spam_complaint_count", "open_rate", "reply_rate",
    "day_of_week", "month",
]

PROFITABILITY_XGBOOST_FEATURES = PROFITABILITY_FEATURE_ORDER

# `.astype("category")` sans `categories=` explicite dérive l'ensemble des
# catégories des valeurs PRÉSENTES, triées par ordre alphabétique (comportement
# par défaut de pandas) — sans ces listes fixes, les codes catégoriels XGBoost
# à l'inférence (1 seule ligne) ne correspondent plus à ceux vus à
# l'entraînement (cf. discussion modèle warm-up). Valeurs confirmées à partir
# du dataset d'entraînement réel (90 jours consécutifs, 2026-04-29 → 2026-07-27,
# pour chaque domaine) : seuls 4 mois y sont représentés, pas les 12.
WEEKDAY_CATEGORIES = sorted([
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
])
MONTH_CATEGORIES = sorted(["April", "May", "June", "July"])


@dataclass
class WarmupFeatureConfig:
    target_col: str = "success_label"
    date_col: str = "day_date"
    domain_col: str = "domain_name"


# Colonnes exactes attendues par `model_risk.joblib` (introspectées via
# `model.feature_names_in_` — cf. discussion §synchronisation modèles/backend).
# Toute colonne absente du DataFrame produit est remise à 0 par
# `_cast_to_model_dtypes` (predictor.py), donc seules les colonnes actives
# (les 9 numériques + le tld/country réellement observés) doivent être posées.
RISK_MODEL_NUMERIC_FEATURES = [
    "domain_age", "blacklist", "backlink", "rank", "domain_lenght",
    "nbr_hyp", "nbr_srv", "backlinks_missing", "rank_missing",
]

RISK_MODEL_KNOWN_TLDS = [
    "cfd", "click", "co", "com", "de", "digital", "edu", "fr", "gov", "hair",
    "help", "io", "jp", "net", "org", "ru", "sbs", "shop", "top", "xyz",
]

RISK_MODEL_KNOWN_COUNTRIES = [
    "Brazil", "Canada", "China", "France", "Germany", "Hong Kong", "India",
    "Ireland", "Italy", "Japan", "Portugal", "Russia", "Singapore",
    "South Korea", "Spain", "Switzerland", "The Netherlands",
    "United Kingdom", "United States",
]

RISK_MODEL_FEATURE_NAMES = (
    RISK_MODEL_NUMERIC_FEATURES
    + [f"tld_{t}" for t in RISK_MODEL_KNOWN_TLDS] + ["tld_other"]
    + [f"country_{c}" for c in RISK_MODEL_KNOWN_COUNTRIES]
    + ["country_Unknown", "country_other"]
)


def _tld_column(tld) -> str:
    tld = str(tld).strip().lower() if tld else ""
    return f"tld_{tld}" if tld in RISK_MODEL_KNOWN_TLDS else "tld_other"


def _country_column(country) -> str:
    if not country:
        return "country_Unknown"
    country = str(country).strip()
    for known in RISK_MODEL_KNOWN_COUNTRIES:
        if known.lower() == country.lower():
            return f"country_{known}"
    return "country_other"


def build_risk_features(domain: dict, metric: dict | None = None) -> pd.DataFrame:
    """Construit le vecteur de features attendu par le modèle de risque.

    Clés lues sur `domain` (complétées par `metric` si fourni — en pratique
    `scoring_service.py` n'en fournit pas, tout transite par `domain_info`) :
    `domain_name`, `tld`, `country`, `domain_length`, `hyphen_count`,
    `domain_age` (jours), `rank`, `backlink`, `is_blacklisted`,
    `ns_server_count`. Ce sont les mêmes noms que `decision_matrix.py`
    attend déjà (`rank`, `backlink`, `domain_age`) — un seul dict sert les
    deux consommateurs.
    """
    metric = metric or {}

    def pick(key):
        if key in metric and metric[key] is not None:
            return metric[key]
        return domain.get(key)

    rank = pick("rank")
    backlink = pick("backlink")
    ns_count = pick("ns_server_count")
    is_blacklisted = pick("is_blacklisted")

    domain_name = str(domain.get("domain_name") or "")
    domain_length = domain.get("domain_length")
    if domain_length is None:
        domain_length = len(domain_name)
    hyphen_count = domain.get("hyphen_count")
    if hyphen_count is None:
        hyphen_count = domain_name.count("-")

    row = {name: 0 for name in RISK_MODEL_FEATURE_NAMES}
    row["domain_age"] = float(domain.get("domain_age") or 0)
    row["blacklist"] = int(bool(is_blacklisted))
    row["backlink"] = float(backlink) if backlink is not None else 0.0
    row["rank"] = float(rank) if rank is not None else 0.0
    row["domain_lenght"] = int(domain_length or 0)
    row["nbr_hyp"] = int(hyphen_count or 0)
    row["nbr_srv"] = float(ns_count) if ns_count is not None else 0.0
    row["backlinks_missing"] = int(backlink is None)
    row["rank_missing"] = int(rank is None)
    row[_tld_column(domain.get("tld"))] = 1
    row[_country_column(domain.get("country"))] = 1

    return pd.DataFrame([row], columns=RISK_MODEL_FEATURE_NAMES)


def build_profitability_features(traffic_rows: list[dict]) -> pd.DataFrame:
    if not traffic_rows:
        raise ValueError("build_profitability_features: aucune donnée traffic fournie")

    df = pd.DataFrame(traffic_rows)

    required_raw = ["day_date", "domain_name", "warmup_volume", "sent_volume",
                    "total_volume", "bounce_count", "spam_complaint_count",
                    "open_rate", "reply_rate"]
    missing_raw = [c for c in required_raw if c not in df.columns]
    if missing_raw:
        raise ValueError(f"Colonnes brutes manquantes : {missing_raw}")

    df = _clean_and_extract_temporal(df)

    dernier_jour = df.iloc[[-1]]

    result = pd.DataFrame(index=dernier_jour.index)
    for col in PROFITABILITY_XGBOOST_FEATURES:
        result[col] = dernier_jour[col] if col in dernier_jour.columns else 0.0

    raw_day, raw_month = result["day_of_week"].iloc[0], result["month"].iloc[0]
    result["day_of_week"] = pd.Categorical(result["day_of_week"], categories=WEEKDAY_CATEGORIES)
    result["month"] = pd.Categorical(result["month"], categories=MONTH_CATEGORIES)

    if result["month"].isna().any():
        logger.warning(
            "build_profitability_features: mois '%s' absent des categories "
            "d'entrainement %s -> traite comme valeur manquante par le modele.",
            raw_month, MONTH_CATEGORIES,
        )
    if result["day_of_week"].isna().any():
        logger.warning(
            "build_profitability_features: jour '%s' absent des categories "
            "d'entrainement %s -> traite comme valeur manquante par le modele.",
            raw_day, WEEKDAY_CATEGORIES,
        )

    return result.reset_index(drop=True)


def build_profitability_features_training(
    raw_df: pd.DataFrame,
    config: WarmupFeatureConfig | None = None,
) -> pd.DataFrame:
    if raw_df is None or raw_df.empty:
        raise ValueError("build_profitability_features_training: dataset vide")

    cfg = config or WarmupFeatureConfig()

    required = ["day_date", "domain_name", "warmup_volume", "sent_volume",
                "total_volume", "bounce_count", "spam_complaint_count",
                "open_rate", "reply_rate", cfg.target_col]
    missing = [c for c in required if c not in raw_df.columns]
    if missing:
        raise ValueError(f"Colonnes manquantes pour l'entraînement : {missing}")

    df = raw_df.copy()
    df = _clean_and_extract_temporal(df)

    meta_cols = [cfg.domain_col, cfg.target_col]
    feature_cols = PROFITABILITY_XGBOOST_FEATURES.copy()

    missing_features = set(PROFITABILITY_XGBOOST_FEATURES) - set(df.columns)
    if missing_features:
        raise ValueError(f"Features manquantes après traitement : {missing_features}")

    df["day_of_week"] = pd.Categorical(df["day_of_week"], categories=WEEKDAY_CATEGORIES)
    df["month"] = pd.Categorical(df["month"], categories=MONTH_CATEGORIES)

    ordered_cols = feature_cols + meta_cols
    return df[ordered_cols].reset_index(drop=True)


def _clean_and_extract_temporal(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    df["day_date"] = pd.to_datetime(df["day_date"])

    df["day_of_week"] = df["day_date"].dt.day_name()
    df["month"] = df["day_date"].dt.month_name()

    df = df.drop(columns=["day_date"])

    numeric_cols = [
        "warmup_volume", "sent_volume", "total_volume",
        "bounce_count", "spam_complaint_count", "open_rate", "reply_rate",
    ]

    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    if "success_label" in df.columns:
        df["success_label"] = pd.to_numeric(
            df["success_label"], errors="coerce"
        ).astype("Int8")

    for col in numeric_cols:
        df[f"{col}_missing"] = df[col].isna().astype(int)

    group_col = "domain_name" if "domain_name" in df.columns else None
    for col in numeric_cols:
        if group_col:
            df[col] = df.groupby(group_col)[col].transform(
                lambda x: x.fillna(x.median())
            )
        df[col] = df[col].fillna(df[col].median())

    df["sent_volume"] = df[["sent_volume", "total_volume"]].min(axis=1)
    df["bounce_count"] = df[["bounce_count", "sent_volume"]].min(axis=1)
    df["spam_complaint_count"] = df[["spam_complaint_count", "sent_volume"]].min(axis=1)

    df["open_rate"] = df["open_rate"].clip(0, 1)
    df["reply_rate"] = df["reply_rate"].clip(0, 1)

    return df.reset_index(drop=True)


def get_feature_names() -> list[str]:
    return PROFITABILITY_XGBOOST_FEATURES.copy()


def validate_inference_input(df: pd.DataFrame) -> None:
    missing = set(PROFITABILITY_XGBOOST_FEATURES) - set(df.columns)
    if missing:
        raise ValueError(f"Features manquantes pour l'inférence : {sorted(missing)}")
    if len(df) != 1:
        logger.warning("validate_inference_input: attendu 1 ligne, reçu %s", len(df))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    traffic = [
        {
            "domain_name": "example.com",
            "day_date": f"2024-01-{i:02d}",
            "warmup_volume": 100 + i * 10,
            "sent_volume": 90 + i * 9,
            "total_volume": 100 + i * 10,
            "bounce_count": max(0, 5 - i),
            "spam_complaint_count": max(0, 2 - i // 3),
            "open_rate": 0.15 + i * 0.01,
            "reply_rate": 0.02 + i * 0.005,
            "success_label": 1 if i >= 7 else 0,
        }
        for i in range(1, 11)
    ]

    features_inference = build_profitability_features(traffic)
    print("\n=== INFÉRENCE ===")
    print(features_inference)
    print(f"Shape: {features_inference.shape}")
    print(f"Types:\n{features_inference.dtypes}")

    df_train = pd.DataFrame(traffic)
    features_training = build_profitability_features_training(df_train)
    print("\n=== ENTRAÎNEMENT ===")
    print(features_training.head(3))
    print(f"Shape: {features_training.shape}")
    print(f"Types:\n{features_training.dtypes}")