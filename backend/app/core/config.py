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

    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_AUTH_MAX_AGE: int = 86_400

    CORS_ORIGINS: str = "http://localhost:5173"
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"
    SESSION_MAX_AGE: int = 60 * 60 * 24 * 30

    MAX_CONCURRENT_ANALYSES: int = 5

    @property
    def CORS_ORIGINS_LIST(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
