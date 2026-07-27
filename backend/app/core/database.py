from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.base import Base  # source unique de la Base déclarative (ré-export)

# settings (instance), pas Settings (classe) : sinon on passe un FieldInfo au moteur.
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
SessionLocale = SessionLocal  # alias rétro-compatible (ancienne orthographe)

__all__ = ["engine", "SessionLocal", "SessionLocale", "Base", "get_db"]


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
