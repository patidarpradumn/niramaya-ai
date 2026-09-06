"""Authentication endpoints for MediGuard AI."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy import func
from sqlalchemy.orm import Session
from jose import JWTError

from app.db.session import get_db
from app.models import User, UserRoleEnum
from app.schemas import (
    TokenData,
    UserRegister,
    UserResponse,
    MessageResponse
)
from app.utils import (
    get_current_active_user,
    get_current_firebase_user
)

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED, summary="Register application profile from Firebase token")
def register(
    user_in: UserRegister,
    token_data: TokenData = Depends(get_current_firebase_user),
    db: Session = Depends(get_db)
):
    """Register a new user using Firebase ID token."""
    email_clean = token_data.email.strip().lower()
    
    # Check if user already exists by firebase_uid
    existing_user_by_uid = db.query(User).filter(User.firebase_uid == token_data.firebase_uid).first()
    if existing_user_by_uid:
        return existing_user_by_uid

    # Check if user already exists by email (legacy link scenario)
    existing_user_by_email = db.query(User).filter(func.lower(User.email) == email_clean).first()
    if existing_user_by_email:
        if existing_user_by_email.firebase_uid is None:
            existing_user_by_email.firebase_uid = token_data.firebase_uid
            db.commit()
            db.refresh(existing_user_by_email)
            return existing_user_by_email
        elif existing_user_by_email.firebase_uid != token_data.firebase_uid:
            raise HTTPException(
                status_code=400,
                detail="Email already registered with a different identity provider account"
            )

    # Note: Authorization check for non-citizens can be added here if needed.
    # Currently we only allow citizens through public registration.
    if user_in.role != UserRoleEnum.CITIZEN:
        # Check if caller has permission
        caller_role = getattr(token_data, "role", UserRoleEnum.CITIZEN)
        if caller_role not in [UserRoleEnum.SUPER_ADMIN, UserRoleEnum.STATE_ADMIN]:
             raise HTTPException(
                 status_code=status.HTTP_403_FORBIDDEN,
                 detail="Registration of non-citizen roles is restricted to administrators"
             )

    db_user = User(
        firebase_uid=token_data.firebase_uid,
        email=email_clean,
        full_name=user_in.full_name,
        password_hash=None, # Firebase handles auth
        role=user_in.role,
        facility_id=user_in.facility_id,
        state_id=user_in.state_id,
        district_id=user_in.district_id,
        is_active=True
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user

@router.get("/me", response_model=UserResponse, summary="Get current logged in user profile")
def get_me(current_user: User = Depends(get_current_active_user)):
    """Return the profile of the currently authenticated active user."""
    return current_user


@router.post("/logout", response_model=MessageResponse, summary="Logout user session")
def logout(current_user: User = Depends(get_current_active_user)):
    """Logout current user session. Firebase handles actual auth token invalidation client-side."""
    return MessageResponse(message="Successfully logged out")
