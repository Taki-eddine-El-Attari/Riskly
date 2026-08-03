from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str

    SECRET_KEY: str

    OPEN_PAGERANK_API_KEY: str = ""
    INTERNAL_TOOL_API_URL: str = ""
    INTERNAL_TOOL_API_KEY: str = ""

    MODEL_PATH: str = "app/ml/artifacts/model_v1.pkl"
    MODEL_VERSION: str = "v1"

    RISK_MODEL_PATH: str = "app/ml/artifacts/model_risk.joblib"
    RISK_MODEL_THRESHOLD: float = 0.5
    PROFITABILITY_MODEL_PATH: str = "app/ml/artifacts/xgboost_wormup_model_f_v.pkl"

    EXTERNAL_API_TIMEOUT_SECONDS: float = 10.0

    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_AUTH_MAX_AGE: int = 86_400

    CORS_ORIGINS: str = "http://localhost:5173"
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"
    SESSION_MAX_AGE: int = 60 * 60 * 24 * 30

    MAX_CONCURRENT_ANALYSES: int = 5

    # --- Stockage des CSV de warm-up (volume privé, hors dépôt) --------------
    # Répertoire dédié, en dehors de l'arborescence servie par le serveur web.
    # DOIT résider sur un volume chiffré au repos (chiffrement disque/LUKS ou
    # SSE côté objet) — le service n'ajoute pas de chiffrement applicatif.
    WARMUP_STORAGE_DIR: str = "/var/lib/riskly/warmup"
    # Plafond de taille par fichier (5 Mio, aligné sur la validation front).
    WARMUP_MAX_SIZE_BYTES: int = 5 * 1024 * 1024
    # Extensions autorisées (minuscules, sans le point), séparées par virgule.
    WARMUP_ALLOWED_EXTENSIONS: str = "csv"

    @property
    def WARMUP_ALLOWED_EXTENSIONS_SET(self) -> set[str]:
        return {
            e.strip().lower().lstrip(".")
            for e in self.WARMUP_ALLOWED_EXTENSIONS.split(",")
            if e.strip()
        }

    @property
    def CORS_ORIGINS_LIST(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
