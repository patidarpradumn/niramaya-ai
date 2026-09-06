"""Service layer for Equipment inventory and Maintenance management."""

from datetime import datetime, timezone
from typing import Optional, List, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.models import (
    Equipment, MaintenanceRecord, Facility, AuditLog,
    EquipmentStatusEnum, UserRoleEnum, RiskCategoryEnum, AlertSeverityEnum, AlertStatusEnum
)
from app.schemas import (
    EquipmentCreate, EquipmentUpdate, MaintenanceRecordCreate, EquipmentDowntimeAnalysis
)
from app.utils import check_facility_access
from app.services.alert_service import alert_service
from fastapi import HTTPException, status


class EquipmentService:
    """Service handling equipment CRUD, status transitions, maintenance records, downtime and overdue calculations."""

    @staticmethod
    def _create_audit_log(db: Session, user, action: str, details: str, entity_type: str = "equipment", entity_id: Optional[int] = None):
        """Helper to create audit log entries."""
        if user and getattr(user, "id", None):
            audit = AuditLog(
                user_id=user.id,
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                details=details
            )
            db.add(audit)
            db.commit()


    @staticmethod
    def _trigger_equipment_alert_if_needed(db: Session, equipment: Equipment, reason: str):
        """Trigger equipment risk alert if status is NON_FUNCTIONAL, UNDER_MAINTENANCE or overdue."""
        if equipment.status in (EquipmentStatusEnum.NON_FUNCTIONAL, EquipmentStatusEnum.UNDER_MAINTENANCE) or equipment.is_overdue_maintenance:
            severity = AlertSeverityEnum.HIGH if equipment.status == EquipmentStatusEnum.NON_FUNCTIONAL else AlertSeverityEnum.MEDIUM
            if equipment.is_overdue_maintenance:
                severity = AlertSeverityEnum.HIGH

            title = f"Equipment Alert: {equipment.name} ({equipment.status.value})"
            description = f"Equipment '{equipment.name}' at facility ID {equipment.facility_id} requires attention. Reason: {reason}."
            details = {
                "equipment_id": equipment.id,
                "equipment_name": equipment.name,
                "serial_number": equipment.serial_number,
                "status": equipment.status.value,
                "reason": reason,
                "next_maintenance_date": equipment.next_maintenance_date.isoformat() if equipment.next_maintenance_date else None,
                "is_overdue": equipment.is_overdue_maintenance
            }
            alert_service.create_operational_alert(
                db=db,
                facility_id=equipment.facility_id,
                risk_category=RiskCategoryEnum.EQUIPMENT,
                severity=severity,
                title=title,
                description=description,
                details=details
            )

    def create_equipment(self, db: Session, data: EquipmentCreate, user) -> Equipment:
        """Create new medical equipment with RBAC check."""
        facility = db.query(Facility).filter(Facility.id == data.facility_id).first()
        if not facility:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facility not found")

        check_facility_access(user, facility, db)

        if data.serial_number:
            existing = db.query(Equipment).filter(Equipment.serial_number == data.serial_number).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Equipment with serial number '{data.serial_number}' already exists."
                )

        equipment = Equipment(
            facility_id=data.facility_id,
            name=data.name,
            equipment_type=data.equipment_type,
            serial_number=data.serial_number,
            status=data.status,
            installation_date=data.installation_date,
            purchase_date=data.purchase_date,
            last_maintenance_date=data.last_maintenance_date,
            next_maintenance_date=data.next_maintenance_date,
            downtime_hours=data.downtime_hours
        )
        db.add(equipment)
        db.commit()
        db.refresh(equipment)

        self._trigger_equipment_alert_if_needed(db, equipment, f"Initial registration with status {equipment.status.value}")
        self._create_audit_log(db, user, "CREATE_EQUIPMENT", f"Created equipment '{equipment.name}' (ID: {equipment.id})", entity_type="equipment", entity_id=equipment.id)

        return equipment

    def get_equipment(self, db: Session, equipment_id: int, user) -> Equipment:
        """Retrieve single equipment item by ID with RBAC check."""
        equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
        if not equipment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipment not found")

        check_facility_access(user, equipment.facility, db)
        return equipment


    def list_equipment(
        self,
        db: Session,
        user,
        facility_id: Optional[int] = None,
        status_filter: Optional[EquipmentStatusEnum] = None,
        equipment_type: Optional[str] = None,
        is_overdue: Optional[bool] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 50
    ) -> Tuple[List[Equipment], int]:
        """List equipment with optional filters and RBAC isolation."""
        query = db.query(Equipment)

        # Enforce user role facility boundaries
        role = getattr(user, "role", None)
        if role in (UserRoleEnum.HOSPITAL_ADMIN, UserRoleEnum.FACILITY_STAFF):
            if user.facility_id:
                query = query.filter(Equipment.facility_id == user.facility_id)
            else:
                return ([], 0)
        elif role == UserRoleEnum.DISTRICT_ADMIN:
            if user.district_id:
                query = query.join(Facility).filter(Facility.district_id == user.district_id)
            else:
                return ([], 0)
        elif role == UserRoleEnum.STATE_ADMIN:
            if user.state_id:
                query = query.join(Facility).filter(Facility.state_id == user.state_id)
            else:
                return ([], 0)
        elif role == UserRoleEnum.CITIZEN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Citizens cannot view internal equipment records")

        if facility_id:
            query = query.filter(Equipment.facility_id == facility_id)
        if status_filter:
            query = query.filter(Equipment.status == status_filter)
        if equipment_type:
            query = query.filter(Equipment.equipment_type.ilike(f"%{equipment_type}%"))
        if search:
            query = query.filter(
                or_(
                    Equipment.name.ilike(f"%{search}%"),
                    Equipment.serial_number.ilike(f"%{search}%")
                )
            )

        items = query.all()

        if is_overdue is not None:
            now = datetime.now(timezone.utc)
            if is_overdue:
                items = [
                    eq for eq in items
                    if eq.next_maintenance_date and eq.status != EquipmentStatusEnum.RETIRED and (
                        eq.next_maintenance_date.replace(tzinfo=timezone.utc) if eq.next_maintenance_date.tzinfo is None else eq.next_maintenance_date
                    ) < now
                ]
            else:
                items = [
                    eq for eq in items
                    if not (
                        eq.next_maintenance_date and eq.status != EquipmentStatusEnum.RETIRED and (
                            eq.next_maintenance_date.replace(tzinfo=timezone.utc) if eq.next_maintenance_date.tzinfo is None else eq.next_maintenance_date
                        ) < now
                    )
                ]

        total = len(items)
        paginated = items[skip : skip + limit]
        return paginated, total

    def update_equipment(self, db: Session, equipment_id: int, data: EquipmentUpdate, user) -> Equipment:
        """Update equipment details or perform status transitions."""
        equipment = self.get_equipment(db, equipment_id, user)

        update_dict = data.model_dump(exclude_unset=True)

        if "serial_number" in update_dict and update_dict["serial_number"] != equipment.serial_number:
            sn = update_dict["serial_number"]
            if sn:
                existing = db.query(Equipment).filter(Equipment.serial_number == sn, Equipment.id != equipment_id).first()
                if existing:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Equipment with serial number '{sn}' already exists."
                    )

        old_status = equipment.status
        for key, value in update_dict.items():
            setattr(equipment, key, value)

        equipment.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(equipment)

        if "status" in update_dict and update_dict["status"] != old_status:
            reason = f"Status transition from {old_status.value} to {equipment.status.value}"
            self._trigger_equipment_alert_if_needed(db, equipment, reason)
            self._create_audit_log(db, user, "UPDATE_EQUIPMENT_STATUS", f"Equipment ID {equipment.id} transition: {reason}", entity_type="equipment", entity_id=equipment.id)
        else:
            self._create_audit_log(db, user, "UPDATE_EQUIPMENT", f"Updated equipment '{equipment.name}' (ID: {equipment.id})", entity_type="equipment", entity_id=equipment.id)

        return equipment

    def delete_equipment(self, db: Session, equipment_id: int, user) -> bool:
        """Delete an equipment record."""
        equipment = self.get_equipment(db, equipment_id, user)

        eq_name = equipment.name
        db.delete(equipment)
        db.commit()

        self._create_audit_log(db, user, "DELETE_EQUIPMENT", f"Deleted equipment '{eq_name}' (ID: {equipment_id})", entity_type="equipment", entity_id=equipment_id)
        return True

    def create_maintenance_record(self, db: Session, data: MaintenanceRecordCreate, user) -> MaintenanceRecord:
        """Create a maintenance record and update equipment maintenance timestamps/status."""
        equipment = self.get_equipment(db, data.equipment_id, user)

        record = MaintenanceRecord(
            equipment_id=data.equipment_id,
            performed_by=data.performed_by,
            description=data.description,
            cost=data.cost,
            maintenance_date=data.maintenance_date,
            next_due_date=data.next_due_date,
            maintenance_type=data.maintenance_type or "ROUTINE",
            downtime_hours=data.downtime_hours
        )
        db.add(record)

        # Update equipment fields based on maintenance record
        equipment.last_maintenance_date = data.maintenance_date
        if data.next_due_date:
            equipment.next_maintenance_date = data.next_due_date

        if data.downtime_hours > 0:
            equipment.downtime_hours = (equipment.downtime_hours or 0.0) + data.downtime_hours

        if data.update_equipment_status:
            equipment.status = data.update_equipment_status

        equipment.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(record)
        db.refresh(equipment)

        self._create_audit_log(
            db, user, "CREATE_MAINTENANCE",
            f"Created maintenance record ID {record.id} for equipment ID {equipment.id} ({data.maintenance_type})",
            entity_type="maintenance", entity_id=record.id
        )

        return record


    def list_maintenance_records(
        self,
        db: Session,
        user,
        equipment_id: Optional[int] = None,
        facility_id: Optional[int] = None,
        maintenance_type: Optional[str] = None,
        skip: int = 0,
        limit: int = 50
    ) -> Tuple[List[MaintenanceRecord], int]:
        """List maintenance records with RBAC checks."""
        query = db.query(MaintenanceRecord).join(Equipment)

        role = getattr(user, "role", None)
        if role in (UserRoleEnum.HOSPITAL_ADMIN, UserRoleEnum.FACILITY_STAFF):
            if user.facility_id:
                query = query.filter(Equipment.facility_id == user.facility_id)
            else:
                return ([], 0)
        elif role == UserRoleEnum.DISTRICT_ADMIN:
            if user.district_id:
                query = query.join(Facility, Equipment.facility_id == Facility.id).filter(Facility.district_id == user.district_id)
            else:
                return ([], 0)
        elif role == UserRoleEnum.STATE_ADMIN:
            if user.state_id:
                query = query.join(Facility, Equipment.facility_id == Facility.id).filter(Facility.state_id == user.state_id)
            else:
                return ([], 0)
        elif role == UserRoleEnum.CITIZEN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Citizens cannot view maintenance records")

        if equipment_id:
            query = query.filter(MaintenanceRecord.equipment_id == equipment_id)
        if facility_id:
            query = query.filter(Equipment.facility_id == facility_id)
        if maintenance_type:
            query = query.filter(MaintenanceRecord.maintenance_type.ilike(f"%{maintenance_type}%"))

        total = query.count()
        records = query.order_by(MaintenanceRecord.maintenance_date.desc()).offset(skip).limit(limit).all()
        return records, total

    def calculate_downtime_and_uptime(self, db: Session, equipment_id: int, user) -> EquipmentDowntimeAnalysis:
        """Calculate downtime hours, days, and uptime percentage for equipment."""
        equipment = self.get_equipment(db, equipment_id, user)

        now = datetime.now(timezone.utc)
        start_date = equipment.installation_date or equipment.created_at or now

        if start_date.tzinfo is None:
            start_date = start_date.replace(tzinfo=timezone.utc)

        total_hours_span = max(1.0, (now - start_date).total_seconds() / 3600.0)
        total_downtime = max(0.0, equipment.downtime_hours or 0.0)

        uptime_percentage = max(0.0, min(100.0, round(((total_hours_span - total_downtime) / total_hours_span) * 100.0, 2)))
        m_count = db.query(MaintenanceRecord).filter(MaintenanceRecord.equipment_id == equipment_id).count()

        return EquipmentDowntimeAnalysis(
            equipment_id=equipment.id,
            equipment_name=equipment.name,
            status=equipment.status,
            total_downtime_hours=total_downtime,
            total_downtime_days=equipment.downtime_days,
            uptime_percentage=uptime_percentage,
            last_maintenance_date=equipment.last_maintenance_date,
            next_maintenance_date=equipment.next_maintenance_date,
            is_overdue=equipment.is_overdue_maintenance,
            maintenance_count=m_count
        )


equipment_service = EquipmentService()
