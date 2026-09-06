"""Inventory API routes delegating business logic to InventoryService."""

from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.session import get_db
from app.models import User, UserRoleEnum
from app.schemas import (
    InventoryResponse,
    InventoryCreate,
    InventoryUpdate,
    PaginatedInventoryResponse,
    StockMovementResponse
)
from app.services.inventory_service import InventoryService
from app.services.stock_movement_service import StockMovementService
from app.utils import get_current_user, require_roles

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("/", response_model=List[InventoryResponse])
def list_inventory(
    facility_id: Optional[int] = Query(None, description="Filter by facility ID"),
    item_id: Optional[int] = Query(None, description="Filter by catalog item ID"),
    category: Optional[str] = Query(None, description="Filter by item category"),
    is_low_stock: Optional[bool] = Query(None, description="Filter for low stock items"),
    batch_number: Optional[str] = Query(None, description="Filter by batch number"),
    search: Optional[str] = Query(None, description="Search by item name or code"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Max records to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List inventory items scoped by user role, location hierarchy, and filters."""
    items, total = InventoryService.list_inventory(
        db=db,
        current_user=current_user,
        skip=skip,
        limit=limit,
        facility_id=facility_id,
        item_id=item_id,
        category=category,
        is_low_stock=is_low_stock,
        batch_number=batch_number,
        search=search
    )
    return items


@router.get("/low-stock", response_model=List[InventoryResponse])
def get_low_stock(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Max records to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Identify inventory items with stock at or below minimum threshold."""
    items, total = InventoryService.get_low_stock_inventory(
        db=db,
        current_user=current_user,
        skip=skip,
        limit=limit
    )
    return items


@router.get("/{inventory_id}/movements", response_model=List[StockMovementResponse])
def get_inventory_movements(
    inventory_id: int,
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Max records to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get stock movements for a specific inventory record."""
    movements, total = StockMovementService.list_movements(
        db=db,
        current_user=current_user,
        skip=skip,
        limit=limit,
        inventory_id=inventory_id
    )
    return movements


@router.get("/{item_id}", response_model=InventoryResponse)
def get_inventory_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get specific inventory item by ID with boundary access check."""
    return InventoryService.get_inventory_by_id(
        db=db,
        inventory_id=item_id,
        current_user=current_user
    )


@router.post("/", response_model=InventoryResponse, status_code=status.HTTP_201_CREATED)
def create_inventory_item(
    request: InventoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRoleEnum.SUPER_ADMIN,
        UserRoleEnum.STATE_ADMIN,
        UserRoleEnum.DISTRICT_ADMIN,
        UserRoleEnum.HOSPITAL_ADMIN,
        UserRoleEnum.FACILITY_STAFF
    ))
):
    """Create a new inventory item with quantity validation and facility access check."""
    return InventoryService.create_inventory(
        db=db,
        inv_in=request,
        current_user=current_user
    )


@router.put("/{item_id}", response_model=InventoryResponse)
def update_inventory_item(
    item_id: int,
    request: InventoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRoleEnum.SUPER_ADMIN,
        UserRoleEnum.STATE_ADMIN,
        UserRoleEnum.DISTRICT_ADMIN,
        UserRoleEnum.HOSPITAL_ADMIN,
        UserRoleEnum.FACILITY_STAFF
    ))
):
    """Update inventory item stock levels and thresholds."""
    return InventoryService.update_inventory(
        db=db,
        inventory_id=item_id,
        inv_in=request,
        current_user=current_user
    )


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_inventory_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRoleEnum.SUPER_ADMIN,
        UserRoleEnum.STATE_ADMIN,
        UserRoleEnum.DISTRICT_ADMIN,
        UserRoleEnum.HOSPITAL_ADMIN
    ))
):
    """Delete an inventory record with boundary access check."""
    InventoryService.delete_inventory(
        db=db,
        inventory_id=item_id,
        current_user=current_user
    )
    return None