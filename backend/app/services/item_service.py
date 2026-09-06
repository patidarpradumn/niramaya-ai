"""Item Service layer for medical items catalog."""

from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi import HTTPException, status

from app.models import Item
from app.schemas import ItemCreate, ItemUpdate


class ItemService:
    """Business logic for Item catalog management."""

    @staticmethod
    def create_item(db: Session, item_in: ItemCreate) -> Item:
        """Create a new item in the catalog."""
        existing = db.query(Item).filter(Item.code == item_in.code).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Item with code '{item_in.code}' already exists."
            )

        item = Item(
            name=item_in.name,
            code=item_in.code,
            category=item_in.category,
            unit=item_in.unit,
            description=item_in.description
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def get_item_by_id(db: Session, item_id: int) -> Item:
        """Retrieve item by ID."""
        item = db.query(Item).filter(Item.id == item_id).first()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Item not found"
            )
        return item

    @staticmethod
    def get_item_by_code(db: Session, code: str) -> Optional[Item]:
        """Retrieve item by code."""
        return db.query(Item).filter(Item.code == code).first()

    @staticmethod
    def list_items(
        db: Session,
        skip: int = 0,
        limit: int = 50,
        category: Optional[str] = None,
        search: Optional[str] = None
    ) -> Tuple[List[Item], int]:
        """List items with filtering, search, and pagination."""
        query = db.query(Item)

        if category:
            query = query.filter(Item.category == category)

        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    Item.name.ilike(search_pattern),
                    Item.code.ilike(search_pattern)
                )
            )

        total = query.count()
        items = query.order_by(Item.id.asc()).offset(skip).limit(limit).all()
        return items, total

    @staticmethod
    def update_item(db: Session, item_id: int, item_in: ItemUpdate) -> Item:
        """Update an existing item."""
        item = ItemService.get_item_by_id(db, item_id)

        if item_in.code and item_in.code != item.code:
            existing = db.query(Item).filter(Item.code == item_in.code).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Item with code '{item_in.code}' already exists."
                )
            item.code = item_in.code

        if item_in.name is not None:
            item.name = item_in.name
        if item_in.category is not None:
            item.category = item_in.category
        if item_in.unit is not None:
            item.unit = item_in.unit
        if item_in.description is not None:
            item.description = item_in.description

        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def delete_item(db: Session, item_id: int) -> bool:
        """Delete an item by ID."""
        item = ItemService.get_item_by_id(db, item_id)
        db.delete(item)
        db.commit()
        return True
