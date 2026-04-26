"""Tests for /api/auth/* endpoints."""


# ─── Login ──────────────────────────────────────────────────────────────────

def test_login_success(admin_client):
    resp = admin_client.get("/api/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "admin"
    assert data["role"] == "admin"


def test_login_wrong_password(client):
    from passlib.context import CryptContext
    from models.user import User
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    eng = create_engine("sqlite:///./test.db", connect_args={"check_same_thread": False})
    Sess = sessionmaker(bind=eng)
    db = Sess()
    try:
        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        db.add(User(username="testuser", hashed_pw=pwd.hash("correct"), role="viewer"))
        db.commit()
    finally:
        db.close()

    resp = client.post(
        "/api/auth/token",
        data={"username": "testuser", "password": "wrong"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert resp.status_code == 400


def test_login_unknown_user(client):
    resp = client.post(
        "/api/auth/token",
        data={"username": "nobody", "password": "anything"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert resp.status_code == 400


def test_me_without_token(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_me_with_bad_token(client):
    client.headers.update({"Authorization": "Bearer invalid.jwt.token"})
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


# ─── Register ───────────────────────────────────────────────────────────────

def test_admin_can_register(admin_client):
    resp = admin_client.post(
        "/api/auth/register",
        json={"username": "newuser", "password": "newpass123", "role": "analyst"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["username"] == "newuser"
    assert data["role"] == "analyst"
    assert "id" in data


def test_register_duplicate_username(admin_client):
    admin_client.post(
        "/api/auth/register",
        json={"username": "dup", "password": "pass1", "role": "viewer"},
    )
    resp = admin_client.post(
        "/api/auth/register",
        json={"username": "dup", "password": "pass2", "role": "viewer"},
    )
    assert resp.status_code == 409


def test_register_invalid_role(admin_client):
    resp = admin_client.post(
        "/api/auth/register",
        json={"username": "badrole", "password": "pass", "role": "superuser"},
    )
    assert resp.status_code == 400


def test_viewer_cannot_register(viewer_client):
    resp = viewer_client.post(
        "/api/auth/register",
        json={"username": "attempt", "password": "pass", "role": "viewer"},
    )
    assert resp.status_code == 403


def test_analyst_cannot_register(analyst_client):
    resp = analyst_client.post(
        "/api/auth/register",
        json={"username": "attempt2", "password": "pass", "role": "viewer"},
    )
    assert resp.status_code == 403
