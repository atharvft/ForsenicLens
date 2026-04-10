"""Processing service for coordinating AI model inference"""
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
import logging
from pathlib import Path
from datetime import datetime
import time

from app.models.photo import Photo, ProcessingStatus
from app.models.processing_result import ProcessingResult
from app.schemas.photo import PhotoProcessRequest
from app.ai_engine.anomaly_detector import get_anomaly_detector
from app.ai_engine.upscaler import get_upscaler
from app.utils.file_handler import get_file_handler
from app.core.config import settings

logger = logging.getLogger(__name__)


class ProcessingService:
    """Service for orchestrating AI model processing"""
    
    @staticmethod
    def process_photo(db: Session, photo_id: int, request: PhotoProcessRequest) -> ProcessingResult:
        """Process a photo with AI models
        
        Args:
            db: Database session
            photo_id: ID of the photo to process
            request: Processing request parameters
            
        Returns:
            ProcessingResult object
            
        Raises:
            HTTPException: If processing fails
        """
        try:
            # Get photo
            photo = db.query(Photo).filter(Photo.id == photo_id).first()
            if not photo:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Photo not found"
                )
            
            # Update status to processing
            photo.status = ProcessingStatus.PROCESSING
            db.commit()
            
            logger.info(f"Starting processing for photo {photo_id}")
            start_time = time.time()
            
            # Initialize result
            result = ProcessingResult(photo_id=photo_id)
            
            # Anomaly Detection
            if request.detect_anomalies:
                logger.info(f"Running anomaly detection for photo {photo_id}")
                anomaly_detector = get_anomaly_detector()
                anomaly_result = anomaly_detector.detect(photo.original_path)
                
                result.has_anomalies = anomaly_result["has_anomalies"]
                result.anomaly_score = anomaly_result["anomaly_score"]
                result.anomaly_details = anomaly_result["anomaly_details"]
                result.anomaly_regions = anomaly_result["anomaly_regions"]
            
            # Image Upscaling
            if request.upscale:
                logger.info(f"Running upscaling for photo {photo_id}")
                upscaler = get_upscaler()
                file_handler = get_file_handler()
                
                # Generate output path
                processed_filename = file_handler.get_processed_filename(
                    Path(photo.original_path).name,
                    suffix=f"_upscaled_{request.upscale_factor}x"
                )
                output_path = str(file_handler.processed_dir / processed_filename)
                
                # Upscale image
                upscaled_path, width, height = upscaler.upscale(
                    photo.original_path,
                    output_path,
                    request.upscale_factor
                )
                
                result.upscaled_path = upscaled_path
                result.upscale_factor = request.upscale_factor
                result.upscaled_width = width
                result.upscaled_height = height
            
            # Calculate processing time
            processing_time = time.time() - start_time
            result.processing_time = processing_time
            result.model_version = "v1.0.0"  # Update with actual version
            
            # Save result
            db.add(result)
            
            # Update photo status
            photo.status = ProcessingStatus.COMPLETED
            photo.processed_at = datetime.utcnow()
            
            db.commit()
            db.refresh(result)
            
            logger.info(f"Processing completed for photo {photo_id} in {processing_time:.2f}s")
            return result
        
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error processing photo {photo_id}: {str(e)}")
            
            # Update photo status to failed
            photo.status = ProcessingStatus.FAILED
            db.commit()
            
            # Create error result
            error_result = ProcessingResult(
                photo_id=photo_id,
                error_message=str(e)
            )
            db.add(error_result)
            db.commit()
            
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error processing photo: {str(e)}"
            )
    
    @staticmethod
    async def process_photo_async(db: Session, photo_id: int, request: PhotoProcessRequest):
        """Asynchronous photo processing (for background tasks)
        
        Args:
            db: Database session
            photo_id: ID of the photo to process
            request: Processing request parameters
        
        Note:
            This can be integrated with Celery or FastAPI BackgroundTasks
            for true async processing in production
        """
        # TODO: Integrate with task queue (Celery/Redis) for production
        return ProcessingService.process_photo(db, photo_id, request)
    
    @staticmethod
    def get_processing_status(db: Session, photo_id: int) -> dict:
        """Get processing status for a photo
        
        Args:
            db: Database session
            photo_id: Photo ID
            
        Returns:
            Dictionary with status information
        """
        photo = db.query(Photo).filter(Photo.id == photo_id).first()
        
        if not photo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Photo not found"
            )
        
        result = db.query(ProcessingResult).filter(
            ProcessingResult.photo_id == photo_id
        ).order_by(ProcessingResult.created_at.desc()).first()
        
        status_dict = {
            "photo_id": photo_id,
            "status": photo.status.value,
            "message": None,
            "result": None
        }
        
        if photo.status == ProcessingStatus.COMPLETED and result:
            status_dict["result"] = result
        elif photo.status == ProcessingStatus.FAILED and result and result.error_message:
            status_dict["message"] = result.error_message
        elif photo.status == ProcessingStatus.PROCESSING:
            status_dict["message"] = "Processing in progress..."
        
        return status_dict
