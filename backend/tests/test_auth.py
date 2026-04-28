from tests.conftest import auth, _seed_user


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_cors_header_present_on_origin_request(client):
    resp = client.get("/health", headers={"Origin": "http://localhost:8080"})
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "*"


def test_login_success(client, db):
    _seed_user(db, "alice", "pass123", "viewer")
    resp = client.post("/api/auth/token", data={"username": "alice", "password": "pass123"})
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_login_wrong_password(client, db):
    _seed_user(db, "bob", "rightpass", "viewer")
    resp = client.post("/api/auth/token", data={"username": "bob", "password": "wrongpass"})
    assert resp.status_code == 400


def test_login_unknown_user(client):
    resp = client.post("/api/auth/token", data={"username": "nobody", "password": "pass"})
    assert resp.status_code == 400


def test_get_me(client, admin_token):
    resp = client.get("/api/auth/me", headers=auth(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "admin"
    assert data["role"] == "admin"


def test_get_me_unauthenticated(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_register_by_admin(client, admin_token):
    resp = client.post(
        "/api/auth/register",
        json={"username": "newuser", "password": "newpass", "role": "viewer"},
        headers=auth(admin_token),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["username"] == "newuser"
    assert data["role"] == "viewer"
    assert "id" in data


def test_register_duplicate_username(client, admin_token):
    client.post(
        "/api/auth/register",
        json={"username": "dup", "password": "p", "role": "viewer"},
        headers=auth(admin_token),
    )
    resp = client.post(
        "/api/auth/register",
        json={"username": "dup", "password": "p", "role": "viewer"},
        headers=auth(admin_token),
    )
    assert resp.status_code == 409


def test_register_non_admin_forbidden(client, viewer_token):
    resp = client.post(
        "/api/auth/register",
        json={"username": "blocked", "password": "p", "role": "viewer"},
        headers=auth(viewer_token),
    )
    assert resp.status_code == 403


def test_register_invalid_role(client, admin_token):
    resp = client.post(
        "/api/auth/register",
        json={"username": "badrole", "password": "p", "role": "superadmin"},
        headers=auth(admin_token),
    )
    assert resp.status_code == 400


def test_change_password_success(client, db):
    _seed_user(db, "changeme", "oldpass123", "viewer")
    login = client.post("/api/auth/token", data={"username": "changeme", "password": "oldpass123"})
    token = login.json()["access_token"]
    resp = client.post(
        "/api/auth/change-password",
        json={"current_password": "oldpass123", "new_password": "newpass123"},
        headers=auth(token),
    )
    assert resp.status_code == 204
    relogin = client.post("/api/auth/token", data={"username": "changeme", "password": "newpass123"})
    assert relogin.status_code == 200


def test_change_password_wrong_current_password(client, db):
    _seed_user(db, "wrongcurrent", "oldpass123", "viewer")
    token = client.post("/api/auth/token", data={"username": "wrongcurrent", "password": "oldpass123"}).json()["access_token"]
    resp = client.post(
        "/api/auth/change-password",
        json={"current_password": "bad-old", "new_password": "newpass123"},
        headers=auth(token),
    )
    assert resp.status_code == 400


def test_change_password_requires_auth(client):
    resp = client.post(
        "/api/auth/change-password",
        json={"current_password": "oldpass123", "new_password": "newpass123"},
    )
    assert resp.status_code == 401
