import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.models import Facility, User, UserRoleEnum, Item, Inventory, AlertSeverityEnum, RiskCategoryEnum
from unittest.mock import patch, MagicMock
from app.services.gemini_service import gemini_service, GeminiService


def test_full_integration_workflow(client: TestClient, db_session: Session):
    from app.utils import get_password_hash
    from app.models import Role
    
    # Setup Roles and Users manually since db_session wipes the DB
    super_admin_role = Role(name="super_admin")
    citizen_role = Role(name="citizen")
    db_session.add_all([super_admin_role, citizen_role])
    db_session.commit()
    
    admin_user = User(
        email="superadmin@example.com",
        full_name="Super Admin",
        password_hash=get_password_hash("securepassword123"),
        role_id=super_admin_role.id,
        role=UserRoleEnum.SUPER_ADMIN,
        is_active=True
    )
    citizen_user = User(
        email="citizen@example.com",
        full_name="Citizen",
        password_hash=get_password_hash("securepassword123"),
        role_id=citizen_role.id,
        role=UserRoleEnum.CITIZEN,
        is_active=True
    )
    db_session.add_all([admin_user, citizen_user])
    db_session.commit()

    # 1. Admin login
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "superadmin@example.com", "password": "securepassword123"}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    admin_token = response.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Facility creation (Source and Dest)
    src_payload = {
        "name": "Integration Source Hospital",
        "location": "Source City",
        "type": "DISTRICT_HOSPITAL",
        "contact_email": "src@example.com",
        "latitude": 10.0,
        "longitude": 10.0,
        "is_active": True
    }
    response = client.post("/api/v1/facilities/", json=src_payload, headers=admin_headers)
    assert response.status_code == 201
    src_facility_id = response.json()["id"]

    dest_payload = {
        "name": "Integration Dest Clinic",
        "location": "Dest City",
        "type": "PHC",
        "contact_email": "dest@example.com",
        "latitude": 10.1,
        "longitude": 10.1,
        "is_active": True
    }
    response = client.post("/api/v1/facilities/", json=dest_payload, headers=admin_headers)
    assert response.status_code == 201
    dest_facility_id = response.json()["id"]

    # 3. Item creation
    item_payload = {
        "name": "Integration Paracetamol",
        "code": "IP-1234",
        "category": "MEDICINE",
        "unit": "BOX"
    }
    response = client.post("/api/v1/items/", json=item_payload, headers=admin_headers)
    assert response.status_code == 201
    item_id = response.json()["id"]

    # 4. Inventory creation
    inv_src_payload = {
        "facility_id": src_facility_id,
        "item_id": item_id,
        "current_stock": 0,
        "min_threshold": 10,
        "max_threshold": 100
    }
    response = client.post("/api/v1/inventory/", json=inv_src_payload, headers=admin_headers)
    assert response.status_code == 201

    inv_dest_payload = {
        "facility_id": dest_facility_id,
        "item_id": item_id,
        "current_stock": 0,
        "min_threshold": 20,
        "max_threshold": 100
    }
    response = client.post("/api/v1/inventory/", json=inv_dest_payload, headers=admin_headers)
    assert response.status_code == 201

    # 5. Stock receipt (Add stock to Source)
    receipt_payload = {
        "facility_id": src_facility_id,
        "item_id": item_id,
        "movement_type": "RECEIVED",
        "quantity": 500,
        "reference": "INIT-001"
    }
    response = client.post("/api/v1/stock-movements/", json=receipt_payload, headers=admin_headers)
    assert response.status_code == 201
    
    # 6. Consumption records (Dest consumes a lot, causing low stock)
    # Give dest a bit of stock first
    client.post("/api/v1/stock-movements/", json={
        "facility_id": dest_facility_id,
        "item_id": item_id,
        "movement_type": "RECEIVED",
        "quantity": 30,
        "reference": "INIT-002"
    }, headers=admin_headers)
    
    client.post("/api/v1/stock-movements/", json={
        "facility_id": dest_facility_id,
        "item_id": item_id,
        "movement_type": "ISSUED",
        "quantity": 25,
        "reference": "DISP-001"
    }, headers=admin_headers)

    # Check Dest stock is now 5
    inv_dest_resp = client.get(f"/api/v1/inventory/?facility_id={dest_facility_id}&item_id={item_id}", headers=admin_headers)
    assert inv_dest_resp.status_code == 200
    assert inv_dest_resp.json()[0]["current_stock"] == 5

    # 7. ML prediction & 8. Prediction persistence
    # Trigger prediction pipeline for dest_facility inventory item
    inv_dest = inv_dest_resp.json()[0]
    inv_dest_id = inv_dest["id"]
    
    response = client.post("/api/v1/predictions/forecast", json={
        "facility_id": dest_facility_id, 
        "item_id": item_id,
        "historical_days": 30
    }, headers=admin_headers)
    assert response.status_code == 200
    pred_data = response.json()
    assert "predicted_demand" in pred_data

    # Trigger stockout risk explicitly
    response = client.post("/api/v1/predictions/stockout-risk", json={
        "facility_id": dest_facility_id, 
        "item_id": item_id,
        "current_stock": inv_dest["current_stock"],
        "min_stock": inv_dest["min_stock_level"],
        "lead_time_days": 7
    }, headers=admin_headers)
    assert response.status_code == 200

    # 10. Alert creation (Should exist a low stock alert for Dest because stock is 5, min is 20)
    alerts_resp = client.get(f"/api/v1/alerts/?facility_id={dest_facility_id}", headers=admin_headers)
    assert alerts_resp.status_code == 200
    alerts = alerts_resp.json()

    # Trigger recommendation generation manually if auto-generation isn't present
    response = client.post(f"/api/v1/recommendations/generate?facility_id={dest_facility_id}", headers=admin_headers)
    assert response.status_code == 200
    recs = response.json()
    assert len(recs) > 0
    rec_id = recs[0]["id"]

    # 12. Recommendation approval
    approve_payload = {
        "action": "APPROVED",
        "notes": "Looks good."
    }
    response = client.post(f"/api/v1/recommendations/{rec_id}/approve", json=approve_payload, headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "APPROVED"

    # Verify inventory changes after approval
    inv_dest_resp = client.get(f"/api/v1/inventory/?facility_id={dest_facility_id}&item_id={item_id}", headers=admin_headers)
    assert inv_dest_resp.json()[0]["current_stock"] > 5

    inv_src_resp = client.get(f"/api/v1/inventory/?facility_id={src_facility_id}&item_id={item_id}", headers=admin_headers)
    assert inv_src_resp.json()[0]["current_stock"] < 500

    # 14. Audit log
    audit_resp = client.get("/api/v1/audit-logs/", headers=admin_headers)
    assert audit_resp.status_code == 200
    logs = audit_resp.json()["items"]
    assert len(logs) > 0

    # 15. Gemini explanation using mocked Gemini
    with patch("app.routers.ai.gemini_service.explain_recommendation", return_value={"explanation": "Mocked explanation for recommendation", "disclaimer": "Test"}):
        gemini_resp = client.post(f"/api/v1/ai/explain-recommendation", json={"recommendation_id": rec_id}, headers=admin_headers)
        assert gemini_resp.status_code == 200
        assert "Mocked explanation" in gemini_resp.json()["explanation"]

    # 16. Citizen facility search
    # Login as citizen
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "citizen@example.com", "password": "securepassword123"}
    )
    assert response.status_code == 200
    citizen_token = response.json()["access_token"]
    citizen_headers = {"Authorization": f"Bearer {citizen_token}"}

    search_resp = client.get("/api/v1/public/facilities?search=Integration", headers=citizen_headers)
    assert search_resp.status_code == 200
    assert search_resp.json()["total"] >= 2

    # 17. Verify citizen cannot access sensitive admin data
    # Citizen trying to get audit logs
    audit_fail_resp = client.get("/api/v1/audit-logs/", headers=citizen_headers)
    assert audit_fail_resp.status_code == 403

    # Citizen trying to access inventory
    inv_fail_resp = client.get("/api/v1/inventory/", headers=citizen_headers)
    assert inv_fail_resp.status_code == 403
    
    # Citizen trying to get recommendation
    rec_fail_resp = client.get(f"/api/v1/recommendations/{rec_id}", headers=citizen_headers)
    assert rec_fail_resp.status_code == 403
