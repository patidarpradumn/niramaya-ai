"""Items Catalog API routes."""

from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.orm import Session
from typing import Optional, List

from app.db.session import get_db
from app.models import User, UserRoleEnum
from app.schemas import (
    ItemCreate,
    ItemUpdate,
    ItemResponse,
    PaginatedItemResponse
)
from app.services.item_service import ItemService
from app.utils import get_current_user, require_roles

router = APIRouter(prefix="/items", tags=["Items Catalog"])


@router.get("/", response_model=PaginatedItemResponse)
def list_items(
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(50, ge=1, le=100, description="Page size"),
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search by name or code"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List medical items catalog with pagination and search."""
    skip = (page - 1) * size
    items, total = ItemService.list_items(
        db=db,
        skip=skip,
        limit=size,
        category=category,
        search=search
    )
    pages = (total + size - 1) // size if total > 0 else 1
    return PaginatedItemResponse(
        items=[ItemResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        size=size,
        pages=pages
    )


@router.post("/", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
def create_item(
    request: ItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRoleEnum.SUPER_ADMIN,
        UserRoleEnum.STATE_ADMIN,
        UserRoleEnum.DISTRICT_ADMIN,
        UserRoleEnum.HOSPITAL_ADMIN
    ))
):
    """Create a new item in the medical catalog."""
    item = ItemService.create_item(db=db, item_in=request)
    return ItemResponse.model_validate(item)


@router.get("/{item_id}", response_model=ItemResponse)
def get_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get details of a specific medical catalog item."""
    item = ItemService.get_item_by_id(db=db, item_id=item_id)
    return ItemResponse.model_validate(item)


@router.put("/{item_id}", response_model=ItemResponse)
def update_item(
    item_id: int,
    request: ItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRoleEnum.SUPER_ADMIN,
        UserRoleEnum.STATE_ADMIN,
        UserRoleEnum.DISTRICT_ADMIN,
        UserRoleEnum.HOSPITAL_ADMIN
    ))
):
    """Update medical catalog item details."""
    item = ItemService.update_item(db=db, item_id=item_id, item_in=request)
    return ItemResponse.model_validate(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRoleEnum.SUPER_ADMIN,
        UserRoleEnum.STATE_ADMIN
    ))
):
    """Delete an item from the catalog."""
    ItemService.delete_item(db=db, item_id=item_id)
    return None
