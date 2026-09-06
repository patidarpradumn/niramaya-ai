"""Pytest fixtures for MediGuard AI Backend tests."""

import pytest
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.main import app as fastapi_app
from app.db.base import Base
import app.models  # Ensures all ORM models are registered in Base metadata
from app.db.session import get_db

from sqlalchemy.pool import StaticPool

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Create test database tables before tests run and drop after."""
    Base.metadata.drop_all(bind=engine, checkfirst=True)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine, checkfirst=True)


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """Provide a fresh transactional database session for each test."""
    Base.metadata.drop_all(bind=engine, checkfirst=True)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine, checkfirst=True)




@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """Test client with overridden get_db dependency."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    fastapi_app.dependency_overrides[get_db] = override_get_db
    with TestClient(fastapi_app) as test_client:
        yield test_client
    fastapi_app.dependency_overrides.clear()
