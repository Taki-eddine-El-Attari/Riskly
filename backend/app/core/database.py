"""Moteur SQLAlchemy, fabrique de sessions et dépendance FastAPI `get_db`."""

from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

# SQLite a besoin de check_same_thread=False avec le pool de threads de FastAPI.
connect_args = (
    {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
)

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    """Fournit une session par requête et la referme systématiquement."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
