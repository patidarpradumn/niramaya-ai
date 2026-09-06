"""Comprehensive tests for ML Engine Adapter, Providers, Factory, Service, and API Endpoints."""

# pyrefly: ignore [missing-import]
import pytest
from unittest.mock import patch, MagicMock
# pyrefly: ignore [missing-import]
import httpx

from app.models import UserRoleEnum, Prediction, Risk, State, District, Facility, Item, User
from app.config import settings
from app.utils import create_access_token
from app.integrations.ml import (
    MockMLProvider,
    RealMLProvider,
    get_ml_provider,
    MLException,
    MLTimeoutException,
    MLConnectionException,
    MLResponseException,
    MLValidationError,
)
from app.schemas import (
    DemandForecastRequest,
    StockoutRiskRequest,
    ExpiryRiskRequest,
    BatchExpiryInfo,
    RedistributionScoreRequest,
)
from app.services.ml_adapter_service import MLAdapterService


def get_auth_header(email: str, user_id: int, role: UserRoleEnum) -> dict:
    token = create_access_token({"sub": str(user_id), "email": email, "role": role.value})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def test_data(db_session):
    state = State(id=10, name="State Alpha", code="SA")
    db_session.add(state)
    db_session.commit()

    dist1 = District(id=10, name="District 1", state_id=10)
    dist2 = District(id=20, name="District 2", state_id=10)
    db_session.add_all([dist1, dist2])
    db_session.commit()

    fac1 = Facility(id=10, name="Facility One", location="Loc 1", district_id=10, type="hospital")
    fac2 = Facility(id=20, name="Facility Two", location="Loc 2", district_id=20, type="clinic")
    db_session.add_all([fac1, fac2])
    db_session.commit()

    item = Item(id=10, name="Amoxicillin 500mg", category="Medication", unit="Capsules", code="MED-AMX-500")
    db_session.add(item)
    db_session.commit()

    user = User(
        id=1, email="super@mediguard.gov", full_name="Super Admin",
        password_hash="hash", role=UserRoleEnum.SUPER_ADMIN, is_active=True
    )
    citizen = User(
        id=99, email="citizen@mediguard.gov", full_name="Citizen",
        password_hash="hash", role=UserRoleEnum.CITIZEN, is_active=True
    )
    db_session.add_all([user, citizen])
    db_session.commit()

    return {"fac1": fac1, "fac2": fac2, "item": item}


@pytest.fixture
def test_facility(test_data):
    return test_data["fac1"]


@pytest.fixture
def test_facility_district2(test_data):
    return test_data["fac2"]


@pytest.fixture
def test_item(test_data):
    return test_data["item"]


# --- Provider Unit Tests ---

def test_mock_provider_demand_forecast():
    provider = MockMLProvider()
    req = DemandForecastRequest(facility_id=1, item_id=2, historical_days=30)
    res = provider.predict_demand(req)

    assert res.facility_id == 1
    assert res.item_id == 2
    assert res.predicted_demand > 0
    assert 0.0 <= res.confidence <= 1.0
    assert res.provider == "mock"
    assert res.is_mock is True


def test_mock_provider_stockout_risk():
    provider = MockMLProvider()
    req = StockoutRiskRequest(facility_id=1, item_id=2, current_stock=10, min_stock=100)
    res = provider.predict_stockout_risk(req)

    assert res.facility_id == 1
    assert res.item_id == 2
    assert res.risk_level == "CRITICAL"
    assert res.stockout_risk_score >= 0.9
    assert res.is_mock is True


def test_mock_provider_expiry_risk():
    provider = MockMLProvider()
    req = ExpiryRiskRequest(
        facility_id=1,
        item_id=2,
        batches=[
            BatchExpiryInfo(batch_number="B1", quantity=50, expiry_date="2026-09-10"),  # Near
            BatchExpiryInfo(batch_number="B2", quantity=50, expiry_date="2027-12-31"),  # Far
        ]
    )
    res = provider.predict_expiry_risk(req)

    assert res.facility_id == 1
    assert res.item_id == 2
    assert res.at_risk_quantity == 50
    assert res.expiry_risk_score == 0.5
    assert res.is_mock is True


def test_mock_provider_redistribution_score():
    provider = MockMLProvider()
    req = RedistributionScoreRequest(source_facility_id=1, target_facility_id=2, item_id=5, quantity=100)
    res = provider.predict_redistribution_score(req)

    assert res.source_facility_id == 1
    assert res.target_facility_id == 2
    assert res.redistribution_score > 0.0
    assert res.feasibility_rating in ("HIGH", "MEDIUM")
    assert res.is_mock is True


def test_real_provider_success():
    provider = RealMLProvider(base_url="http://test-ml:8000", api_key="secret-key-123", timeout=2.0)
    req = DemandForecastRequest(facility_id=10, item_id=20)

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "facility_id": 10,
        "item_id": 20,
        "total_predicted_demand": 120,
        "confidence": 0.88,
        "timestamp": "2026-09-20",
    }

    with patch("httpx.Client.post", return_value=mock_response) as mock_post:
        res = provider.predict_demand(req)
        assert res.predicted_demand == 120
        assert res.confidence == 0.85
        assert res.provider == "real"
        assert res.is_mock is False

        args, kwargs = mock_post.call_args
        assert "Authorization" in kwargs["headers"]
        assert kwargs["headers"]["Authorization"] == "Bearer secret-key-123"


def test_real_provider_timeout():
    provider = RealMLProvider(base_url="http://test-ml:8000", timeout=1.0, max_retries=0)
    req = DemandForecastRequest(facility_id=10, item_id=20)

    with patch("httpx.Client.post", side_effect=httpx.TimeoutException("Timeout occurred")):
        with pytest.raises(MLTimeoutException) as exc_info:
            provider.predict_demand(req)
        assert "timed out" in str(exc_info.value)


def test_real_provider_connection_failure():
    provider = RealMLProvider(base_url="http://test-ml:8000", max_retries=0)
    req = DemandForecastRequest(facility_id=10, item_id=20)

    with patch("httpx.Client.post", side_effect=httpx.RequestError("Connection refused")):
        with pytest.raises(MLConnectionException) as exc_info:
            provider.predict_demand(req)
        assert "Failed to connect" in str(exc_info.value)


def test_real_provider_server_error():
    provider = RealMLProvider(base_url="http://test-ml:8000", max_retries=0)
    req = DemandForecastRequest(facility_id=10, item_id=20)

    mock_resp = MagicMock()
    mock_resp.status_code = 500
    mock_resp.text = "Internal Server Error"

    with patch("httpx.Client.post", return_value=mock_resp):
        with pytest.raises(MLResponseException) as exc_info:
            provider.predict_demand(req)
        assert "500" in str(exc_info.value)


def test_real_provider_schema_validation_error():
    provider = RealMLProvider(base_url="http://test-ml:8000", max_retries=0)
    req = DemandForecastRequest(facility_id=10, item_id=20)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"facility_id": 10, "item_id": 20}

    with patch("httpx.Client.post", return_value=mock_resp):
        with pytest.raises(MLValidationError) as exc_info:
            provider.predict_demand(req)
        assert "Invalid schema" in str(exc_info.value)


def test_factory_provider_selection():
    mock_p = get_ml_provider(provider_type="mock")
    assert isinstance(mock_p, MockMLProvider)

    real_p = get_ml_provider(provider_type="real")
    assert isinstance(real_p, RealMLProvider)


# --- Service and DB Persistence Tests ---

def test_service_predict_and_store_demand(db_session, test_facility, test_item):
    service = MLAdapterService(provider=MockMLProvider())
    req = DemandForecastRequest(facility_id=test_facility.id, item_id=test_item.id)

    response = service.predict_and_store_demand(db_session, req)
    assert response.facility_id == test_facility.id
    assert response.item_id == test_item.id

    db_pred = db_session.query(Prediction).filter(
        Prediction.facility_id == test_facility.id,
        Prediction.item_id == test_item.id
    ).first()

    assert db_pred is not None
    assert db_pred.predicted_demand == response.predicted_demand
    assert db_pred.confidence == response.confidence


def test_service_assess_and_store_stockout_risk(db_session, test_facility, test_item):
    service = MLAdapterService(provider=MockMLProvider())
    req = StockoutRiskRequest(
        facility_id=test_facility.id,
        item_id=test_item.id,
        current_stock=5,
        min_stock=100
    )

    response = service.assess_and_store_stockout_risk(db_session, req)
    assert response.risk_level == "CRITICAL"

    db_risk = db_session.query(Risk).filter(
        Risk.facility_id == test_facility.id,
        Risk.item_id == test_item.id,
        Risk.risk_type == "STOCKOUT_RISK"
    ).first()

    assert db_risk is not None
    assert "CRITICAL" in db_risk.description


# --- Router Endpoint Integration Tests ---

def test_forecast_endpoint(client, test_facility, test_item):
    headers = get_auth_header("super@mediguard.gov", 1, UserRoleEnum.SUPER_ADMIN)
    payload = {
        "facility_id": test_facility.id,
        "item_id": test_item.id,
        "historical_days": 30
    }

    response = client.post("/api/v1/predictions/forecast", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["facility_id"] == test_facility.id
    assert data["item_id"] == test_item.id
    assert "predicted_demand" in data
    assert data["provider"] == "mock"


def test_stockout_risk_endpoint(client, test_facility, test_item):
    headers = get_auth_header("super@mediguard.gov", 1, UserRoleEnum.SUPER_ADMIN)
    payload = {
        "facility_id": test_facility.id,
        "item_id": test_item.id,
        "current_stock": 20,
        "min_stock": 100
    }

    response = client.post("/api/v1/predictions/stockout-risk", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["risk_level"] in ("HIGH", "CRITICAL")
    assert "stockout_risk_score" in data


def test_expiry_risk_endpoint(client, test_facility, test_item):
    headers = get_auth_header("super@mediguard.gov", 1, UserRoleEnum.SUPER_ADMIN)
    payload = {
        "facility_id": test_facility.id,
        "item_id": test_item.id,
        "batches": [
            {"batch_number": "BAT-101", "quantity": 100, "expiry_date": "2026-09-15"}
        ]
    }

    response = client.post("/api/v1/predictions/expiry-risk", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "expiry_risk_score" in data
    assert data["at_risk_quantity"] == 100


def test_redistribution_score_endpoint(client, test_facility, test_facility_district2, test_item):
    headers = get_auth_header("super@mediguard.gov", 1, UserRoleEnum.SUPER_ADMIN)
    payload = {
        "source_facility_id": test_facility.id,
        "target_facility_id": test_facility_district2.id,
        "item_id": test_item.id,
        "quantity": 50
    }

    response = client.post("/api/v1/predictions/redistribution-score", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["source_facility_id"] == test_facility.id
    assert data["target_facility_id"] == test_facility_district2.id
    assert "redistribution_score" in data


def test_predictions_citizen_access_denied(client, test_facility, test_item):
    headers = get_auth_header("citizen@mediguard.gov", 99, UserRoleEnum.CITIZEN)
    payload = {"facility_id": test_facility.id, "item_id": test_item.id}

    response = client.post("/api/v1/predictions/forecast", json=payload, headers=headers)
    assert response.status_code == 403


def test_endpoint_ml_error_resilience(client, test_facility, test_item):
    headers = get_auth_header("super@mediguard.gov", 1, UserRoleEnum.SUPER_ADMIN)
    payload = {"facility_id": test_facility.id, "item_id": test_item.id}

    with patch("app.services.ml_adapter_service.MLAdapterService.predict_and_store_demand", side_effect=MLTimeoutException("Service timeout")):
        response = client.post("/api/v1/predictions/forecast", json=payload, headers=headers)
        assert response.status_code == 504
        assert "ML Engine timeout" in response.json()["detail"]
