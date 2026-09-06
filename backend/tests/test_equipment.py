"""Comprehensive pytest test suite for Equipment & Maintenance Module (Phase 12)."""

import pytest
from datetime import datetime, timezone, timedelta

from app.models import (
    UserRoleEnum, EquipmentStatusEnum, State, District, Facility, User,
    Equipment, MaintenanceRecord, Alert, RiskCategoryEnum, AlertStatusEnum
)
from app.utils import create_access_token


def get_auth_header(email: str, user_id: int, role: UserRoleEnum) -> dict:
    token = create_access_token({"sub": str(user_id), "email": email, "role": role.value})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def equipment_test_data(db_session):
    state = State(id=300, name="Equipment State", code="ES")
    db_session.add(state)
    db_session.commit()

    dist1 = District(id=300, name="Equipment District 1", state_id=300)
    dist2 = District(id=400, name="Equipment District 2", state_id=300)
    db_session.add_all([dist1, dist2])
    db_session.commit()

    fac1 = Facility(id=300, name="Metro General Hospital", location="Downtown", district_id=300, type="DISTRICT_HOSPITAL")
    fac2 = Facility(id=400, name="Suburban Health Clinic", location="North Side", district_id=400, type="PHC")
    db_session.add_all([fac1, fac2])
    db_session.commit()

    super_admin = User(
        id=300, email="super_eq@mediguard.gov", full_name="Super Admin Eq",
        password_hash="hash", role=UserRoleEnum.SUPER_ADMIN, is_active=True
    )
    admin_fac1 = User(
        id=301, email="admin_fac300@mediguard.gov", full_name="Admin Fac 300",
        password_hash="hash", role=UserRoleEnum.HOSPITAL_ADMIN, facility_id=300, is_active=True
    )
    admin_fac2 = User(
        id=302, email="admin_fac400@mediguard.gov", full_name="Admin Fac 400",
        password_hash="hash", role=UserRoleEnum.HOSPITAL_ADMIN, facility_id=400, is_active=True
    )
    citizen = User(
        id=399, email="citizen_eq@mediguard.gov", full_name="Citizen Eq",
        password_hash="hash", role=UserRoleEnum.CITIZEN, is_active=True
    )
    db_session.add_all([super_admin, admin_fac1, admin_fac2, citizen])
    db_session.commit()

    return {
        "fac1": fac1,
        "fac2": fac2,
        "super_admin": super_admin,
        "admin_fac1": admin_fac1,
        "admin_fac2": admin_fac2,
        "citizen": citizen
    }


def test_equipment_crud(client, equipment_test_data):
    """Test Equipment CRUD endpoints."""
    headers = get_auth_header(
        equipment_test_data["admin_fac1"].email,
        equipment_test_data["admin_fac1"].id,
        UserRoleEnum.HOSPITAL_ADMIN
    )

    # 1. Create equipment
    create_payload = {
        "facility_id": 300,
        "name": "Ventilator Model V1",
        "equipment_type": "Ventilator",
        "serial_number": "SN-VENT-1001",
        "status": "OPERATIONAL",
        "installation_date": "2025-01-15T00:00:00Z",
        "downtime_hours": 5.0
    }
    res = client.post("/api/v1/equipment", json=create_payload, headers=headers)
    assert res.status_code == 201, res.text
    eq_data = res.json()
    eq_id = eq_data["id"]
    assert eq_data["name"] == "Ventilator Model V1"
    assert eq_data["equipment_type"] == "Ventilator"
    assert eq_data["status"] == "OPERATIONAL"

    # 2. Get equipment by ID
    res = client.get(f"/api/v1/equipment/{eq_id}", headers=headers)
    assert res.status_code == 200
    assert res.json()["serial_number"] == "SN-VENT-1001"

    # 3. List equipment
    res = client.get("/api/v1/equipment", headers=headers)
    assert res.status_code == 200
    assert len(res.json()) >= 1

    # 4. Update equipment
    update_payload = {
        "name": "Ventilator Model V1 Ultra",
        "downtime_hours": 12.0
    }
    res = client.patch(f"/api/v1/equipment/{eq_id}", json=update_payload, headers=headers)
    assert res.status_code == 200
    assert res.json()["name"] == "Ventilator Model V1 Ultra"
    assert res.json()["downtime_hours"] == 12.0

    # 5. Delete equipment
    res = client.delete(f"/api/v1/equipment/{eq_id}", headers=headers)
    assert res.status_code == 200

    # 6. Verify deletion
    res = client.get(f"/api/v1/equipment/{eq_id}", headers=headers)
    assert res.status_code == 404


def test_status_transitions_and_risk_alerts(client, equipment_test_data, db_session):
    """Test status transitions and automatic equipment risk alert creation."""
    headers = get_auth_header(
        equipment_test_data["admin_fac1"].email,
        equipment_test_data["admin_fac1"].id,
        UserRoleEnum.HOSPITAL_ADMIN
    )

    # Create operational equipment
    create_payload = {
        "facility_id": 300,
        "name": "MRI Scanner 3T",
        "equipment_type": "Imaging",
        "serial_number": "SN-MRI-3000",
        "status": "OPERATIONAL"
    }
    res = client.post("/api/v1/equipment", json=create_payload, headers=headers)
    assert res.status_code == 201
    eq_id = res.json()["id"]

    # Transition to UNDER_MAINTENANCE
    res = client.patch(f"/api/v1/equipment/{eq_id}", json={"status": "UNDER_MAINTENANCE"}, headers=headers)
    assert res.status_code == 200
    assert res.json()["status"] == "UNDER_MAINTENANCE"

    # Verify equipment risk alert generated
    alerts = db_session.query(Alert).filter(
        Alert.facility_id == 300,
        Alert.risk_category == RiskCategoryEnum.EQUIPMENT
    ).all()
    assert len(alerts) >= 1

    # Transition to NON_FUNCTIONAL
    res = client.patch(f"/api/v1/equipment/{eq_id}", json={"status": "NON_FUNCTIONAL"}, headers=headers)
    assert res.status_code == 200
    assert res.json()["status"] == "NON_FUNCTIONAL"

    # Transition back to OPERATIONAL
    res = client.patch(f"/api/v1/equipment/{eq_id}", json={"status": "OPERATIONAL"}, headers=headers)
    assert res.status_code == 200
    assert res.json()["status"] == "OPERATIONAL"


def test_maintenance_records_and_updates(client, equipment_test_data):
    """Test maintenance record logging and equipment update side effects."""
    headers = get_auth_header(
        equipment_test_data["admin_fac1"].email,
        equipment_test_data["admin_fac1"].id,
        UserRoleEnum.HOSPITAL_ADMIN
    )

    # Create equipment
    res = client.post("/api/v1/equipment", json={
        "facility_id": 300,
        "name": "Dialysis Machine",
        "equipment_type": "Dialysis",
        "serial_number": "SN-DIA-500",
        "status": "UNDER_MAINTENANCE"
    }, headers=headers)
    assert res.status_code == 201
    eq_id = res.json()["id"]

    # Log maintenance record
    now_str = datetime.now(timezone.utc).isoformat()
    next_due_str = (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()
    maint_payload = {
        "equipment_id": eq_id,
        "description": "Replaced filter and recalibrated pressure sensor",
        "performed_by": "BioMed Services Inc",
        "cost": 450.0,
        "maintenance_date": now_str,
        "next_due_date": next_due_str,
        "maintenance_type": "PREVENTIVE",
        "downtime_hours": 6.0,
        "update_equipment_status": "OPERATIONAL"
    }

    res = client.post("/api/v1/maintenance", json=maint_payload, headers=headers)
    assert res.status_code == 201, res.text
    m_data = res.json()
    assert m_data["cost"] == 450.0
    assert m_data["maintenance_type"] == "PREVENTIVE"

    # Verify equipment was updated with last_maintenance, next_maintenance, downtime, and OPERATIONAL status
    res = client.get(f"/api/v1/equipment/{eq_id}", headers=headers)
    assert res.status_code == 200
    eq_updated = res.json()
    assert eq_updated["status"] == "OPERATIONAL"
    assert eq_updated["downtime_hours"] == 6.0
    assert eq_updated["last_maintenance_date"] is not None

    # List maintenance records for equipment
    res = client.get(f"/api/v1/equipment/{eq_id}/maintenance", headers=headers)
    assert res.status_code == 200
    assert len(res.json()) >= 1


def test_downtime_calculation_and_analysis(client, equipment_test_data):
    """Test downtime calculations and uptime analysis endpoint."""
    headers = get_auth_header(
        equipment_test_data["admin_fac1"].email,
        equipment_test_data["admin_fac1"].id,
        UserRoleEnum.HOSPITAL_ADMIN
    )

    # Create equipment with installation date in past
    install_date = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
    res = client.post("/api/v1/equipment", json={
        "facility_id": 300,
        "name": "X-Ray Generator",
        "equipment_type": "Radiology",
        "serial_number": "SN-XRAY-700",
        "status": "OPERATIONAL",
        "installation_date": install_date,
        "downtime_hours": 24.0
    }, headers=headers)
    assert res.status_code == 201
    eq_id = res.json()["id"]

    # Request downtime analysis endpoint
    res = client.get(f"/api/v1/equipment/{eq_id}/downtime", headers=headers)
    assert res.status_code == 200
    analysis = res.json()
    assert analysis["total_downtime_hours"] == 24.0
    assert analysis["total_downtime_days"] == 1.0
    assert 0.0 <= analysis["uptime_percentage"] <= 100.0


def test_overdue_maintenance_detection(client, equipment_test_data):
    """Test overdue maintenance query and detection."""
    headers = get_auth_header(
        equipment_test_data["admin_fac1"].email,
        equipment_test_data["admin_fac1"].id,
        UserRoleEnum.HOSPITAL_ADMIN
    )

    # Create equipment with next maintenance in the past
    past_due = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
    res = client.post("/api/v1/equipment", json={
        "facility_id": 300,
        "name": "ECG Machine",
        "equipment_type": "Cardiology",
        "serial_number": "SN-ECG-999",
        "status": "OPERATIONAL",
        "next_maintenance_date": past_due
    }, headers=headers)
    assert res.status_code == 201

    # Query overdue equipment endpoint
    res = client.get("/api/v1/equipment/overdue", headers=headers)
    assert res.status_code == 200
    overdue_list = res.json()
    assert len(overdue_list) >= 1
    assert any(item["serial_number"] == "SN-ECG-999" for item in overdue_list)


def test_facility_rbac_and_isolation(client, equipment_test_data):
    """Test facility-level RBAC isolation for equipment operations."""
    headers_fac1 = get_auth_header(
        equipment_test_data["admin_fac1"].email,
        equipment_test_data["admin_fac1"].id,
        UserRoleEnum.HOSPITAL_ADMIN
    )
    headers_fac2 = get_auth_header(
        equipment_test_data["admin_fac2"].email,
        equipment_test_data["admin_fac2"].id,
        UserRoleEnum.HOSPITAL_ADMIN
    )
    headers_citizen = get_auth_header(
        equipment_test_data["citizen"].email,
        equipment_test_data["citizen"].id,
        UserRoleEnum.CITIZEN
    )

    # 1. Admin Fac1 creates equipment at Facility 300
    res = client.post("/api/v1/equipment", json={
        "facility_id": 300,
        "name": "Defibrillator Alpha",
        "serial_number": "SN-DEF-300"
    }, headers=headers_fac1)
    assert res.status_code == 201
    eq_id = res.json()["id"]

    # 2. Admin Fac2 attempts to access Facility 300 equipment -> 403 Forbidden
    res = client.get(f"/api/v1/equipment/{eq_id}", headers=headers_fac2)
    assert res.status_code == 403

    # 3. Admin Fac2 attempts to update Facility 300 equipment -> 403 Forbidden
    res = client.patch(f"/api/v1/equipment/{eq_id}", json={"name": "Hacked Name"}, headers=headers_fac2)
    assert res.status_code == 403

    # 4. Citizen attempts to access equipment endpoints -> 403 Forbidden
    res = client.get("/api/v1/equipment", headers=headers_citizen)
    assert res.status_code == 403

    res = client.get("/api/v1/maintenance", headers=headers_citizen)
    assert res.status_code == 403
