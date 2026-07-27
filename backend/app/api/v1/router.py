"""Agrège les routers de l'API v1."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import auth

api_router = APIRouter()
api_router.include_router(auth.router)
# domains, history : à brancher ici lorsqu'ils seront implémentés.
