from fastapi import APIRouter
from app.api.v1 import auth, warmup, history, domains

router = APIRouter(prefix="/api/v1")

router.include_router(auth.router)
router.include_router(warmup.router)
router.include_router(history.router)
router.include_router(domains.analyses_router)
router.include_router(domains.domains_router)
