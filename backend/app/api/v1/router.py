from fastapi import APIRouter
from app.api.v1 import auth, domains, history
 
router = APIRouter(prefix="/api/v1")
 
router.include_router(auth.router)
router.include_router(domains.router)
router.include_router(history.router)
