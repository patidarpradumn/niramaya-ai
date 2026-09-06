"""Comprehensive tests for Inventory and Item catalog module in MediGuard AI backend."""

import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import (
    User, UserRoleEnum, State, District, Facility, Item, Inventory
)
from app.utils import get_password_hash, create_access_token


def setup_inventory_test_data(db: Session):
    """Setup test hierarchy and initial catalog items."""
    db.query(Inventory).delete()
    db.query(Item).delete()
    db.query(Facility).delete()
    db.query(District).delete()
    db.query(State).delete()
    db.query(User).delete()
    db.commit()

    # State & District
    state_a = State(id=1, name="State Alpha", code="SA")
    state_b = State(id=2, name="State Beta", code="SB")
    db.add_all([state_a, state_b])
    db.commit()

    dist_a1 = District(id=1, name="District A1", state_id=1)
    dist_b1 = District(id=2, name="District B1", state_id=2)
    db.add_all([dist_a1, dist_b1])
    db.commit()

    # Facilities
    fac_1 = Facility(id=1, name="City Hospital", location="Center", district_id=1, type="hospital")
    fac_2 = Facility(id=2, name="Rural Clinic", location="North", district_id=2, type="clinic")
    db.add_all([fac_1, fac_2])
    db.commit()

    # Users
    super_admin = User(
        id=1, email="super@mediguard.gov", full_name="Super Admin",
        password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.SUPER_ADMIN, is_active=True
    )
    dist_admin_a1 = User(
        id=2, email="dista1@mediguard.gov", full_name="District Admin A1",
        password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.DISTRICT_ADMIN,
        state_id=1, district_id=1, is_active=True
    )
    hosp_admin_1 = User(
        id=3, email="hosp1@mediguard.gov", full_name="Hospital Admin 1",
        password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.HOSPITAL_ADMIN,
        state_id=1, district_id=1, facility_id=1, is_active=True
    )
    hosp_admin_2 = User(
        id=4, email="hosp2@mediguard.gov", full_name="Hospital Admin 2",
        password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.HOSPITAL_ADMIN,
        state_id=2, district_id=2, facility_id=2, is_active=True
    )
    facility_staff = User(
        id=5, email="staff1@mediguard.gov", full_name="Facility Staff 1",
        password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.FACILITY_STAFF,
        state_id=1, district_id=1, facility_id=1, is_active=True
    )
    citizen = User(
        id=6, email="citizen@mediguard.gov", full_name="Citizen",
        password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.CITIZEN, is_active=True
    )

    db.add_all([super_admin, dist_admin_a1, hosp_admin_1, hosp_admin_2, facility_staff, citizen])
    db.commit()

    # Base catalog items
    item_1 = Item(id=1, name="Paracetamol 500mg", code="PCM-500", category="Analgesics", unit="tablets")
    item_2 = Item(id=2, name="Amoxicillin 250mg", code="AMX-250", category="Antibiotics", unit="capsules")
    db.add_all([item_1, item_2])
    db.commit()

    return {
        "super_admin": super_admin,
        "dist_admin_a1": dist_admin_a1,
        "hosp_admin_1": hosp_admin_1,
        "hosp_admin_2": hosp_admin_2,
        "facility_staff": facility_staff,
        "citizen": citizen,
        "fac_1": fac_1,
        "fac_2": fac_2,
        "item_1": item_1,
        "item_2": item_2,
    }


def auth_header(user: User):
    token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role.value})
    return {"Authorization": f"Bearer {token}"}


# -------------------------------------------------------------------
# 1. Item Catalog CRUD & Validation Tests
# -------------------------------------------------------------------

def test_item_crud_and_validation(client: TestClient, db_session: Session):
    data = setup_inventory_test_data(db_session)
    headers = auth_header(data["super_admin"])

    # Create Item
    res = client.post("/api/v1/items", json={
        "name": "Surgical Mask 3-Ply",
        "code": "MASK-001",
        "category": "PPE",
        "unit": "boxes",
        "description": "High grade surgical mask"
    }, headers=headers)
    assert res.status_code == 201
    item_data = res.json()
    assert item_data["name"] == "Surgical Mask 3-Ply"
    assert item_data["code"] == "MASK-001"
    item_id = item_data["id"]

    # Duplicate code rejection
    res_dup = client.post("/api/v1/items", json={
        "name": "Another Mask",
        "code": "MASK-001",
        "category": "PPE",
        "unit": "boxes"
    }, headers=headers)
    assert res_dup.status_code == 400
    assert "already exists" in res_dup.json()["detail"]

    # List items with pagination & search
    res_list = client.get("/api/v1/items?search=Mask&page=1&size=10", headers=headers)
    assert res_list.status_code == 200
    list_json = res_list.json()
    assert list_json["total"] == 1
    assert list_json["items"][0]["code"] == "MASK-001"

    # Get Item by ID
    res_get = client.get(f"/api/v1/items/{item_id}", headers=headers)
    assert res_get.status_code == 200
    assert res_get.json()["id"] == item_id

    # Update Item
    res_update = client.put(f"/api/v1/items/{item_id}", json={
        "name": "Surgical Mask N95",
        "description": "Updated description"
    }, headers=headers)
    assert res_update.status_code == 200
    assert res_update.json()["name"] == "Surgical Mask N95"

    # Delete Item
    res_del = client.delete(f"/api/v1/items/{item_id}", headers=headers)
    assert res_del.status_code == 204

    # Verify 404
    assert client.get(f"/api/v1/items/{item_id}", headers=headers).status_code == 404


# -------------------------------------------------------------------
# 2. Inventory CRUD & Validation Tests
# -------------------------------------------------------------------

def test_inventory_crud_and_validation(client: TestClient, db_session: Session):
    data = setup_inventory_test_data(db_session)
    headers = auth_header(data["hosp_admin_1"])

    # Create Inventory with valid data
    res_create = client.post("/api/v1/inventory", json={
        "facility_id": 1,
        "item_id": 1,
        "current_stock": 100,
        "min_threshold": 20,
        "max_threshold": 300,
        "batch_number": "BATCH-2026A",
        "expiry_date": (datetime.now(timezone.utc) + timedelta(days=180)).isoformat()
    }, headers=headers)
    assert res_create.status_code == 201
    inv_data = res_create.json()
    assert inv_data["facility_id"] == 1
    assert inv_data["current_stock"] == 100
    assert inv_data["batch_number"] == "BATCH-2026A"
    inv_id = inv_data["id"]

    # Negative stock validation check (Pydantic level 422 or Service level 400)
    res_neg = client.post("/api/v1/inventory", json={
        "facility_id": 1,
        "item_id": 2,
        "current_stock": -5,
        "min_threshold": 10,
        "max_threshold": 100
    }, headers=headers)
    assert res_neg.status_code in (400, 422)

    # Max < Min threshold validation check
    res_thresh = client.post("/api/v1/inventory", json={
        "facility_id": 1,
        "item_id": 2,
        "current_stock": 50,
        "min_threshold": 100,
        "max_threshold": 20
    }, headers=headers)
    assert res_thresh.status_code in (400, 422)

    # Get Inventory Item
    res_get = client.get(f"/api/v1/inventory/{inv_id}", headers=headers)
    assert res_get.status_code == 200
    assert res_get.json()["current_stock"] == 100

    # Update Stock Quantity and Thresholds
    res_up = client.put(f"/api/v1/inventory/{inv_id}", json={
        "current_stock": 15,
        "min_threshold": 20
    }, headers=headers)
    assert res_up.status_code == 200
    assert res_up.json()["current_stock"] == 15
    assert res_up.json()["is_low_stock"] is True

    # Low Stock endpoint check
    res_low = client.get("/api/v1/inventory/low-stock", headers=headers)
    assert res_low.status_code == 200
    low_items = res_low.json()
    assert len(low_items) >= 1
    assert low_items[0]["id"] == inv_id

    # Delete Inventory
    res_del = client.delete(f"/api/v1/inventory/{inv_id}", headers=headers)
    assert res_del.status_code == 204


# -------------------------------------------------------------------
# 3. RBAC & Facility Isolation Tests
# -------------------------------------------------------------------

def test_inventory_rbac_and_facility_isolation(client: TestClient, db_session: Session):
    data = setup_inventory_test_data(db_session)
    headers_h1 = auth_header(data["hosp_admin_1"])
    headers_h2 = auth_header(data["hosp_admin_2"])
    headers_citizen = auth_header(data["citizen"])

    # Hospital Admin 1 creates inventory in Facility 1 -> 201 OK
    res_create = client.post("/api/v1/inventory", json={
        "facility_id": 1,
        "item_id": 1,
        "current_stock": 50,
        "min_threshold": 10,
        "max_threshold": 200
    }, headers=headers_h1)
    assert res_create.status_code == 201
    inv_id = res_create.json()["id"]

    # Hospital Admin 1 attempts to create inventory for Facility 2 -> 403 Forbidden
    res_cross_create = client.post("/api/v1/inventory", json={
        "facility_id": 2,
        "item_id": 1,
        "current_stock": 50,
        "min_threshold": 10,
        "max_threshold": 200
    }, headers=headers_h1)
    assert res_cross_create.status_code == 403

    # Hospital Admin 2 attempts to get inventory item from Facility 1 -> 403 Forbidden
    res_cross_get = client.get(f"/api/v1/inventory/{inv_id}", headers=headers_h2)
    assert res_cross_get.status_code == 403

    # Hospital Admin 2 attempts to update inventory item from Facility 1 -> 403 Forbidden
    res_cross_up = client.put(f"/api/v1/inventory/{inv_id}", json={"current_stock": 0}, headers=headers_h2)
    assert res_cross_up.status_code == 403

    # Citizen attempts access -> 403 Forbidden
    assert client.get("/api/v1/inventory", headers=headers_citizen).status_code == 403
    assert client.get(f"/api/v1/inventory/{inv_id}", headers=headers_citizen).status_code == 403
    assert client.get("/api/v1/inventory/low-stock", headers=headers_citizen).status_code == 403
