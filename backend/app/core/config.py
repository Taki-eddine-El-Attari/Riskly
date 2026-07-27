from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str 

    SECRET_KEY: str 

    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60*24

    # Rendre obligatoires une fois la clé est ajouté
    # Par défaut vides  pour le développement initial et  pour le démarrage  de l'app normalement maintenant
    OPEN_PAGERANK_API_KEY: str = ""
    INTERNAL_TOOL_API_URL: str = ""
    INTERNAL_TOOL_API_KEY: str = ""
 
    MODEL_PATH: str = "app/ml/artifacts/model_v1.pkl"
    MODEL_VERSION: str = "v1"
    
settings = Settings()