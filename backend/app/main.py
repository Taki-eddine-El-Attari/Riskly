import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.core.config import settings
from app.core.exceptions import RisklyException, riskly_exception_handler
from app.api.v1.router import router as api_router

# Sans configuration explicite, les logger.info() des collectors/services
# (résultats des API externes, décisions du modèle) restent invisibles
# (root logger par défaut au niveau WARNING). Ce basicConfig les fait
# apparaître dans la console où tourne uvicorn.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

# Enregistre le modèle User (auth). Les autres modèles (analysis, domain…)
# sont du WIP qui ne s'importe pas encore ; on les ajoutera ici une
# fois corrigés, en même temps que la relation User.analyses.
from app.models import (  # noqa: F401
    user,
    domain,
    analysis,
    api_log,
    features,
    model,
    traffic_history,
    reputation_event,
    acquisition_result,
    warmup_file,
)

app = FastAPI(title="Riskly API")

# Session par cookie signé (HttpOnly) — porte l'auth locale ET Telegram.
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SECRET_KEY,
    https_only=settings.COOKIE_SECURE,
    same_site=settings.COOKIE_SAMESITE,
    max_age=settings.SESSION_MAX_AGE,
)

# CORS : credentials autorisés (le cookie voyage), origines explicites.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS_LIST,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(RisklyException, riskly_exception_handler)
app.include_router(api_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
