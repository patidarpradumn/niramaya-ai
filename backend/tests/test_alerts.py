"""Comprehensive tests for Risk and Alert Processing module (Phase 10)."""

import pytest
from datetime import datetime, timezone, timedelta

from app.models import (
    UserRoleEnum, Alert, Risk, State, District, Facility, Item, User,
    AlertSeverityEnum, RiskCategoryEnum, AlertStatusEnum
)
from app.config import settings
from app.utils import create_access_token
from app.services.alert_service import alert_service


def get_auth_header(email: str, user_id: int, role: UserRoleEnum) -> dict:
    token = create_access_token({"sub": str(user_id), "email": email, "role": role.value})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def alert_test_data(db_session):
    state = State(id=100, name="Alert State", code="AS")
    db_session.add(state)
    db_session.commit()

    dist1 = District(id=100, name="Alert District 1", state_id=100)
    dist2 = District(id=200, name="Alert District 2", state_id=100)
    db_session.add_all([dist1, dist2])
    db_session.commit()

    fac1 = Facility(id=100, name="Central Hospital", location="City Center", district_id=100, type="hospital")
    fac2 = Facility(id=200, name="Rural Clinic", location="North Suburb", district_id=200, type="clinic")
    db_session.add_all([fac1, fac2])
    db_session.commit()

    item1 = Item(id=100, name="Paracetamol 500mg", category="Medication", unit="Tablets", code="MED-PAR-500")
    item2 = Item(id=200, name="Oxygen Cylinder 10L", category="Equipment", unit="Cylinders", code="EQP-OXY-10")
    db_session.add_all([item1, item2])
    db_session.commit()

    super_admin = User(
        id=100, email="super_alert@mediguard.gov", full_name="Super Admin",
        password_hash="hash", role=UserRoleEnum.SUPER_ADMIN, is_active=True
    )
    hospital_admin = User(
        id=101, email="admin_fac100@mediguard.gov", full_name="Hospital Admin",
        password_hash="hash", role=UserRoleEnum.HOSPITAL_ADMIN, facility_id=100, is_active=True
    )
    citizen = User(
        id=199, email="citizen_alert@mediguard.gov", full_name="Citizen User",
        password_hash="hash", role=UserRoleEnum.CITIZEN, is_active=True
    )
    db_session.add_all([super_admin, hospital_admin, citizen])
    db_session.commit()

    return {
        "fac1": fac1,
        "fac2": fac2,
        "item1": item1,
        "item2": item2,
        "super_admin": super_admin,
        "hospital_admin": hospital_admin,
        "citizen": citizen
    }


# --- Unit & Threshold Service Tests ---

def test_calculate_stockout_severity_thresholds():
    """Test stock-out severity calculation against configurable thresholds."""
    # Critical: <= ALERT_STOCKOUT_CRITICAL_DAYS (3.0)
    assert alert_service.calculate_stockout_severity(1.0) == AlertSeverityEnum.CRITICAL
    assert alert_service.calculate_stockout_severity(3.0) == AlertSeverityEnum.CRITICAL

    # High: > 3.0 and <= 7.0
    assert alert_service.calculate_stockout_severity(4.0) == AlertSeverityEnum.HIGH
    assert alert_service.calculate_stockout_severity(7.0) == AlertSeverityEnum.HIGH

    # Medium: > 7.0 and <= 14.0
    assert alert_service.calculate_stockout_severity(10.0) == AlertSeverityEnum.MEDIUM
    assert alert_service.calculate_stockout_severity(14.0) == AlertSeverityEnum.MEDIUM

    # Low: > 14.0
    assert alert_service.calculate_stockout_severity(20.0) == AlertSeverityEnum.LOW


def test_calculate_expiry_severity_thresholds():
    """Test expiry severity calculation against configurable thresholds."""
    # Critical: <= 7 days
    assert alert_service.calculate_expiry_severity(5) == AlertSeverityEnum.CRITICAL
    assert alert_service.calculate_expiry_severity(7) == AlertSeverityEnum.CRITICAL

    # High: > 7 and <= 30 days
    assert alert_service.calculate_expiry_severity(15) == AlertSeverityEnum.HIGH
    assert alert_service.calculate_expiry_severity(30) == AlertSeverityEnum.HIGH

    # Medium: > 30 and <= 60 days
    assert alert_service.calculate_expiry_severity(45) == AlertSeverityEnum.MEDIUM
    assert alert_service.calculate_expiry_severity(60) == AlertSeverityEnum.MEDIUM

    # Low: > 60 days
    assert alert_service.calculate_expiry_severity(90) == AlertSeverityEnum.LOW


def test_create_stockout_alert_service(db_session, alert_test_data):
    """Test creating stock-out alert creates Risk and Alert with structured details."""
    alert = alert_service.create_stockout_alert(
        db=db_session,
        facility_id=100,
        item_id=100,
        current_stock=15,
        predicted_demand=120,
        estimated_days_to_shortage=2.5
    )

    assert alert is not None
    assert alert.facility_id == 100
    assert alert.item_id == 100
    assert alert.severity == AlertSeverityEnum.CRITICAL
    assert alert.risk_category == RiskCategoryEnum.STOCK_OUT
    assert alert.status == AlertStatusEnum.ACTIVE
    assert alert.acknowledged is False

    # Check details JSON
    assert alert.details["current_stock"] == 15
    assert alert.details["predicted_demand"] == 120
    assert alert.details["estimated_days_to_shortage"] == 2.5
    assert alert.details["risk_level"] == "CRITICAL"

    # Verify associated Risk record
    assert alert.risk_id is not None
    risk = db_session.query(Risk).filter(Risk.id == alert.risk_id).first()
    assert risk is not None
    assert risk.risk_type == "STOCK_OUT"


def test_create_expiry_alert_service(db_session, alert_test_data):
    """Test creating expiry alert with batch details and context."""
    expiry_dt = datetime.now(timezone.utc) + timedelta(days=20)

    alert = alert_service.create_expiry_alert(
        db=db_session,
        facility_id=100,
        item_id=100,
        quantity=500,
        expiry_date=expiry_dt,
        expected_consumption_context="High pediatric demand",
        batch_number="BAT-999"
    )

    assert alert is not None
    assert alert.facility_id == 100
    assert alert.item_id == 100
    assert alert.severity == AlertSeverityEnum.HIGH
    assert alert.risk_category == RiskCategoryEnum.EXPIRY
    assert alert.details["quantity"] == 500
    assert alert.details["batch_number"] == "BAT-999"
    assert alert.details["expected_consumption_context"] == "High pediatric demand"


def test_duplicate_alert_prevention(db_session, alert_test_data):
    """Test that duplicate active alerts within window are suppressed."""
    alert1 = alert_service.create_stockout_alert(
        db=db_session,
        facility_id=100,
        item_id=100,
        current_stock=10,
        predicted_demand=100,
        estimated_days_to_shortage=2.0
    )
    assert alert1 is not None

    # Immediate duplicate attempt
    alert2 = alert_service.create_stockout_alert(
        db=db_session,
        facility_id=100,
        item_id=100,
        current_stock=10,
        predicted_demand=100,
        estimated_days_to_shortage=2.0
    )
    assert alert2 is None


# --- API Router Endpoint Integration Tests ---

def test_list_alerts_endpoint(client, db_session, alert_test_data):
    """Test listing alerts with filters for facility, severity, status."""
    alert_service.create_stockout_alert(
        db=db_session, facility_id=100, item_id=100,
        current_stock=5, predicted_demand=100, estimated_days_to_shortage=1.0
    )
    expiry_dt = datetime.now(timezone.utc) + timedelta(days=45)
    alert_service.create_expiry_alert(
        db=db_session, facility_id=100, item_id=100,
        quantity=200, expiry_date=expiry_dt, batch_number="BAT-1"
    )

    headers = get_auth_header("super_alert@mediguard.gov", 100, UserRoleEnum.SUPER_ADMIN)

    # Filter by facility
    res = client.get("/api/v1/alerts?facility_id=100", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 2

    # Filter by risk_category
    res_cat = client.get("/api/v1/alerts?risk_category=EXPIRY", headers=headers)
    assert res_cat.status_code == 200
    assert all(a["risk_category"] == "EXPIRY" for a in res_cat.json())

    # Filter by severity
    res_sev = client.get("/api/v1/alerts?severity=CRITICAL", headers=headers)
    assert res_sev.status_code == 200
    assert all(a["severity"].upper() == "CRITICAL" for a in res_sev.json())


def test_get_alert_by_id_endpoint(client, db_session, alert_test_data):
    """Test fetching single alert by ID."""
    alert = alert_service.create_stockout_alert(
        db=db_session, facility_id=100, item_id=100,
        current_stock=10, predicted_demand=80, estimated_days_to_shortage=3.0
    )
    headers = get_auth_header("super_alert@mediguard.gov", 100, UserRoleEnum.SUPER_ADMIN)

    res = client.get(f"/api/v1/alerts/{alert.id}", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == alert.id
    assert data["facility_id"] == 100
    assert data["details"]["current_stock"] == 10
    assert data["details"]["risk_level"] == "CRITICAL"


def test_create_alert_endpoint(client, alert_test_data):
    """Test manual/operational alert creation via POST /alerts."""
    headers = get_auth_header("super_alert@mediguard.gov", 100, UserRoleEnum.SUPER_ADMIN)
    payload = {
        "facility_id": 100,
        "item_id": 200,
        "risk_category": "EQUIPMENT",
        "severity": "HIGH",
        "title": "Oxygen Plant Pressure Drop",
        "description": "Pressure instability detected in primary oxygen delivery pipeline.",
        "details": {"sensor_id": "SN-404", "pressure_psi": 28.5}
    }

    res = client.post("/api/v1/alerts", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["risk_category"] == "EQUIPMENT"
    assert data["severity"].upper() == "HIGH"
    assert data["title"] == "Oxygen Plant Pressure Drop"
    assert data["details"]["pressure_psi"] == 28.5


def test_acknowledge_alert_endpoint(client, db_session, alert_test_data):
    """Test acknowledging alert via POST /alerts/{id}/acknowledge."""
    alert = alert_service.create_stockout_alert(
        db=db_session, facility_id=100, item_id=100,
        current_stock=8, predicted_demand=50, estimated_days_to_shortage=2.0
    )
    headers = get_auth_header("admin_fac100@mediguard.gov", 101, UserRoleEnum.HOSPITAL_ADMIN)

    res = client.post(f"/api/v1/alerts/{alert.id}/acknowledge", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["acknowledged"] is True
    assert data["status"] == "ACKNOWLEDGED"
    assert data["acknowledged_by"] == 101
    assert data["acknowledged_at"] is not None


def test_patch_update_alert_endpoint(client, db_session, alert_test_data):
    """Test updating alert status and resolution notes via PATCH /alerts/{id}."""
    alert = alert_service.create_stockout_alert(
        db=db_session, facility_id=100, item_id=100,
        current_stock=5, predicted_demand=40, estimated_days_to_shortage=1.5
    )
    headers = get_auth_header("super_alert@mediguard.gov", 100, UserRoleEnum.SUPER_ADMIN)

    patch_payload = {
        "status": "RESOLVED",
        "resolution_notes": "Emergency stock delivered from District Warehouse."
    }

    res = client.patch(f"/api/v1/alerts/{alert.id}", json=patch_payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "RESOLVED"
    assert data["resolution_notes"] == "Emergency stock delivered from District Warehouse."
    assert data["resolved_at"] is not None


def test_rbac_citizen_access_denied(client, alert_test_data):
    """Test that Citizens get 403 Forbidden on alert endpoints."""
    headers = get_auth_header("citizen_alert@mediguard.gov", 199, UserRoleEnum.CITIZEN)

    res_list = client.get("/api/v1/alerts", headers=headers)
    assert res_list.status_code == 403

    res_get = client.get("/api/v1/alerts/1", headers=headers)
    assert res_get.status_code == 403


def test_facility_isolation_rbac(client, db_session, alert_test_data):
    """Test that Hospital Admin for facility 100 cannot access alerts for facility 200."""
    alert_fac2 = alert_service.create_stockout_alert(
        db=db_session, facility_id=200, item_id=100,
        current_stock=2, predicted_demand=60, estimated_days_to_shortage=0.5
    )
    # Admin of facility 100
    headers = get_auth_header("admin_fac100@mediguard.gov", 101, UserRoleEnum.HOSPITAL_ADMIN)

    res = client.get(f"/api/v1/alerts/{alert_fac2.id}", headers=headers)
    assert res.status_code == 403
