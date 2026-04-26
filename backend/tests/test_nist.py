"""Tests for /api/nist/* endpoints."""
import io

AUDIT_CSV = (
    b"Check Name,Status,Description,Policy Value,Actual Value\r\n"
    b"1.1 Audit logging enabled,PASSED,auditd running,enabled,enabled\r\n"
    b"1.2 Root login disabled,FAILED,PermitRootLogin=yes,no,yes\r\n"
    b"1.3 Password policy,WARNING,weak policy,minlen=12,minlen=6\r\n"
    b"2.1 Unused services,FAILED,telnet running,disabled,enabled\r\n"
    b"2.2 Firewall enabled,PASSED,active,active,active\r\n"
)

AUDIT_CSV_V2 = (
    b"Check Name,Status,Description,Policy Value,Actual Value\r\n"
    b"1.1 Audit logging enabled,PASSED,auditd running,enabled,enabled\r\n"
    b"1.2 Root login disabled,PASSED,Fixed!,no,no\r\n"
    b"1.3 Password policy,PASSED,policy updated,minlen=12,minlen=12\r\n"
    b"2.1 Unused services,FAILED,telnet still running,disabled,enabled\r\n"
    b"2.2 Firewall enabled,PASSED,active,active,active\r\n"
    b"3.1 New check,FAILED,new issue found,required,missing\r\n"
)


def _upload_audit(client, name="Q1 Audit", scan_date="2024-03-31", csv=None):
    return client.post(
        "/api/nist/upload",
        data={"name": name, "scan_date": scan_date},
        files={"file": ("audit.csv", io.BytesIO(csv or AUDIT_CSV), "text/csv")},
    )


# ─── Upload ──────────────────────────────────────────────────────────────────

def test_upload_audit_success(admin_client):
    resp = _upload_audit(admin_client)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Q1 Audit"
    assert data["total"] == 5
    assert data["passed"] == 2
    assert data["failed"] == 2
    assert data["warning"] == 1
    assert data["scan_date"] == "2024-03-31"


def test_upload_audit_analyst(analyst_client):
    resp = _upload_audit(analyst_client, "Analyst Audit")
    assert resp.status_code == 201


def test_upload_audit_viewer_forbidden(viewer_client):
    resp = _upload_audit(viewer_client)
    assert resp.status_code == 403


def test_upload_audit_unauthenticated(client):
    resp = _upload_audit(client)
    assert resp.status_code == 401


def test_upload_audit_non_csv(admin_client):
    resp = admin_client.post(
        "/api/nist/upload",
        data={"name": "Bad"},
        files={"file": ("audit.json", b"{}", "application/json")},
    )
    assert resp.status_code == 400


# ─── List & Detail ───────────────────────────────────────────────────────────

def test_list_audit_scans_empty(admin_client):
    resp = admin_client.get("/api/nist/scans")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_audit_scans_after_upload(admin_client):
    _upload_audit(admin_client)
    resp = admin_client.get("/api/nist/scans")
    assert len(resp.json()) == 1


def test_get_audit_detail(admin_client):
    audit_id = _upload_audit(admin_client).json()["id"]
    resp = admin_client.get(f"/api/nist/scans/{audit_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert "results" in data
    assert len(data["results"]) == 5


def test_get_audit_not_found(admin_client):
    resp = admin_client.get("/api/nist/scans/99999")
    assert resp.status_code == 404


# ─── Delete ──────────────────────────────────────────────────────────────────

def test_delete_audit_as_admin(admin_client):
    audit_id = _upload_audit(admin_client).json()["id"]
    assert admin_client.delete(f"/api/nist/scans/{audit_id}").status_code == 204
    assert admin_client.get(f"/api/nist/scans/{audit_id}").status_code == 404


def test_delete_audit_viewer_forbidden(admin_client):
    from passlib.context import CryptContext
    from models.user import User
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    # Upload as admin first
    audit_id = _upload_audit(admin_client).json()["id"]

    # Seed a viewer user and get their token
    eng = create_engine("sqlite:///./test.db", connect_args={"check_same_thread": False})
    db = sessionmaker(bind=eng)()
    try:
        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        db.add(User(username="viewer_del2", hashed_pw=pwd.hash("v_pass2"), role="viewer"))
        db.commit()
    finally:
        db.close()

    token = admin_client.post(
        "/api/auth/token",
        data={"username": "viewer_del2", "password": "v_pass2"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    ).json()["access_token"]

    resp = admin_client.delete(
        f"/api/nist/scans/{audit_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


# ─── Trend ───────────────────────────────────────────────────────────────────

def test_audit_trend_empty(admin_client):
    resp = admin_client.get("/api/nist/trend")
    assert resp.status_code == 200
    assert resp.json() == []


def test_audit_trend_has_pass_rate(admin_client):
    _upload_audit(admin_client, "Q1", "2024-03-31")
    _upload_audit(admin_client, "Q2", "2024-06-30", AUDIT_CSV_V2)
    resp = admin_client.get("/api/nist/trend")
    assert resp.status_code == 200
    points = resp.json()
    assert len(points) == 2
    for p in points:
        assert "pass_rate" in p
        assert 0 <= p["pass_rate"] <= 100


# ─── Diff ────────────────────────────────────────────────────────────────────

def test_audit_diff(admin_client):
    v1_id = _upload_audit(admin_client, "V1", "2024-03-31").json()["id"]
    v2_id = _upload_audit(admin_client, "V2", "2024-06-30", AUDIT_CSV_V2).json()["id"]

    resp = admin_client.get(f"/api/nist/diff?base={v1_id}&comp={v2_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert "new_failures" in data
    assert "resolved_failures" in data
    assert "persistent_failures" in data
    # 1.2 and 1.3 were FAILED in v1, PASSED in v2 → resolved
    resolved_names = [r["check_name"] for r in data["resolved_failures"]]
    assert any("1.2" in n for n in resolved_names)
    # 3.1 is new failure in v2
    new_names = [r["check_name"] for r in data["new_failures"]]
    assert any("3.1" in n for n in new_names)
    # 2.1 persists as FAILED
    persistent_names = [r["check_name"] for r in data["persistent_failures"]]
    assert any("2.1" in n for n in persistent_names)


def test_audit_diff_not_found(admin_client):
    resp = admin_client.get("/api/nist/diff?base=1&comp=99999")
    assert resp.status_code == 404
