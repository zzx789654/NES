"""Tests for /api/dashboard endpoint."""
import io

NESSUS_CSV = (
    b"Plugin ID,CVE,Risk,Host,Port,Protocol,Name,CVSS v3.0 Base Score,"
    b"Synopsis,Description,Solution,Plugin Output\r\n"
    b"10001,CVE-2023-0001,Critical,192.168.1.1,443,tcp,SSL Vuln,9.8,,,Fix,\r\n"
    b"10002,CVE-2022-9999,High,192.168.1.2,80,tcp,HTTP Vuln,7.2,,,Patch,\r\n"
    b"10003,,Medium,192.168.1.1,22,tcp,SSH Config,5.0,,,Reconfigure,\r\n"
)

AUDIT_CSV = (
    b"Check Name,Status,Description,Policy Value,Actual Value\r\n"
    b"1.1 Audit logging,PASSED,auditd,enabled,enabled\r\n"
    b"1.2 Root login,FAILED,still enabled,no,yes\r\n"
    b"1.3 Password,PASSED,ok,minlen=12,minlen=12\r\n"
    b"1.4 Firewall,PASSED,active,active,active\r\n"
)


def test_dashboard_empty(admin_client):
    resp = admin_client.get("/api/dashboard")
    assert resp.status_code == 200
    data = resp.json()
    assert data["scan_count"] == 0
    assert data["audit_scan_count"] == 0
    assert data["risk"]["total"] == 0
    assert data["nist"]["total"] == 0


def test_dashboard_with_scan(admin_client):
    admin_client.post(
        "/api/scans/upload",
        data={"name": "Dashboard Scan", "scan_date": "2024-06-01"},
        files={"file": ("scan.csv", io.BytesIO(NESSUS_CSV), "text/csv")},
    )
    resp = admin_client.get("/api/dashboard")
    assert resp.status_code == 200
    data = resp.json()
    assert data["scan_count"] == 1
    assert data["risk"]["total"] == 3
    assert data["risk"]["critical"] == 1
    assert data["risk"]["high"] == 1
    assert data["risk"]["medium"] == 1
    assert data["latest_scan_date"] == "2024-06-01"


def test_dashboard_with_audit(admin_client):
    admin_client.post(
        "/api/nist/upload",
        data={"name": "Dashboard Audit", "scan_date": "2024-06-15"},
        files={"file": ("audit.csv", io.BytesIO(AUDIT_CSV), "text/csv")},
    )
    resp = admin_client.get("/api/dashboard")
    assert resp.status_code == 200
    data = resp.json()
    assert data["audit_scan_count"] == 1
    assert data["nist"]["total"] == 4
    assert data["nist"]["passed"] == 3
    assert data["nist"]["failed"] == 1
    assert data["nist"]["pass_rate"] == 75.0
    assert data["latest_audit_date"] == "2024-06-15"


def test_dashboard_uses_latest_scan(admin_client):
    """Dashboard should reflect the most recent scan by date."""
    admin_client.post(
        "/api/scans/upload",
        data={"name": "Old Scan", "scan_date": "2023-01-01"},
        files={"file": ("s1.csv", io.BytesIO(NESSUS_CSV), "text/csv")},
    )
    admin_client.post(
        "/api/scans/upload",
        data={"name": "New Scan", "scan_date": "2024-12-01"},
        files={"file": ("s2.csv", io.BytesIO(NESSUS_CSV), "text/csv")},
    )
    resp = admin_client.get("/api/dashboard")
    assert resp.json()["latest_scan_date"] == "2024-12-01"


def test_dashboard_unauthenticated(client):
    resp = client.get("/api/dashboard")
    assert resp.status_code == 401


def test_dashboard_viewer_can_read(viewer_client):
    resp = viewer_client.get("/api/dashboard")
    assert resp.status_code == 200


def test_dashboard_health_endpoint(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
