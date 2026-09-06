"""Comprehensive unit & integration tests for Consumption Records module in MediGuard AI backend."""

import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import (
    User, UserRoleEnum, State, District, Facility, Item, ConsumptionRecord, FacilityTypeEnum
)
from app.utils import get_password_hash, create_access_token


def setup_consumption_test_data(db: Session):
    """Setup test environment: states, districts, facilities, items, users, and consumption records."""
    db.query(ConsumptionRecord).delete()
    db.query(Item).delete()
    db.query(Facility).delete()
    db.query(District).delete()
    db.query(State).delete()
    db.query(User).delete()
    db.commit()

    # States & Districts
    state_1 = State(id=1, name="State Alpha", code="SA")
    state_2 = State(id=2, name="State Beta", code="SB")
    db.add_all([state_1, state_2])
    db.commit()

    dist_1 = District(id=1, name="District 1", state_id=1)
    dist_2 = District(id=2, name="District 2", state_id=2)
    db.add_all([dist_1, dist_2])
    db.commit()

    # Facilities
    fac_1 = Facility(id=1, name="City Hospital", location="Center", district_id=1, type=FacilityTypeEnum.DISTRICT_HOSPITAL)
    fac_2 = Facility(id=2, name="Rural Clinic", location="North", district_id=2, type=FacilityTypeEnum.CHC)
    db.add_all([fac_1, fac_2])
    db.commit()

    # Items
    item_1 = Item(id=1, name="Paracetamol 500mg", category="Medication", unit="Tablets", code="MED-PAR-500")
    item_2 = Item(id=2, name="N95 Mask", category="PPE", unit="Pieces", code="PPE-N95-001")
    db.add_all([item_1, item_2])
    db.commit()

    # Users
    super_admin = User(
        id=1, email="super@mediguard.gov", full_name="Super Admin",
        password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.SUPER_ADMIN, is_active=True
    )
    hosp_admin_1 = User(
        id=2, email="admin1@mediguard.gov", full_name="Admin Fac 1",
        password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.HOSPITAL_ADMIN,
        facility_id=1, district_id=1, state_id=1, is_active=True
    )
    hosp_admin_2 = User(
        id=3, email="admin2@mediguard.gov", full_name="Admin Fac 2",
        password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.HOSPITAL_ADMIN,
        facility_id=2, district_id=2, state_id=2, is_active=True
    )
    citizen_user = User(
        id=4, email="citizen@mediguard.gov", full_name="Citizen User",
        password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.CITIZEN, is_active=True
    )
    db.add_all([super_admin, hosp_admin_1, hosp_admin_2, citizen_user])
    db.commit()

    # Pre-populate historical consumption records for aggregation & ML input tests
    now = datetime.now(timezone.utc)
    records = [
        ConsumptionRecord(facility_id=1, item_id=1, quantity_consumed=50, record_date=now - timedelta(days=3)),
        ConsumptionRecord(facility_id=1, item_id=1, quantity_consumed=30, record_date=now - timedelta(days=2)),
        ConsumptionRecord(facility_id=1, item_id=1, quantity_consumed=70, record_date=now - timedelta(days=1)),
        ConsumptionRecord(facility_id=1, item_id=2, quantity_consumed=15, record_date=now - timedelta(days=2)),
        ConsumptionRecord(facility_id=2, item_id=1, quantity_consumed=20, record_date=now - timedelta(days=1)),
    ]
    db.add_all(records)
    db.commit()


def get_auth_header(email: str, user_id: int, role: UserRoleEnum) -> dict:
    token = create_access_token({"sub": str(user_id), "email": email, "role": role.value})
    return {"Authorization": f"Bearer {token}"}


def test_create_consumption_success_and_validation(client: TestClient, db_session: Session):
    setup_consumption_test_data(db_session)
    headers = get_auth_header("super@mediguard.gov", 1, UserRoleEnum.SUPER_ADMIN)

    # 1. Success creation
    payload = {
        "facility_id": 1,
        "item_id": 1,
        "quantity_consumed": 40,
        "record_date": datetime.now(timezone.utc).isoformat()
    }
    response = client.post("/api/v1/consumption/", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["facility_id"] == 1
    assert data["item_id"] == 1
    assert data["quantity_consumed"] == 40
    assert data["facility_name"] == "City Hospital"
    assert data["item_name"] == "Paracetamol 500mg"

    # 2. Validation: Zero or Negative quantity
    invalid_payload = {
        "facility_id": 1,
        "item_id": 1,
        "quantity_consumed": 0
    }
    resp = client.post("/api/v1/consumption/", json=invalid_payload, headers=headers)
    assert resp.status_code == 422 or resp.status_code == 400

    # 3. Validation: Non-existent item
    invalid_item_payload = {
        "facility_id": 1,
        "item_id": 9999,
        "quantity_consumed": 10
    }
    resp = client.post("/api/v1/consumption/", json=invalid_item_payload, headers=headers)
    assert resp.status_code == 404

    # 4. Validation: Non-existent facility
    invalid_fac_payload = {
        "facility_id": 9999,
        "item_id": 1,
        "quantity_consumed": 10
    }
    resp = client.post("/api/v1/consumption/", json=invalid_fac_payload, headers=headers)
    assert resp.status_code == 404


def test_get_and_list_consumption_records(client: TestClient, db_session: Session):
    setup_consumption_test_data(db_session)
    headers = get_auth_header("super@mediguard.gov", 1, UserRoleEnum.SUPER_ADMIN)

    # List all
    response = client.get("/api/v1/consumption/", headers=headers)
    assert response.status_code == 200
    records = response.json()
    assert len(records) == 5

    # Filter by item_id
    response = client.get("/api/v1/consumption/?item_id=2", headers=headers)
    assert response.status_code == 200
    records = response.json()
    assert len(records) == 1
    assert records[0]["item_id"] == 2

    # Get single record by ID
    record_id = records[0]["id"]
    response = client.get(f"/api/v1/consumption/{record_id}", headers=headers)
    assert response.status_code == 200
    rec = response.json()
    assert rec["id"] == record_id

    # Get unknown record ID -> 404
    response = client.get("/api/v1/consumption/99999", headers=headers)
    assert response.status_code == 404


def test_consumption_aggregation(client: TestClient, db_session: Session):
    setup_consumption_test_data(db_session)
    headers = get_auth_header("super@mediguard.gov", 1, UserRoleEnum.SUPER_ADMIN)

    # Daily summary for facility 1
    response = client.get("/api/v1/consumption/summary?facility_id=1&period=daily", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["period"] == "daily"
    assert data["facility_id"] == 1
    assert data["total_consumed"] == 165  # 50 + 30 + 70 + 15
    assert len(data["summary"]) > 0

    # Weekly summary
    response = client.get("/api/v1/consumption/summary?facility_id=1&period=weekly", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["period"] == "weekly"

    # Invalid period -> 400
    response = client.get("/api/v1/consumption/summary?period=yearly", headers=headers)
    assert response.status_code == 400


def test_consumption_date_filtering(client: TestClient, db_session: Session):
    setup_consumption_test_data(db_session)
    headers = get_auth_header("super@mediguard.gov", 1, UserRoleEnum.SUPER_ADMIN)

    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=2, hours=1)).isoformat()
    end_date = (now - timedelta(days=1, hours=-1)).isoformat()

    params = {
        "start_date": start_date,
        "end_date": end_date
    }
    response = client.get("/api/v1/consumption/", params=params, headers=headers)
    assert response.status_code == 200
    records = response.json()
    assert len(records) >= 1


def test_ml_input_preparation(client: TestClient, db_session: Session):
    setup_consumption_test_data(db_session)
    headers = get_auth_header("super@mediguard.gov", 1, UserRoleEnum.SUPER_ADMIN)

    response = client.get("/api/v1/consumption/ml-input?facility_id=1&item_id=1", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["facility_id"] == 1
    assert data["item_id"] == 1
    assert data["total_records"] == 3
    assert data["total_quantity"] == 150  # 50 + 30 + 70
    assert len(data["data_points"]) == 3

    # Check ML formatting: ds (YYYY-MM-DD) and y (quantity)
    dp = data["data_points"][0]
    assert "ds" in dp
    assert "y" in dp
    assert isinstance(dp["y"], int)


def test_consumption_rbac_and_facility_isolation(client: TestClient, db_session: Session):
    setup_consumption_test_data(db_session)

    # 1. Hospital Admin 1 (facility 1) access own facility
    admin1_headers = get_auth_header("admin1@mediguard.gov", 2, UserRoleEnum.HOSPITAL_ADMIN)
    response = client.get("/api/v1/consumption/", headers=admin1_headers)
    assert response.status_code == 200
    records = response.json()
    assert all(r["facility_id"] == 1 for r in records)

    # Hospital Admin 1 attempting to create for Facility 2 -> 403 Forbidden
    payload = {
        "facility_id": 2,
        "item_id": 1,
        "quantity_consumed": 10
    }
    response = client.post("/api/v1/consumption/", json=payload, headers=admin1_headers)
    assert response.status_code == 403

    # 2. Citizen access -> 403 Forbidden
    citizen_headers = get_auth_header("citizen@mediguard.gov", 4, UserRoleEnum.CITIZEN)
    response = client.get("/api/v1/consumption/", headers=citizen_headers)
    assert response.status_code == 403

    response = client.post("/api/v1/consumption/", json=payload, headers=citizen_headers)
    assert response.status_code == 403
