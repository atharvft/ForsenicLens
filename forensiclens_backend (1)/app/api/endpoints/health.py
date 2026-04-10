"""Health check and system status endpoints"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import torch

from app.db.session import get_db
from app.core.config import settings

router = APIRouter()


@router.get("/health")
def health_check():
    """Basic health check endpoint
    
    Returns:
        Health status
    """
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION
    }


@router.get("/status")
def system_status(db: Session = Depends(get_db)):
    """Detailed system status
    
    Returns:
        System information including GPU availability
    """
    # Check GPU availability
    gpu_available = torch.cuda.is_available()
    gpu_name = torch.cuda.get_device_name(0) if gpu_available else None
    
    # Check database connection
    db_connected = True
    try:
        db.execute("SELECT 1")
    except Exception:
        db_connected = False
    
    return {
        "status": "operational",
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "gpu": {
            "available": gpu_available,
            "device_name": gpu_name,
            "enabled": settings.USE_GPU
        },
        "database": {
            "connected": db_connected
        }
    }
