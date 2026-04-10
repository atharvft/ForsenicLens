"""Photo management API endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.schemas.photo import (
    PhotoUploadResponse, 
    PhotoDetail, 
    PhotoList, 
    PhotoProcessRequest
)
from app.schemas.processing_result import ProcessingResultResponse, ProcessingStatusResponse
from app.services.photo_service import PhotoService
from app.services.processing_service import ProcessingService
from app.api.dependencies.auth import get_current_user
from app.models.user import User
from app.models.photo import ProcessingStatus
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/upload", response_model=PhotoUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a photo for processing
    
    Args:
        file: Image file to upload
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Uploaded photo information
    """
    photo = await PhotoService.upload_photo(db, file, current_user.id)
    return photo


@router.get("/", response_model=PhotoList)
def get_photos(
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all photos for the current user
    
    Args:
        skip: Number of records to skip (pagination)
        limit: Maximum number of records to return
        status_filter: Optional status filter (pending, processing, completed, failed)
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        List of photos with pagination info
    """
    # Parse status filter
    status_enum = None
    if status_filter:
        try:
            status_enum = ProcessingStatus(status_filter.lower())
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status filter: {status_filter}"
            )
    
    photos, total = PhotoService.get_user_photos(
        db, 
        current_user.id, 
        skip=skip, 
        limit=limit,
        status=status_enum
    )
    
    return PhotoList(
        photos=photos,
        total=total,
        page=skip // limit + 1,
        page_size=limit
    )


@router.get("/{photo_id}", response_model=PhotoDetail)
def get_photo(
    photo_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get photo details
    
    Args:
        photo_id: Photo ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Photo details
    """
    photo = PhotoService.get_photo_by_id(db, photo_id, current_user.id)
    return photo


@router.post("/{photo_id}/process", response_model=ProcessingResultResponse)
def process_photo(
    photo_id: int,
    request: PhotoProcessRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Process a photo with AI models
    
    Args:
        photo_id: Photo ID
        request: Processing configuration
        background_tasks: FastAPI background tasks
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Processing result
    """
    # Verify photo ownership
    photo = PhotoService.get_photo_by_id(db, photo_id, current_user.id)
    
    # Process photo synchronously for now
    # TODO: Move to background task or Celery for production
    result = ProcessingService.process_photo(db, photo_id, request)
    
    return result


@router.get("/{photo_id}/status", response_model=ProcessingStatusResponse)
def get_processing_status(
    photo_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get processing status for a photo
    
    Args:
        photo_id: Photo ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Processing status information
    """
    # Verify photo ownership
    photo = PhotoService.get_photo_by_id(db, photo_id, current_user.id)
    
    status_info = ProcessingService.get_processing_status(db, photo_id)
    return status_info


@router.get("/{photo_id}/result", response_model=ProcessingResultResponse)
def get_processing_result(
    photo_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get processing result for a photo
    
    Args:
        photo_id: Photo ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Processing result
    """
    result = PhotoService.get_processing_result(db, photo_id, current_user.id)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No processing result found for this photo"
        )
    
    return result


@router.get("/{photo_id}/download")
def download_photo(
    photo_id: int,
    processed: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download original or processed photo
    
    Args:
        photo_id: Photo ID
        processed: Whether to download processed version
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        File response with the image
    """
    photo = PhotoService.get_photo_by_id(db, photo_id, current_user.id)
    
    if processed:
        result = PhotoService.get_processing_result(db, photo_id, current_user.id)
        if not result or not result.upscaled_path:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Processed image not available"
            )
        file_path = result.upscaled_path
        filename = f"processed_{photo.filename}"
    else:
        file_path = photo.original_path
        filename = photo.filename
    
    return FileResponse(
        path=file_path,
        media_type=photo.mime_type,
        filename=filename
    )


@router.delete("/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_photo(
    photo_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a photo
    
    Args:
        photo_id: Photo ID
        current_user: Current authenticated user
        db: Database session
    """
    PhotoService.delete_photo(db, photo_id, current_user.id)
    return {"message": "Photo deleted successfully"}
