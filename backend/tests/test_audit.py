"""Comprehensive unit and integration tests for MediGuard Audit Logging."""

import pytest
import json
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import User, UserRoleEnum, AuditLog
from app.services.audit_service import audit_service, sanitize_metadata
from app.utils import get_password_hash, create_access_token


def setup_audit_test_data(db: Session):
    """Setup users for audit testing."""
    db.query(AuditLog).delete()
    db.query(User).delete()
    db.commit()

    super_admin = User(
        id=1001,
        email="admin_audit@mediguard.gov",
        full_name="Super Admin Audit",
        role=UserRoleEnum.SUPER_ADMIN,
        is_active=True,
        password_hash=get_password_hash("AdminPass123!")
    )
    facility_staff = User(
        id=1002,
        email="staff_audit@mediguard.gov",
        full_name="Facility Staff Audit",
        role=UserRoleEnum.FACILITY_STAFF,
        facility_id=1,
        is_active=True,
        password_hash=get_password_hash("StaffPass123!")
    )
    db.add_all([super_admin, facility_staff])
    db.commit()
    return super_admin, facility_staff


def get_auth_headers(user: User):
    token_data = {"sub": str(user.id), "email": user.email, "role": user.role.value}
    token = create_access_token(token_data)
    return {"Authorization": f"Bearer {token}"}


def test_audit_creation(db_session: Session):
    """Test creating an audit log entry via audit_service."""
    super_admin, _ = setup_audit_test_data(db_session)

    log = audit_service.create_log(
        db=db_session,
        user_id=super_admin.id,
        action="INVENTORY_UPDATE",
        entity_type="inventory",
        entity_id=10,
        details={"item_id": 5, "quantity_change": +50},
        correlation_id="corr-test-123"
    )

    assert log.id is not None
    assert log.user_id == super_admin.id
    assert log.action == "INVENTORY_UPDATE"
    assert log.entity_type == "inventory"
    assert log.entity_id == 10
    assert log.correlation_id == "corr-test-123"
    assert log.created_at is not None

    parsed_details = json.loads(log.details)
    assert parsed_details["quantity_change"] == 50


def test_audit_immutability(db_session: Session):
    """Test that audit log entries cannot be modified or deleted via SQLAlchemy ORM listeners."""
    super_admin, _ = setup_audit_test_data(db_session)

    log = audit_service.create_log(
        db=db_session,
        user_id=super_admin.id,
        action="IMMUTABLE_ACTION",
        entity_type="system",
        entity_id=1,
        details={"note": "original data"}
    )
    log_id = log.id

    # Test update immutability
    log.action = "TAMPERED_ACTION"
    with pytest.raises(ValueError, match="Audit logs are immutable"):
        db_session.commit()

    db_session.rollback()

    # Re-fetch after rollback
    fetched_log = db_session.query(AuditLog).filter(AuditLog.id == log_id).first()
    assert fetched_log is not None
    assert fetched_log.action == "IMMUTABLE_ACTION"

    # Test delete immutability
    db_session.delete(fetched_log)
    with pytest.raises(ValueError, match="Audit logs are immutable"):
        db_session.commit()


    db_session.rollback()


def test_audit_sanitization():
    """Test data sanitization for sensitive keys."""
    raw_details = {
        "user_email": "user@example.com",
        "password": "SecretPassword123!",
        "access_token": "bearer_abc_xyz",
        "api_key": "key_12345",
        "secret": "my_secret",
        "nested": {
            "token": "nested_token",
            "safe_field": "ok"
        }
    }

    sanitized = sanitize_metadata(raw_details)

    assert sanitized["user_email"] == "user@example.com"
    assert sanitized["password"] == "[REDACTED]"
    assert sanitized["access_token"] == "[REDACTED]"
    assert sanitized["api_key"] == "[REDACTED]"
    assert sanitized["secret"] == "[REDACTED]"
    assert sanitized["nested"]["token"] == "[REDACTED]"
    assert sanitized["nested"]["safe_field"] == "ok"


def test_audit_api_list_authorization(client: TestClient, db_session: Session):
    """Test RBAC restrictions on GET /api/v1/audit-logs."""
    super_admin, facility_staff = setup_audit_test_data(db_session)

    # Super Admin can list audit logs
    admin_headers = get_auth_headers(super_admin)
    res_admin = client.get("/api/v1/audit-logs", headers=admin_headers)
    assert res_admin.status_code == 200
    data = res_admin.json()
    assert "items" in data
    assert "total" in data

    # Facility Staff is forbidden (403)
    staff_headers = get_auth_headers(facility_staff)
    res_staff = client.get("/api/v1/audit-logs", headers=staff_headers)
    assert res_staff.status_code == 403

    # Unauthenticated is 401
    res_unauth = client.get("/api/v1/audit-logs")
    assert res_unauth.status_code == 401


def test_audit_api_get_by_id(client: TestClient, db_session: Session):
    """Test retrieving single audit log by ID."""
    super_admin, _ = setup_audit_test_data(db_session)
    admin_headers = get_auth_headers(super_admin)

    log = audit_service.create_log(
        db=db_session,
        user_id=super_admin.id,
        action="TRANSFER_APPROVAL",
        entity_type="recommendation",
        entity_id=99,
        details={"approved": True}
    )

    # Get existing log
    res = client.get(f"/api/v1/audit-logs/{log.id}", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == log.id
    assert data["action"] == "TRANSFER_APPROVAL"
    assert data["entity_type"] == "recommendation"
    assert data["entity_id"] == 99

    # Get non-existent log
    res_404 = client.get("/api/v1/audit-logs/99999", headers=admin_headers)
    assert res_404.status_code == 404


def test_audit_filtering_and_search(client: TestClient, db_session: Session):
    """Test audit log filtering by action, entity_type, and free-text search."""
    super_admin, _ = setup_audit_test_data(db_session)
    admin_headers = get_auth_headers(super_admin)

    audit_service.create_log(
        db=db_session,
        user_id=super_admin.id,
        action="STOCK_DISPATCH",
        entity_type="inventory",
        entity_id=1,
        details={"location": "Warehouse Alpha"},
        correlation_id="corr-alpha"
    )
    audit_service.create_log(
        db=db_session,
        user_id=super_admin.id,
        action="EQUIPMENT_MAINTENANCE",
        entity_type="equipment",
        entity_id=5,
        details={"tech": "Dr. Smith"},
        correlation_id="corr-beta"
    )

    # Filter by action
    res_action = client.get("/api/v1/audit-logs?action=STOCK_DISPATCH", headers=admin_headers)
    assert res_action.status_code == 200
    assert res_action.json()["total"] == 1
    assert res_action.json()["items"][0]["action"] == "STOCK_DISPATCH"

    # Filter by entity_type
    res_entity = client.get("/api/v1/audit-logs?entity_type=equipment", headers=admin_headers)
    assert res_entity.status_code == 200
    assert res_entity.json()["total"] == 1
    assert res_entity.json()["items"][0]["entity_type"] == "equipment"

    # Filter by correlation_id
    res_corr = client.get("/api/v1/audit-logs?correlation_id=corr-alpha", headers=admin_headers)
    assert res_corr.status_code == 200
    assert res_corr.json()["total"] == 1

    # Search filter
    res_search = client.get("/api/v1/audit-logs?search=Warehouse", headers=admin_headers)
    assert res_search.status_code == 200
    assert res_search.json()["total"] == 1


def test_correlation_id_middleware(client: TestClient):
    """Test that incoming requests receive a correlation ID in header."""
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    assert "X-Request-ID" in res.headers

    # Custom correlation ID header
    custom_id = "custom-trace-header-999"
    res_custom = client.get("/api/v1/health", headers={"X-Request-ID": custom_id})
    assert res_custom.status_code == 200
    assert res_custom.headers["X-Request-ID"] == custom_id
