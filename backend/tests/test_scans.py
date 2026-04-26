"""Tests for /api/scans/* endpoints."""
import io

NESSUS_CSV = (
    b"Plugin ID,CVE,Risk,Host,Port,Protocol,Name,CVSS v3.0 Base Score,"
    b"Synopsis,Description,Solution,Plugin Output\r\n"
    b"10001,CVE-2023-0001,Critical,192.168.1.10,443,tcp,SSL Vuln,9.8,"
    b"SSL issue,Long desc,Update SSL,Output A\r\n"
    b"10002,CVE-2022-9999,High,192.168.1.11,80,tcp,HTTP Vuln,7.2,"
    b"HTTP issue,Long desc 2,Patch,Output B\r\n"
    b"10003,,Medium,192.168.1.10,22,tcp,SSH Config,5.0,"
    b"SSH miscfg,Desc,Reconfigure,\r\n"
)


def _upload_scan(client, name="Test Scan 2024-Q1", scan_date="2024-01-15"):
    return client.post(
        "/api/scans/upload",
        data={"name": name, "scan_date": scan_date},
        files={"file": ("scan.csv", io.BytesIO(NESSUS_CSV), "text/csv")},
    )


# ─── Upload ──────────────────────────────────────────────────────────────────

def test_upload_scan_success(admin_client):
    resp = _upload_scan(admin_client)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Scan 2024-Q1"
    assert data["vuln_count"] == 3
    assert data["host_count"] == 2
    assert data["scan_date"] == "2024-01-15"
    assert data["source"] == "nessus_csv"


def test_upload_scan_as_analyst(analyst_client):
    resp = _upload_scan(analyst_client, "Analyst Upload")
    assert resp.status_code == 201


def test_upload_scan_viewer_forbidden(viewer_client):
    resp = _upload_scan(viewer_client)
    assert resp.status_code == 403


def test_upload_scan_no_auth(client):
    resp = _upload_scan(client)
    assert resp.status_code == 401


def test_upload_scan_unsupported_file(admin_client):
    resp = admin_client.post(
        "/api/scans/upload",
        data={"name": "Bad File"},
        files={"file": ("report.xml", b"<xml/>", "text/xml")},
    )
    assert resp.status_code == 400


def test_upload_scan_no_date(admin_client):
    resp = admin_client.post(
        "/api/scans/upload",
        data={"name": "No Date Scan"},
        files={"file": ("scan.csv", io.BytesIO(NESSUS_CSV), "text/csv")},
    )
    assert resp.status_code == 201
    assert resp.json()["scan_date"] is None


# ─── List & Detail ───────────────────────────────────────────────────────────

def test_list_scans_empty(admin_client):
    resp = admin_client.get("/api/scans")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_scans_after_upload(admin_client):
    _upload_scan(admin_client)
    resp = admin_client.get("/api/scans")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_get_scan_detail(admin_client):
    upload_resp = _upload_scan(admin_client)
    scan_id = upload_resp.json()["id"]

    resp = admin_client.get(f"/api/scans/{scan_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert "vulnerabilities" in data
    assert len(data["vulnerabilities"]) == 3


def test_get_scan_not_found(admin_client):
    resp = admin_client.get("/api/scans/99999")
    assert resp.status_code == 404


def test_list_scans_unauthenticated(client):
    resp = client.get("/api/scans")
    assert resp.status_code == 401


# ─── Delete ──────────────────────────────────────────────────────────────────

def test_delete_scan_as_admin(admin_client):
    upload_resp = _upload_scan(admin_client)
    scan_id = upload_resp.json()["id"]

    del_resp = admin_client.delete(f"/api/scans/{scan_id}")
    assert del_resp.status_code == 204

    get_resp = admin_client.get(f"/api/scans/{scan_id}")
    assert get_resp.status_code == 404


def test_delete_scan_as_analyst(analyst_client):
    upload_resp = _upload_scan(analyst_client)
    scan_id = upload_resp.json()["id"]
    resp = analyst_client.delete(f"/api/scans/{scan_id}")
    assert resp.status_code == 204


def test_delete_scan_viewer_forbidden(admin_client):
    from passlib.context import CryptContext
    from models.user import User
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    # Upload as admin first
    scan_id = _upload_scan(admin_client).json()["id"]

    # Seed a viewer user and get their token
    eng = create_engine("sqlite:///./test.db", connect_args={"check_same_thread": False})
    db = sessionmaker(bind=eng)()
    try:
        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        db.add(User(username="viewer_del", hashed_pw=pwd.hash("v_pass"), role="viewer"))
        db.commit()
    finally:
        db.close()

    token = admin_client.post(
        "/api/auth/token",
        data={"username": "viewer_del", "password": "v_pass"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    ).json()["access_token"]

    resp = admin_client.delete(
        f"/api/scans/{scan_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


def test_delete_scan_not_found(admin_client):
    resp = admin_client.delete("/api/scans/99999")
    assert resp.status_code == 404


# ─── Diff ────────────────────────────────────────────────────────────────────

NESSUS_CSV_V2 = (
    b"Plugin ID,CVE,Risk,Host,Port,Protocol,Name,CVSS v3.0 Base Score,"
    b"Synopsis,Description,Solution,Plugin Output\r\n"
    b"10001,CVE-2023-0001,Critical,192.168.1.10,443,tcp,SSL Vuln,9.8,"
    b"SSL issue,Long desc,Update SSL,Output A\r\n"
    b"10004,CVE-2024-1111,High,192.168.1.12,8080,tcp,New Vuln,7.8,"
    b"New vuln,Desc,Fix,\r\n"
)


def test_scan_diff(admin_client):
    v1_id = admin_client.post(
        "/api/scans/upload",
        data={"name": "V1", "scan_date": "2024-01-01"},
        files={"file": ("v1.csv", io.BytesIO(NESSUS_CSV), "text/csv")},
    ).json()["id"]

    v2_id = admin_client.post(
        "/api/scans/upload",
        data={"name": "V2", "scan_date": "2024-04-01"},
        files={"file": ("v2.csv", io.BytesIO(NESSUS_CSV_V2), "text/csv")},
    ).json()["id"]

    resp = admin_client.get(f"/api/scans/diff?base={v1_id}&comp={v2_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert "new" in data
    assert "resolved" in data
    assert "persistent" in data
    # CVE-2023-0001 is in both → persistent
    assert any(v["cve"] == "CVE-2023-0001" for v in data["persistent"])
    # CVE-2022-9999 only in base → resolved
    assert any(v["cve"] == "CVE-2022-9999" for v in data["resolved"])
    # CVE-2024-1111 only in comp → new
    assert any(v["cve"] == "CVE-2024-1111" for v in data["new"])


def test_scan_diff_missing_scan(admin_client):
    resp = admin_client.get("/api/scans/diff?base=1&comp=99999")
    assert resp.status_code == 404
