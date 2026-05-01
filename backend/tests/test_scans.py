import io
from unittest.mock import AsyncMock, patch

from tests.conftest import auth

NESSUS_CSV = b"""Plugin ID,CVE,Risk,Host,Port,Protocol,Name,CVSS v3.0 Base Score,Synopsis,Description,Solution,Plugin Output
12345,CVE-2024-0001,Critical,192.168.1.1,443,TCP,Vuln A,9.8,Synopsis A,Desc A,Fix A,Out A
23456,CVE-2024-0002,High,192.168.1.2,80,TCP,Vuln B,7.5,Synopsis B,Desc B,Fix B,Out B
34567,,Medium,192.168.1.1,22,TCP,Vuln C,5.0,Synopsis C,Desc C,Fix C,Out C
"""

NESSUS_CSV_2 = b"""Plugin ID,CVE,Risk,Host,Port,Protocol,Name,CVSS v3.0 Base Score,Synopsis,Description,Solution,Plugin Output
12345,CVE-2024-0001,Critical,192.168.1.1,443,TCP,Vuln A,9.8,Synopsis A,Desc A,Fix A,Out A
99999,CVE-2024-9999,High,192.168.1.3,8080,TCP,New Vuln,8.0,New,New Desc,Fix,Out
"""

_EPSS_MOCK = {"CVE-2024-0001": 0.9, "CVE-2024-0002": 0.5}


def _upload(client, token, name="Test Scan", csv=NESSUS_CSV, scan_date="2024-01-15"):
    with patch("routers.scans.fetch_epss_scores", new=AsyncMock(return_value=_EPSS_MOCK)):
        return client.post(
            "/api/scans/upload",
            data={"name": name, "scan_date": scan_date},
            files={"file": ("scan.csv", io.BytesIO(csv), "text/csv")},
            headers=auth(token),
        )


def test_list_scans_empty(client, admin_token):
    resp = client.get("/api/scans", headers=auth(admin_token))
    assert resp.status_code == 200
    assert resp.json() == []


def test_upload_scan(client, admin_token):
    resp = _upload(client, admin_token)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Scan"
    assert data["source"] == "nessus_csv"
    assert data["vuln_count"] == 3
    assert data["host_count"] == 2


def test_list_scans_after_upload(client, admin_token):
    _upload(client, admin_token)
    resp = client.get("/api/scans", headers=auth(admin_token))
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_get_scan_detail(client, admin_token):
    scan_id = _upload(client, admin_token).json()["id"]
    resp = client.get(f"/api/scans/{scan_id}", headers=auth(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["vulnerabilities"]) == 3


def test_get_scan_not_found(client, admin_token):
    resp = client.get("/api/scans/9999", headers=auth(admin_token))
    assert resp.status_code == 404


def test_delete_scan(client, admin_token):
    scan_id = _upload(client, admin_token).json()["id"]
    assert client.delete(f"/api/scans/{scan_id}", headers=auth(admin_token)).status_code == 204
    assert client.get(f"/api/scans/{scan_id}", headers=auth(admin_token)).status_code == 404


def test_delete_scan_viewer_forbidden(client, admin_token, viewer_token):
    scan_id = _upload(client, admin_token).json()["id"]
    resp = client.delete(f"/api/scans/{scan_id}", headers=auth(viewer_token))
    assert resp.status_code == 403


def test_scan_diff(client, admin_token):
    id1 = _upload(client, admin_token, name="S1", csv=NESSUS_CSV).json()["id"]
    id2 = _upload(client, admin_token, name="S2", csv=NESSUS_CSV_2).json()["id"]
    resp = client.get(f"/api/scans/diff?base={id1}&comp={id2}", headers=auth(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["new"]) == 1
    assert len(data["resolved"]) == 2
    assert len(data["persistent"]) == 1


def test_scan_diff_not_found(client, admin_token):
    resp = client.get("/api/scans/diff?base=9999&comp=8888", headers=auth(admin_token))
    assert resp.status_code == 404


def test_host_history(client, admin_token):
    _upload(client, admin_token, name="H1", csv=NESSUS_CSV)
    _upload(client, admin_token, name="H2", csv=NESSUS_CSV_2)

    resp = client.get("/api/scans/hosts/192.168.1.1/history", headers=auth(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["host"] == "192.168.1.1"
    assert data["total_scans"] == 2
    assert data["history"][0]["scan_name"] == "H2"
    assert data["history"][0]["vuln_count"] >= 1


def test_upload_unsupported_extension(client, admin_token):
    with patch("routers.scans.fetch_epss_scores", new=AsyncMock(return_value={})):
        resp = client.post(
            "/api/scans/upload",
            data={"name": "Bad"},
            files={"file": ("scan.txt", io.BytesIO(b"data"), "text/plain")},
            headers=auth(admin_token),
        )
    assert resp.status_code == 400


def test_upload_requires_analyst_or_admin(client, viewer_token):
    resp = _upload(client, viewer_token)
    assert resp.status_code == 403


def test_scan_requires_auth(client):
    resp = client.get("/api/scans")
    assert resp.status_code == 401
