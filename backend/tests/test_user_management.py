"""Tests for user management and password expiry features."""
from datetime import datetime, timedelta, timezone

from tests.conftest import auth, _seed_user


def _seed_user_full(db, username, password, role, expires_days=90, expired=False):
    """Seed a user with optional expired password."""
    from models.user import User
    from routers.auth import hash_password
    changed = datetime.now(timezone.utc)
    if expired:
        changed = datetime.now(timezone.utc) - timedelta(days=expires_days + 1)
    user = User(
        username=username,
        hashed_pw=hash_password(password),
        role=role,
        password_expires_days=expires_days,
        password_changed_at=changed,
    )
    db.add(user)
    db.commit()
    return user


# ── /api/users ────────────────────────────────────────────────────────────────

def test_list_users_admin(client, admin_token):
    resp = client.get("/api/users", headers=auth(admin_token))
    assert resp.status_code == 200
    users = resp.json()
    assert isinstance(users, list)
    assert any(u["username"] == "admin" for u in users)


def test_list_users_non_admin_forbidden(client, viewer_token):
    resp = client.get("/api/users", headers=auth(viewer_token))
    assert resp.status_code == 403


def test_update_user_role(client, db, admin_token):
    _seed_user(db, "target", "targetpass", "viewer")
    users = client.get("/api/users", headers=auth(admin_token)).json()
    target = next(u for u in users if u["username"] == "target")
    resp = client.put(f"/api/users/{target['id']}", json={"role": "analyst"}, headers=auth(admin_token))
    assert resp.status_code == 200
    assert resp.json()["role"] == "analyst"


def test_update_user_invalid_role(client, db, admin_token):
    _seed_user(db, "target2", "targetpass", "viewer")
    users = client.get("/api/users", headers=auth(admin_token)).json()
    target = next(u for u in users if u["username"] == "target2")
    resp = client.put(f"/api/users/{target['id']}", json={"role": "superadmin"}, headers=auth(admin_token))
    assert resp.status_code == 400


def test_toggle_user_active(client, db, admin_token):
    _seed_user(db, "togglable", "togglepass", "viewer")
    users = client.get("/api/users", headers=auth(admin_token)).json()
    target = next(u for u in users if u["username"] == "togglable")
    resp = client.patch(f"/api/users/{target['id']}/activate", headers=auth(admin_token))
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False
    # Toggle back
    resp2 = client.patch(f"/api/users/{target['id']}/activate", headers=auth(admin_token))
    assert resp2.json()["is_active"] is True


def test_cannot_deactivate_self(client, admin_token):
    users = client.get("/api/users", headers=auth(admin_token)).json()
    me = next(u for u in users if u["username"] == "admin")
    resp = client.patch(f"/api/users/{me['id']}/activate", headers=auth(admin_token))
    assert resp.status_code == 400


def test_admin_reset_password(client, db, admin_token):
    _seed_user(db, "resetme", "Oldpass1!", "viewer")
    users = client.get("/api/users", headers=auth(admin_token)).json()
    target = next(u for u in users if u["username"] == "resetme")
    resp = client.post(
        f"/api/users/{target['id']}/reset-password",
        json={"new_password": "Newpass1!"},
        headers=auth(admin_token),
    )
    assert resp.status_code == 204
    # Verify new password works
    login = client.post("/api/auth/token", data={"username": "resetme", "password": "Newpass1!"})
    assert login.status_code == 200


def test_delete_user(client, db, admin_token):
    _seed_user(db, "todelete", "Deletepass1!", "viewer")
    users = client.get("/api/users", headers=auth(admin_token)).json()
    target = next(u for u in users if u["username"] == "todelete")
    resp = client.delete(f"/api/users/{target['id']}", headers=auth(admin_token))
    assert resp.status_code == 204
    users2 = client.get("/api/users", headers=auth(admin_token)).json()
    assert all(u["username"] != "todelete" for u in users2)


def test_cannot_delete_self(client, admin_token):
    users = client.get("/api/users", headers=auth(admin_token)).json()
    me = next(u for u in users if u["username"] == "admin")
    resp = client.delete(f"/api/users/{me['id']}", headers=auth(admin_token))
    assert resp.status_code == 400


def test_disabled_user_cannot_login(client, db):
    from models.user import User
    from routers.auth import hash_password
    user = User(username="disabled", hashed_pw=hash_password("Disabled1!"), role="viewer", is_active=False)
    db.add(user)
    db.commit()
    resp = client.post("/api/auth/token", data={"username": "disabled", "password": "Disabled1!"})
    assert resp.status_code == 403


# ── Password expiry ───────────────────────────────────────────────────────────

def test_login_with_non_expired_password(client, db):
    _seed_user_full(db, "fresh_user", "Freshpass1!", "viewer", expires_days=90, expired=False)
    resp = client.post("/api/auth/token", data={"username": "fresh_user", "password": "Freshpass1!"})
    assert resp.status_code == 200


def test_login_with_expired_password_returns_403(client, db):
    _seed_user_full(db, "expired_user", "Expired1!", "viewer", expires_days=30, expired=True)
    resp = client.post("/api/auth/token", data={"username": "expired_user", "password": "Expired1!"})
    assert resp.status_code == 403
    body = resp.json()
    assert body["detail"]["password_expired"] is True


def test_never_expire_password(client, db):
    _seed_user_full(db, "never_expire", "Neverexpire1!", "viewer", expires_days=0, expired=True)
    # expires_days=0 means never expire, even if changed_at is old
    resp = client.post("/api/auth/token", data={"username": "never_expire", "password": "Neverexpire1!"})
    assert resp.status_code == 200


def test_change_expired_password(client, db):
    _seed_user_full(db, "change_me", "Changepass1!", "viewer", expires_days=30, expired=True)
    resp = client.post("/api/auth/change-expired-password", json={
        "username": "change_me",
        "old_password": "Changepass1!",
        "new_password": "Newpass12!",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()
    # Can now login with new password
    login = client.post("/api/auth/token", data={"username": "change_me", "password": "Newpass12!"})
    assert login.status_code == 200


def test_change_expired_password_wrong_old(client, db):
    _seed_user_full(db, "badold_user", "Correct1!", "viewer", expires_days=30, expired=True)
    resp = client.post("/api/auth/change-expired-password", json={
        "username": "badold_user",
        "old_password": "Wrong1!",
        "new_password": "Newpass12!",
    })
    assert resp.status_code == 400


def test_change_expired_rejects_weak_password(client, db):
    _seed_user_full(db, "weak_change", "Weakpass1!", "viewer", expires_days=30, expired=True)
    resp = client.post("/api/auth/change-expired-password", json={
        "username": "weak_change",
        "old_password": "Weakpass1!",
        "new_password": "weak",
    })
    assert resp.status_code == 422


# ── Self change-password ──────────────────────────────────────────────────────

def test_change_own_password(client, db):
    _seed_user(db, "changer", "Changer1!", "viewer")
    token = client.post("/api/auth/token", data={"username": "changer", "password": "Changer1!"}).json()["access_token"]
    resp = client.post("/api/auth/change-password",
        json={"old_password": "Changer1!", "new_password": "Changed1!"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 204
    # Old password should no longer work
    login = client.post("/api/auth/token", data={"username": "changer", "password": "Changer1!"})
    assert login.status_code == 400


def test_change_password_wrong_old(client, db):
    _seed_user(db, "wrongold", "Wrongold1!", "viewer")
    token = client.post("/api/auth/token", data={"username": "wrongold", "password": "Wrongold1!"}).json()["access_token"]
    resp = client.post("/api/auth/change-password",
        json={"old_password": "WrongGuess1!", "new_password": "Newpass1!"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


def test_change_password_same_as_old(client, db):
    _seed_user(db, "samepass", "Samepass1!", "viewer")
    token = client.post("/api/auth/token", data={"username": "samepass", "password": "Samepass1!"}).json()["access_token"]
    resp = client.post("/api/auth/change-password",
        json={"old_password": "Samepass1!", "new_password": "Samepass1!"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


def test_get_me_returns_full_detail(client, admin_token):
    resp = client.get("/api/auth/me", headers=auth(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert "is_active" in data
    assert "password_changed_at" in data
    assert "password_expires_days" in data
