"""Consumption API routes delegating business logic to ConsumptionService."""

from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.db.session import get_db
from app.models import User, UserRoleEnum
from app.schemas import (
    ConsumptionCreate, ConsumptionResponse,
    ConsumptionSummaryResponse, MLInputPreparationResponse
)
from app.services.consumption_service import ConsumptionService
from app.utils import get_current_user, require_roles

router = APIRouter(prefix="/consumption", tags=["Consumption Records"])


@router.post("/", response_model=ConsumptionResponse, status_code=status.HTTP_201_CREATED)
def create_consumption_record(
    request: ConsumptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRoleEnum.SUPER_ADMIN,
        UserRoleEnum.STATE_ADMIN,
        UserRoleEnum.DISTRICT_ADMIN,
        UserRoleEnum.HOSPITAL_ADMIN,
        UserRoleEnum.FACILITY_STAFF
    ))
):
    """Record a historical resource consumption entry."""
    return ConsumptionService.create_consumption_record(
        db=db,
        user=current_user,
        data=request
    )


@router.get("/summary", response_model=ConsumptionSummaryResponse)
def get_consumption_summary(
    facility_id: Optional[int] = Query(None, description="Filter by facility ID"),
    item_id: Optional[int] = Query(None, description="Filter by item ID"),
    start_date: Optional[datetime] = Query(None, description="Filter from start date"),
    end_date: Optional[datetime] = Query(None, description="Filter to end date"),
    period: str = Query("daily", description="Aggregation period: 'daily' or 'weekly'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Aggregate historical consumption daily or weekly."""
    return ConsumptionService.aggregate_consumption(
        db=db,
        user=current_user,
        facility_id=facility_id,
        item_id=item_id,
        start_date=start_date,
        end_date=end_date,
        period=period
    )


@router.get("/ml-input", response_model=MLInputPreparationResponse)
def prepare_ml_input_data(
    facility_id: Optional[int] = Query(None, description="Filter by facility ID"),
    item_id: Optional[int] = Query(None, description="Filter by item ID"),
    start_date: Optional[datetime] = Query(None, description="Filter from start date"),
    end_date: Optional[datetime] = Query(None, description="Filter to end date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Extract and format historical consumption into time-series data points structured for ML engines."""
    return ConsumptionService.prepare_ml_input(
        db=db,
        user=current_user,
        facility_id=facility_id,
        item_id=item_id,
        start_date=start_date,
        end_date=end_date
    )


@router.get("/", response_model=List[ConsumptionResponse])
def list_consumption_records(
    facility_id: Optional[int] = Query(None, description="Filter by facility ID"),
    item_id: Optional[int] = Query(None, description="Filter by item ID"),
    start_date: Optional[datetime] = Query(None, description="Filter from start date"),
    end_date: Optional[datetime] = Query(None, description="Filter to end date"),
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Max records to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List historical consumption records with filtering and pagination."""
    records, total = ConsumptionService.list_consumption_records(
        db=db,
        user=current_user,
        facility_id=facility_id,
        item_id=item_id,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit
    )
    return records


@router.get("/{record_id}", response_model=ConsumptionResponse)
def get_consumption_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve details for a specific consumption record by ID."""
    return ConsumptionService.get_consumption_record(
        db=db,
        user=current_user,
        record_id=record_id
    )
