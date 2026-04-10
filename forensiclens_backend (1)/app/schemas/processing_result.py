"""Processing Result Pydantic schemas"""
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime


# Anomaly Region
class AnomalyRegion(BaseModel):
    """Schema for anomaly region bounding box"""
    x: int
    y: int
    width: int
    height: int
    confidence: float
    anomaly_type: str


# Processing Result Response
class ProcessingResultResponse(BaseModel):
    """Schema for processing result response"""
    id: int
    photo_id: int
    
    # Anomaly Detection
    has_anomalies: bool
    anomaly_score: Optional[float]
    anomaly_details: Optional[Dict[str, Any]]
    anomaly_regions: Optional[List[Dict[str, Any]]]
    
    # Upscaling
    upscaled_path: Optional[str]
    upscale_factor: Optional[float]
    upscaled_width: Optional[int]
    upscaled_height: Optional[int]
    
    # Metadata
    processing_time: Optional[float]
    model_version: Optional[str]
    error_message: Optional[str]
    
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


# Processing Status Response
class ProcessingStatusResponse(BaseModel):
    """Schema for checking processing status"""
    photo_id: int
    status: str
    progress: Optional[float] = None  # 0.0 to 1.0
    message: Optional[str] = None
    result: Optional[ProcessingResultResponse] = None
