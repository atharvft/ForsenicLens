"""Photo Pydantic schemas"""
from pydantic import BaseModel, validator
from typing import Optional, List
from datetime import datetime
from app.models.photo import ProcessingStatus


# Photo Upload Response
class PhotoUploadResponse(BaseModel):
    """Schema for photo upload response"""
    id: int
    filename: str
    file_size: int
    mime_type: str
    status: ProcessingStatus
    uploaded_at: datetime
    
    class Config:
        from_attributes = True


# Photo Detail Response
class PhotoDetail(BaseModel):
    """Schema for detailed photo information"""
    id: int
    filename: str
    original_path: str
    file_size: int
    mime_type: str
    width: Optional[int]
    height: Optional[int]
    status: ProcessingStatus
    owner_id: int
    uploaded_at: datetime
    processed_at: Optional[datetime]
    
    class Config:
        from_attributes = True


# Photo List Response
class PhotoList(BaseModel):
    """Schema for paginated photo list"""
    photos: List[PhotoDetail]
    total: int
    page: int
    page_size: int
    

# Photo Processing Request
class PhotoProcessRequest(BaseModel):
    """Schema for requesting photo processing"""
    detect_anomalies: bool = True
    upscale: bool = True
    upscale_factor: Optional[float] = 2.0
    
    @validator("upscale_factor")
    def validate_upscale_factor(cls, v):
        if v is not None:
            assert 1.0 < v <= 4.0, "Upscale factor must be between 1.0 and 4.0"
        return v
