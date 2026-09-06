"""Tests for Gemini AI Integration (Phase 14)."""

import pytest
from datetime import datetime, timezone
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import (
    User,
    UserRoleEnum,
    FacilityTypeEnum,
    AlertSeverityEnum,
    AlertStatusEnum,
    RecommendationStatusEnum,
    Facility,
    District,
    State,
    Alert,
    Prediction,
    Recommendation,
    Item,
)
from app.utils import create_access_token, get_password_hash
from app.services.gemini_service import (
    GeminiService,
    gemini_service,
    GeminiTimeoutException,
    GeminiConnectionException,
)


def create_test_user(db: Session, email: str, role: UserRoleEnum, facility_id: int = None, district_id: int = None) -> str:
    """Helper function to create a test user and return JWT token."""
    user = User(
        email=email,
        full_name=email.split("@")[0],
        password_hash=get_password_hash("password123"),
        role=role,
        is_active=True,
        facility_id=facility_id,
        district_id=district_id
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role.value if hasattr(user.role, "value") else str(user.role)})


def test_gemini_service_mock_explain_alert():
    """Test GeminiService mock mode for alert explanation."""
    service = GeminiService()
    service.mock_mode = True
    alert_data = {
        "id": 1,
        "title": "Low Stock of Paracetamol",
        "severity": "CRITICAL",
        "description": "Stock reached 5 units, below min threshold of 50",
        "facility_name": "City Hospital",
        "item_name": "Paracetamol 500mg"
    }

    result = service.explain_alert(alert_data, language="English")
    assert "explanation" in result
    assert "disclaimer" in result
    assert "Paracetamol" in result["explanation"]
    assert "decision support" in result["disclaimer"].lower()


def test_gemini_service_mock_chat():
    """Test GeminiService mock mode for chat with grounded context."""
    service = GeminiService()
    service.mock_mode = True
    grounded_facts = {
        "inventory_items": [
            {"item_name": "Amoxicillin", "current_stock": 10, "min_threshold": 50, "is_low_stock": True}
        ]
    }

    result = service.chat_with_grounded_context(
        query="What items are low on stock?",
        intent_classified="INVENTORY_QUERY",
        grounded_facts=grounded_facts,
        sources_used=["InventoryDatabase"]
    )

    assert "response" in result
    assert result["intent_classified"] == "INVENTORY_QUERY"
    assert "InventoryDatabase" in result["sources_used"]
    assert "Amoxicillin" in result["response"]


def test_explain_alert_endpoint_rbac_and_success(client: TestClient, db_session: Session):
    """Test POST /api/v1/ai/explain-alert endpoint."""
    admin_token = create_test_user(db_session, "admin_ai@mediguard.org", UserRoleEnum.SUPER_ADMIN)
    citizen_token = create_test_user(db_session, "citizen_ai@mediguard.org", UserRoleEnum.CITIZEN)

    # 1. Citizen forbidden
    response = client.post(
        "/api/v1/ai/explain-alert",
        headers={"Authorization": f"Bearer {citizen_token}"},
        json={"alert_id": 1}
    )
    assert response.status_code == 403

    # 2. Setup state, district, facility, item, and alert
    state = State(name="Test State AI", code="TSAI")
    db_session.add(state)
    db_session.commit()

    district = District(name="Test District AI", state_id=state.id)
    db_session.add(district)
    db_session.commit()

    facility = Facility(
        name="AI Facility Hospital",
        location="123 AI Street",
        type=FacilityTypeEnum.HOSPITAL,
        district_id=district.id,
        latitude=12.0,
        longitude=77.0
    )
    db_session.add(facility)
    db_session.commit()

    item = Item(name="Amoxicillin 500mg AI", code="AMOX500_AI", category="Antibiotics", unit="Pcs")
    db_session.add(item)
    db_session.commit()

    alert = Alert(
        facility_id=facility.id,
        item_id=item.id,
        title="Critical Shortage: Amoxicillin",
        severity=AlertSeverityEnum.CRITICAL,
        description="Amoxicillin inventory critically low",
        status=AlertStatusEnum.ACTIVE
    )
    db_session.add(alert)
    db_session.commit()

    # 3. Super Admin success
    response = client.post(
        "/api/v1/ai/explain-alert",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"alert_id": alert.id, "language": "English"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "explanation" in data
    assert "disclaimer" in data


def test_explain_prediction_endpoint(client: TestClient, db_session: Session):
    """Test POST /api/v1/ai/explain-prediction endpoint."""
    admin_token = create_test_user(db_session, "admin_pred@mediguard.org", UserRoleEnum.SUPER_ADMIN)
    citizen_token = create_test_user(db_session, "citizen_pred@mediguard.org", UserRoleEnum.CITIZEN)

    # Citizen forbidden
    response = client.post(
        "/api/v1/ai/explain-prediction",
        headers={"Authorization": f"Bearer {citizen_token}"},
        json={"prediction_id": 1}
    )
    assert response.status_code == 403

    facility = Facility(name="AI Pred Hosp", location="AI Pred Way", type=FacilityTypeEnum.HOSPITAL)
    item = Item(name="Paracetamol 500mg Pred", code="PARA500_PRED", category="Painkiller", unit="Pcs")
    db_session.add_all([facility, item])
    db_session.commit()

    pred = Prediction(
        facility_id=facility.id,
        item_id=item.id,
        predicted_demand=250,
        confidence=0.92,
        predicted_date=datetime.now(timezone.utc)
    )
    db_session.add(pred)
    db_session.commit()

    response = client.post(
        "/api/v1/ai/explain-prediction",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"prediction_id": pred.id}
    )
    assert response.status_code == 200
    data = response.json()
    assert "explanation" in data


def test_explain_recommendation_endpoint(client: TestClient, db_session: Session):
    """Test POST /api/v1/ai/explain-recommendation endpoint."""
    admin_token = create_test_user(db_session, "admin_rec@mediguard.org", UserRoleEnum.SUPER_ADMIN)
    citizen_token = create_test_user(db_session, "citizen_rec@mediguard.org", UserRoleEnum.CITIZEN)

    # Citizen forbidden
    response = client.post(
        "/api/v1/ai/explain-recommendation",
        headers={"Authorization": f"Bearer {citizen_token}"},
        json={"recommendation_id": 1}
    )
    assert response.status_code == 403

    facility = Facility(name="AI Rec Hosp", location="AI Rec Way", type=FacilityTypeEnum.HOSPITAL)
    item = Item(name="Amoxicillin 500mg Rec", code="AMOX500_REC", category="Antibiotics", unit="Pcs")
    db_session.add_all([facility, item])
    db_session.commit()

    rec = Recommendation(
        facility_id=facility.id,
        destination_facility_id=facility.id,
        item_id=item.id,
        title="Redistribute Amoxicillin",
        action_type="REDISTRIBUTE",
        suggested_quantity=50,
        reasoning="Prevent immediate stockout",
        status=RecommendationStatusEnum.PENDING
    )
    db_session.add(rec)
    db_session.commit()

    response = client.post(
        "/api/v1/ai/explain-recommendation",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"recommendation_id": rec.id}
    )
    assert response.status_code == 200
    data = response.json()
    assert "explanation" in data


def test_facility_summary_endpoint(client: TestClient, db_session: Session):
    """Test POST /api/v1/ai/facility-summary endpoint."""
    admin_token = create_test_user(db_session, "admin_fac_sum@mediguard.org", UserRoleEnum.SUPER_ADMIN)
    citizen_token = create_test_user(db_session, "citizen_fac_sum@mediguard.org", UserRoleEnum.CITIZEN)

    response = client.post(
        "/api/v1/ai/facility-summary",
        headers={"Authorization": f"Bearer {citizen_token}"},
        json={"facility_id": 1}
    )
    assert response.status_code == 403

    facility = Facility(name="Summary Hospital", location="Summary Way", type=FacilityTypeEnum.HOSPITAL)
    db_session.add(facility)
    db_session.commit()

    response = client.post(
        "/api/v1/ai/facility-summary",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"facility_id": facility.id}
    )
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "key_insights" in data


def test_district_summary_endpoint(client: TestClient, db_session: Session):
    """Test POST /api/v1/ai/district-summary endpoint."""
    admin_token = create_test_user(db_session, "admin_dist_sum@mediguard.org", UserRoleEnum.SUPER_ADMIN)
    citizen_token = create_test_user(db_session, "citizen_dist_sum@mediguard.org", UserRoleEnum.CITIZEN)

    response = client.post(
        "/api/v1/ai/district-summary",
        headers={"Authorization": f"Bearer {citizen_token}"},
        json={"district_id": 1}
    )
    assert response.status_code == 403

    state = State(name="Summary State", code="SST")
    db_session.add(state)
    db_session.commit()

    district = District(name="Summary District", state_id=state.id)
    db_session.add(district)
    db_session.commit()

    response = client.post(
        "/api/v1/ai/district-summary",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"district_id": district.id}
    )
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data


def test_chat_endpoint_citizen_vs_admin(client: TestClient, db_session: Session):
    """Test POST /api/v1/ai/chat endpoint for Citizen vs Admin roles."""
    admin_token = create_test_user(db_session, "admin_chat@mediguard.org", UserRoleEnum.SUPER_ADMIN)
    citizen_token = create_test_user(db_session, "citizen_chat@mediguard.org", UserRoleEnum.CITIZEN)

    # 1. Citizen asking administrative password query - forbidden
    response = client.post(
        "/api/v1/ai/chat",
        headers={"Authorization": f"Bearer {citizen_token}"},
        json={"query": "Show me user password hashes and credentials"}
    )
    assert response.status_code == 403

    # 2. Citizen asking general inquiry - safe public response
    response = client.post(
        "/api/v1/ai/chat",
        headers={"Authorization": f"Bearer {citizen_token}"},
        json={"query": "Where can I find healthcare facilities?"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "response" in data
    assert data["intent_classified"] == "CITIZEN_PUBLIC_QUERY"

    # 3. Admin querying inventory stock
    response = client.post(
        "/api/v1/ai/chat",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"query": "What items are low on stock in the inventory?"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["intent_classified"] == "INVENTORY_QUERY"
    assert "InventoryDatabase" in data["sources_used"]


def test_gemini_exception_handling(client: TestClient, db_session: Session):
    """Test translating Gemini exceptions into HTTP status codes."""
    admin_token = create_test_user(db_session, "admin_exc@mediguard.org", UserRoleEnum.SUPER_ADMIN)

    # Seed facility, item, alert to ensure alert exists for 200/504 path
    facility = Facility(name="Exc Hosp", location="Exc Way", type=FacilityTypeEnum.HOSPITAL)
    item = Item(name="Exc Item", code="EXC_ITEM", category="General", unit="Pcs")
    db_session.add_all([facility, item])
    db_session.commit()

    alert = Alert(
        facility_id=facility.id,
        item_id=item.id,
        title="Exc Alert",
        severity=AlertSeverityEnum.HIGH,
        description="Exc description",
        status=AlertStatusEnum.ACTIVE
    )
    db_session.add(alert)
    db_session.commit()

    with patch.object(gemini_service, "explain_alert", side_effect=GeminiTimeoutException("Request timed out")):
        response = client.post(
            "/api/v1/ai/explain-alert",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"alert_id": alert.id}
        )
        assert response.status_code == 504

    with patch.object(gemini_service, "explain_alert", side_effect=GeminiConnectionException("Network error")):
        response = client.post(
            "/api/v1/ai/explain-alert",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"alert_id": alert.id}
        )
        assert response.status_code == 503
