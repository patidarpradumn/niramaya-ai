"""Users API routes with hierarchical RBAC, user management, and status updates."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserRole, ApprovalStatusEnum, District, Facility
from app.schemas import UserResponse, UserUpdate, UserStatusUpdate
from app.utils import get_current_user, require_roles, get_password_hash, normalize_role, UserRoleEnum
from app.services.audit_service import audit_service

router = APIRouter(prefix="/users", tags=["Users"])


def check_user_management_permission(current_user: User, target_user: User, db: Session) -> bool:
    """Verify if current user is authorized to manage the target user within their jurisdiction."""
    curr_role = normalize_role(current_user.role)
    target_role = normalize_role(target_user.role)

    if curr_role == UserRoleEnum.SUPER_ADMIN:
        return True

    if curr_role == UserRoleEnum.STATE_ADMIN:
        # State Admin can manage users within their state (District Admins, Facility Admins, Staff, Citizens of that state)
        if target_user.state_id and target_user.state_id == current_user.state_id:
            return True
        if target_user.district_id:
            dist = db.query(District).filter(District.id == target_user.district_id).first()
            if dist and dist.state_id == current_user.state_id:
                return True
        if target_user.facility_id:
            fac = db.query(Facility).filter(Facility.id == target_user.facility_id).first()
            if fac and fac.district_id:
                dist = db.query(District).filter(District.id == fac.district_id).first()
                if dist and dist.state_id == current_user.state_id:
                    return True
        return False

    if curr_role == UserRoleEnum.DISTRICT_ADMIN:
        # District Admin can manage users within their district
        if target_user.district_id and target_user.district_id == current_user.district_id:
            return True
        if target_user.facility_id:
            fac = db.query(Facility).filter(Facility.id == target_user.facility_id).first()
            if fac and fac.district_id == current_user.district_id:
                return True
        return False

    if curr_role in (UserRoleEnum.HOSPITAL_ADMIN, UserRoleEnum.FACILITY_ADMIN):
        # Facility Admin can manage staff within their facility
        if target_user.facility_id == current_user.facility_id and target_role in (UserRoleEnum.FACILITY_STAFF, UserRoleEnum.STAFF):
            return True
        return False

    return False


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return current_user


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


# User Management endpoints
@router.get("/", response_model=List[UserResponse])
def list_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List users scoped hierarchically by caller role and jurisdiction."""
    curr_role = normalize_role(current_user.role)

    if curr_role in (UserRoleEnum.FACILITY_STAFF, UserRoleEnum.STAFF, UserRoleEnum.CITIZEN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to manage users"
        )

    query = db.query(User)

    if curr_role == UserRoleEnum.SUPER_ADMIN:
        pass
    elif curr_role == UserRoleEnum.STATE_ADMIN:
        if current_user.state_id:
            query = query.filter(
                (User.state_id == current_user.state_id) |
                (User.district_id.in_(
                    db.query(District.id).filter(District.state_id == current_user.state_id)
                ))
            )
        else:
            return []
    elif curr_role == UserRoleEnum.DISTRICT_ADMIN:
        if current_user.district_id:
            query = query.filter(
                (User.district_id == current_user.district_id) |
                (User.facility_id.in_(
                    db.query(Facility.id).filter(Facility.district_id == current_user.district_id)
                ))
            )
        else:
            return []
    elif curr_role in (UserRoleEnum.HOSPITAL_ADMIN, UserRoleEnum.FACILITY_ADMIN):
        if current_user.facility_id:
            query = query.filter(
                User.facility_id == current_user.facility_id,
                User.role.in_([UserRoleEnum.FACILITY_STAFF, UserRoleEnum.STAFF])
            )
        else:
            return []

    users = query.offset(skip).limit(limit).all()
    return users


@router.get("/pending", response_model=List[UserResponse])
def get_pending_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.STATE_ADMIN, UserRole.DISTRICT_ADMIN))
):
    """Get list of pending user registrations based on hierarchy."""
    query = db.query(User).filter(User.approval_status == ApprovalStatusEnum.PENDING)
    curr_role = normalize_role(current_user.role)

    if curr_role == UserRoleEnum.SUPER_ADMIN:
        query = query.filter(User.role == UserRole.STATE_ADMIN)
    elif curr_role == UserRoleEnum.STATE_ADMIN:
        query = query.filter(
            User.role == UserRole.DISTRICT_ADMIN,
            User.state_id == current_user.state_id
        )
    elif curr_role == UserRoleEnum.DISTRICT_ADMIN:
        query = query.filter(
            User.role.in_([UserRole.HOSPITAL_ADMIN, UserRole.FACILITY_STAFF, UserRole.FACILITY_ADMIN, UserRole.STAFF]),
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
    user.is_active = True
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
    user.is_active = False
    user.approved_by_id = current_user.id
    db.commit()
    db.refresh(user)
    
    audit_service.create_log(
        db=db, user_id=current_user.id, action="USER_REJECTED",
        entity_type="user", entity_id=user.id,
        details={"rejected_user_email": user.email}
    )
    return user


@router.put("/{user_id}/status", response_model=UserResponse)
def update_user_status(
    user_id: int,
    status_in: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update user status (ACTIVE, INACTIVE, or SUSPENDED) with hierarchical permission checks."""
    curr_role = normalize_role(current_user.role)
    if curr_role in (UserRoleEnum.FACILITY_STAFF, UserRoleEnum.STAFF, UserRoleEnum.CITIZEN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to modify user status"
        )

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if not check_user_management_permission(current_user, target_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Cannot manage user outside your jurisdiction"
        )

    clean_status = status_in.status.upper().strip()
    if clean_status == "ACTIVE":
        target_user.is_active = True
        target_user.approval_status = ApprovalStatusEnum.APPROVED
    elif clean_status == "INACTIVE":
        target_user.is_active = False
    elif clean_status == "SUSPENDED":
        target_user.is_active = False
        target_user.approval_status = ApprovalStatusEnum.REJECTED
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be ACTIVE, INACTIVE, or SUSPENDED"
        )

    if status_in.is_active is not None:
        target_user.is_active = status_in.is_active

    db.commit()
    db.refresh(target_user)

    audit_service.create_log(
        db=db,
        user_id=current_user.id,
        action="USER_STATUS_UPDATED",
        entity_type="user",
        entity_id=target_user.id,
        details={"new_status": clean_status, "is_active": target_user.is_active}
    )
    return target_user


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user by ID with jurisdiction checks."""
    curr_role = normalize_role(current_user.role)
    if curr_role in (UserRoleEnum.FACILITY_STAFF, UserRoleEnum.STAFF, UserRoleEnum.CITIZEN):
        if current_user.id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id != current_user.id and not check_user_management_permission(current_user, user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: User is outside your jurisdiction"
        )
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))
):
    """Delete user (Super Admin only)."""
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