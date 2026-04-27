import io
from unittest.mock import AsyncMock, patch

from tests.conftest import auth

NESSUS_CSV = b"""Plugin ID,CVE,Risk,Host,Port,Protocol,Name,CVSS v3.0 Base Score,Synopsis,Description,Solution,Plugin Output
1,CVE-2024-0001,Critical,10.0.0.1,443,TCP,V1,9.8,S,D,F,O
2,CVE-2024-0002,High,10.0.0.2,80,TCP,V2,7.5,S,D,F,O
3,,Medium,10.0.0.1,22,TCP,V3,5.0,S,D,F,O
"""

AUDIT_CSV = b"""Check Name,Status,Description,Policy Value,Actual Value
Check1,PASSED,Desc,On,On
Check2,FAILED,Desc,Off,On
Check3,PASSED,Desc,On,On
Check4,PASSED,Desc,On,On
"""


def test_dashboard_empty(client, admin_token):
    resp = client.get("/api/dashboard", headers=auth(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["scan_count"] == 0
    assert data["audit_scan_count"] == 0
    assert data["risk"]["total"] == 0
    assert data["nist"]["pass_rate"] == 0.0
    assert data["latest_scan_date"] is None
    assert data["latest_audit_date"] is None


def test_dashboard_with_scan(client, admin_token):
    with patch("routers.scans.fetch_epss_scores", new=AsyncMock(return_value={})):
        client.post(
            "/api/scans/upload",
            data={"name": "S1", "scan_date": "2024-01-15"},
            files={"file": ("scan.csv", io.BytesIO(NESSUS_CSV), "text/csv")},
            headers=auth(admin_token),
        )
    resp = client.get("/api/dashboard", headers=auth(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["scan_count"] == 1
    assert data["risk"]["critical"] == 1
    assert data["risk"]["high"] == 1
    assert data["risk"]["medium"] == 1
    assert data["risk"]["total"] == 3
    assert data["latest_scan_date"] == "2024-01-15"


def test_dashboard_with_audit(client, admin_token):
    client.post(
        "/api/nist/upload",
        data={"name": "A1", "scan_date": "2024-03-01"},
        files={"file": ("audit.csv", io.BytesIO(AUDIT_CSV), "text/csv")},
        headers=auth(admin_token),
    )
    resp = client.get("/api/dashboard", headers=auth(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["audit_scan_count"] == 1
    assert data["nist"]["passed"] == 3
    assert data["nist"]["failed"] == 1
    assert data["nist"]["total"] == 4
    assert data["nist"]["pass_rate"] == 75.0
    assert data["latest_audit_date"] == "2024-03-01"


def test_dashboard_requires_auth(client):
    assert client.get("/api/dashboard").status_code == 401
