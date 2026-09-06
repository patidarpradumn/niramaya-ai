"""Comprehensive test suite for Phase 3 Authentication & Authorization."""

import pytest
from datetime import timedelta
from fastapi.testclient import TestClient

from app.models import User, UserRoleEnum
from app.utils import get_password_hash, create_access_token


def create_test_user(db_session, email="testuser@mediguard.gov", password="Password123!", role=UserRoleEnum.VIEWER, is_active=True):
    """Helper to create a test user in database."""
    user = User(
        email=email,
        password_hash=get_password_hash(password),
        full_name="Test User",
        role=role,
        is_active=is_active
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_successful_login(client: TestClient, db_session):
    """Test login with valid email and password."""
    create_test_user(db_session, email="active@mediguard.gov", password="SecretPassword123")

    response = client.post("/api/v1/auth/login", json={
        "email": "active@mediguard.gov",
        "password": "SecretPassword123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_login_invalid_password(client: TestClient, db_session):
    """Test login with correct email but wrong password."""
    create_test_user(db_session, email="user1@mediguard.gov", password="CorrectPassword123")

    response = client.post("/api/v1/auth/login", json={
        "email": "user1@mediguard.gov",
        "password": "WrongPassword123"
    })
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"


def test_login_unknown_user(client: TestClient, db_session):
    """Test login with non-existent user email."""
    response = client.post("/api/v1/auth/login", json={
        "email": "nonexistent@mediguard.gov",
        "password": "Password123!"
    })
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"


def test_login_inactive_user(client: TestClient, db_session):
    """Test login with inactive user account."""
    create_test_user(db_session, email="inactive@mediguard.gov", password="Password123!", is_active=False)

    response = client.post("/api/v1/auth/login", json={
        "email": "inactive@mediguard.gov",
        "password": "Password123!"
    })
    assert response.status_code in [400, 401]
    assert "Inactive user" in response.json()["detail"]


def test_get_me_valid_token(client: TestClient, db_session):
    """Test GET /api/v1/auth/me with valid Bearer token."""
    user = create_test_user(db_session, email="me_valid@mediguard.gov", role=UserRoleEnum.ADMIN)
    token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": "super_admin"})

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "me_valid@mediguard.gov"
    assert data["role"] in ["admin", "ADMIN", "super_admin", "SUPER_ADMIN"]
    assert data["is_active"] is True
    assert "password" not in data
    assert "password_hash" not in data


def test_get_me_invalid_token(client: TestClient):
    """Test GET /api/v1/auth/me with invalid token."""
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid_garbage_token_123"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Could not validate credentials"


def test_get_me_expired_token(client: TestClient, db_session):
    """Test GET /api/v1/auth/me with an expired token."""
    user = create_test_user(db_session, email="expired@mediguard.gov")
    expired_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": "citizen"},
        expires_delta=timedelta(seconds=-10)  # Expired 10 seconds ago
    )

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"}
    )
    assert response.status_code == 401
    assert "expired" in response.json()["detail"].lower()


def test_password_hash_never_returned(client: TestClient, db_session):
    """Test that responses never contain password or password_hash fields."""
    user = create_test_user(db_session, email="nopasswordhash@mediguard.gov")
    token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": "citizen"})

    me_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert "password" not in me_data
    assert "password_hash" not in me_data


def test_restricted_user_registration(client: TestClient, db_session):
    """Test registration rules (initial setup vs admin restriction vs short password)."""
    # 1. Short password validation (< 8 chars)
    short_pw_res = client.post("/api/v1/auth/register", json={
        "email": "shortpw@mediguard.gov",
        "password": "123",
        "full_name": "Short Pass User"
    })
    assert short_pw_res.status_code == 400
    assert "8 characters" in short_pw_res.json()["detail"]

    # 2. Initial setup registration (when database has 0 users)
    db_session.query(User).delete()
    db_session.commit()

    init_res = client.post("/api/v1/auth/register", json={
        "email": "firstadmin@mediguard.gov",
        "password": "AdminPassword123",
        "full_name": "System Admin",
        "role": "super_admin"
    })
    assert init_res.status_code == 201
    init_data = init_res.json()
    assert init_data["email"] == "firstadmin@mediguard.gov"
    assert "password" not in init_data
    assert "password_hash" not in init_data

    # 3. Unauthenticated public registration when users exist -> HTTP 403 Forbidden
    public_res = client.post("/api/v1/auth/register", json={
        "email": "unauth@mediguard.gov",
        "password": "ValidPassword123",
        "full_name": "Public User"
    })
    assert public_res.status_code == 403
    assert "restricted to administrators" in public_res.json()["detail"]

    # 4. Admin user registration when users exist -> HTTP 201 Created
    admin_token = create_access_token(data={"sub": "1", "email": "firstadmin@mediguard.gov", "role": "super_admin"})
    admin_reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": "newmanager@mediguard.gov",
            "password": "ManagerPassword123",
            "full_name": "New Manager",
            "role": "hospital_admin"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert admin_reg_res.status_code == 201
    assert admin_reg_res.json()["email"] == "newmanager@mediguard.gov"



def test_logout_endpoint(client: TestClient, db_session):
    """Test POST /api/v1/auth/logout with valid token."""
    user = create_test_user(db_session, email="logout_test@mediguard.gov")
    token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": "VIEWER"})

    response = client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Successfully logged out"
