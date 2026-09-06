"""Tests for Phase 5 Facility Management Module."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import State, District, Facility, FacilityService, User, UserRoleEnum, FacilityTypeEnum
from app.utils import get_password_hash, create_access_token


def setup_facility_test_data(db: Session):
    """Seed comprehensive geographic and facility test hierarchy."""
    # Create States
    state_a = State(id=1, name="State Alpha", code="SA")
    state_b = State(id=2, name="State Beta", code="SB")
    db.add_all([state_a, state_b])
    db.commit()

    # Create Districts
    dist_a1 = District(id=1, state_id=1, name="District A1")
    dist_a2 = District(id=2, state_id=1, name="District A2")
    dist_b1 = District(id=3, state_id=2, name="District B1")
    db.add_all([dist_a1, dist_a2, dist_b1])
    db.commit()

    # Create Facilities
    fac_1 = Facility(
        id=1, district_id=1, name="District Hospital A1", location="City Center A1",
        type=FacilityTypeEnum.DISTRICT_HOSPITAL, contact_email="contact@hospitala1.gov",
        contact_phone="1234567890", is_active=True, latitude=12.9716, longitude=77.5946,
        operational_status="OPERATIONAL"
    )
    fac_2 = Facility(
        id=2, district_id=2, name="Primary Health Centre A2", location="Rural Area A2",
        type=FacilityTypeEnum.PHC, contact_email="contact@phca2.gov",
        contact_phone="0987654321", is_active=True, latitude=13.0827, longitude=80.2707,
        operational_status="OPERATIONAL"
    )
    fac_3 = Facility(
        id=3, district_id=3, name="Civil Hospital B1", location="Town Square B1",
        type=FacilityTypeEnum.CIVIL_HOSPITAL, contact_email="contact@civilb1.gov",
        contact_phone="1122334455", is_active=True, latitude=15.3647, longitude=75.1240,
        operational_status="MAINTENANCE"
    )
    fac_4 = Facility(
        id=4, district_id=1, name="Community Health Centre A1", location="East Suburb A1",
        type=FacilityTypeEnum.CHC, contact_email="contact@chca1.gov",
        contact_phone="5544332211", is_active=True, latitude=12.9800, longitude=77.5800,
        operational_status="OPERATIONAL"
    )
    db.add_all([fac_1, fac_2, fac_3, fac_4])
    db.commit()

    # Create Services for Facility 1
    srv_1 = FacilityService(id=1, facility_id=1, service_name="ICU", is_available=True)
    srv_2 = FacilityService(id=2, facility_id=1, service_name="Pediatrics", is_available=True)
    db.add_all([srv_1, srv_2])
    db.commit()

    # Create Users for all roles
    super_admin = User(
        id=1, email="super_fac@mediguard.gov", full_name="Super Admin Fac",
        password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.SUPER_ADMIN, is_active=True
    )
    state_admin_a = User(
        id=2, email="statea_fac@mediguard.gov", full_name="State Admin A Fac",
        password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.STATE_ADMIN,
        state_id=1, is_active=True
    )
    dist_admin_a1 = User(
        id=3, email="dista1_fac@mediguard.gov", full_name="District Admin A1 Fac",
        password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.DISTRICT_ADMIN,
        state_id=1, district_id=1, is_active=True
    )
    dist_admin_b1 = User(
        id=4, email="distb1_fac@mediguard.gov", full_name="District Admin B1 Fac",
        password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.DISTRICT_ADMIN,
        state_id=2, district_id=3, is_active=True
    )
    hosp_admin_1 = User(
        id=5, email="hosp1_fac@mediguard.gov", full_name="Hosp Admin 1 Fac",
        password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.HOSPITAL_ADMIN,
        state_id=1, district_id=1, facility_id=1, is_active=True
    )
    staff_1 = User(
        id=6, email="staff1_fac@mediguard.gov", full_name="Staff 1 Fac",
        password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.FACILITY_STAFF,
        state_id=1, district_id=1, facility_id=1, is_active=True
    )
    citizen = User(
        id=7, email="citizen_fac@mediguard.gov", full_name="Citizen Fac",
        password_hash=get_password_hash("Pass123!"), role=UserRoleEnum.CITIZEN, is_active=True
    )
    db.add_all([super_admin, state_admin_a, dist_admin_a1, dist_admin_b1, hosp_admin_1, staff_1, citizen])
    db.commit()

    return {
        "super_admin": super_admin,
        "state_admin_a": state_admin_a,
        "dist_admin_a1": dist_admin_a1,
        "dist_admin_b1": dist_admin_b1,
        "hosp_admin_1": hosp_admin_1,
        "staff_1": staff_1,
        "citizen": citizen,
    }


def auth_header(user: User):
    """Generate auth token header."""
    token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role.value})
    return {"Authorization": f"Bearer {token}"}


# -------------------------------------------------------------------
# 1. CREATE FACILITY & VALIDATION TESTS
# -------------------------------------------------------------------

def test_create_facility_success_and_validation(client: TestClient, db_session: Session):
    users = setup_facility_test_data(db_session)
    headers = auth_header(users["super_admin"])

    # Valid facility creation
    payload = {
        "name": "New PHC North",
        "location": "North Zone",
        "type": "PHC",
        "district_id": 1,
        "contact_email": "phcnorth@mediguard.gov",
        "contact_phone": "9876543210",
        "latitude": 13.5000,
        "longitude": 77.8000,
        "operational_status": "OPERATIONAL"
    }
    res = client.post("/api/v1/facilities", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "New PHC North"
    assert data["type"] == "PHC"
    assert data["latitude"] == 13.5000

    # Invalid Latitude (> 90)
    payload_bad_lat = {**payload, "latitude": 95.0}
    res_lat = client.post("/api/v1/facilities", json=payload_bad_lat, headers=headers)
    assert res_lat.status_code == 422

    # Invalid Longitude (< -180)
    payload_bad_lon = {**payload, "longitude": -190.0}
    res_lon = client.post("/api/v1/facilities", json=payload_bad_lon, headers=headers)
    assert res_lon.status_code == 422

    # Invalid Facility Type
    payload_bad_type = {**payload, "type": "INVALID_TYPE"}
    res_type = client.post("/api/v1/facilities", json=payload_bad_type, headers=headers)
    assert res_type.status_code == 422


# -------------------------------------------------------------------
# 2. GEOGRAPHIC ACCESS CONTROL & RBAC TESTS
# -------------------------------------------------------------------

def test_create_facility_geographic_rbac(client: TestClient, db_session: Session):
    users = setup_facility_test_data(db_session)
    headers_dist_a1 = auth_header(users["dist_admin_a1"])
    headers_state_a = auth_header(users["state_admin_a"])

    # District Admin A1 attempts to create facility in District B1 (district_id=3) -> 403
    payload_b1 = {
        "name": "Unauthorized PHC",
        "location": "Loc B1",
        "type": "PHC",
        "district_id": 3
    }
    res1 = client.post("/api/v1/facilities", json=payload_b1, headers=headers_dist_a1)
    assert res1.status_code == 403

    # State Admin A attempts to create facility in District B1 (District B1 belongs to State 2) -> 403
    res2 = client.post("/api/v1/facilities", json=payload_b1, headers=headers_state_a)
    assert res2.status_code == 403

    # District Admin A1 creates facility in District A1 -> 201
    payload_a1 = {
        "name": "Authorized Sub Centre",
        "location": "Loc A1",
        "type": "OTHER",
        "district_id": 1
    }
    res3 = client.post("/api/v1/facilities", json=payload_a1, headers=headers_dist_a1)
    assert res3.status_code == 201


# -------------------------------------------------------------------
# 3. CRUD & BOUNDARY TESTS
# -------------------------------------------------------------------

def test_read_and_update_facility_crud(client: TestClient, db_session: Session):
    users = setup_facility_test_data(db_session)
    headers_h1 = auth_header(users["hosp_admin_1"])
    headers_super = auth_header(users["super_admin"])

    # Hospital Admin 1 gets Facility 1 details
    res_get = client.get("/api/v1/facilities/1", headers=headers_h1)
    assert res_get.status_code == 200
    assert res_get.json()["name"] == "District Hospital A1"

    # Hospital Admin 1 updates Facility 1 status
    res_update = client.put(
        "/api/v1/facilities/1",
        json={"operational_status": "MAINTENANCE", "contact_phone": "9999999999"},
        headers=headers_h1
    )
    assert res_update.status_code == 200
    assert res_update.json()["operational_status"] == "MAINTENANCE"
    assert res_update.json()["contact_phone"] == "9999999999"

    # Super Admin deletes Facility 4
    res_del = client.delete("/api/v1/facilities/4", headers=headers_super)
    assert res_del.status_code == 204

    # Verify Facility 4 is deleted
    res_del_verify = client.get("/api/v1/facilities/4", headers=headers_super)
    assert res_del_verify.status_code == 404


# -------------------------------------------------------------------
# 4. FILTERING & SEARCH TESTS
# -------------------------------------------------------------------

def test_facilities_filtering_and_search(client: TestClient, db_session: Session):
    users = setup_facility_test_data(db_session)
    headers_super = auth_header(users["super_admin"])

    # Filter by state_id=1 (Districts 1 and 2)
    res_state = client.get("/api/v1/facilities?state_id=1", headers=headers_super)
    assert res_state.status_code == 200
    names_state = [f["name"] for f in res_state.json()]
    assert "District Hospital A1" in names_state
    assert "Primary Health Centre A2" in names_state
    assert "Civil Hospital B1" not in names_state

    # Filter by district_id=1
    res_dist = client.get("/api/v1/facilities?district_id=1", headers=headers_super)
    assert res_dist.status_code == 200
    assert len(res_dist.json()) == 2

    # Filter by type=PHC
    res_type = client.get("/api/v1/facilities?type=PHC", headers=headers_super)
    assert res_type.status_code == 200
    assert len(res_type.json()) == 1
    assert res_type.json()[0]["name"] == "Primary Health Centre A2"

    # Filter by operational_status=MAINTENANCE
    res_status = client.get("/api/v1/facilities?operational_status=MAINTENANCE", headers=headers_super)
    assert res_status.status_code == 200
    assert len(res_status.json()) == 1
    assert res_status.json()[0]["name"] == "Civil Hospital B1"

    # Search by name substring
    res_search = client.get("/api/v1/facilities?search=Civil", headers=headers_super)
    assert res_search.status_code == 200
    assert len(res_search.json()) == 1
    assert res_search.json()[0]["name"] == "Civil Hospital B1"


# -------------------------------------------------------------------
# 5. PAGINATION TESTS
# -------------------------------------------------------------------

def test_facilities_pagination(client: TestClient, db_session: Session):
    users = setup_facility_test_data(db_session)
    headers_super = auth_header(users["super_admin"])

    # Page 1 with limit 2
    res_page1 = client.get("/api/v1/facilities?skip=0&limit=2", headers=headers_super)
    assert res_page1.status_code == 200
    assert len(res_page1.json()) == 2

    # Page 2 with limit 2
    res_page2 = client.get("/api/v1/facilities?skip=2&limit=2", headers=headers_super)
    assert res_page2.status_code == 200
    assert len(res_page2.json()) == 2


# -------------------------------------------------------------------
# 6. CITIZEN PUBLIC SAFE RESPONSE TESTS
# -------------------------------------------------------------------

def test_citizen_public_safe_endpoints(client: TestClient, db_session: Session):
    users = setup_facility_test_data(db_session)
    headers_citizen = auth_header(users["citizen"])

    # Unauthenticated / Citizen access to public list
    res_public = client.get("/api/v1/facilities/public")
    assert res_public.status_code == 200
    data = res_public.json()
    assert len(data) >= 4
    # Ensure sensitive contact email & phone are NOT in public schema keys
    item = data[0]
    assert "id" in item
    assert "name" in item
    assert "location" in item
    assert "contact_email" not in item
    assert "contact_phone" not in item

    # Public get details
    res_pub_detail = client.get("/api/v1/facilities/public/1")
    assert res_pub_detail.status_code == 200
    detail = res_pub_detail.json()
    assert detail["name"] == "District Hospital A1"
    assert "contact_email" not in detail

    # Citizen attempting administrative endpoint -> 403 Forbidden
    res_admin = client.get("/api/v1/facilities", headers=headers_citizen)
    assert res_admin.status_code == 403


# -------------------------------------------------------------------
# 7. FACILITY SERVICES TESTS
# -------------------------------------------------------------------

def test_facility_services_endpoints(client: TestClient, db_session: Session):
    users = setup_facility_test_data(db_session)
    headers_h1 = auth_header(users["hosp_admin_1"])

    # List services for Facility 1
    res_list = client.get("/api/v1/facilities/1/services", headers=headers_h1)
    assert res_list.status_code == 200
    service_names = [s["service_name"] for s in res_list.json()]
    assert "ICU" in service_names
    assert "Pediatrics" in service_names

    # Add service "Trauma Care" to Facility 1
    res_add = client.post(
        "/api/v1/facilities/1/services",
        json={"service_name": "Trauma Care", "is_available": True},
        headers=headers_h1
    )
    assert res_add.status_code == 201
    assert res_add.json()["service_name"] == "Trauma Care"

    # Hospital Admin 1 attempting to add service to Facility 3 (District B1) -> 403 Forbidden
    res_unauth = client.post(
        "/api/v1/facilities/3/services",
        json={"service_name": "Surgery", "is_available": True},
        headers=headers_h1
    )
    assert res_unauth.status_code == 403

    # Delete service 1 ("ICU") from Facility 1
    res_del = client.delete("/api/v1/facilities/1/services/1", headers=headers_h1)
    assert res_del.status_code == 204
