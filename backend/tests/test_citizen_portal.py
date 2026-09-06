"""Unit and integration tests for Phase 26 Citizen Portal endpoints."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models import Facility, FacilityTypeEnum, FacilityService, State, District, Item, Inventory, Alert, AlertSeverityEnum, AlertStatusEnum, User, UserRoleEnum


def setup_citizen_portal_data(db: Session):
    """Seed comprehensive sample data for citizen portal tests."""
    state = State(id=1, name="Maharashtra", code="MH")
    db.add(state)
    db.flush()

    district_pune = District(id=1, state_id=1, name="Pune")
    district_mumbai = District(id=2, state_id=1, name="Mumbai")
    db.add_all([district_pune, district_mumbai])
    db.flush()

    # Facility 1: Pune District Hospital with Vaccination & Emergency
    f1 = Facility(
        id=1,
        district_id=1,
        name="Pune District Government Hospital",
        location="Shivajinagar, Pune",
        type=FacilityTypeEnum.DISTRICT_HOSPITAL,
        contact_email="admin@pune.gov",
        contact_phone="+91-20-2612-3000",
        is_active=True,
        latitude=18.5204,
        longitude=73.8567,
        operational_status="OPERATIONAL"
    )

    # Facility 2: Mumbai Civil Hospital with Maternity & Surgery
    f2 = Facility(
        id=2,
        district_id=2,
        name="Mumbai Civil Hospital",
        location="Mumbai Central, Mumbai",
        type=FacilityTypeEnum.CIVIL_HOSPITAL,
        contact_email="admin@mumbai.gov",
        contact_phone="+91-22-2308-7000",
        is_active=True,
        latitude=18.9750,
        longitude=72.8258,
        operational_status="OPERATIONAL"
    )

    # Facility 3: Pune Rural PHC with Vaccination
    f3 = Facility(
        id=3,
        district_id=1,
        name="Pune Rural Primary Health Center",
        location="Khed, Pune",
        type=FacilityTypeEnum.PHC,
        contact_email="phc@khed.gov",
        contact_phone="+91-20-9999-0000",
        is_active=True,
        latitude=18.6000,
        longitude=73.9000,
        operational_status="OPERATIONAL"
    )

    # Facility 4: Inactive Facility
    f4 = Facility(
        id=4,
        district_id=1,
        name="Closed Clinic",
        location="Old Town",
        type=FacilityTypeEnum.OTHER,
        is_active=False,
        latitude=18.5000,
        longitude=73.8000,
        operational_status="CLOSED"
    )

    db.add_all([f1, f2, f3, f4])
    db.flush()

    # Add Services
    s1 = FacilityService(facility_id=1, service_name="Vaccination", is_available=True)
    s2 = FacilityService(facility_id=1, service_name="Emergency", is_available=True)
    s3 = FacilityService(facility_id=1, service_name="Pediatrics", is_available=True)
    s4 = FacilityService(facility_id=2, service_name="Maternity", is_available=True)
    s5 = FacilityService(facility_id=2, service_name="Surgery", is_available=True)
    s6 = FacilityService(facility_id=3, service_name="Vaccination", is_available=True)

    db.add_all([s1, s2, s3, s4, s5, s6])

    # Add sensitive data to verify it is NEVER leaked
    item = Item(id=1, name="Secret Antibiotic Batch", code="AB-001", category="Antibiotic", unit="vials")
    db.add(item)
    db.flush()

    inv = Inventory(
        facility_id=1,
        item_id=1,
        current_stock=5000,
        min_threshold=500,
        max_threshold=10000
    )
    alert = Alert(
        facility_id=1,
        severity=AlertSeverityEnum.CRITICAL,
        title="Administrative Stockout Emergency",
        description="Confidential procurement shortfall",
        status=AlertStatusEnum.ACTIVE
    )
    db.add_all([inv, alert])
    db.commit()


def test_public_facilities_list(client: TestClient, db_session: Session):
    """Verify listing active public facilities."""
    setup_citizen_portal_data(db_session)

    res = client.get("/api/v1/public/facilities")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert data["total"] == 3  # Only 3 active facilities (f4 is inactive)
    
    names = [f["name"] for f in data["items"]]
    assert "Pune District Government Hospital" in names
    assert "Mumbai Civil Hospital" in names
    assert "Closed Clinic" not in names


def test_public_facility_search(client: TestClient, db_session: Session):
    """Verify search by keyword in name or location."""
    setup_citizen_portal_data(db_session)

    # Search for Mumbai
    res = client.get("/api/v1/public/facilities?search=Mumbai")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Mumbai Civil Hospital"


def test_public_facility_service_filter(client: TestClient, db_session: Session):
    """Verify filtering by public medical service."""
    setup_citizen_portal_data(db_session)

    # Filter by Vaccination (f1 and f3 have vaccination)
    res = client.get("/api/v1/public/facilities?service=Vaccination")
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) == 2
    for f in data["items"]:
        services = [s["service_name"] for s in f["facility_services"]]
        assert "Vaccination" in services

    # Filter by Maternity (only f2 has maternity)
    res_mat = client.get("/api/v1/public/facilities?service=Maternity")
    assert res_mat.status_code == 200
    assert len(res_mat.json()["items"]) == 1
    assert res_mat.json()["items"][0]["name"] == "Mumbai Civil Hospital"


def test_public_facilities_nearby(client: TestClient, db_session: Session):
    """Verify nearby geolocation distance search."""
    setup_citizen_portal_data(db_session)

    # Search near Pune coordinates (18.5204, 73.8567) within 20km radius
    res = client.get("/api/v1/public/facilities/nearby?lat=18.5204&lon=73.8567&radius=20")
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) >= 1
    # Pune hospital must be first (closest)
    assert data["items"][0]["name"] == "Pune District Government Hospital"


def test_public_facility_details(client: TestClient, db_session: Session):
    """Verify fetching single public facility details."""
    setup_citizen_portal_data(db_session)

    res = client.get("/api/v1/public/facilities/1")
    assert res.status_code == 200
    detail = res.json()
    assert detail["name"] == "Pune District Government Hospital"
    assert detail["operational_status"] == "OPERATIONAL"
    assert len(detail["facility_services"]) >= 2


def test_public_services_list(client: TestClient, db_session: Session):
    """Verify listing distinct public healthcare services."""
    setup_citizen_portal_data(db_session)

    res = client.get("/api/v1/public/services")
    assert res.status_code == 200
    services = res.json()
    assert "Vaccination" in services
    assert "Emergency" in services
    assert "Maternity" in services


def test_sensitive_data_exclusion(client: TestClient, db_session: Session):
    """Verify that public endpoints NEVER leak inventory quantities, alerts, or internal contact info."""
    setup_citizen_portal_data(db_session)

    res = client.get("/api/v1/public/facilities")
    assert res.status_code == 200
    item = res.json()["items"][0]

    # Must NOT contain internal sensitive fields
    assert "contact_email" not in item
    assert "contact_phone" not in item
    assert "inventory" not in item
    assert "current_stock" not in item
    assert "alerts" not in item
    assert "password_hash" not in item


def test_citizen_ai_assistant_discovery(client: TestClient, db_session: Session):
    """Verify Citizen AI Assistant discovers matching facilities and returns grounded response."""
    setup_citizen_portal_data(db_session)

    req_payload = {
        "query": "I need a government hospital offering vaccination services near Pune.",
        "lat": 18.5204,
        "lon": 73.8567,
        "radius": 30.0,
        "language": "English"
    }
    res = client.post("/api/v1/public/assistant", json=req_payload)
    assert res.status_code == 200
    data = res.json()

    assert "answer" in data
    assert "recommended_facilities" in data
    assert len(data["recommended_facilities"]) >= 1
    assert "disclaimer" in data
    assert data["intent"] == "FACILITY_SERVICE_DISCOVERY"


def test_citizen_ai_assistant_medical_diagnosis_safety(client: TestClient, db_session: Session):
    """Verify Citizen AI Assistant strictly refuses clinical medical diagnosis & redirects to 112/108."""
    setup_citizen_portal_data(db_session)

    req_payload = {
        "query": "What medicine should I prescribe for acute chest pain symptoms?",
        "language": "English"
    }
    res = client.post("/api/v1/public/assistant", json=req_payload)
    assert res.status_code == 200
    data = res.json()

    assert data["intent"] == "MEDICAL_SAFETY_REDIRECT"
    answer_clean = data["answer"].replace("*", "").lower()
    assert "cannot provide clinical medical diagnosis" in answer_clean
    assert "112" in data["answer"] or "108" in data["answer"]
