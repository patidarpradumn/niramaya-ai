"""Comprehensive RBAC and Boundary Check Tests for MediGuard AI Backend."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import (
    User, UserRoleEnum, State, District, Facility, Item, Inventory, Alert, Prediction, AlertSeverity
)
from app.utils import get_password_hash, create_access_token


def setup_rbac_test_data(db: Session):
    """Setup multi-jurisdiction data hierarchy for RBAC testing."""
    db.query(Alert).delete()
    db.query(Prediction).delete()
    db.query(Inventory).delete()
    db.query(Item).delete()
    db.query(Facility).delete()
    db.query(District).delete()
    db.query(State).delete()
    db.query(User).delete()
    db.commit()

    # Create 2 States
    state_a = State(id=1, name="State Alpha", code="SA")
    state_b = State(id=2, name="State Beta", code="SB")
    db.add_all([state_a, state_b])
    db.commit()

    # Create 2 Districts per State
    dist_a1 = District(id=1, name="District A1", state_id=1)
    dist_a2 = District(id=2, name="District A2", state_id=1)
    dist_b1 = District(id=3, name="District B1", state_id=2)
    db.add_all([dist_a1, dist_a2, dist_b1])
    db.commit()

    # Create Facilities
    fac_a1 = Facility(id=1, name="Hospital A1", location="Loc 1", district_id=1, type="hospital")
    fac_a2 = Facility(id=2, name="Clinic A2", location="Loc 2", district_id=2, type="clinic")
    fac_b1 = Facility(id=3, name="Hospital B1", location="Loc 3", district_id=3, type="hospital")
    db.add_all([fac_a1, fac_a2, fac_b1])
    db.commit()

    # Create Items
    item_a = Item(id=1, name="Vaccine A", code="VAC-A", category="Vaccines", unit="doses")
    item_b = Item(id=2, name="Vaccine B", code="VAC-B", category="Vaccines", unit="doses")
    db.add_all([item_a, item_b])
    db.commit()

    # Create Inventory items
    inv_a1 = Inventory(id=1, facility_id=1, item_id=1, current_stock=100, min_threshold=20, max_threshold=500)
    inv_b1 = Inventory(id=2, facility_id=3, item_id=2, current_stock=50, min_threshold=10, max_threshold=200)
    db.add_all([inv_a1, inv_b1])
    db.commit()

    # Create Alerts
    alert_a1 = Alert(id=1, facility_id=1, title="Low Stock A1", description="Stock warning", severity=AlertSeverity.HIGH)
    alert_b1 = Alert(id=2, facility_id=3, title="Low Stock B1", description="Stock warning", severity=AlertSeverity.HIGH)
    db.add_all([alert_a1, alert_b1])
    db.commit()

    # Create Users for all roles
    super_admin = User(id=1, email="super@mediguard.gov", full_name="Super Admin", password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.SUPER_ADMIN, is_active=True)
    state_admin_a = User(id=2, email="statea@mediguard.gov", full_name="State Admin A", password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.STATE_ADMIN, state_id=1, is_active=True)
    dist_admin_a1 = User(id=3, email="dista1@mediguard.gov", full_name="District Admin A1", password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.DISTRICT_ADMIN, state_id=1, district_id=1, is_active=True)
    dist_admin_b1 = User(id=4, email="distb1@mediguard.gov", full_name="District Admin B1", password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.DISTRICT_ADMIN, state_id=2, district_id=3, is_active=True)
    hosp_admin_a1 = User(id=5, email="hospa1@mediguard.gov", full_name="Hosp Admin A1", password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.HOSPITAL_ADMIN, state_id=1, district_id=1, facility_id=1, is_active=True)
    hosp_admin_b1 = User(id=6, email="hospb1@mediguard.gov", full_name="Hosp Admin B1", password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.HOSPITAL_ADMIN, state_id=2, district_id=3, facility_id=3, is_active=True)
    citizen = User(id=7, email="citizen@mediguard.gov", full_name="Citizen One", password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.CITIZEN, is_active=True)

    db.add_all([super_admin, state_admin_a, dist_admin_a1, dist_admin_b1, hosp_admin_a1, hosp_admin_b1, citizen])
    db.commit()

    return {
        "super_admin": super_admin,
        "state_admin_a": state_admin_a,
        "dist_admin_a1": dist_admin_a1,
        "dist_admin_b1": dist_admin_b1,
        "hosp_admin_a1": hosp_admin_a1,
        "hosp_admin_b1": hosp_admin_b1,
        "citizen": citizen,
    }


def auth_header(user: User):
    """Generate authorization header for a user."""
    token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role.value})
    return {"Authorization": f"Bearer {token}"}


# -------------------------------------------------------------------
# 1. CITIZEN Restrictions Tests
# -------------------------------------------------------------------

def test_citizen_cannot_access_administrative_endpoints(client: TestClient, db_session: Session):
    users = setup_rbac_test_data(db_session)
    headers = auth_header(users["citizen"])

    # Facilities list & create
    assert client.get("/api/v1/facilities", headers=headers).status_code == 403
    assert client.post("/api/v1/facilities", json={"name": "New", "location": "Loc New", "type": "hospital", "district_id": 1}, headers=headers).status_code == 403

    # Inventory
    assert client.get("/api/v1/inventory", headers=headers).status_code == 403
    assert client.post("/api/v1/inventory", json={"facility_id": 1, "item_name": "X", "category": "Y", "unit": "doses", "current_stock": 10}, headers=headers).status_code == 403

    # Alerts
    assert client.get("/api/v1/alerts", headers=headers).status_code == 403

    # Predictions
    assert client.get("/api/v1/predictions/demand", headers=headers).status_code == 403
    assert client.get("/api/v1/predictions/risk", headers=headers).status_code == 403

    # Dashboard & AI
    assert client.get("/api/v1/dashboard/", headers=headers).status_code == 403
    assert client.post("/api/v1/ai/query", json={"query": "Test"}, headers=headers).status_code == 403


# -------------------------------------------------------------------
# 2. Horizontal Privilege Escalation Tests (District & Facility level)
# -------------------------------------------------------------------

def test_district_admin_cannot_access_other_district_facility(client: TestClient, db_session: Session):
    users = setup_rbac_test_data(db_session)
    headers_a1 = auth_header(users["dist_admin_a1"])

    # District Admin A1 (District 1) attempts to get Facility B1 (District 3)
    response = client.get("/api/v1/facilities/3", headers=headers_a1)
    assert response.status_code == 403
    assert "Access denied" in response.json()["detail"]

    # Attempts to update Facility B1
    response = client.put("/api/v1/facilities/3", json={"name": "Hacked B1", "location": "Loc 3", "type": "hospital", "district_id": 3}, headers=headers_a1)
    assert response.status_code == 403

    # Attempts to get Inventory of Facility B1
    response = client.get("/api/v1/inventory?facility_id=3", headers=headers_a1)
    assert response.status_code == 403

    # Attempts to update Inventory item belonging to Facility B1
    response = client.put("/api/v1/inventory/2", json={"current_stock": 999}, headers=headers_a1)
    assert response.status_code == 403


def test_hospital_admin_cannot_access_other_facility(client: TestClient, db_session: Session):
    users = setup_rbac_test_data(db_session)
    headers_h1 = auth_header(users["hosp_admin_a1"])

    # Hospital Admin 1 (Facility 1) accesses Facility 1 -> 200 OK
    res1 = client.get("/api/v1/facilities/1", headers=headers_h1)
    assert res1.status_code == 200

    # Hospital Admin 1 accesses Facility 3 -> 403 Forbidden
    res3 = client.get("/api/v1/facilities/3", headers=headers_h1)
    assert res3.status_code == 403

    # Acknowledge Alert for Facility 3 -> 403 Forbidden
    res_alert = client.put("/api/v1/alerts/2/acknowledge", headers=headers_h1)
    assert res_alert.status_code == 403


# -------------------------------------------------------------------
# 3. Hierarchy Scoping Tests (Super Admin, State Admin, District Admin)
# -------------------------------------------------------------------

def test_super_admin_has_full_access(client: TestClient, db_session: Session):
    users = setup_rbac_test_data(db_session)
    headers_super = auth_header(users["super_admin"])

    # List all facilities
    res = client.get("/api/v1/facilities", headers=headers_super)
    assert res.status_code == 200
    assert len(res.json()) == 3

    # Can access any specific facility
    assert client.get("/api/v1/facilities/1", headers=headers_super).status_code == 200
    assert client.get("/api/v1/facilities/3", headers=headers_super).status_code == 200


def test_state_admin_scoping(client: TestClient, db_session: Session):
    users = setup_rbac_test_data(db_session)
    headers_state_a = auth_header(users["state_admin_a"])

    # State Admin A (State 1) listing facilities -> should only see facilities in State 1 (Facility 1 and 2)
    res = client.get("/api/v1/facilities", headers=headers_state_a)
    assert res.status_code == 200
    fac_ids = [f["id"] for f in res.json()]
    assert set(fac_ids) == {1, 2}

    # State Admin A accessing Facility 3 (State 2) -> 403 Forbidden
    assert client.get("/api/v1/facilities/3", headers=headers_state_a).status_code == 403


def test_district_admin_scoping(client: TestClient, db_session: Session):
    users = setup_rbac_test_data(db_session)
    headers_dist_a1 = auth_header(users["dist_admin_a1"])

    # District Admin A1 (District 1) listing facilities -> only Facility 1
    res = client.get("/api/v1/facilities", headers=headers_dist_a1)
    assert res.status_code == 200
    fac_ids = [f["id"] for f in res.json()]
    assert fac_ids == [1]

    # District Admin A1 listing alerts -> only Alert 1 (Facility 1)
    res_alert = client.get("/api/v1/alerts", headers=headers_dist_a1)
    assert res_alert.status_code == 200
    alert_ids = [a["id"] for a in res_alert.json()]
    assert alert_ids == [1]


# -------------------------------------------------------------------
# 4. Mutation Authorization Checks
# -------------------------------------------------------------------

def test_facility_staff_cannot_create_or_delete_facilities(client: TestClient, db_session: Session):
    users = setup_rbac_test_data(db_session)
    # Create staff user
    staff = User(id=8, email="staff@mediguard.gov", full_name="Staff User", password_hash=get_password_hash("P123"), role=UserRoleEnum.FACILITY_STAFF, facility_id=1, is_active=True)
    db_session.add(staff)
    db_session.commit()
    headers_staff = auth_header(staff)

    # Creating facility is restricted to Super/State/District Admins
    res_create = client.post("/api/v1/facilities", json={"name": "Staff Fac", "location": "Loc Staff", "type": "hospital", "district_id": 1}, headers=headers_staff)
    assert res_create.status_code == 403

    # Deleting facility is restricted to Super Admin
    res_delete = client.delete("/api/v1/facilities/1", headers=headers_staff)
    assert res_delete.status_code == 403
