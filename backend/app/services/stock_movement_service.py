"""Service layer for Stock Movement operations enforcing database transactions, audit logging, and RBAC."""

from datetime import datetime
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models import (
    StockMovement, Inventory, Item, Facility, User, UserRoleEnum, AuditLog, StockMovementTypeEnum
)
from app.schemas import StockMovementCreate
from app.utils import check_facility_access


class StockMovementService:
    """Business logic service for stock movements."""

    @staticmethod
    def record_movement(
        db: Session,
        movement_in: StockMovementCreate,
        current_user: User
    ) -> StockMovement:
        """Record a stock movement within an atomic database transaction.
        
        Updates inventory stock levels, prevents negative stock, creates audit log entry.
        """
        if current_user.role == UserRoleEnum.CITIZEN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Citizens are not authorized to perform stock movements."
            )

        facility_id = movement_in.facility_id
        item_id = movement_in.item_id

        # If inventory_id is passed directly, resolve facility_id and item_id
        if movement_in.inventory_id:
            inv_record = db.query(Inventory).filter(Inventory.id == movement_in.inventory_id).first()
            if not inv_record:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Inventory record with ID {movement_in.inventory_id} not found."
                )
            facility_id = inv_record.facility_id
            item_id = inv_record.item_id

        # Enforce facility access
        check_facility_access(current_user, facility_id, db)

        # Validate item and facility existence
        item = db.query(Item).filter(Item.id == item_id).first()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Item with ID {item_id} not found."
            )

        facility = db.query(Facility).filter(Facility.id == facility_id).first()
        if not facility:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Facility with ID {facility_id} not found."
            )

        if movement_in.quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Movement quantity must be greater than 0."
            )

        # Calculate net stock change direction based on movement type
        mtype = movement_in.movement_type
        if mtype in (StockMovementTypeEnum.RECEIVED, StockMovementTypeEnum.TRANSFERRED_IN):
            delta = movement_in.quantity
        elif mtype in (StockMovementTypeEnum.ISSUED, StockMovementTypeEnum.TRANSFERRED_OUT, StockMovementTypeEnum.DAMAGED, StockMovementTypeEnum.EXPIRED):
            delta = -movement_in.quantity
        elif mtype == StockMovementTypeEnum.ADJUSTMENT:
            # For adjustment, if reference specifies decrease or negative quantity, adjust accordingly
            delta = movement_in.quantity
        else:
            delta = movement_in.quantity

        try:
            # Lock the inventory row for update to ensure concurrency safety
            inv = db.query(Inventory).filter(
                Inventory.facility_id == facility_id,
                Inventory.item_id == item_id
            ).with_for_update().first()

            if not inv:
                if delta < 0:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Insufficient stock: No inventory record exists for this item at the specified facility."
                    )
                # Create inventory record for inbound stock
                inv = Inventory(
                    facility_id=facility_id,
                    item_id=item_id,
                    current_stock=0,
                    min_threshold=10,
                    max_threshold=100
                )
                db.add(inv)
                db.flush()

            # Verify non-negative stock constraint
            new_stock = inv.current_stock + delta
            if new_stock < 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient stock: Current stock is {inv.current_stock}, requested decrease is {abs(delta)}."
                )

            inv.current_stock = new_stock

            # Create StockMovement audit record
            movement = StockMovement(
                facility_id=facility_id,
                item_id=item_id,
                movement_type=movement_in.movement_type,
                quantity=movement_in.quantity,
                reference=movement_in.reference,
                created_by_user_id=current_user.id
            )
            db.add(movement)
            db.flush()

            # Create AuditLog entry preserving system auditability
            audit_entry = AuditLog(
                user_id=current_user.id,
                action="STOCK_MOVEMENT_RECORDED",
                entity_type="StockMovement",
                entity_id=movement.id,
                details=f"Recorded {mtype.value} movement of {movement_in.quantity} units for Item '{item.name}' (ID: {item_id}) at Facility '{facility.name}' (ID: {facility_id}). New stock: {new_stock}."
            )
            db.add(audit_entry)

            db.commit()
            db.refresh(movement)

            # Attach helper properties for response serialization
            movement.facility_name = facility.name
            movement.item_name = item.name
            movement.user_name = current_user.full_name

            return movement

        except HTTPException:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to record stock movement: {str(e)}"
            )

    @staticmethod
    def list_movements(
        db: Session,
        current_user: User,
        skip: int = 0,
        limit: int = 100,
        facility_id: Optional[int] = None,
        item_id: Optional[int] = None,
        movement_type: Optional[StockMovementTypeEnum] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        inventory_id: Optional[int] = None
    ) -> Tuple[List[StockMovement], int]:
        """List stock movements with filtering, date range support, and RBAC boundary enforcement."""
        if current_user.role == UserRoleEnum.CITIZEN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Citizens are not authorized to view stock movements."
            )

        query = db.query(StockMovement)

        # Handle direct inventory_id filter
        if inventory_id:
            inv = db.query(Inventory).filter(Inventory.id == inventory_id).first()
            if not inv:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Inventory record with ID {inventory_id} not found."
                )
            check_facility_access(current_user, inv.facility_id, db)
            query = query.filter(
                StockMovement.facility_id == inv.facility_id,
                StockMovement.item_id == inv.item_id
            )
        else:
            # Location / facility scope enforcement based on role
            if current_user.role in (UserRoleEnum.HOSPITAL_ADMIN, UserRoleEnum.FACILITY_STAFF):
                if current_user.facility_id:
                    query = query.filter(StockMovement.facility_id == current_user.facility_id)
                else:
                    return [], 0
            elif current_user.role == UserRoleEnum.DISTRICT_ADMIN:
                if current_user.district_id:
                    district_facility_ids = [
                        f.id for f in db.query(Facility.id).filter(Facility.district_id == current_user.district_id).all()
                    ]
                    query = query.filter(StockMovement.facility_id.in_(district_facility_ids))
                else:
                    return [], 0
            elif current_user.role == UserRoleEnum.STATE_ADMIN:
                if current_user.state_id:
                    state_facility_ids = [
                        f.id for f in db.query(Facility.id).join(Facility.district).filter(Facility.district.has(state_id=current_user.state_id)).all()
                    ]
                    query = query.filter(StockMovement.facility_id.in_(state_facility_ids))
                else:
                    return [], 0

            # Explicit facility filter requested
            if facility_id:
                check_facility_access(current_user, facility_id, db)
                query = query.filter(StockMovement.facility_id == facility_id)

        # Filters
        if item_id:
            query = query.filter(StockMovement.item_id == item_id)
        if movement_type:
            query = query.filter(StockMovement.movement_type == movement_type)
        if start_date:
            query = query.filter(StockMovement.created_at >= start_date)
        if end_date:
            query = query.filter(StockMovement.created_at <= end_date)

        total = query.count()
        movements = query.order_by(StockMovement.created_at.desc()).offset(skip).limit(limit).all()

        # Populate response dynamic attributes
        for m in movements:
            m.facility_name = m.facility.name if m.facility else None
            m.item_name = m.item.name if m.item else None
            m.user_name = m.user.full_name if m.user else None

        return movements, total
