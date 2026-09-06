"""Comprehensive test suite for Phase 2 Core Database Models & Migration."""

import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy.exc import IntegrityError
from alembic.config import Config
from alembic import command

from app.models import (
    Role, State, District, Facility, FacilityService, User, Item, Inventory,
    StockMovement, ConsumptionRecord, Equipment, MaintenanceRecord,
    Prediction, Risk, Alert, Recommendation, Transfer, ApprovalAction, AuditLog,
    UserRoleEnum, FacilityTypeEnum, AlertSeverityEnum, StockMovementTypeEnum,
    EquipmentStatusEnum, RiskStatusEnum, RecommendationStatusEnum, TransferStatusEnum
)


# --- 1. Model Creation & Relationship Tests ---

def test_state_district_facility_relationship(db_session):
    """Test State -> District -> Facility hierarchical relationships."""
    state = State(name="Test State", code="TS")
    db_session.add(state)
    db_session.commit()

    district = District(state_id=state.id, name="Test District")
    db_session.add(district)
    db_session.commit()

    facility = Facility(
        district_id=district.id,
        name="Test Hospital",
        location="123 Health Way",
        type=FacilityTypeEnum.HOSPITAL
    )
    db_session.add(facility)
    db_session.commit()

    # Query back & verify relationships
    fetched_state = db_session.query(State).filter_by(id=state.id).first()
    assert len(fetched_state.districts) == 1
    assert fetched_state.districts[0].name == "Test District"

    fetched_district = db_session.query(District).filter_by(id=district.id).first()
    assert len(fetched_district.facilities) == 1
    assert fetched_district.facilities[0].name == "Test Hospital"
    assert fetched_district.state.name == "Test State"


def test_inventory_item_facility_relationships(db_session):
    """Test Item -> Inventory -> Facility relationships."""
    state = State(name="State B", code="SB")
    district = District(state=state, name="District B")
    facility = Facility(district=district, name="Hospital B", location="Loc B", type=FacilityTypeEnum.HOSPITAL)
    item = Item(name="Antibiotic X", code="ANT-X", category="Medications", unit="tablets")
    db_session.add_all([state, district, facility, item])
    db_session.commit()

    inventory = Inventory(facility_id=facility.id, item_id=item.id, current_stock=100, min_threshold=10, max_threshold=200)
    db_session.add(inventory)
    db_session.commit()

    assert inventory.facility.name == "Hospital B"
    assert inventory.item.name == "Antibiotic X"
    assert len(facility.inventory) == 1
    assert len(item.inventory) == 1


def test_transfer_dual_facility_relationship(db_session):
    """Test Transfer relationships with source & destination facilities and item."""
    state = State(name="State C", code="SC")
    district = District(state=state, name="District C")
    f_source = Facility(district=district, name="Warehouse Alpha", location="Loc Alpha", type=FacilityTypeEnum.WAREHOUSE)
    f_dest = Facility(district=district, name="Clinic Beta", location="Loc Beta", type=FacilityTypeEnum.CLINIC)
    item = Item(name="Syringes 10ml", code="SYR-10", category="Consumables", unit="boxes")
    db_session.add_all([state, district, f_source, f_dest, item])
    db_session.commit()

    transfer = Transfer(
        source_facility_id=f_source.id,
        destination_facility_id=f_dest.id,
        item_id=item.id,
        quantity=50,
        status=TransferStatusEnum.PENDING
    )
    db_session.add(transfer)
    db_session.commit()

    assert transfer.source_facility.name == "Warehouse Alpha"
    assert transfer.destination_facility.name == "Clinic Beta"
    assert transfer.item.name == "Syringes 10ml"
    assert len(f_source.source_transfers) == 1
    assert len(f_dest.destination_transfers) == 1


def test_prediction_risk_recommendation_alert_chain(db_session):
    """Test chain from Prediction -> Risk -> Recommendation & Alert."""
    state = State(name="State D", code="SD")
    district = District(state=state, name="District D")
    facility = Facility(district=district, name="Hospital D", location="Loc D", type=FacilityTypeEnum.HOSPITAL)
    item = Item(name="Oxygen Cylinder", code="OXY-01", category="Equipment", unit="cylinders")
    db_session.add_all([state, district, facility, item])
    db_session.commit()

    prediction = Prediction(
        facility_id=facility.id,
        item_id=item.id,
        predicted_demand=80,
        confidence=0.92,
        predicted_date=datetime.now(timezone.utc) + timedelta(days=7)
    )
    db_session.add(prediction)
    db_session.commit()

    risk = Risk(
        facility_id=facility.id,
        item_id=item.id,
        prediction_id=prediction.id,
        risk_type="CRITICAL_DEFICIT",
        severity=AlertSeverityEnum.CRITICAL,
        description="Predicted oxygen deficit"
    )
    db_session.add(risk)
    db_session.commit()

    alert = Alert(
        facility_id=facility.id,
        item_id=item.id,
        prediction_id=prediction.id,
        severity=AlertSeverityEnum.CRITICAL,
        title="Oxygen Supply Risk",
        description="Immediate restock required"
    )
    recommendation = Recommendation(
        facility_id=facility.id,
        item_id=item.id,
        prediction_id=prediction.id,
        risk_id=risk.id,
        title="Order Emergency Oxygen",
        action_type="PROCURE",
        suggested_quantity=100,
        reasoning="Prevent deficit"
    )
    db_session.add_all([alert, recommendation])
    db_session.commit()

    assert risk.prediction.predicted_demand == 80
    assert recommendation.risk.description == "Predicted oxygen deficit"
    assert alert.facility.name == "Hospital D"


def test_approval_action_and_audit_log(db_session):
    """Test ApprovalAction & AuditLog linking to User."""
    user = User(
        email="approver@mediguard.gov",
        password_hash="hashed_pw",
        full_name="Chief Officer",
        role=UserRoleEnum.ADMIN
    )
    db_session.add(user)
    db_session.commit()

    audit = AuditLog(
        user_id=user.id,
        action="APPROVE_TRANSFER",
        entity_type="Transfer",
        entity_id=1,
        details="Approved 50 boxes transfer"
    )
    db_session.add(audit)
    db_session.commit()

    assert audit.user.full_name == "Chief Officer"
    assert len(user.audit_logs) == 1


# --- 2. Check Constraints & Validation Tests ---

def test_negative_inventory_stock_constraint(db_session):
    """Test CheckConstraint prevents negative inventory quantities."""
    state = State(name="State E", code="SE")
    district = District(state=state, name="District E")
    facility = Facility(district=district, name="Hospital E", location="Loc E", type=FacilityTypeEnum.HOSPITAL)
    item = Item(name="Mask N95", code="MSK-95", category="Consumables", unit="boxes")
    db_session.add_all([state, district, facility, item])
    db_session.commit()

    invalid_inventory = Inventory(
        facility_id=facility.id,
        item_id=item.id,
        current_stock=-5,  # Violates check_inventory_stock_non_negative
        min_threshold=10,
        max_threshold=100
    )
    db_session.add(invalid_inventory)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_negative_consumption_quantity_constraint(db_session):
    """Test CheckConstraint prevents negative consumption quantity."""
    state = State(name="State F", code="SF")
    district = District(state=state, name="District F")
    facility = Facility(district=district, name="Hospital F", location="Loc F", type=FacilityTypeEnum.HOSPITAL)
    item = Item(name="Gauze Roll", code="GZ-01", category="Consumables", unit="rolls")
    db_session.add_all([state, district, facility, item])
    db_session.commit()

    invalid_consumption = ConsumptionRecord(
        facility_id=facility.id,
        item_id=item.id,
        quantity_consumed=-10,  # Violates check_consumption_qty_non_negative
        record_date=datetime.now(timezone.utc)
    )
    db_session.add(invalid_consumption)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_invalid_transfer_same_facility_constraint(db_session):
    """Test CheckConstraint prevents transfer to same source and destination facility."""
    state = State(name="State G", code="SG")
    district = District(state=state, name="District G")
    facility = Facility(district=district, name="Hospital G", location="Loc G", type=FacilityTypeEnum.HOSPITAL)
    item = Item(name="Saline 500ml", code="SAL-500", category="Consumables", unit="liters")
    db_session.add_all([state, district, facility, item])
    db_session.commit()

    invalid_transfer = Transfer(
        source_facility_id=facility.id,
        destination_facility_id=facility.id,  # Same facility violates check_transfer_different_facilities
        item_id=item.id,
        quantity=20
    )
    db_session.add(invalid_transfer)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


# --- 3. Unique Constraints Tests ---

def test_unique_facility_item_inventory_constraint(db_session):
    """Test UniqueConstraint on (facility_id, item_id) in Inventory."""
    state = State(name="State H", code="SH")
    district = District(state=state, name="District H")
    facility = Facility(district=district, name="Hospital H", location="Loc H", type=FacilityTypeEnum.HOSPITAL)
    item = Item(name="Insulin Vial", code="INS-01", category="Medications", unit="vials")
    db_session.add_all([state, district, facility, item])
    db_session.commit()

    inv1 = Inventory(facility_id=facility.id, item_id=item.id, current_stock=50)
    db_session.add(inv1)
    db_session.commit()

    inv2 = Inventory(facility_id=facility.id, item_id=item.id, current_stock=30)
    db_session.add(inv2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_unique_state_district_name_constraint(db_session):
    """Test UniqueConstraint on (state_id, name) in District."""
    state = State(name="State I", code="SI")
    db_session.add(state)
    db_session.commit()

    d1 = District(state_id=state.id, name="Metro District")
    db_session.add(d1)
    db_session.commit()

    d2 = District(state_id=state.id, name="Metro District")
    db_session.add(d2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


# --- 4. Alembic Migration Upgrade / Downgrade Test ---

def test_alembic_migration_upgrade_downgrade():
    """Test executing Alembic migration upgrade and downgrade commands cleanly."""
    from app.db.session import engine
    from app.db.base import Base
    from sqlalchemy import text

    alembic_cfg = Config("alembic.ini")

    # Drop existing tables created by conftest fixture including alembic_version table
    Base.metadata.drop_all(bind=engine)
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS alembic_version"))

    # Run upgrade to head
    command.upgrade(alembic_cfg, "head")

    # Run downgrade to base
    command.downgrade(alembic_cfg, "base")

    # Re-apply upgrade to head for remaining tests/system execution
    command.upgrade(alembic_cfg, "head")

