import os
import sys

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure the backend root is on sys.path before any app imports
_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

# Disable rate limiting so tests can call /api/auth/token freely
os.environ.setdefault("TESTING", "true")

# Module-level imports so every fixture shares the exact same objects.
# Importing `app` triggers model registration on Base.metadata.
from main import app          # noqa: E402
from database import Base, get_db  # noqa: E402


@pytest.fixture
def db():
    # StaticPool forces a single connection so that all threads (including
    # the anyio worker spawned by TestClient) share the same in-memory DB.
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    engine.dispose()


@pytest.fixture
def client(db):
    def _override():
        yield db

    app.dependency_overrides[get_db] = _override
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


def _seed_user(db, username, password, role):
    from models.user import User
    from routers.auth import hash_password

    user = User(username=username, hashed_pw=hash_password(password), role=role)
    db.add(user)
    db.commit()


def _get_token(client, username, password):
    resp = client.post("/api/auth/token", data={"username": username, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest.fixture
def admin_token(client, db):
    _seed_user(db, "admin", "adminpass", "admin")
    return _get_token(client, "admin", "adminpass")


@pytest.fixture
def analyst_token(client, db):
    _seed_user(db, "analyst", "analystpass", "analyst")
    return _get_token(client, "analyst", "analystpass")


@pytest.fixture
def viewer_token(client, db):
    _seed_user(db, "viewer", "viewerpass", "viewer")
    return _get_token(client, "viewer", "viewerpass")


def auth(token):
    return {"Authorization": f"Bearer {token}"}
