"""Comprehensive unit & integration tests for Stock Movement module in MediGuard AI backend."""

import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import (
    User, UserRoleEnum, State, District, Facility, Item, Inventory, StockMovement, AuditLog, StockMovementTypeEnum, FacilityTypeEnum
)
from app.utils import get_password_hash, create_access_token


def setup_stock_movement_test_data(db: Session):
    """Setup test environment: states, districts, facilities, users, items, and initial inventory."""
    db.query(AuditLog).delete()
    db.query(StockMovement).delete()
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
    fac_1 = Facility(id=1, name="Central Medical Store", location="Center", district_id=1, type=FacilityTypeEnum.DISTRICT_HOSPITAL)
    fac_2 = Facility(id=2, name="Community Health Center", location="North", district_id=2, type=FacilityTypeEnum.CHC)
    db.add_all([fac_1, fac_2])
    db.commit()

    # Users
    super_admin = User(
        id=1, email="super@mediguard.gov", full_name="Super Admin",
        password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.SUPER_ADMIN, is_active=True
    )
    hosp_admin_1 = User(
        id=2, email="admin1@mediguard.gov", full_name="Hospital Admin 1",
        password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.HOSPITAL_ADMIN,
        state_id=1, district_id=1, facility_id=1, is_active=True
    )
    hosp_admin_2 = User(
        id=3, email="admin2@mediguard.gov", full_name="Hospital Admin 2",
        password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.HOSPITAL_ADMIN,
        state_id=2, district_id=2, facility_id=2, is_active=True
    )
    staff_1 = User(
        id=4, email="staff1@mediguard.gov", full_name="Facility Staff 1",
        password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.FACILITY_STAFF,
        state_id=1, district_id=1, facility_id=1, is_active=True
    )
    citizen = User(
        id=5, email="citizen@mediguard.gov", full_name="Citizen",
        password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.CITIZEN, is_active=True
    )

    db.add_all([super_admin, hosp_admin_1, hosp_admin_2, staff_1, citizen])
    db.commit()

    # Catalog Items
    item_1 = Item(id=1, name="Paracetamol 500mg", code="PCM-500", category="Analgesics", unit="tablets")
    item_2 = Item(id=2, name="Amoxicillin 250mg", code="AMX-250", category="Antibiotics", unit="capsules")
    db.add_all([item_1, item_2])
    db.commit()

    # Initial Inventory
    inv_1 = Inventory(id=1, facility_id=1, item_id=1, current_stock=100, min_threshold=20, max_threshold=300)
    inv_2 = Inventory(id=2, facility_id=2, item_id=1, current_stock=50, min_threshold=10, max_threshold=200)
    db.add_all([inv_1, inv_2])
    db.commit()

    return {
        "super_admin": super_admin,
        "hosp_admin_1": hosp_admin_1,
        "hosp_admin_2": hosp_admin_2,
        "staff_1": staff_1,
        "citizen": citizen,
        "fac_1": fac_1,
        "fac_2": fac_2,
        "item_1": item_1,
        "item_2": item_2,
        "inv_1": inv_1,
        "inv_2": inv_2,
    }


def auth_header(user: User):
    token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role.value})
    return {"Authorization": f"Bearer {token}"}


# -------------------------------------------------------------------
# 1. Receiving Stock Test
# -------------------------------------------------------------------

def test_receiving_stock(client: TestClient, db_session: Session):
    data = setup_stock_movement_test_data(db_session)
    headers = auth_header(data["hosp_admin_1"])

    res = client.post("/api/v1/stock-movements", json={
        "facility_id": 1,
        "item_id": 1,
        "movement_type": "RECEIVED",
        "quantity": 50,
        "reference": "PO-2026-001"
    }, headers=headers)

    assert res.status_code == 201
    mv_data = res.json()
    assert mv_data["facility_id"] == 1
    assert mv_data["item_id"] == 1
    assert mv_data["movement_type"] == "RECEIVED"
    assert mv_data["quantity"] == 50
    assert mv_data["reference"] == "PO-2026-001"
    assert mv_data["facility_name"] == "Central Medical Store"
    assert mv_data["item_name"] == "Paracetamol 500mg"

    # Verify inventory increased from 100 to 150
    inv = db_session.query(Inventory).filter(Inventory.id == 1).first()
    assert inv.current_stock == 150


# -------------------------------------------------------------------
# 2. Issuing Stock Test
# -------------------------------------------------------------------

def test_issuing_stock(client: TestClient, db_session: Session):
    data = setup_stock_movement_test_data(db_session)
    headers = auth_header(data["hosp_admin_1"])

    res = client.post("/api/v1/stock-movements", json={
        "facility_id": 1,
        "item_id": 1,
        "movement_type": "ISSUED",
        "quantity": 30,
        "reference": "DISP-2026-01"
    }, headers=headers)

    assert res.status_code == 201
    mv_data = res.json()
    assert mv_data["quantity"] == 30
    assert mv_data["movement_type"] == "ISSUED"

    # Verify inventory decreased from 100 to 70
    inv = db_session.query(Inventory).filter(Inventory.id == 1).first()
    assert inv.current_stock == 70


# -------------------------------------------------------------------
# 3. Insufficient Stock Test
# -------------------------------------------------------------------

def test_insufficient_stock(client: TestClient, db_session: Session):
    data = setup_stock_movement_test_data(db_session)
    headers = auth_header(data["hosp_admin_1"])

    res = client.post("/api/v1/stock-movements", json={
        "facility_id": 1,
        "item_id": 1,
        "movement_type": "ISSUED",
        "quantity": 500,  # Only 100 available
        "reference": "OVERDRAW-TEST"
    }, headers=headers)

    assert res.status_code == 400
    assert "Insufficient stock" in res.json()["detail"]

    # Verify inventory remains unchanged at 100
    inv = db_session.query(Inventory).filter(Inventory.id == 1).first()
    assert inv.current_stock == 100


# -------------------------------------------------------------------
# 4. Transfer Movements Test
# -------------------------------------------------------------------

def test_transfer_movements(client: TestClient, db_session: Session):
    data = setup_stock_movement_test_data(db_session)
    headers_super = auth_header(data["super_admin"])

    # Step 1: Outbound transfer from Facility 1
    res_out = client.post("/api/v1/stock-movements", json={
        "facility_id": 1,
        "item_id": 1,
        "movement_type": "TRANSFERRED_OUT",
        "quantity": 25,
        "reference": "TRANSFER-FAC1-TO-FAC2"
    }, headers=headers_super)
    assert res_out.status_code == 201

    # Step 2: Inbound transfer to Facility 2
    res_in = client.post("/api/v1/stock-movements", json={
        "facility_id": 2,
        "item_id": 1,
        "movement_type": "TRANSFERRED_IN",
        "quantity": 25,
        "reference": "TRANSFER-FAC1-TO-FAC2"
    }, headers=headers_super)
    assert res_in.status_code == 201

    # Verify Facility 1 reduced from 100 to 75
    inv_1 = db_session.query(Inventory).filter(Inventory.id == 1).first()
    assert inv_1.current_stock == 75

    # Verify Facility 2 increased from 50 to 75
    inv_2 = db_session.query(Inventory).filter(Inventory.id == 2).first()
    assert inv_2.current_stock == 75


# -------------------------------------------------------------------
# 5. Transaction Rollback & Error Safety Test
# -------------------------------------------------------------------

def test_transaction_rollback(client: TestClient, db_session: Session):
    data = setup_stock_movement_test_data(db_session)
    headers = auth_header(data["hosp_admin_1"])

    # Non-existent item ID
    res_invalid = client.post("/api/v1/stock-movements", json={
        "facility_id": 1,
        "item_id": 99999,
        "movement_type": "RECEIVED",
        "quantity": 50
    }, headers=headers)

    assert res_invalid.status_code == 404

    # Verify no stock movement recorded
    movements_count = db_session.query(StockMovement).count()
    assert movements_count == 0


# -------------------------------------------------------------------
# 6. Audit Information Test
# -------------------------------------------------------------------

def test_audit_information(client: TestClient, db_session: Session):
    data = setup_stock_movement_test_data(db_session)
    headers = auth_header(data["staff_1"])

    res = client.post("/api/v1/stock-movements", json={
        "facility_id": 1,
        "item_id": 1,
        "movement_type": "ADJUSTMENT",
        "quantity": 5,
        "reference": "PHYSICAL_COUNT"
    }, headers=headers)

    assert res.status_code == 201
    mv_id = res.json()["id"]

    # Check StockMovement user responsible ID
    mv = db_session.query(StockMovement).filter(StockMovement.id == mv_id).first()
    assert mv.created_by_user_id == data["staff_1"].id
    assert mv.created_at is not None

    # Check AuditLog table entry
    audit = db_session.query(AuditLog).filter(
        AuditLog.entity_type == "StockMovement",
        AuditLog.entity_id == mv_id
    ).first()

    assert audit is not None
    assert audit.user_id == data["staff_1"].id
    assert audit.action == "STOCK_MOVEMENT_RECORDED"
    assert "ADJUSTMENT" in audit.details


# -------------------------------------------------------------------
# 7. RBAC & Location Access Control Test
# -------------------------------------------------------------------

def test_rbac_and_isolation(client: TestClient, db_session: Session):
    data = setup_stock_movement_test_data(db_session)
    headers_citizen = auth_header(data["citizen"])
    headers_h1 = auth_header(data["hosp_admin_1"])
    headers_h2 = auth_header(data["hosp_admin_2"])

    # Citizen cannot post movement -> 403
    res_cit_post = client.post("/api/v1/stock-movements", json={
        "facility_id": 1,
        "item_id": 1,
        "movement_type": "RECEIVED",
        "quantity": 10
    }, headers=headers_citizen)
    assert res_cit_post.status_code == 403

    # Citizen cannot list movements -> 403
    assert client.get("/api/v1/stock-movements", headers=headers_citizen).status_code == 403

    # Hospital Admin 1 cannot post movement for Facility 2 -> 403
    res_cross = client.post("/api/v1/stock-movements", json={
        "facility_id": 2,
        "item_id": 1,
        "movement_type": "RECEIVED",
        "quantity": 10
    }, headers=headers_h1)
    assert res_cross.status_code == 403

    # Hospital Admin 2 listing movements receives only movements for Facility 2
    client.post("/api/v1/stock-movements", json={
        "facility_id": 1,
        "item_id": 1,
        "movement_type": "RECEIVED",
        "quantity": 10
    }, headers=headers_h1)

    client.post("/api/v1/stock-movements", json={
        "facility_id": 2,
        "item_id": 1,
        "movement_type": "RECEIVED",
        "quantity": 20
    }, headers=headers_h2)

    res_list_h2 = client.get("/api/v1/stock-movements", headers=headers_h2)
    assert res_list_h2.status_code == 200
    h2_mvs = res_list_h2.json()
    assert all(m["facility_id"] == 2 for m in h2_mvs)


# -------------------------------------------------------------------
# 8. Filtering & Inventory Movement Endpoint Test
# -------------------------------------------------------------------

def test_filtering_stock_movements(client: TestClient, db_session: Session):
    data = setup_stock_movement_test_data(db_session)
    headers = auth_header(data["super_admin"])

    # Record various movements
    client.post("/api/v1/stock-movements", json={
        "facility_id": 1, "item_id": 1, "movement_type": "RECEIVED", "quantity": 50
    }, headers=headers)

    client.post("/api/v1/stock-movements", json={
        "facility_id": 1, "item_id": 1, "movement_type": "ISSUED", "quantity": 10
    }, headers=headers)

    client.post("/api/v1/stock-movements", json={
        "facility_id": 2, "item_id": 1, "movement_type": "RECEIVED", "quantity": 15
    }, headers=headers)

    # Filter by movement_type=ISSUED
    res_type = client.get("/api/v1/stock-movements?movement_type=ISSUED", headers=headers)
    assert res_type.status_code == 200
    assert len(res_type.json()) == 1
    assert res_type.json()[0]["movement_type"] == "ISSUED"

    # Filter by facility_id=1
    res_fac = client.get("/api/v1/stock-movements?facility_id=1", headers=headers)
    assert res_fac.status_code == 200
    assert len(res_fac.json()) == 2

    # GET /api/v1/inventory/1/movements
    res_inv_mvs = client.get("/api/v1/inventory/1/movements", headers=headers)
    assert res_inv_mvs.status_code == 200
    assert len(res_inv_mvs.json()) == 2
