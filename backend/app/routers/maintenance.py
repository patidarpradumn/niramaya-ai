"""Maintenance API routes for Equipment Maintenance management."""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models import User, MaintenanceRecord, UserRoleEnum
from app.schemas import (
    MaintenanceRecordResponse, MaintenanceRecordCreate, PaginatedMaintenanceResponse
)
from app.utils import get_current_user, require_roles
from app.services.equipment_service import equipment_service

router = APIRouter(prefix="/maintenance", tags=["Maintenance"])


@router.post("", response_model=MaintenanceRecordResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=MaintenanceRecordResponse, status_code=status.HTTP_201_CREATED)
def create_maintenance_record(
    data: MaintenanceRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([
        UserRoleEnum.SUPER_ADMIN, UserRoleEnum.STATE_ADMIN,
        UserRoleEnum.DISTRICT_ADMIN, UserRoleEnum.HOSPITAL_ADMIN,
        UserRoleEnum.FACILITY_STAFF
    ]))
):
    """Log a maintenance record for medical equipment."""
    record = equipment_service.create_maintenance_record(db, data, current_user)
    return record


@router.get("", response_model=List[MaintenanceRecordResponse])
@router.get("/", response_model=List[MaintenanceRecordResponse])
def list_maintenance_records(
    equipment_id: Optional[int] = None,
    facility_id: Optional[int] = None,
    maintenance_type: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List maintenance records with filtering and RBAC checks."""
    records, _ = equipment_service.list_maintenance_records(
        db=db,
        user=current_user,
        equipment_id=equipment_id,
        facility_id=facility_id,
        maintenance_type=maintenance_type,
        skip=skip,
        limit=limit
    )
    return records


@router.get("/{maintenance_id}", response_model=MaintenanceRecordResponse)
def get_maintenance_record(
    maintenance_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get single maintenance record details by ID."""
    record = db.query(MaintenanceRecord).filter(MaintenanceRecord.id == maintenance_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Maintenance record not found")

    # Access check via parent equipment
    equipment_service.get_equipment(db, record.equipment_id, current_user)

    return record
