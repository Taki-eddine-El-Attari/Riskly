"""Point d'entrée de l'API Riskly (uvicorn app.main:app)."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import engine
from app.models.base import Base
from app.models import user as _user  # noqa: F401  (enregistre la table users)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # DEV : crée les tables manquantes au démarrage.
    # En production, gérer le schéma via Alembic (backend/alembic).
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Riskly API", lifespan=lifespan)

# Le cookie de session traverse une origine différente (front Vite) :
# CORS doit autoriser les credentials et lister explicitement les origines.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
