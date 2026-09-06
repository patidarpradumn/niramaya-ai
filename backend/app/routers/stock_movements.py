"""Stock Movement API routes delegating business logic to StockMovementService."""

from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.db.session import get_db
from app.models import User, UserRoleEnum, StockMovementTypeEnum
from app.schemas import StockMovementResponse, StockMovementCreate
from app.services.stock_movement_service import StockMovementService
from app.utils import get_current_user, require_roles

router = APIRouter(prefix="/stock-movements", tags=["Stock Movements"])


@router.post("/", response_model=StockMovementResponse, status_code=status.HTTP_201_CREATED)
def record_stock_movement(
    request: StockMovementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRoleEnum.SUPER_ADMIN,
        UserRoleEnum.STATE_ADMIN,
        UserRoleEnum.DISTRICT_ADMIN,
        UserRoleEnum.HOSPITAL_ADMIN,
        UserRoleEnum.FACILITY_STAFF
    ))
):
    """Record a new stock movement with transaction safety, stock validation, and audit logging."""
    return StockMovementService.record_movement(
        db=db,
        movement_in=request,
        current_user=current_user
    )


@router.get("/", response_model=List[StockMovementResponse])
def list_stock_movements(
    facility_id: Optional[int] = Query(None, description="Filter by facility ID"),
    item_id: Optional[int] = Query(None, description="Filter by item ID"),
    movement_type: Optional[StockMovementTypeEnum] = Query(None, description="Filter by movement type"),
    start_date: Optional[datetime] = Query(None, description="Filter from start date"),
    end_date: Optional[datetime] = Query(None, description="Filter to end date"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Max records to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List stock movements filtered by facility, item, movement type, and date range."""
    movements, total = StockMovementService.list_movements(
        db=db,
        current_user=current_user,
        skip=skip,
        limit=limit,
        facility_id=facility_id,
        item_id=item_id,
        movement_type=movement_type,
        start_date=start_date,
        end_date=end_date
    )
    return movements
