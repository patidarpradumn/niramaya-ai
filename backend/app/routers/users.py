"""Users API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import User, UserRole, ApprovalStatusEnum
from app.schemas import UserResponse, UserUpdate
from app.utils import get_current_user, require_roles, get_password_hash

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return current_user


from app.services.audit_service import audit_service


@router.put("/me", response_model=UserResponse)
def update_current_user(
    request: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user profile."""
    changes = []
    if request.full_name:
        current_user.full_name = request.full_name
        changes.append("full_name")
    if request.password:
        current_user.password_hash = get_password_hash(request.password)
        changes.append("password")

    db.commit()
    db.refresh(current_user)

    audit_service.create_log(
        db=db,
        user_id=current_user.id,
        action="USER_UPDATED_PROFILE",
        entity_type="user",
        entity_id=current_user.id,
        details={"updated_fields": changes}
    )
    return current_user


# Admin-only endpoints
@router.get("/", response_model=List[UserResponse])
def list_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """List all users (admin only)."""
    users = db.query(User).offset(skip).limit(limit).all()
    return users


@router.get("/pending", response_model=List[UserResponse])
def get_pending_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.STATE_ADMIN, UserRole.DISTRICT_ADMIN))
):
    """Get list of pending user registrations based on hierarchy."""
    query = db.query(User).filter(User.approval_status == ApprovalStatusEnum.PENDING)
    
    if current_user.role == UserRole.SUPER_ADMIN:
        query = query.filter(User.role == UserRole.STATE_ADMIN)
    elif current_user.role == UserRole.STATE_ADMIN:
        query = query.filter(
            User.role == UserRole.DISTRICT_ADMIN,
            User.state_id == current_user.state_id
        )
    elif current_user.role == UserRole.DISTRICT_ADMIN:
        query = query.filter(
            User.role.in_([UserRole.HOSPITAL_ADMIN, UserRole.FACILITY_STAFF]),
            User.district_id == current_user.district_id
        )
    return query.all()


@router.post("/{user_id}/approve", response_model=UserResponse)
def approve_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.STATE_ADMIN, UserRole.DISTRICT_ADMIN))
):
    """Approve a pending user registration."""
    user = db.query(User).filter(User.id == user_id, User.approval_status == ApprovalStatusEnum.PENDING).first()
    if not user:
        raise HTTPException(status_code=404, detail="Pending user not found")
        
    user.approval_status = ApprovalStatusEnum.APPROVED
    user.approved_by_id = current_user.id
    db.commit()
    db.refresh(user)
    
    audit_service.create_log(
        db=db, user_id=current_user.id, action="USER_APPROVED",
        entity_type="user", entity_id=user.id,
        details={"approved_user_email": user.email}
    )
    return user


@router.post("/{user_id}/reject", response_model=UserResponse)
def reject_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.STATE_ADMIN, UserRole.DISTRICT_ADMIN))
):
    """Reject a pending user registration."""
    user = db.query(User).filter(User.id == user_id, User.approval_status == ApprovalStatusEnum.PENDING).first()
    if not user:
        raise HTTPException(status_code=404, detail="Pending user not found")
        
    user.approval_status = ApprovalStatusEnum.REJECTED
    user.approved_by_id = current_user.id
    db.commit()
    db.refresh(user)
    
    audit_service.create_log(
        db=db, user_id=current_user.id, action="USER_REJECTED",
        entity_type="user", entity_id=user.id,
        details={"rejected_user_email": user.email}
    )
    return user


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Get user by ID (admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Delete user (admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent self-deletion
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    deleted_user_email = user.email
    db.delete(user)
    db.commit()

    audit_service.create_log(
        db=db,
        user_id=current_user.id,
        action="USER_DELETED",
        entity_type="user",
        entity_id=user_id,
        details={"target_email": deleted_user_email}
    )
    return None