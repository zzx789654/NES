import io
from unittest.mock import AsyncMock, patch

from tests.conftest import auth


MIXED_RISK_CSV = b"""Plugin ID,CVE,Risk,Host,Port,Protocol,Name,CVSS v3.0 Base Score,EPSS Score,VPR Score
1005,,Info,192.168.1.5,443,TCP,Info Vuln,0.0,,
1003,,Medium,192.168.1.3,443,TCP,Medium Vuln,5.0,0.2,5.0
1001,,Critical,192.168.1.1,443,TCP,Critical Vuln,9.8,0.9,9.8
1004,,Low,192.168.1.4,443,TCP,Low Vuln,2.0,0.1,2.0
1002,,High,192.168.1.2,443,TCP,High Vuln,7.5,0.5,7.5
"""


def _upload_mixed_risks(client, token):
    with patch("routers.scans.fetch_epss_scores", new=AsyncMock(return_value={})):
        resp = client.post(
            "/api/scans/upload",
            data={"name": "Mixed Risk Scan", "scan_date": "2026-05-11"},
            files={"file": ("mixed.csv", io.BytesIO(MIXED_RISK_CSV), "text/csv")},
            headers=auth(token),
        )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_vulnerability_table_defaults_to_risk_descending_order(client, admin_token):
    scan_id = _upload_mixed_risks(client, admin_token)

    resp = client.get(f"/api/scans/{scan_id}/vulns", headers=auth(admin_token))

    assert resp.status_code == 200, resp.text
    assert [item["risk"] for item in resp.json()["items"]] == [
        "Critical",
        "High",
        "Medium",
        "Low",
        "Info",
    ]


def test_vulnerability_table_risk_desc_reverses_to_info_first(client, admin_token):
    scan_id = _upload_mixed_risks(client, admin_token)

    resp = client.get(f"/api/scans/{scan_id}/vulns?sort_by=risk&sort_dir=desc", headers=auth(admin_token))

    assert resp.status_code == 200, resp.text
    assert [item["risk"] for item in resp.json()["items"]] == [
        "Info",
        "Low",
        "Medium",
        "High",
        "Critical",
    ]


def test_vulnerability_matrix_reads_scores_and_uses_risk_order(client, admin_token):
    scan_id = _upload_mixed_risks(client, admin_token)

    resp = client.get(f"/api/scans/{scan_id}/vuln-matrix", headers=auth(admin_token))

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert [item["risk"] for item in data] == ["Critical", "High", "Medium", "Low", "Info"]
    critical = data[0]
    assert critical["cvss_v3_base"] == 9.8
    assert critical["epss"] == 0.9
    assert critical["vpr"] == 9.8
