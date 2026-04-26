"""Shared fixtures for all tests."""
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Use in-memory SQLite for all tests
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-testing-only")

from database import Base, get_db
from main import app

TEST_DB_URL = "sqlite:///./test.db"

engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_db():
    """Create all tables before each test and drop after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def admin_client(client):
    """TestClient with a seeded admin user and valid JWT token."""
    from passlib.context import CryptContext
    from models.user import User

    db = TestingSession()
    try:
        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        db.add(User(username="admin", hashed_pw=pwd.hash("admin123"), role="admin"))
        db.commit()
    finally:
        db.close()

    resp = client.post(
        "/api/auth/token",
        data={"username": "admin", "password": "admin123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


@pytest.fixture
def analyst_client(client):
    """TestClient pre-authenticated as analyst."""
    from passlib.context import CryptContext
    from models.user import User

    db = TestingSession()
    try:
        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        db.add(User(username="analyst1", hashed_pw=pwd.hash("pass456"), role="analyst"))
        db.commit()
    finally:
        db.close()

    resp = client.post(
        "/api/auth/token",
        data={"username": "analyst1", "password": "pass456"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


@pytest.fixture
def viewer_client(client):
    """TestClient pre-authenticated as viewer."""
    from passlib.context import CryptContext
    from models.user import User

    db = TestingSession()
    try:
        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        db.add(User(username="viewer1", hashed_pw=pwd.hash("view789"), role="viewer"))
        db.commit()
    finally:
        db.close()

    resp = client.post(
        "/api/auth/token",
        data={"username": "viewer1", "password": "view789"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client
