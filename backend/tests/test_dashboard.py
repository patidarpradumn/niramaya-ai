"""Tests for Dashboard API."""

import pytest
from datetime import datetime, timedelta, timezone

from app.models import (
    UserRoleEnum, State, District, Facility, User,
    Inventory, Alert, ConsumptionRecord, Item
)
from app.schemas import AlertSeverity
from app.utils import create_access_token


def get_auth_header(email: str, user_id: int, role: UserRoleEnum) -> dict:
    token = create_access_token({"sub": str(user_id), "email": email, "role": role.value})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def dashboard_test_data(db_session):
    # Base geography
    state = State(id=800, name="Dashboard State", code="DS")
    db_session.add(state)
    db_session.commit()

    dist = District(id=800, name="Dashboard District", state_id=800)
    db_session.add(dist)
    db_session.commit()

    fac = Facility(id=800, name="Dashboard Hospital", location="Center", district_id=800, type="DISTRICT_HOSPITAL")
    db_session.add(fac)
    db_session.commit()
    
    item = Item(id=800, name="Dashboard Item", code="DASH-1", category="Consumable", unit="box")
    db_session.add(item)
    db_session.commit()

    admin = User(
        id=800, email="admin_dash@mediguard.gov", full_name="Admin Dash",
        password_hash="hash", role=UserRoleEnum.HOSPITAL_ADMIN, facility_id=800, is_active=True
    )
    citizen = User(
        id=899, email="citizen_dash@mediguard.gov", full_name="Citizen Dash",
        password_hash="hash", role=UserRoleEnum.CITIZEN, is_active=True
    )
    db_session.add_all([admin, citizen])
    db_session.commit()

    return {
        "fac": fac,
        "item": item,
        "admin": admin,
        "citizen": citizen
    }


def test_dashboard_overview_admin(client, dashboard_test_data):
    headers = get_auth_header(
        dashboard_test_data["admin"].email,
        dashboard_test_data["admin"].id,
        UserRoleEnum.HOSPITAL_ADMIN
    )
    response = client.get("/api/v1/dashboard/overview", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()
    assert "kpis" in data
    assert "recent_alerts" in data
    assert "stock_summary" in data
    
def test_dashboard_overview_citizen_forbidden(client, dashboard_test_data):
    headers = get_auth_header(
        dashboard_test_data["citizen"].email,
        dashboard_test_data["citizen"].id,
        UserRoleEnum.CITIZEN
    )
    response = client.get("/api/v1/dashboard/overview", headers=headers)
    assert response.status_code == 403

def test_dashboard_trends(client, dashboard_test_data, db_session):
    headers = get_auth_header(
        dashboard_test_data["admin"].email,
        dashboard_test_data["admin"].id,
        UserRoleEnum.HOSPITAL_ADMIN
    )
    fac = dashboard_test_data["fac"]
    item = dashboard_test_data["item"]
    
    # Create some test data for trends
    cons = ConsumptionRecord(
        facility_id=fac.id,
        item_id=item.id,
        quantity_consumed=10,
        record_date=datetime.now(timezone.utc) - timedelta(days=5)
    )
    db_session.add(cons)
    
    alert = Alert(
        facility_id=fac.id,
        severity=AlertSeverity.HIGH,
        title="Trend Alert",
        description="Mock alert description",
        created_at=datetime.now(timezone.utc) - timedelta(days=5)
    )
    db_session.add(alert)
    db_session.commit()
    
    response = client.get("/api/v1/dashboard/trends?days=7", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()
    assert "consumption_trend" in data
    assert "alert_trend" in data
    assert len(data["consumption_trend"]) > 0
    assert len(data["alert_trend"]) > 0

def test_dashboard_stock_risks(client, dashboard_test_data, db_session):
    headers = get_auth_header(
        dashboard_test_data["admin"].email,
        dashboard_test_data["admin"].id,
        UserRoleEnum.HOSPITAL_ADMIN
    )
    fac = dashboard_test_data["fac"]
    item = dashboard_test_data["item"]
    
    # Set stock risk
    inv = Inventory(
        facility_id=fac.id,
        item_id=item.id,
        current_stock=5,
        min_threshold=10,
        max_threshold=100
    )
    db_session.add(inv)
    db_session.commit()
    
    response = client.get("/api/v1/dashboard/stock-risks", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert data[0]["current_stock"] == 5
    assert data[0]["status"] == "critical"

def test_dashboard_expiry_risks(client, dashboard_test_data, db_session):
    headers = get_auth_header(
        dashboard_test_data["admin"].email,
        dashboard_test_data["admin"].id,
        UserRoleEnum.HOSPITAL_ADMIN
    )
    fac = dashboard_test_data["fac"]
    item = dashboard_test_data["item"]
    
    # Set expiry risk
    inv = Inventory(
        facility_id=fac.id,
        item_id=item.id,
        current_stock=50,
        min_threshold=10,
        max_threshold=100,
        expiry_date=datetime.now(timezone.utc) + timedelta(days=10)
    )
    db_session.add(inv)
    db_session.commit()
    
    response = client.get("/api/v1/dashboard/expiry-risks", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert data[0]["quantity"] == 50
    # Allow some variation in days due to exact time calculation differences
    assert 9 <= data[0]["days_to_expiry"] <= 10
