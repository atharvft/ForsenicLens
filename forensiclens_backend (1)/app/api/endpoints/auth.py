"""Authentication API endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token, UserUpdate
from app.services.auth_service import AuthService
from app.api.dependencies.auth import get_current_user
from app.models.user import User

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    """Register a new user
    
    Args:
        user_data: User registration information
        db: Database session
        
    Returns:
        Created user object
    """
    user = AuthService.create_user(db, user_data)
    return user


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login and get access token
    
    Args:
        form_data: OAuth2 login form (username and password)
        db: Database session
        
    Returns:
        Access and refresh tokens
    """
    login_data = UserLogin(username=form_data.username, password=form_data.password)
    user = AuthService.authenticate_user(db, login_data)
    tokens = AuthService.generate_tokens(user)
    return tokens


@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current user information
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        Current user object
    """
    return current_user


@router.put("/me", response_model=UserResponse)
def update_current_user(
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user information
    
    Args:
        user_data: Updated user data
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Updated user object
    """
    updated_user = AuthService.update_user(db, current_user.id, user_data)
    return updated_user


@router.post("/refresh", response_model=Token)
def refresh_token(
    refresh_token: str,
    db: Session = Depends(get_db)
):
    """Refresh access token using refresh token
    
    Args:
        refresh_token: Valid refresh token
        db: Database session
        
    Returns:
        New access and refresh tokens
    """
    from app.core.security import decode_token
    from jose import JWTError
    
    try:
        payload = decode_token(refresh_token)
        token_type = payload.get("type")
        user_id = payload.get("sub")
        
        if token_type != "refresh" or not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        user = AuthService.get_user_by_id(db, int(user_id))
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        tokens = AuthService.generate_tokens(user)
        return tokens
    
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
