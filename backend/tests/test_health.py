"""Tests for health endpoint and database connectivity."""

from fastapi import status
from unittest.mock import MagicMock
from app.db.session import get_db
from app.main import app


def test_health_endpoint_success(client):
    """Test GET /api/v1/health returns 200 OK and connected database status."""
    response = client.get("/api/v1/health")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "ok"
    assert "environment" in data
    assert data["version"] == "1.0.0"
    assert data["database"]["connected"] is True
    assert data["database"]["error"] is None


def test_health_endpoint_db_failure(client):
    """Test GET /api/v1/health returns degraded status when database query fails."""
    mock_db = MagicMock()
    mock_db.execute.side_effect = Exception("DB connection dropped")

    def override_broken_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_broken_db

    response = client.get("/api/v1/health")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "degraded"
    assert data["database"]["connected"] is False
    assert "DB connection dropped" in data["database"]["error"]

    app.dependency_overrides.clear()
