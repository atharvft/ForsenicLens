"""Main API router that includes all endpoint routers"""
from fastapi import APIRouter

from app.api.endpoints import auth, photos, health

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(photos.router, prefix="/photos", tags=["Photos"])
api_router.include_router(health.router, prefix="/health", tags=["Health"])
