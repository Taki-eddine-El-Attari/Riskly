from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str

    SECRET_KEY: str

    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # Rendre obligatoires une fois la clé est ajouté
    # Par défaut vides  pour le développement initial et  pour le démarrage  de l'app normalement maintenant
    OPEN_PAGERANK_API_KEY: str = ""
    INTERNAL_TOOL_API_URL: str = ""
    INTERNAL_TOOL_API_KEY: str = ""

    MODEL_PATH: str = "app/ml/artifacts/model_v1.pkl"
    MODEL_VERSION: str = "v1"

    # --- Auth Telegram (Login Widget) ---
    # Token du bot @BotFather ; vide = login Telegram désactivé.
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_AUTH_MAX_AGE: int = 86_400  # fraîcheur max d'un login Telegram (anti-rejeu)

    # --- CORS + cookie de session ---
    CORS_ORIGINS: str = "http://localhost:5173"  # origines front, séparées par des virgules
    COOKIE_SECURE: bool = False  # True obligatoire en prod (HTTPS)
    COOKIE_SAMESITE: str = "lax"  # "none" si front et back sur des domaines différents
    SESSION_MAX_AGE: int = 60 * 60 * 24 * 30  # 30 jours

    @property
    def CORS_ORIGINS_LIST(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
