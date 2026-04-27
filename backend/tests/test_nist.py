import io

from tests.conftest import auth

AUDIT_CSV = b"""Check Name,Status,Description,Policy Value,Actual Value
Check Password Policy,PASSED,Password length,8,12
Disable Guest Account,FAILED,Guest disabled,Disabled,Enabled
Check Firewall,WARNING,Firewall enabled,Enabled,Not configured
Enable Audit Logging,PASSED,Audit log,Enabled,Enabled
Disable Telnet,FAILED,Telnet disabled,Disabled,Enabled
"""

AUDIT_CSV_2 = b"""Check Name,Status,Description,Policy Value,Actual Value
Check Password Policy,PASSED,Password length,8,12
Disable Guest Account,PASSED,Guest disabled,Disabled,Disabled
New Check,FAILED,New check,On,Off
"""


def _upload(client, token, name="Test Audit", csv=AUDIT_CSV, scan_date="2024-03-01"):
    return client.post(
        "/api/nist/upload",
        data={"name": name, "scan_date": scan_date},
        files={"file": ("audit.csv", io.BytesIO(csv), "text/csv")},
        headers=auth(token),
    )


def test_list_audit_scans_empty(client, admin_token):
    resp = client.get("/api/nist/scans", headers=auth(admin_token))
    assert resp.status_code == 200
    assert resp.json() == []


def test_upload_audit(client, admin_token):
    resp = _upload(client, admin_token)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Audit"
    assert data["total"] == 5
    assert data["passed"] == 2
    assert data["failed"] == 2
    assert data["warning"] == 1


def test_get_audit_detail(client, admin_token):
    scan_id = _upload(client, admin_token).json()["id"]
    resp = client.get(f"/api/nist/scans/{scan_id}", headers=auth(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["results"]) == 5


def test_get_audit_not_found(client, admin_token):
    resp = client.get("/api/nist/scans/9999", headers=auth(admin_token))
    assert resp.status_code == 404


def test_delete_audit(client, admin_token):
    scan_id = _upload(client, admin_token).json()["id"]
    assert client.delete(f"/api/nist/scans/{scan_id}", headers=auth(admin_token)).status_code == 204
    assert client.get(f"/api/nist/scans/{scan_id}", headers=auth(admin_token)).status_code == 404


def test_delete_audit_viewer_forbidden(client, admin_token, viewer_token):
    scan_id = _upload(client, admin_token).json()["id"]
    assert client.delete(f"/api/nist/scans/{scan_id}", headers=auth(viewer_token)).status_code == 403


def test_audit_diff(client, admin_token):
    id1 = _upload(client, admin_token, name="A1", csv=AUDIT_CSV).json()["id"]
    id2 = _upload(client, admin_token, name="A2", csv=AUDIT_CSV_2).json()["id"]
    resp = client.get(f"/api/nist/diff?base={id1}&comp={id2}", headers=auth(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    # A1 failed: Disable Guest Account, Disable Telnet
    # A2 failed: New Check
    assert len(data["new_failures"]) == 1
    assert len(data["resolved_failures"]) == 2
    assert len(data["persistent_failures"]) == 0


def test_audit_diff_not_found(client, admin_token):
    resp = client.get("/api/nist/diff?base=9999&comp=8888", headers=auth(admin_token))
    assert resp.status_code == 404


def test_audit_trend(client, admin_token):
    _upload(client, admin_token, name="Audit1")
    resp = client.get("/api/nist/trend", headers=auth(admin_token))
    assert resp.status_code == 200
    points = resp.json()
    assert len(points) == 1
    assert points[0]["pass_rate"] == 40.0
    assert points[0]["passed"] == 2
    assert points[0]["failed"] == 2
    assert points[0]["total"] == 5


def test_upload_non_csv_rejected(client, admin_token):
    resp = client.post(
        "/api/nist/upload",
        data={"name": "Test"},
        files={"file": ("audit.json", io.BytesIO(b"{}"), "application/json")},
        headers=auth(admin_token),
    )
    assert resp.status_code == 400


def test_nist_requires_auth(client):
    resp = client.get("/api/nist/scans")
    assert resp.status_code == 401
