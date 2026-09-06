"""Equipment API routes for Equipment & Maintenance management."""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import math

from app.database import get_db
from app.models import User, EquipmentStatusEnum, UserRoleEnum
from app.schemas import (
    EquipmentResponse, EquipmentCreate, EquipmentUpdate,
    PaginatedEquipmentResponse, MaintenanceRecordResponse,
    EquipmentDowntimeAnalysis, MessageResponse
)
from app.utils import get_current_user, require_roles
from app.services.equipment_service import equipment_service

router = APIRouter(prefix="/equipment", tags=["Equipment"])


@router.post("", response_model=EquipmentResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=EquipmentResponse, status_code=status.HTTP_201_CREATED)
def create_equipment(
    data: EquipmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([
        UserRoleEnum.SUPER_ADMIN, UserRoleEnum.STATE_ADMIN,
        UserRoleEnum.DISTRICT_ADMIN, UserRoleEnum.HOSPITAL_ADMIN
    ]))
):
    """Create new medical equipment record."""
    equipment = equipment_service.create_equipment(db, data, current_user)
    return equipment


@router.get("/overdue", response_model=List[EquipmentResponse])
def get_overdue_equipment(
    facility_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all equipment that is overdue for maintenance."""
    items, _ = equipment_service.list_equipment(
        db=db,
        user=current_user,
        facility_id=facility_id,
        is_overdue=True,
        limit=1000
    )
    return items


@router.get("", response_model=List[EquipmentResponse])
@router.get("/", response_model=List[EquipmentResponse])
def list_equipment(
    facility_id: Optional[int] = None,
    status_filter: Optional[EquipmentStatusEnum] = Query(None, alias="status"),
    equipment_type: Optional[str] = Query(None),
    is_overdue: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List equipment with optional filters and facility-level RBAC."""
    items, _ = equipment_service.list_equipment(
        db=db,
        user=current_user,
        facility_id=facility_id,
        status_filter=status_filter,
        equipment_type=equipment_type,
        is_overdue=is_overdue,
        search=search,
        skip=skip,
        limit=limit
    )
    return items


@router.get("/{equipment_id}", response_model=EquipmentResponse)
def get_equipment(
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get equipment by ID with RBAC check."""
    return equipment_service.get_equipment(db, equipment_id, current_user)


@router.put("/{equipment_id}", response_model=EquipmentResponse)
@router.patch("/{equipment_id}", response_model=EquipmentResponse)
def update_equipment(
    equipment_id: int,
    data: EquipmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([
        UserRoleEnum.SUPER_ADMIN, UserRoleEnum.STATE_ADMIN,
        UserRoleEnum.DISTRICT_ADMIN, UserRoleEnum.HOSPITAL_ADMIN,
        UserRoleEnum.FACILITY_STAFF
    ]))
):
    """Update equipment details or perform status transitions."""
    return equipment_service.update_equipment(db, equipment_id, data, current_user)


@router.delete("/{equipment_id}", response_model=MessageResponse)
def delete_equipment(
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([
        UserRoleEnum.SUPER_ADMIN, UserRoleEnum.STATE_ADMIN,
        UserRoleEnum.DISTRICT_ADMIN, UserRoleEnum.HOSPITAL_ADMIN
    ]))
):
    """Delete an equipment record."""
    equipment_service.delete_equipment(db, equipment_id, current_user)
    return MessageResponse(message=f"Equipment ID {equipment_id} deleted successfully.")


@router.get("/{equipment_id}/downtime", response_model=EquipmentDowntimeAnalysis)
def get_equipment_downtime(
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get equipment downtime calculation and availability statistics."""
    return equipment_service.calculate_downtime_and_uptime(db, equipment_id, current_user)


@router.get("/{equipment_id}/maintenance", response_model=List[MaintenanceRecordResponse])
def get_equipment_maintenance_history(
    equipment_id: int,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get maintenance history records for specific equipment."""
    records, _ = equipment_service.list_maintenance_records(
        db=db,
        user=current_user,
        equipment_id=equipment_id,
        skip=skip,
        limit=limit
    )
    return records
