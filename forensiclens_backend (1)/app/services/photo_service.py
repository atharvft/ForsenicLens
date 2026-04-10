"""Photo service for managing photo uploads and processing"""
from sqlalchemy.orm import Session
from fastapi import HTTPException, status, UploadFile
from typing import List, Optional
import logging
from datetime import datetime

from app.models.photo import Photo, ProcessingStatus
from app.models.processing_result import ProcessingResult
from app.schemas.photo import PhotoProcessRequest
from app.utils.file_handler import get_file_handler

logger = logging.getLogger(__name__)


class PhotoService:
    """Service for photo management and processing"""
    
    @staticmethod
    async def upload_photo(db: Session, file: UploadFile, user_id: int) -> Photo:
        """Upload and save a photo
        
        Args:
            db: Database session
            file: Uploaded file
            user_id: ID of the user uploading the photo
            
        Returns:
            Created photo object
        """
        try:
            # Save file
            file_handler = get_file_handler()
            file_path, file_size, mime_type, (width, height) = await file_handler.save_upload_file(file)
            
            # Create database entry
            db_photo = Photo(
                filename=file.filename,
                original_path=file_path,
                file_size=file_size,
                mime_type=mime_type,
                width=width,
                height=height,
                owner_id=user_id,
                status=ProcessingStatus.PENDING
            )
            
            db.add(db_photo)
            db.commit()
            db.refresh(db_photo)
            
            logger.info(f"Photo uploaded: {db_photo.id} by user {user_id}")
            return db_photo
        
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error uploading photo: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error uploading photo: {str(e)}"
            )
    
    @staticmethod
    def get_photo_by_id(db: Session, photo_id: int, user_id: int) -> Photo:
        """Get photo by ID
        
        Args:
            db: Database session
            photo_id: Photo ID
            user_id: ID of the requesting user
            
        Returns:
            Photo object
            
        Raises:
            HTTPException: If photo not found or access denied
        """
        photo = db.query(Photo).filter(Photo.id == photo_id).first()
        
        if not photo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Photo not found"
            )
        
        if photo.owner_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        return photo
    
    @staticmethod
    def get_user_photos(
        db: Session, 
        user_id: int, 
        skip: int = 0, 
        limit: int = 100,
        status: Optional[ProcessingStatus] = None
    ) -> tuple[List[Photo], int]:
        """Get all photos for a user
        
        Args:
            db: Database session
            user_id: User ID
            skip: Number of records to skip
            limit: Maximum number of records to return
            status: Optional status filter
            
        Returns:
            Tuple of (list of photos, total count)
        """
        query = db.query(Photo).filter(Photo.owner_id == user_id)
        
        if status:
            query = query.filter(Photo.status == status)
        
        total = query.count()
        photos = query.order_by(Photo.uploaded_at.desc()).offset(skip).limit(limit).all()
        
        return photos, total
    
    @staticmethod
    def update_photo_status(db: Session, photo_id: int, status: ProcessingStatus) -> Photo:
        """Update photo processing status
        
        Args:
            db: Database session
            photo_id: Photo ID
            status: New status
            
        Returns:
            Updated photo object
        """
        photo = db.query(Photo).filter(Photo.id == photo_id).first()
        
        if not photo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Photo not found"
            )
        
        photo.status = status
        
        if status == ProcessingStatus.COMPLETED:
            photo.processed_at = datetime.utcnow()
        
        db.commit()
        db.refresh(photo)
        
        logger.info(f"Photo {photo_id} status updated to {status}")
        return photo
    
    @staticmethod
    def delete_photo(db: Session, photo_id: int, user_id: int) -> None:
        """Delete a photo
        
        Args:
            db: Database session
            photo_id: Photo ID
            user_id: ID of the requesting user
            
        Raises:
            HTTPException: If photo not found or access denied
        """
        photo = PhotoService.get_photo_by_id(db, photo_id, user_id)
        
        # Delete files
        file_handler = get_file_handler()
        file_handler.delete_file(photo.original_path)
        
        # Delete processed files
        for result in photo.processing_results:
            if result.upscaled_path:
                file_handler.delete_file(result.upscaled_path)
        
        # Delete from database
        db.delete(photo)
        db.commit()
        
        logger.info(f"Photo {photo_id} deleted by user {user_id}")
    
    @staticmethod
    def get_processing_result(db: Session, photo_id: int, user_id: int) -> Optional[ProcessingResult]:
        """Get processing result for a photo
        
        Args:
            db: Database session
            photo_id: Photo ID
            user_id: ID of the requesting user
            
        Returns:
            ProcessingResult object or None
        """
        # Verify access
        photo = PhotoService.get_photo_by_id(db, photo_id, user_id)
        
        # Get latest processing result
        result = db.query(ProcessingResult).filter(
            ProcessingResult.photo_id == photo_id
        ).order_by(ProcessingResult.created_at.desc()).first()
        
        return result
