import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models import Facility, FacilityTypeEnum, FacilityService

def setup_public_test_data(db_session):
    # Clear facilities
    db_session.query(FacilityService).delete()
    db_session.query(Facility).delete()
    db_session.commit()

    f1 = Facility(
        name="Public Clinic A",
        location="Downtown",
        type=FacilityTypeEnum.CLINIC,
        contact_email="clinica@example.com",
        contact_phone="1234567890",
        latitude=40.7128,
        longitude=-74.0060,
        operational_status="OPERATIONAL",
        is_active=True
    )
    f2 = Facility(
        name="Hospital B",
        location="Uptown",
        type=FacilityTypeEnum.DISTRICT_HOSPITAL,
        contact_email="hospitalb@example.com",
        contact_phone="0987654321",
        latitude=40.7306,
        longitude=-73.9352,
        operational_status="OPERATIONAL",
        is_active=True
    )
    f3 = Facility(
        name="Inactive Clinic",
        location="Midtown",
        type=FacilityTypeEnum.CLINIC,
        is_active=False
    )
    db_session.add_all([f1, f2, f3])
    db_session.commit()

    s1 = FacilityService(facility_id=f1.id, service_name="Vaccination", is_available=True)
    s2 = FacilityService(facility_id=f2.id, service_name="Emergency", is_available=True)
    s3 = FacilityService(facility_id=f2.id, service_name="Vaccination", is_available=True)
    db_session.add_all([s1, s2, s3])
    db_session.commit()
    
    return f1, f2, f3

def test_public_access_facilities(client: TestClient, db_session):
    f1, f2, f3 = setup_public_test_data(db_session)

    response = client.get("/api/v1/public/facilities")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert data["total"] == 2 # Excludes inactive
    
    names = [f["name"] for f in data["items"]]
    assert "Public Clinic A" in names
    assert "Hospital B" in names
    assert "Inactive Clinic" not in names

def test_sensitive_field_exclusion(client: TestClient, db_session):
    f1, f2, f3 = setup_public_test_data(db_session)
    
    response = client.get(f"/api/v1/public/facilities/{f1.id}")
    assert response.status_code == 200
    data = response.json()
    
    assert data["name"] == "Public Clinic A"
    assert "contact_email" not in data
    assert "contact_phone" not in data
    assert "inventory" not in data
    assert "stock_movements" not in data
    assert "users" not in data

def test_nearby_search(client: TestClient, db_session):
    f1, f2, f3 = setup_public_test_data(db_session)
    
    # f1 is at 40.7128, -74.0060 (NYC)
    # f2 is at 40.7306, -73.9352 (NYC)
    # distance is roughly 6 km
    
    # Query very close to f1 with small radius
    response = client.get("/api/v1/public/facilities/nearby?lat=40.7128&lon=-74.0060&radius=2.0")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Public Clinic A"

    # Query with larger radius
    response = client.get("/api/v1/public/facilities/nearby?lat=40.7128&lon=-74.0060&radius=10.0")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2

def test_service_filtering(client: TestClient, db_session):
    f1, f2, f3 = setup_public_test_data(db_session)

    response = client.get("/api/v1/public/facilities?service=Vaccination")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    
    response = client.get("/api/v1/public/facilities?service=Emergency")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Hospital B"

def test_pagination(client: TestClient, db_session):
    setup_public_test_data(db_session)
    
    response = client.get("/api/v1/public/facilities?page=1&size=1")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 1
    assert data["pages"] == 2
    assert data["total"] == 2
    
def test_public_services_list(client: TestClient, db_session):
    setup_public_test_data(db_session)
    
    response = client.get("/api/v1/public/services")
    assert response.status_code == 200
    data = response.json()
    assert "Vaccination" in data
    assert "Emergency" in data
    assert len(data) == 2
