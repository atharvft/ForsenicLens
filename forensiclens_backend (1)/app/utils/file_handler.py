"""File handling utilities for image uploads and storage"""
import os
import uuid
import shutil
from pathlib import Path
from typing import Optional, Tuple
from fastapi import UploadFile, HTTPException, status
from PIL import Image
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


class FileHandler:
    """Handle file uploads, storage, and validation"""
    
    def __init__(self):
        """Initialize file handler and create necessary directories"""
        self.upload_dir = Path(settings.UPLOAD_DIR)
        self.processed_dir = Path(settings.PROCESSED_DIR)
        
        # Create directories if they don't exist
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.processed_dir.mkdir(parents=True, exist_ok=True)
    
    def validate_file(self, file: UploadFile) -> None:
        """Validate uploaded file
        
        Args:
            file: Uploaded file object
            
        Raises:
            HTTPException: If file validation fails
        """
        # Check file size
        if file.size and file.size > settings.MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE / (1024*1024):.2f} MB"
            )
        
        # Check file extension
        file_ext = file.filename.split(".")[-1].lower() if file.filename else ""
        if file_ext not in settings.ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type not allowed. Allowed types: {', '.join(settings.ALLOWED_EXTENSIONS)}"
            )
        
        # Check MIME type
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must be an image"
            )
    
    def generate_unique_filename(self, original_filename: str) -> str:
        """Generate a unique filename while preserving the extension
        
        Args:
            original_filename: Original filename from upload
            
        Returns:
            Unique filename with UUID
        """
        file_ext = original_filename.split(".")[-1].lower() if original_filename else "jpg"
        unique_id = uuid.uuid4().hex
        return f"{unique_id}.{file_ext}"
    
    async def save_upload_file(self, file: UploadFile) -> Tuple[str, int, str, Tuple[int, int]]:
        """Save uploaded file to disk
        
        Args:
            file: Uploaded file object
            
        Returns:
            Tuple of (file_path, file_size, mime_type, (width, height))
        """
        try:
            # Validate file
            self.validate_file(file)
            
            # Generate unique filename
            unique_filename = self.generate_unique_filename(file.filename)
            file_path = self.upload_dir / unique_filename
            
            # Save file
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # Get file size
            file_size = os.path.getsize(file_path)
            
            # Get image dimensions
            try:
                with Image.open(file_path) as img:
                    width, height = img.size
            except Exception as e:
                logger.warning(f"Could not read image dimensions: {str(e)}")
                width, height = 0, 0
            
            logger.info(f"File saved: {file_path} ({file_size} bytes)")
            return str(file_path), file_size, file.content_type, (width, height)
        
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error saving file: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error saving file: {str(e)}"
            )
    
    def get_file_path(self, filename: str, processed: bool = False) -> Path:
        """Get full path for a file
        
        Args:
            filename: Filename
            processed: Whether to get path from processed directory
            
        Returns:
            Full file path
        """
        base_dir = self.processed_dir if processed else self.upload_dir
        return base_dir / filename
    
    def delete_file(self, file_path: str) -> None:
        """Delete a file from disk
        
        Args:
            file_path: Path to the file to delete
        """
        try:
            path = Path(file_path)
            if path.exists():
                path.unlink()
                logger.info(f"File deleted: {file_path}")
        except Exception as e:
            logger.error(f"Error deleting file {file_path}: {str(e)}")
    
    def get_processed_filename(self, original_filename: str, suffix: str = "_upscaled") -> str:
        """Generate filename for processed image
        
        Args:
            original_filename: Original filename
            suffix: Suffix to add to filename
            
        Returns:
            Processed filename
        """
        name_parts = original_filename.rsplit(".", 1)
        if len(name_parts) == 2:
            return f"{name_parts[0]}{suffix}.{name_parts[1]}"
        return f"{original_filename}{suffix}"


# Singleton instance
_file_handler = None


def get_file_handler() -> FileHandler:
    """Get or create the file handler singleton instance"""
    global _file_handler
    if _file_handler is None:
        _file_handler = FileHandler()
    return _file_handler
