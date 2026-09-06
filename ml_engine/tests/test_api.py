"""
Test suite for FastAPI Endpoints (TestClient)
"""

import pytest
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "model_status" in data
    assert data["model_status"]["candidate_available"] is True


def test_models_metadata_endpoint():
    response = client.get("/v1/models")
    assert response.status_code == 200
    data = response.json()
    assert "metadata" in data
    assert data["active_model"] == "demand_model_v1"
    assert "metrics" in data["metadata"]


def test_forecast_endpoint_valid_series():
    payload = {
        "facility_id": "FAC001",
        "resource_id": "RES001",
        "horizon_days": 7,
        "current_stock": 1500.0,
        "lead_time_days": 7
    }
    response = client.post("/v1/forecast", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["facility_id"] == "FAC001"
    assert data["resource_id"] == "RES001"
    assert data["horizon_days"] == 7
    assert len(data["predictions"]) == 7
    assert data["total_predicted_demand"] > 0
    assert data["stock_out_risk"] is not None
    assert "risk_level" in data["stock_out_risk"]


def test_forecast_endpoint_14_and_30_days():
    for h in [14, 30]:
        payload = {
            "facility_id": "FAC002",
            "resource_id": "RES004",
            "horizon_days": h
        }
        response = client.post("/v1/forecast", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert len(data["predictions"]) == h


def test_forecast_custom_history_and_batches():
    payload = {
        "facility_id": "FAC999",
        "resource_id": "RES999",
        "horizon_days": 7,
        "current_stock": 250.0,
        "history": [
            {"date": f"2025-01-{i:02d}", "quantity_consumed": 20.0 + (i % 5)}
            for i in range(1, 31)
        ],
        "batches": [
            {"batch_id": "BAT-CUSTOM-1", "quantity": 150.0, "expiry_date": "2025-02-15"},
            {"batch_id": "BAT-CUSTOM-2", "quantity": 100.0, "expiry_date": "2025-10-30"}
        ]
    }
    response = client.post("/v1/forecast", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total_predicted_demand"] > 0
    assert data["expiry_risk"] is not None
    assert len(data["expiry_risk"]["batches"]) == 2


def test_forecast_invalid_horizon():
    payload = {
        "facility_id": "FAC001",
        "resource_id": "RES001",
        "horizon_days": 150 # Exceeds limit
    }
    response = client.post("/v1/forecast", json=payload)
    assert response.status_code == 422 # Validation error


def test_forecast_batch_endpoint():
    payload = {
        "requests": [
            {"facility_id": "FAC001", "resource_id": "RES001", "horizon_days": 7},
            {"facility_id": "FAC002", "resource_id": "RES002", "horizon_days": 14}
        ]
    }
    response = client.post("/v1/forecast/batch", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total_requests"] == 2
    assert data["successful_count"] == 2
    assert len(data["results"]) == 2


def test_scenario_simulation_endpoint():
    payload = {
        "facility_id": "FAC001",
        "resource_id": "RES001",
        "normal_forecast_demand": 600.0,
        "current_stock": 800.0,
        "multiplier": 1.40,
        "scenario_name": "Dengue Surge (+40%)"
    }
    response = client.post("/v1/scenario", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_simulation"] is True
    assert data["simulated_forecast_demand"] == 840.0
    assert data["stock_cover_reduction_days"] > 0


def test_redistribution_endpoint():
    payload = {
        "resource_id": "RES001",
        "resource_name": "Paracetamol 500mg"
    }
    response = client.post("/v1/redistribution", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "recommendations" in data
    assert data["total_recommendations"] >= 0
