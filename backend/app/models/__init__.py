"""Core SQLAlchemy data models for MediGuard AI."""

import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, ForeignKey, Text,
    Boolean, CheckConstraint, UniqueConstraint, Enum as SQLEnum, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


# --- Enumerations ---

class UserRoleEnum(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    STATE_ADMIN = "state_admin"
    DISTRICT_ADMIN = "district_admin"
    HOSPITAL_ADMIN = "hospital_admin"
    FACILITY_STAFF = "facility_staff"
    CITIZEN = "citizen"

    # Backward-compatibility aliases
    ADMIN = "super_admin"
    FACILITY_MANAGER = "hospital_admin"
    VIEWER = "citizen"


class FacilityTypeEnum(str, enum.Enum):
    DISTRICT_HOSPITAL = "DISTRICT_HOSPITAL"
    CIVIL_HOSPITAL = "CIVIL_HOSPITAL"
    CHC = "CHC"
    PHC = "PHC"
    OTHER = "OTHER"
    # Backward-compatibility aliases
    HOSPITAL = "hospital"
    CLINIC = "clinic"
    WAREHOUSE = "warehouse"
    DISTRIBUTION_CENTER = "distribution_center"


class AlertSeverityEnum(str, enum.Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class RiskCategoryEnum(str, enum.Enum):
    STOCK_OUT = "STOCK_OUT"
    EXPIRY = "EXPIRY"
    EQUIPMENT = "EQUIPMENT"
    RESOURCE = "RESOURCE"


class AlertStatusEnum(str, enum.Enum):
    ACTIVE = "ACTIVE"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"
    DISMISSED = "DISMISSED"


class ApprovalStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class StockLevelEnum(str, enum.Enum):
    CRITICAL = "critical"
    LOW = "low"
    ADEQUATE = "adequate"
    OVERSTOCKED = "overstocked"


class StockMovementTypeEnum(str, enum.Enum):
    RECEIVED = "RECEIVED"
    ISSUED = "ISSUED"
    TRANSFERRED_IN = "TRANSFERRED_IN"
    TRANSFERRED_OUT = "TRANSFERRED_OUT"
    ADJUSTMENT = "ADJUSTMENT"
    DAMAGED = "DAMAGED"
    EXPIRED = "EXPIRED"

    # Backward compatibility aliases
    INBOUND = "RECEIVED"
    OUTBOUND = "ISSUED"
    TRANSFER_IN = "TRANSFERRED_IN"
    TRANSFER_OUT = "TRANSFERRED_OUT"


class EquipmentStatusEnum(str, enum.Enum):
    OPERATIONAL = "OPERATIONAL"
    UNDER_MAINTENANCE = "UNDER_MAINTENANCE"
    NON_FUNCTIONAL = "NON_FUNCTIONAL"
    RETIRED = "RETIRED"

    # Backward compatibility aliases
    MAINTENANCE_REQUIRED = "UNDER_MAINTENANCE"
    OUT_OF_SERVICE = "NON_FUNCTIONAL"


class RiskStatusEnum(str, enum.Enum):
    ACTIVE = "ACTIVE"
    MITIGATED = "MITIGATED"
    RESOLVED = "RESOLVED"


class RecommendationStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXECUTED = "EXECUTED"


class TransferStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    IN_TRANSIT = "IN_TRANSIT"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


# Backward-compatibility aliases
UserRole = UserRoleEnum
FacilityType = FacilityTypeEnum
AlertSeverity = AlertSeverityEnum
StockLevel = StockLevelEnum
ApprovalStatus = ApprovalStatusEnum


# --- Models ---

class Role(Base):
    """User role definition."""
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True, nullable=False)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    users = relationship("User", back_populates="role_rel")


class State(Base):
    """Geographic State model."""
    __tablename__ = "states"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    code = Column(String(10), unique=True, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    districts = relationship("District", back_populates="state", cascade="all, delete-orphan")


class District(Base):
    """Geographic District model within a State."""
    __tablename__ = "districts"

    __table_args__ = (
        UniqueConstraint("state_id", "name", name="uq_state_district_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    state_id = Column(Integer, ForeignKey("states.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    state = relationship("State", back_populates="districts")
    facilities = relationship("Facility", back_populates="district")


class Facility(Base):
    """Healthcare facility model."""
    __tablename__ = "facilities"

    id = Column(Integer, primary_key=True, index=True)
    district_id = Column(Integer, ForeignKey("districts.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    location = Column(String(255), nullable=False)
    type = Column(SQLEnum(FacilityTypeEnum, native_enum=False), nullable=False, default=FacilityTypeEnum.DISTRICT_HOSPITAL)
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    operational_status = Column(String(50), default="OPERATIONAL", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    district = relationship("District", back_populates="facilities")
    users = relationship("User", back_populates="facility")
    inventory = relationship("Inventory", back_populates="facility", cascade="all, delete-orphan")
    stock_movements = relationship("StockMovement", back_populates="facility")
    consumption_records = relationship("ConsumptionRecord", back_populates="facility")
    equipment = relationship("Equipment", back_populates="facility", cascade="all, delete-orphan")
    facility_services = relationship("FacilityService", back_populates="facility", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="facility")
    predictions = relationship("Prediction", back_populates="facility")
    risks = relationship("Risk", back_populates="facility")
    recommendations = relationship("Recommendation", foreign_keys="[Recommendation.facility_id]", back_populates="facility")
    source_transfers = relationship("Transfer", foreign_keys="Transfer.source_facility_id", back_populates="source_facility")
    destination_transfers = relationship("Transfer", foreign_keys="Transfer.destination_facility_id", back_populates="destination_facility")


class FacilityService(Base):
    """Services provided by a Healthcare Facility."""
    __tablename__ = "facility_services"

    __table_args__ = (
        UniqueConstraint("facility_id", "service_name", name="uq_facility_service_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("facilities.id", ondelete="CASCADE"), nullable=False, index=True)
    service_name = Column(String(100), nullable=False)
    is_available = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    facility = relationship("Facility", back_populates="facility_services")


class User(Base):
    """User authentication and profile model."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    firebase_uid = Column(String(128), unique=True, index=True, nullable=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=True) # Now optional because Firebase users do not need it
    full_name = Column(String(255), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="SET NULL"), nullable=True, index=True)
    role = Column(SQLEnum(UserRoleEnum, native_enum=False), nullable=False, default=UserRoleEnum.CITIZEN)
    facility_id = Column(Integer, ForeignKey("facilities.id", ondelete="SET NULL"), nullable=True, index=True)
    state_id = Column(Integer, ForeignKey("states.id", ondelete="SET NULL"), nullable=True, index=True)
    district_id = Column(Integer, ForeignKey("districts.id", ondelete="SET NULL"), nullable=True, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    approval_status = Column(SQLEnum(ApprovalStatusEnum, native_enum=False), nullable=False, default=ApprovalStatusEnum.PENDING)
    approved_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    role_rel = relationship("Role", back_populates="users")
    facility = relationship("Facility", back_populates="users")
    state = relationship("State")
    district = relationship("District")
    audit_logs = relationship("AuditLog", back_populates="user")
    approval_actions = relationship("ApprovalAction", back_populates="user")
    approved_users = relationship("User", back_populates="approved_by", foreign_keys=[approved_by_id])
    approved_by = relationship("User", back_populates="approved_users", remote_side="User.id", foreign_keys=[approved_by_id])


class Item(Base):
    """Medical item/drug catalog model."""
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, index=True, nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)
    category = Column(String(100), nullable=False, index=True)
    unit = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    inventory = relationship("Inventory", back_populates="item")
    stock_movements = relationship("StockMovement", back_populates="item")
    consumption_records = relationship("ConsumptionRecord", back_populates="item")
    predictions = relationship("Prediction", back_populates="item")
    risks = relationship("Risk", back_populates="item")
    alerts = relationship("Alert", back_populates="item")
    recommendations = relationship("Recommendation", back_populates="item")
    transfers = relationship("Transfer", back_populates="item")


class Inventory(Base):
    """Facility inventory levels."""
    __tablename__ = "inventory"

    __table_args__ = (
        UniqueConstraint("facility_id", "item_id", name="uq_facility_item_inventory"),
        CheckConstraint("current_stock >= 0", name="check_inventory_stock_non_negative"),
        CheckConstraint("min_threshold >= 0", name="check_min_threshold_non_negative"),
        CheckConstraint("max_threshold >= min_threshold", name="check_max_threshold_gte_min"),
    )

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("facilities.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    current_stock = Column(Integer, nullable=False, default=0)
    min_threshold = Column(Integer, nullable=False, default=10)
    max_threshold = Column(Integer, nullable=False, default=100)
    batch_number = Column(String(100), nullable=True, default="BATCH-001", index=True)
    expiry_date = Column(DateTime(timezone=True), nullable=True, index=True)
    unit = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    facility = relationship("Facility", back_populates="inventory")
    item = relationship("Item", back_populates="inventory")

    @property
    def quantity(self) -> int:
        return self.current_stock

    @quantity.setter
    def quantity(self, value: int):
        self.current_stock = value

    @property
    def min_stock_level(self) -> int:
        return self.min_threshold

    @min_stock_level.setter
    def min_stock_level(self, value: int):
        self.min_threshold = value

    @property
    def max_stock_level(self) -> int:
        return self.max_threshold

    @max_stock_level.setter
    def max_stock_level(self, value: int):
        self.max_threshold = value

    @property
    def is_low_stock(self) -> bool:
        return self.current_stock <= self.min_threshold

    @property
    def item_name(self) -> str:
        return self.item.name if self.item else "Unknown Item"

    @property
    def category(self) -> str:
        return self.item.category if self.item else "General"

    @property
    def last_updated(self):
        return self.updated_at or self.created_at

    @property
    def stock_level(self) -> StockLevelEnum:
        """Calculate dynamic stock status."""
        if self.current_stock <= self.min_threshold * 0.5:
            return StockLevelEnum.CRITICAL
        elif self.current_stock <= self.min_threshold:
            return StockLevelEnum.LOW
        elif self.current_stock >= self.max_threshold:
            return StockLevelEnum.OVERSTOCKED
        return StockLevelEnum.ADEQUATE


class StockMovement(Base):
    """Stock movement audit records (inbound, outbound, transfers)."""
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("facilities.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    movement_type = Column(SQLEnum(StockMovementTypeEnum, native_enum=False), nullable=False)
    quantity = Column(Integer, nullable=False)
    reference = Column(String(100), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    facility = relationship("Facility", back_populates="stock_movements")
    item = relationship("Item", back_populates="stock_movements")
    user = relationship("User")


class ConsumptionRecord(Base):
    """Historical item consumption records for trend analysis."""
    __tablename__ = "consumption_records"

    __table_args__ = (
        CheckConstraint("quantity_consumed >= 0", name="check_consumption_qty_non_negative"),
    )

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("facilities.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    quantity_consumed = Column(Integer, nullable=False)
    record_date = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    facility = relationship("Facility", back_populates="consumption_records")
    item = relationship("Item", back_populates="consumption_records")


class Equipment(Base):
    """Medical equipment inventory model."""
    __tablename__ = "equipment"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("facilities.id", ondelete="CASCADE"), nullable=False, index=True)
    equipment_type = Column(String(100), nullable=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    serial_number = Column(String(100), unique=True, index=True, nullable=True)
    status = Column(SQLEnum(EquipmentStatusEnum, native_enum=False), nullable=False, default=EquipmentStatusEnum.OPERATIONAL)
    installation_date = Column(DateTime(timezone=True), nullable=True)
    purchase_date = Column(DateTime(timezone=True), nullable=True)
    last_maintenance_date = Column(DateTime(timezone=True), nullable=True)
    next_maintenance_date = Column(DateTime(timezone=True), nullable=True)
    downtime_hours = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    facility = relationship("Facility", back_populates="equipment")
    maintenance_records = relationship("MaintenanceRecord", back_populates="equipment", cascade="all, delete-orphan")

    @property
    def is_overdue_maintenance(self) -> bool:
        """Check if equipment is overdue for maintenance."""
        if not self.next_maintenance_date or self.status == EquipmentStatusEnum.RETIRED:
            return False
        now = datetime.now(timezone.utc)
        target = self.next_maintenance_date
        if target.tzinfo is None:
            target = target.replace(tzinfo=timezone.utc)
        return target < now

    @property
    def downtime_days(self) -> float:
        """Calculated downtime in days."""
        return round(self.downtime_hours / 24.0, 2)


class MaintenanceRecord(Base):
    """Maintenance history for medical equipment."""
    __tablename__ = "maintenance_records"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id", ondelete="CASCADE"), nullable=False, index=True)
    performed_by = Column(String(255), nullable=True)
    description = Column(Text, nullable=False)
    cost = Column(Float, default=0.0, nullable=False)
    maintenance_date = Column(DateTime(timezone=True), nullable=False)
    next_due_date = Column(DateTime(timezone=True), nullable=True)
    maintenance_type = Column(String(50), nullable=True, default="ROUTINE")
    downtime_hours = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    equipment = relationship("Equipment", back_populates="maintenance_records")


class Prediction(Base):
    """ML prediction model for forecasting demand."""
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("facilities.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    predicted_demand = Column(Integer, nullable=False)
    confidence = Column(Float, nullable=False)  # 0.0 to 1.0
    predicted_date = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    facility = relationship("Facility", back_populates="predictions")
    item = relationship("Item", back_populates="predictions")
    risks = relationship("Risk", back_populates="prediction")
    alerts = relationship("Alert", back_populates="prediction")
    recommendations = relationship("Recommendation", back_populates="prediction")


class Risk(Base):
    """Identified supply-chain or equipment risk model."""
    __tablename__ = "risks"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("facilities.id", ondelete="CASCADE"), nullable=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="SET NULL"), nullable=True, index=True)
    prediction_id = Column(Integer, ForeignKey("predictions.id", ondelete="SET NULL"), nullable=True, index=True)
    risk_type = Column(String(100), nullable=False)
    severity = Column(SQLEnum(AlertSeverityEnum, native_enum=False), nullable=False, default=AlertSeverityEnum.MEDIUM)
    description = Column(Text, nullable=False)
    status = Column(SQLEnum(RiskStatusEnum, native_enum=False), nullable=False, default=RiskStatusEnum.ACTIVE)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    facility = relationship("Facility", back_populates="risks")
    item = relationship("Item", back_populates="risks")
    prediction = relationship("Prediction", back_populates="risks")
    recommendations = relationship("Recommendation", back_populates="risk")


class Alert(Base):
    """Alert notifications for critical stock or risk events."""
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("facilities.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="SET NULL"), nullable=True, index=True)
    prediction_id = Column(Integer, ForeignKey("predictions.id", ondelete="SET NULL"), nullable=True, index=True)
    risk_id = Column(Integer, ForeignKey("risks.id", ondelete="SET NULL"), nullable=True, index=True)
    risk_category = Column(SQLEnum(RiskCategoryEnum, native_enum=False), nullable=False, default=RiskCategoryEnum.STOCK_OUT, index=True)
    severity = Column(SQLEnum(AlertSeverityEnum, native_enum=False), nullable=False, index=True)
    status = Column(SQLEnum(AlertStatusEnum, native_enum=False), nullable=False, default=AlertStatusEnum.ACTIVE, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    details = Column(JSON, nullable=True)
    acknowledged = Column(Boolean, default=False, nullable=False)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    facility = relationship("Facility", back_populates="alerts")
    item = relationship("Item", back_populates="alerts")
    prediction = relationship("Prediction", back_populates="alerts")
    risk = relationship("Risk")
    acknowledged_by_user = relationship("User", foreign_keys=[acknowledged_by])
    resolved_by_user = relationship("User", foreign_keys=[resolved_by])


class Recommendation(Base):
    """AI and system generated recommendations."""
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("facilities.id", ondelete="CASCADE"), nullable=True, index=True)
    source_facility_id = Column(Integer, ForeignKey("facilities.id", ondelete="CASCADE"), nullable=True, index=True)
    destination_facility_id = Column(Integer, ForeignKey("facilities.id", ondelete="CASCADE"), nullable=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="SET NULL"), nullable=True, index=True)
    prediction_id = Column(Integer, ForeignKey("predictions.id", ondelete="SET NULL"), nullable=True, index=True)
    risk_id = Column(Integer, ForeignKey("risks.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    action_type = Column(String(100), nullable=False)
    suggested_quantity = Column(Integer, nullable=True)
    reasoning = Column(Text, nullable=False)
    details = Column(JSON, nullable=True)
    status = Column(SQLEnum(RecommendationStatusEnum, native_enum=False), nullable=False, default=RecommendationStatusEnum.PENDING, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    facility = relationship("Facility", foreign_keys=[facility_id], back_populates="recommendations")
    source_facility = relationship("Facility", foreign_keys=[source_facility_id])
    destination_facility = relationship("Facility", foreign_keys=[destination_facility_id])
    item = relationship("Item", back_populates="recommendations")
    prediction = relationship("Prediction", back_populates="recommendations")
    risk = relationship("Risk", back_populates="recommendations")
    approval_actions = relationship("ApprovalAction", back_populates="recommendation")



class Transfer(Base):
    """Stock transfer requests between facilities."""
    __tablename__ = "transfers"

    __table_args__ = (
        CheckConstraint("quantity > 0", name="check_transfer_qty_positive"),
        CheckConstraint("source_facility_id != destination_facility_id", name="check_transfer_different_facilities"),
    )

    id = Column(Integer, primary_key=True, index=True)
    source_facility_id = Column(Integer, ForeignKey("facilities.id", ondelete="CASCADE"), nullable=False, index=True)
    destination_facility_id = Column(Integer, ForeignKey("facilities.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False)
    status = Column(SQLEnum(TransferStatusEnum, native_enum=False), nullable=False, default=TransferStatusEnum.PENDING)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    source_facility = relationship("Facility", foreign_keys=[source_facility_id], back_populates="source_transfers")
    destination_facility = relationship("Facility", foreign_keys=[destination_facility_id], back_populates="destination_transfers")
    item = relationship("Item", back_populates="transfers")
    approval_actions = relationship("ApprovalAction", back_populates="transfer")


class ApprovalAction(Base):
    """Human approval actions for recommendations or transfers."""
    __tablename__ = "approval_actions"

    id = Column(Integer, primary_key=True, index=True)
    recommendation_id = Column(Integer, ForeignKey("recommendations.id", ondelete="CASCADE"), nullable=True, index=True)
    transfer_id = Column(Integer, ForeignKey("transfers.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(50), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    recommendation = relationship("Recommendation", back_populates="approval_actions")
    transfer = relationship("Transfer", back_populates="approval_actions")
    user = relationship("User", back_populates="approval_actions")


class AuditLog(Base):
    """Audit log model for recording user activities."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(50), nullable=True, index=True)
    entity_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)
    correlation_id = Column(String(100), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="audit_logs")


from sqlalchemy import event


@event.listens_for(AuditLog, "before_update")
def _prevent_audit_log_update(mapper, connection, target):
    raise ValueError("Audit logs are immutable and cannot be updated.")


@event.listens_for(AuditLog, "before_delete")
def _prevent_audit_log_delete(mapper, connection, target):
    raise ValueError("Audit logs are immutable and cannot be deleted.")