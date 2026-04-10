"""User Pydantic schemas"""
from pydantic import BaseModel, EmailStr, validator
from typing import Optional
from datetime import datetime


# User Registration
class UserCreate(BaseModel):
    """Schema for user registration"""
    email: EmailStr
    username: str
    password: str
    full_name: Optional[str] = None
    
    @validator("username")
    def username_alphanumeric(cls, v):
        assert v.replace("_", "").replace("-", "").isalnum(), "Username must be alphanumeric"
        assert len(v) >= 3, "Username must be at least 3 characters"
        return v
    
    @validator("password")
    def password_strength(cls, v):
        assert len(v) >= 8, "Password must be at least 8 characters"
        return v


# User Login
class UserLogin(BaseModel):
    """Schema for user login"""
    username: str
    password: str


# User Response
class UserResponse(BaseModel):
    """Schema for user response"""
    id: int
    email: str
    username: str
    full_name: Optional[str]
    is_active: bool
    is_superuser: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# Token Response
class Token(BaseModel):
    """Schema for authentication token"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# Token Payload
class TokenPayload(BaseModel):
    """Schema for token payload"""
    sub: Optional[int] = None
    exp: Optional[int] = None
    type: Optional[str] = None


# User Update
class UserUpdate(BaseModel):
    """Schema for updating user information"""
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    password: Optional[str] = None
    
    @validator("password")
    def password_strength(cls, v):
        if v is not None:
            assert len(v) >= 8, "Password must be at least 8 characters"
        return v
