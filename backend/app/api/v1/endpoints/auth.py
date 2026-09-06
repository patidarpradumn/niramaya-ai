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
        if user_in.role:
            existing_user_by_uid.role = user_in.role
        if user_in.full_name:
            existing_user_by_uid.full_name = user_in.full_name
        if user_in.facility_id:
            existing_user_by_uid.facility_id = user_in.facility_id
        if user_in.state_id:
            existing_user_by_uid.state_id = user_in.state_id
        if user_in.district_id:
            existing_user_by_uid.district_id = user_in.district_id
        db.commit()
        db.refresh(existing_user_by_uid)
        return existing_user_by_uid

    # Check if user already exists by email (legacy link scenario)
    existing_user_by_email = db.query(User).filter(func.lower(User.email) == email_clean).first()
    if existing_user_by_email:
        existing_user_by_email.firebase_uid = token_data.firebase_uid
        if user_in.full_name:
            existing_user_by_email.full_name = user_in.full_name
        if user_in.role:
            existing_user_by_email.role = user_in.role
        if user_in.facility_id:
            existing_user_by_email.facility_id = user_in.facility_id
        if user_in.state_id:
            existing_user_by_email.state_id = user_in.state_id
        if user_in.district_id:
            existing_user_by_email.district_id = user_in.district_id
        db.commit()
        db.refresh(existing_user_by_email)
        return existing_user_by_email

    from app.models import ApprovalStatusEnum
    db_user = User(
        firebase_uid=token_data.firebase_uid,
        email=email_clean,
        full_name=user_in.full_name,
        password_hash=None, # Firebase handles auth
        role=user_in.role,
        facility_id=user_in.facility_id,
        state_id=user_in.state_id,
        district_id=user_in.district_id,
        is_active=True,
        approval_status=ApprovalStatusEnum.APPROVED
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
