"""Processing Result database model"""
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, JSON, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class ProcessingResult(Base):
    """Processing result model for storing AI analysis results"""
    __tablename__ = "processing_results"
    
    id = Column(Integer, primary_key=True, index=True)
    photo_id = Column(Integer, ForeignKey("photos.id"), nullable=False)
    
    # Anomaly Detection Results
    has_anomalies = Column(Boolean, default=False)
    anomaly_score = Column(Float, nullable=True)  # 0.0 to 1.0
    anomaly_details = Column(JSON, nullable=True)  # Detailed anomaly information
    anomaly_regions = Column(JSON, nullable=True)  # Bounding boxes of anomalous regions
    
    # Upscaling Results
    upscaled_path = Column(String, nullable=True)
    upscale_factor = Column(Float, nullable=True)
    upscaled_width = Column(Integer, nullable=True)
    upscaled_height = Column(Integer, nullable=True)
    
    # Processing Metadata
    processing_time = Column(Float, nullable=True)  # in seconds
    model_version = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    photo = relationship("Photo", back_populates="processing_results")
