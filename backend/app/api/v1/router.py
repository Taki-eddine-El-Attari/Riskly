from fastapi import APIRouter
from app.api.v1 import auth

router = APIRouter(prefix="/api/v1")

router.include_router(auth.router)

# NOTE : domains/history sont encore en cours :
# `require_authenticated` vs `require_autheticated`, `domains.router` vs
# `analyses_router`, etc.). À réactiver une fois corrigés :
# from app.api.v1 import domains, history
# router.include_router(domains.router)
# router.include_router(history.router)
