"""Configuration centrale de l'application (chargée depuis l'environnement / .env)."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Base de données ---
    # SQLite par défaut pour le développement ; surcharger par une URL Postgres en prod.
    database_url: str = "sqlite:///./riskly.db"

    # --- Sécurité ---
    secret_key: str = "dev-secret-a-changer"

    # --- Telegram Login Widget ---
    telegram_bot_token: str = ""
    # Fraîcheur maximale d'un login Telegram (anti-rejeu), en secondes.
    telegram_auth_max_age: int = 86_400

    # --- CORS ---
    # Origines autorisées (front), séparées par des virgules.
    cors_origins: str = "http://localhost:5173"

    # --- Cookie de session ---
    cookie_name: str = "riskly_session"
    cookie_max_age: int = 60 * 60 * 24 * 30  # 30 jours
    cookie_secure: bool = False  # True obligatoire en prod (HTTPS)
    cookie_samesite: str = "lax"  # "none" si front et back sur des domaines différents

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
