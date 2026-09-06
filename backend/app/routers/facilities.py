"""Facilities API routes with RBAC, geographic scoping, pagination, and citizen public endpoints."""

from math import ceil
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import User, Facility, District, State, FacilityService, UserRoleEnum, FacilityTypeEnum
from app.schemas import (
    FacilityResponse, FacilityCreate, FacilityUpdate,
    PublicFacilityResponse, FacilityServiceCreate, FacilityServiceResponse,
    PaginatedFacilityResponse, PaginatedPublicFacilityResponse
)
from app.utils import get_current_user, require_roles, check_facility_access, normalize_role

router = APIRouter(prefix="/facilities", tags=["Facilities"])


# -------------------------------------------------------------------
# PUBLIC / CITIZEN SAFE ENDPOINTS
# -------------------------------------------------------------------

@router.get("/public", response_model=List[PublicFacilityResponse])
def list_public_facilities(
    state_id: Optional[int] = Query(None, description="Filter by state ID"),
    district_id: Optional[int] = Query(None, description="Filter by district ID"),
    type: Optional[FacilityTypeEnum] = Query(None, description="Filter by facility type"),
    operational_status: Optional[str] = Query(None, description="Filter by operational status"),
    search: Optional[str] = Query(None, description="Search by facility name"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """Public endpoint listing active healthcare facilities without sensitive administrative data."""
    query = db.query(Facility).options(joinedload(Facility.facility_services)).filter(Facility.is_active == True)

    if state_id is not None:
        query = query.join(District, Facility.district_id == District.id).filter(District.state_id == state_id)
    if district_id is not None:
        query = query.filter(Facility.district_id == district_id)
    if type is not None:
        query = query.filter(Facility.type == type)
    if operational_status:
        query = query.filter(func.lower(Facility.operational_status) == operational_status.lower())
    if search:
        query = query.filter(Facility.name.ilike(f"%{search}%"))

    facilities = query.offset(skip).limit(limit).all()
    return facilities


@router.get("/public/{facility_id}", response_model=PublicFacilityResponse)
def get_public_facility(facility_id: int, db: Session = Depends(get_db)):
    """Public endpoint to get facility details without sensitive administrative data."""
    facility = db.query(Facility).options(joinedload(Facility.facility_services)).filter(
        Facility.id == facility_id, Facility.is_active == True
    ).first()

    if not facility:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facility not found")

    return facility


# -------------------------------------------------------------------
# ADMINISTRATIVE FACILITIES ENDPOINTS
# -------------------------------------------------------------------

@router.get("/", response_model=List[FacilityResponse])
def list_facilities(
    state_id: Optional[int] = Query(None, description="Filter by State ID"),
    district_id: Optional[int] = Query(None, description="Filter by District ID"),
    type: Optional[FacilityTypeEnum] = Query(None, description="Filter by facility type"),
    operational_status: Optional[str] = Query(None, description="Filter by operational status"),
    search: Optional[str] = Query(None, description="Search by facility name"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List facilities scoped by user role, geographic hierarchy, with search, filters, and pagination."""
    user_role = normalize_role(current_user.role)

    if user_role == UserRoleEnum.CITIZEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Citizens do not have access to administrative facility listings"
        )

    query = db.query(Facility).options(joinedload(Facility.facility_services))

    # RBAC Boundary Scoping
    if user_role == UserRoleEnum.SUPER_ADMIN:
        pass
    elif user_role == UserRoleEnum.STATE_ADMIN:
        if current_user.state_id:
            query = query.join(District, Facility.district_id == District.id).filter(District.state_id == current_user.state_id)
        else:
            return []
    elif user_role == UserRoleEnum.DISTRICT_ADMIN:
        if current_user.district_id:
            query = query.filter(Facility.district_id == current_user.district_id)
        else:
            return []
    elif user_role in (UserRoleEnum.HOSPITAL_ADMIN, UserRoleEnum.FACILITY_STAFF):
        if current_user.facility_id:
            query = query.filter(Facility.id == current_user.facility_id)
        else:
            return []

    # Optional Filters
    if state_id is not None:
        if user_role == UserRoleEnum.STATE_ADMIN and current_user.state_id != state_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot filter outside assigned state")
        if user_role != UserRoleEnum.STATE_ADMIN:
            query = query.join(District, Facility.district_id == District.id).filter(District.state_id == state_id)

    if district_id is not None:
        if user_role == UserRoleEnum.DISTRICT_ADMIN and current_user.district_id != district_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot filter outside assigned district")
        query = query.filter(Facility.district_id == district_id)

    if type is not None:
        query = query.filter(Facility.type == type)

    if operational_status:
        query = query.filter(func.lower(Facility.operational_status) == operational_status.lower())

    if search:
        query = query.filter(Facility.name.ilike(f"%{search}%"))

    facilities = query.offset(skip).limit(limit).all()
    return facilities


@router.get("/{facility_id}", response_model=FacilityResponse)
def get_facility(
    facility_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get facility details by ID with RBAC and boundary validation."""
    facility = db.query(Facility).options(joinedload(Facility.facility_services)).filter(Facility.id == facility_id).first()
    if not facility:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facility not found")

    check_facility_access(current_user, facility, db)
    return facility


@router.post("/", response_model=FacilityResponse, status_code=status.HTTP_201_CREATED)
def create_facility(
    request: FacilityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRoleEnum.SUPER_ADMIN, UserRoleEnum.STATE_ADMIN, UserRoleEnum.DISTRICT_ADMIN
    ))
):
    """Create a new facility (Admin levels only with boundary check)."""
    user_role = normalize_role(current_user.role)

    # Validate District existence and geographic bounds
    if request.district_id:
        district = db.query(District).filter(District.id == request.district_id).first()
        if not district:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="District not found")

        if user_role == UserRoleEnum.DISTRICT_ADMIN:
            if current_user.district_id != request.district_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot create facility outside assigned district")
        elif user_role == UserRoleEnum.STATE_ADMIN:
            if current_user.state_id != district.state_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot create facility outside assigned state")

    facility = Facility(
        name=request.name,
        location=request.location,
        type=request.type,
        district_id=request.district_id,
        contact_email=request.contact_email,
        contact_phone=request.contact_phone,
        is_active=request.is_active,
        latitude=request.latitude,
        longitude=request.longitude,
        operational_status=request.operational_status or "OPERATIONAL"
    )

    db.add(facility)
    db.commit()
    db.refresh(facility)
    return facility


@router.put("/{facility_id}", response_model=FacilityResponse)
def update_facility(
    facility_id: int,
    request: FacilityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRoleEnum.SUPER_ADMIN, UserRoleEnum.STATE_ADMIN, UserRoleEnum.DISTRICT_ADMIN, UserRoleEnum.HOSPITAL_ADMIN
    ))
):
    """Update a facility with boundary validation."""
    facility = db.query(Facility).options(joinedload(Facility.facility_services)).filter(Facility.id == facility_id).first()
    if not facility:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facility not found")

    check_facility_access(current_user, facility, db)

    # Update supplied fields
    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(facility, key, value)

    db.commit()
    db.refresh(facility)
    return facility


@router.delete("/{facility_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_facility(
    facility_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRoleEnum.SUPER_ADMIN, UserRoleEnum.STATE_ADMIN
    ))
):
    """Delete a facility with boundary check."""
    facility = db.query(Facility).filter(Facility.id == facility_id).first()
    if not facility:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facility not found")

    check_facility_access(current_user, facility, db)

    db.delete(facility)
    db.commit()
    return None


# -------------------------------------------------------------------
# FACILITY SERVICES ENDPOINTS
# -------------------------------------------------------------------

@router.get("/{facility_id}/services", response_model=List[FacilityServiceResponse])
def get_facility_services(
    facility_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get services offered by a facility."""
    facility = db.query(Facility).filter(Facility.id == facility_id).first()
    if not facility:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facility not found")

    user_role = normalize_role(current_user.role)
    if user_role != UserRoleEnum.CITIZEN:
        check_facility_access(current_user, facility, db)

    services = db.query(FacilityService).filter(FacilityService.facility_id == facility_id).all()
    return services


@router.post("/{facility_id}/services", response_model=FacilityServiceResponse, status_code=status.HTTP_201_CREATED)
def add_facility_service(
    facility_id: int,
    request: FacilityServiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRoleEnum.SUPER_ADMIN, UserRoleEnum.STATE_ADMIN, UserRoleEnum.DISTRICT_ADMIN, UserRoleEnum.HOSPITAL_ADMIN, UserRoleEnum.FACILITY_STAFF
    ))
):
    """Add a service to a facility with boundary check."""
    facility = db.query(Facility).filter(Facility.id == facility_id).first()
    if not facility:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facility not found")

    check_facility_access(current_user, facility, db)

    # Check for existing service with same name
    existing = db.query(FacilityService).filter(
        FacilityService.facility_id == facility_id,
        FacilityService.service_name == request.service_name
    ).first()

    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Facility service already exists")

    service = FacilityService(
        facility_id=facility_id,
        service_name=request.service_name,
        is_available=request.is_available
    )

    db.add(service)
    db.commit()
    db.refresh(service)
    return service


@router.delete("/{facility_id}/services/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_facility_service(
    facility_id: int,
    service_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRoleEnum.SUPER_ADMIN, UserRoleEnum.STATE_ADMIN, UserRoleEnum.DISTRICT_ADMIN, UserRoleEnum.HOSPITAL_ADMIN
    ))
):
    """Remove a service from a facility with boundary check."""
    facility = db.query(Facility).filter(Facility.id == facility_id).first()
    if not facility:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facility not found")

    check_facility_access(current_user, facility, db)

    service = db.query(FacilityService).filter(
        FacilityService.id == service_id,
        FacilityService.facility_id == facility_id
    ).first()

    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facility service not found")

    db.delete(service)
    db.commit()
    return None