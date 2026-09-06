"""Inventory Service layer for medical stock management."""

from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi import HTTPException, status

from app.models import Inventory, Facility, Item, District, User, UserRoleEnum
from app.schemas import InventoryCreate, InventoryUpdate
from app.utils import check_facility_access, normalize_role


class InventoryService:
    """Business logic for inventory tracking, stock levels, and threshold enforcement."""

    @staticmethod
    def create_inventory(db: Session, inv_in: InventoryCreate, current_user: User) -> Inventory:
        """Create or update inventory record with stock & threshold validation and RBAC checks."""
        user_role = normalize_role(current_user.role)
        if user_role == UserRoleEnum.CITIZEN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Citizens do not have access to administrative inventory data"
            )

        facility = db.query(Facility).filter(Facility.id == inv_in.facility_id).first()
        if not facility:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Facility not found"
            )

        check_facility_access(current_user, facility, db)

        item = None
        if inv_in.item_id:
            item = db.query(Item).filter(Item.id == inv_in.item_id).first()
            if not item:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Item not found in catalog"
                )
        elif inv_in.item_name:
            item = db.query(Item).filter(Item.name.ilike(inv_in.item_name)).first()
            if not item:
                # Auto-create item catalog entry
                item_code = f"ITEM-{inv_in.item_name.upper().replace(' ', '-')[:20]}"
                # Ensure code uniqueness
                existing_code = db.query(Item).filter(Item.code == item_code).first()
                if existing_code:
                    import uuid
                    item_code = f"{item_code}-{uuid.uuid4().hex[:4]}"
                item = Item(
                    name=inv_in.item_name,
                    code=item_code,
                    category=inv_in.category or "General",
                    unit=inv_in.unit or "units"
                )
                db.add(item)
                db.commit()
                db.refresh(item)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either item_id or item_name must be provided"
            )

        item_id = item.id

        current_stock = inv_in.current_stock if inv_in.quantity is None else inv_in.quantity
        min_threshold = inv_in.min_threshold if inv_in.min_stock_level is None else inv_in.min_stock_level
        max_threshold = inv_in.max_threshold if inv_in.max_stock_level is None else inv_in.max_stock_level

        if current_stock < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Stock quantity cannot be negative"
            )

        if min_threshold < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Minimum threshold cannot be negative"
            )

        if max_threshold < min_threshold:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum stock level must be greater than or equal to minimum stock level"
            )

        batch_number = inv_in.batch_number or "BATCH-001"
        unit = inv_in.unit or item.unit

        # Check if record already exists for facility + item
        existing = db.query(Inventory).filter(
            Inventory.facility_id == inv_in.facility_id,
            Inventory.item_id == inv_in.item_id
        ).first()

        if existing:
            existing.current_stock = current_stock
            existing.min_threshold = min_threshold
            existing.max_threshold = max_threshold
            existing.batch_number = batch_number
            existing.expiry_date = inv_in.expiry_date
            existing.unit = unit
            db.commit()
            db.refresh(existing)
            return existing

        inventory = Inventory(
            facility_id=inv_in.facility_id,
            item_id=inv_in.item_id,
            current_stock=current_stock,
            min_threshold=min_threshold,
            max_threshold=max_threshold,
            batch_number=batch_number,
            expiry_date=inv_in.expiry_date,
            unit=unit
        )
        db.add(inventory)
        db.commit()
        db.refresh(inventory)
        return inventory

    @staticmethod
    def get_inventory_by_id(db: Session, inventory_id: int, current_user: User) -> Inventory:
        """Get inventory item by ID with facility access verification."""
        user_role = normalize_role(current_user.role)
        if user_role == UserRoleEnum.CITIZEN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Citizens do not have access to administrative inventory data"
            )

        inventory = db.query(Inventory).filter(Inventory.id == inventory_id).first()
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventory item not found"
            )

        check_facility_access(current_user, inventory.facility, db)
        return inventory

    @staticmethod
    def list_inventory(
        db: Session,
        current_user: User,
        skip: int = 0,
        limit: int = 50,
        facility_id: Optional[int] = None,
        item_id: Optional[int] = None,
        category: Optional[str] = None,
        is_low_stock: Optional[bool] = None,
        batch_number: Optional[str] = None,
        search: Optional[str] = None
    ) -> Tuple[List[Inventory], int]:
        """List inventory records with RBAC location isolation and filters."""
        user_role = normalize_role(current_user.role)
        if user_role == UserRoleEnum.CITIZEN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Citizens do not have access to administrative inventory data"
            )

        query = db.query(Inventory)

        if facility_id:
            facility = db.query(Facility).filter(Facility.id == facility_id).first()
            if not facility:
                raise HTTPException(status_code=404, detail="Facility not found")
            check_facility_access(current_user, facility, db)
            query = query.filter(Inventory.facility_id == facility_id)
        else:
            if user_role == UserRoleEnum.SUPER_ADMIN:
                pass
            elif user_role == UserRoleEnum.STATE_ADMIN:
                if current_user.state_id:
                    query = query.join(Facility).join(District).filter(District.state_id == current_user.state_id)
                else:
                    return [], 0
            elif user_role == UserRoleEnum.DISTRICT_ADMIN:
                if current_user.district_id:
                    query = query.join(Facility).filter(Facility.district_id == current_user.district_id)
                else:
                    return [], 0
            elif user_role in (UserRoleEnum.HOSPITAL_ADMIN, UserRoleEnum.FACILITY_STAFF):
                if current_user.facility_id:
                    query = query.filter(Inventory.facility_id == current_user.facility_id)
                else:
                    return [], 0

        if item_id:
            query = query.filter(Inventory.item_id == item_id)

        if category or search:
            query = query.join(Item)
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

        if batch_number:
            query = query.filter(Inventory.batch_number == batch_number)

        if is_low_stock:
            query = query.filter(Inventory.current_stock <= Inventory.min_threshold)

        total = query.count()
        items = query.order_by(Inventory.id.asc()).offset(skip).limit(limit).all()
        return items, total

    @staticmethod
    def get_low_stock_inventory(
        db: Session,
        current_user: User,
        skip: int = 0,
        limit: int = 50
    ) -> Tuple[List[Inventory], int]:
        """Get low stock inventory items requiring replenishment."""
        return InventoryService.list_inventory(
            db=db,
            current_user=current_user,
            skip=skip,
            limit=limit,
            is_low_stock=True
        )

    @staticmethod
    def update_inventory(
        db: Session,
        inventory_id: int,
        inv_in: InventoryUpdate,
        current_user: User
    ) -> Inventory:
        """Update inventory stock levels and thresholds with validation."""
        inventory = InventoryService.get_inventory_by_id(db, inventory_id, current_user)

        new_stock = inv_in.current_stock if inv_in.quantity is None else inv_in.quantity
        if new_stock is not None:
            if new_stock < 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Stock quantity cannot be negative"
                )
            inventory.current_stock = new_stock

        new_min = inv_in.min_threshold if inv_in.min_stock_level is None else inv_in.min_stock_level
        if new_min is not None:
            if new_min < 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Minimum threshold cannot be negative"
                )
            inventory.min_threshold = new_min

        new_max = inv_in.max_threshold if inv_in.max_stock_level is None else inv_in.max_stock_level
        if new_max is not None:
            inventory.max_threshold = new_max

        if inventory.max_threshold < inventory.min_threshold:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum stock level must be greater than or equal to minimum stock level"
            )

        if inv_in.batch_number is not None:
            inventory.batch_number = inv_in.batch_number
        if inv_in.expiry_date is not None:
            inventory.expiry_date = inv_in.expiry_date
        if inv_in.unit is not None:
            inventory.unit = inv_in.unit

        db.commit()
        db.refresh(inventory)
        return inventory

    @staticmethod
    def delete_inventory(db: Session, inventory_id: int, current_user: User) -> bool:
        """Delete inventory record."""
        inventory = InventoryService.get_inventory_by_id(db, inventory_id, current_user)
        db.delete(inventory)
        db.commit()
        return True
