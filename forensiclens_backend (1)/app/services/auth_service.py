"""Authentication service for user management"""
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from typing import Optional
import logging

from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserUpdate
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token

logger = logging.getLogger(__name__)


class AuthService:
    """Service for authentication and user management"""
    
    @staticmethod
    def create_user(db: Session, user_data: UserCreate) -> User:
        """Create a new user
        
        Args:
            db: Database session
            user_data: User registration data
            
        Returns:
            Created user object
            
        Raises:
            HTTPException: If user already exists
        """
        # Check if user already exists
        existing_user = db.query(User).filter(
            (User.email == user_data.email) | (User.username == user_data.username)
        ).first()
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email or username already exists"
            )
        
        # Create new user
        hashed_password = get_password_hash(user_data.password)
        db_user = User(
            email=user_data.email,
            username=user_data.username,
            hashed_password=hashed_password,
            full_name=user_data.full_name
        )
        
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        
        logger.info(f"User created: {db_user.username}")
        return db_user
    
    @staticmethod
    def authenticate_user(db: Session, login_data: UserLogin) -> User:
        """Authenticate a user
        
        Args:
            db: Database session
            login_data: User login credentials
            
        Returns:
            Authenticated user object
            
        Raises:
            HTTPException: If authentication fails
        """
        user = db.query(User).filter(User.username == login_data.username).first()
        
        if not user or not verify_password(login_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user"
            )
        
        logger.info(f"User authenticated: {user.username}")
        return user
    
    @staticmethod
    def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
        """Get user by ID
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            User object or None
        """
        return db.query(User).filter(User.id == user_id).first()
    
    @staticmethod
    def get_user_by_username(db: Session, username: str) -> Optional[User]:
        """Get user by username
        
        Args:
            db: Database session
            username: Username
            
        Returns:
            User object or None
        """
        return db.query(User).filter(User.username == username).first()
    
    @staticmethod
    def update_user(db: Session, user_id: int, user_data: UserUpdate) -> User:
        """Update user information
        
        Args:
            db: Database session
            user_id: User ID
            user_data: Updated user data
            
        Returns:
            Updated user object
            
        Raises:
            HTTPException: If user not found
        """
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Update fields
        if user_data.email is not None:
            user.email = user_data.email
        if user_data.full_name is not None:
            user.full_name = user_data.full_name
        if user_data.password is not None:
            user.hashed_password = get_password_hash(user_data.password)
        
        db.commit()
        db.refresh(user)
        
        logger.info(f"User updated: {user.username}")
        return user
    
    @staticmethod
    def generate_tokens(user: User) -> dict:
        """Generate access and refresh tokens for a user
        
        Args:
            user: User object
            
        Returns:
            Dictionary with access_token, refresh_token, and token_type
        """
        access_token = create_access_token(data={"sub": str(user.id)})
        refresh_token = create_refresh_token(data={"sub": str(user.id)})
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer"
        }
