"""Comprehensive test suite for Cross-Facility Redistribution Recommendations (Phase 11)."""

import pytest
from datetime import datetime, timezone

from app.models import (
    UserRoleEnum, Recommendation, Transfer, ApprovalAction, AuditLog, State, District,
    Facility, Item, Inventory, User, RecommendationStatusEnum, TransferStatusEnum,
    StockMovement, StockMovementTypeEnum
)
from app.utils import create_access_token
from app.services.redistribution_service import RedistributionService, calculate_haversine_distance


def get_auth_header(email: str, user_id: int, role: UserRoleEnum) -> dict:
    """Generate JWT authorization header for testing."""
    token = create_access_token({"sub": str(user_id), "email": email, "role": role.value})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def redistribution_test_data(db_session):
    """Seed test database with facilities, inventory, users, and items for redistribution tests."""
    state = State(id=300, name="Redistribution State", code="RS")
    db_session.add(state)
    db_session.commit()

    dist1 = District(id=300, name="Redistribution District 1", state_id=300)
    dist2 = District(id=400, name="Redistribution District 2", state_id=300)
    db_session.add_all([dist1, dist2])
    db_session.commit()

    # Facility 300: Surplus (Lat: 28.61, Lon: 77.20)
    fac_surplus = Facility(
        id=300, name="Surplus General Hospital", location="North Sector",
        district_id=300, type="hospital", latitude=28.6139, longitude=77.2090, is_active=True
    )
    # Facility 400: Deficit (Lat: 28.70, Lon: 77.10)
    fac_deficit = Facility(
        id=400, name="Deficit Community Health Center", location="West Sector",
        district_id=400, type="clinic", latitude=28.7041, longitude=77.1025, is_active=True
    )
    # Facility 500: Unrelated Facility
    fac_unrelated = Facility(
        id=500, name="Unrelated Hospital", location="South Sector",
        district_id=400, type="hospital", latitude=28.5000, longitude=77.3000, is_active=True
    )
    db_session.add_all([fac_surplus, fac_deficit, fac_unrelated])
    db_session.commit()

    item1 = Item(id=300, name="Amoxicillin 500mg", category="Antibiotics", unit="Capsules", code="MED-AMX-500")
    db_session.add(item1)
    db_session.commit()

    # Inventory: Surplus has 200 units (min_threshold 20), Deficit has 5 units (min_threshold 20)
    inv_surplus = Inventory(
        id=300, facility_id=300, item_id=300, current_stock=200, min_threshold=20, max_threshold=300
    )
    inv_deficit = Inventory(
        id=400, facility_id=400, item_id=300, current_stock=5, min_threshold=20, max_threshold=100
    )
    db_session.add_all([inv_surplus, inv_deficit])
    db_session.commit()

    super_admin = User(
        id=300, email="super_redist@mediguard.gov", full_name="Super Admin",
        password_hash="hash", role=UserRoleEnum.SUPER_ADMIN, is_active=True
    )
    admin_surplus = User(
        id=301, email="admin_fac300@mediguard.gov", full_name="Surplus Admin",
        password_hash="hash", role=UserRoleEnum.HOSPITAL_ADMIN, facility_id=300, is_active=True
    )
    admin_deficit = User(
        id=302, email="admin_fac400@mediguard.gov", full_name="Deficit Admin",
        password_hash="hash", role=UserRoleEnum.HOSPITAL_ADMIN, facility_id=400, is_active=True
    )
    admin_unrelated = User(
        id=303, email="admin_fac500@mediguard.gov", full_name="Unrelated Admin",
        password_hash="hash", role=UserRoleEnum.HOSPITAL_ADMIN, facility_id=500, is_active=True
    )
    citizen = User(
        id=399, email="citizen_redist@mediguard.gov", full_name="Citizen User",
        password_hash="hash", role=UserRoleEnum.CITIZEN, is_active=True
    )
    db_session.add_all([super_admin, admin_surplus, admin_deficit, admin_unrelated, citizen])
    db_session.commit()

    return {
        "fac_surplus": fac_surplus,
        "fac_deficit": fac_deficit,
        "fac_unrelated": fac_unrelated,
        "item": item1,
        "inv_surplus": inv_surplus,
        "inv_deficit": inv_deficit,
        "super_admin": super_admin,
        "admin_surplus": admin_surplus,
        "admin_deficit": admin_deficit,
        "admin_unrelated": admin_unrelated,
        "citizen": citizen
    }


def test_haversine_distance_calculation():
    """Verify physical distance calculation logic."""
    dist = calculate_haversine_distance(28.6139, 77.2090, 28.7041, 77.1025)
    assert isinstance(dist, float)
    assert dist > 0
    assert 10.0 < dist < 20.0  # Approx 14 km


def test_generate_recommendations(client, db_session, redistribution_test_data):
    """Test generating recommendations based on surplus vs deficit analysis."""
    headers = get_auth_header("super_redist@mediguard.gov", 300, UserRoleEnum.SUPER_ADMIN)
    response = client.post("/api/v1/recommendations/generate", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1

    rec = data[0]
    assert rec["action_type"] == "REDISTRIBUTION"
    assert rec["source_facility_id"] == 300
    assert rec["destination_facility_id"] == 400
    assert rec["item_id"] == 300
    assert rec["suggested_quantity"] > 0
    assert rec["status"] == "PENDING"

    # Crucial Rule: Stock levels must NOT automatically change upon recommendation creation
    inv_s = db_session.query(Inventory).filter(Inventory.id == 300).first()
    inv_d = db_session.query(Inventory).filter(Inventory.id == 400).first()
    assert inv_s.current_stock == 200
    assert inv_d.current_stock == 5


def test_list_and_get_recommendation(client, db_session, redistribution_test_data):
    """Test listing and retrieving single recommendation by ID."""
    # Seed a recommendation directly
    rec = Recommendation(
        id=900,
        title="Redistribute Amoxicillin",
        action_type="REDISTRIBUTION",
        facility_id=400,
        source_facility_id=300,
        destination_facility_id=400,
        item_id=300,
        suggested_quantity=35,
        reasoning="Test surplus transfer recommendation",
        status=RecommendationStatusEnum.PENDING
    )
    db_session.add(rec)
    db_session.commit()

    headers = get_auth_header("admin_fac300@mediguard.gov", 301, UserRoleEnum.HOSPITAL_ADMIN)
    
    # List recommendations
    response = client.get("/api/v1/recommendations", headers=headers)
    assert response.status_code == 200
    recs = response.json()
    assert len(recs) >= 1
    assert any(r["id"] == 900 for r in recs)

    # Get single recommendation
    response_single = client.get("/api/v1/recommendations/900", headers=headers)
    assert response_single.status_code == 200
    data = response_single.json()
    assert data["id"] == 900
    assert data["suggested_quantity"] == 35


def test_approve_recommendation_success(client, db_session, redistribution_test_data):
    """Test successful recommendation approval workflow."""
    rec = Recommendation(
        id=901,
        title="Redistribute Amoxicillin Batch",
        action_type="REDISTRIBUTION",
        facility_id=400,
        source_facility_id=300,
        destination_facility_id=400,
        item_id=300,
        suggested_quantity=30,
        reasoning="Prevent stockout at deficit facility",
        status=RecommendationStatusEnum.PENDING
    )
    db_session.add(rec)
    db_session.commit()

    headers = get_auth_header("admin_fac300@mediguard.gov", 301, UserRoleEnum.HOSPITAL_ADMIN)
    payload = {"override_quantity": 25, "notes": "Approved with adjusted quantity"}

    response = client.post("/api/v1/recommendations/901/approve", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "APPROVED"
    assert data["suggested_quantity"] == 25

    # Verify inventory movements
    inv_s = db_session.query(Inventory).filter(Inventory.id == 300).first()
    inv_d = db_session.query(Inventory).filter(Inventory.id == 400).first()
    assert inv_s.current_stock == 175  # 200 - 25
    assert inv_d.current_stock == 30   # 5 + 25

    # Verify Transfer record
    transfer = db_session.query(Transfer).filter(
        Transfer.source_facility_id == 300,
        Transfer.destination_facility_id == 400,
        Transfer.item_id == 300
    ).first()
    assert transfer is not None
    assert transfer.quantity == 25
    assert transfer.status in (TransferStatusEnum.COMPLETED, TransferStatusEnum.APPROVED)

    # Verify ApprovalAction record
    action = db_session.query(ApprovalAction).filter(ApprovalAction.recommendation_id == 901).first()
    assert action is not None
    assert action.action == "APPROVE"
    assert action.user_id == 301

    # Verify AuditLog record
    audit = db_session.query(AuditLog).filter(
        AuditLog.entity_type == "Recommendation",
        AuditLog.entity_id == 901,
        AuditLog.action == "RECOMMENDATION_APPROVED"
    ).first()
    assert audit is not None


def test_reject_recommendation(client, db_session, redistribution_test_data):
    """Test recommendation rejection workflow without altering inventory."""
    rec = Recommendation(
        id=902,
        title="Redistribute Excess Amoxicillin",
        action_type="REDISTRIBUTION",
        facility_id=400,
        source_facility_id=300,
        destination_facility_id=400,
        item_id=300,
        suggested_quantity=20,
        reasoning="Test rejection",
        status=RecommendationStatusEnum.PENDING
    )
    db_session.add(rec)
    db_session.commit()

    headers = get_auth_header("admin_fac400@mediguard.gov", 302, UserRoleEnum.HOSPITAL_ADMIN)
    payload = {"notes": "Not needed at this time due to local supply."}

    response = client.post("/api/v1/recommendations/902/reject", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "REJECTED"

    # Verify inventory is completely UNTOUCHED
    inv_s = db_session.query(Inventory).filter(Inventory.id == 300).first()
    inv_d = db_session.query(Inventory).filter(Inventory.id == 400).first()
    assert inv_s.current_stock == 200
    assert inv_d.current_stock == 5

    # Verify ApprovalAction and AuditLog records
    action = db_session.query(ApprovalAction).filter(ApprovalAction.recommendation_id == 902).first()
    assert action is not None
    assert action.action == "REJECT"

    audit = db_session.query(AuditLog).filter(
        AuditLog.entity_type == "Recommendation",
        AuditLog.entity_id == 902,
        AuditLog.action == "RECOMMENDATION_REJECTED"
    ).first()
    assert audit is not None


def test_modify_recommendation(client, db_session, redistribution_test_data):
    """Test modifying recommendation parameters while retaining PENDING status."""
    rec = Recommendation(
        id=903,
        title="Proposed Transfer",
        action_type="REDISTRIBUTION",
        facility_id=400,
        source_facility_id=300,
        destination_facility_id=400,
        item_id=300,
        suggested_quantity=50,
        reasoning="Original reasoning",
        status=RecommendationStatusEnum.PENDING
    )
    db_session.add(rec)
    db_session.commit()

    headers = get_auth_header("admin_fac300@mediguard.gov", 301, UserRoleEnum.HOSPITAL_ADMIN)
    payload = {
        "suggested_quantity": 15,
        "reasoning": "Updated reasoning: limit batch transfer",
        "notes": "Quantity scaled down due to vehicle capacity"
    }

    response = client.post("/api/v1/recommendations/903/modify", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "PENDING"
    assert data["suggested_quantity"] == 15
    assert "scaled down" in data["reasoning"] or "limit batch" in data["reasoning"]

    # Verify ApprovalAction record
    action = db_session.query(ApprovalAction).filter(
        ApprovalAction.recommendation_id == 903,
        ApprovalAction.action == "MODIFY"
    ).first()
    assert action is not None


def test_cross_facility_authorization_and_unauthorized_access(client, db_session, redistribution_test_data):
    """Test RBAC cross-facility authorization and denial of access for unauthorized users."""
    rec = Recommendation(
        id=904,
        title="Unauthorized Test Recommendation",
        action_type="REDISTRIBUTION",
        facility_id=400,
        source_facility_id=300,
        destination_facility_id=400,
        item_id=300,
        suggested_quantity=10,
        reasoning="Authorization boundary test",
        status=RecommendationStatusEnum.PENDING
    )
    db_session.add(rec)
    db_session.commit()

    # 1. Unrelated admin (Facility 500) tries to approve
    unrelated_headers = get_auth_header("admin_fac500@mediguard.gov", 303, UserRoleEnum.HOSPITAL_ADMIN)
    res1 = client.post("/api/v1/recommendations/904/approve", headers=unrelated_headers)
    assert res1.status_code == 403

    # 2. Citizen tries to approve
    citizen_headers = get_auth_header("citizen_redist@mediguard.gov", 399, UserRoleEnum.CITIZEN)
    res2 = client.post("/api/v1/recommendations/904/approve", headers=citizen_headers)
    assert res2.status_code == 403

    # 3. Deficit Admin (Facility 400) CAN approve
    deficit_headers = get_auth_header("admin_fac400@mediguard.gov", 302, UserRoleEnum.HOSPITAL_ADMIN)
    res3 = client.post("/api/v1/recommendations/904/approve", headers=deficit_headers)
    assert res3.status_code == 200
    assert res3.json()["status"] == "APPROVED"


def test_inventory_consistency_and_rollback(client, db_session, redistribution_test_data):
    """Test stock failure handling and transaction rollback when source stock is insufficient."""
    # Set source inventory stock to low quantity (e.g., 5 units)
    inv_s = db_session.query(Inventory).filter(Inventory.id == 300).first()
    inv_s.current_stock = 5
    db_session.commit()

    rec = Recommendation(
        id=905,
        title="High Quantity Transfer",
        action_type="REDISTRIBUTION",
        facility_id=400,
        source_facility_id=300,
        destination_facility_id=400,
        item_id=300,
        suggested_quantity=50,  # 50 > 5
        reasoning="Will fail stock check",
        status=RecommendationStatusEnum.PENDING
    )
    db_session.add(rec)
    db_session.commit()

    headers = get_auth_header("admin_fac300@mediguard.gov", 301, UserRoleEnum.HOSPITAL_ADMIN)
    response = client.post("/api/v1/recommendations/905/approve", headers=headers)
    assert response.status_code == 400
    assert "Insufficient stock" in response.json()["detail"]

    # Verify database state rolled back completely
    db_session.refresh(rec)
    db_session.refresh(inv_s)
    inv_d = db_session.query(Inventory).filter(Inventory.id == 400).first()

    assert rec.status == RecommendationStatusEnum.PENDING
    assert inv_s.current_stock == 5
    assert inv_d.current_stock == 5

    # Verify no Transfer record was saved
    transfer = db_session.query(Transfer).filter(Transfer.quantity == 50).first()
    assert transfer is None
