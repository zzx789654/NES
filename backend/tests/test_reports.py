"""
Test Report API functionality
"""
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


def test_report_modules_available(client, admin_token):
    """Test that report modules endpoint returns available modules"""
    resp = client.get("/api/reports/modules", headers=auth(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert "modules" in data
    assert len(data["modules"]) == 5
    module_ids = [m["id"] for m in data["modules"]]
    assert "risk_overview" in module_ids
    assert "compliance" in module_ids
    assert "scan_efficiency" in module_ids
    assert "remediation_progress" in module_ids
    assert "audit_log" in module_ids


def test_generate_report_without_data(client, admin_token):
    """Test report generation with no scan data"""
    request_body = {
        "modules": ["risk_overview"],
        "timeRange": "30d",
        "exportFormat": "html",
        "includeCharts": True,
        "includeMetrics": True,
        "title": "Test Report",
        "description": "Test Description",
    }
    resp = client.post(
        "/api/reports/generate",
        json=request_body,
        headers=auth(admin_token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["title"] == "Test Report"
    assert data["data"]["description"] == "Test Description"
    assert "risk_overview" in data["data"]["modules"]
    # Risk data should be None when no scan data exists
    assert data["data"]["risk"] is None


def test_generate_report_with_scan_data(client, admin_token):
    """Test report generation with actual scan data"""
    # First upload a scan
    with patch("routers.scans.fetch_epss_scores", new=AsyncMock(return_value={})):
        client.post(
            "/api/scans/upload",
            data={"name": "S1", "scan_date": "2024-01-15"},
            files={"file": ("scan.csv", io.BytesIO(NESSUS_CSV), "text/csv")},
            headers=auth(admin_token),
        )
    
    # Now generate a report
    request_body = {
        "modules": ["risk_overview", "scan_efficiency"],
        "timeRange": "30d",
        "exportFormat": "html",
        "includeCharts": True,
        "includeMetrics": True,
        "title": "Security Report 2024",
        "description": "Monthly security assessment",
    }
    resp = client.post(
        "/api/reports/generate",
        json=request_body,
        headers=auth(admin_token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["title"] == "Security Report 2024"
    assert data["data"]["description"] == "Monthly security assessment"
    
    # Check risk data
    assert data["data"]["risk"] is not None
    assert data["data"]["risk"]["critical"] == 1
    assert data["data"]["risk"]["high"] == 1
    assert data["data"]["risk"]["medium"] == 1
    assert data["data"]["risk"]["low"] == 0
    
    # Check scan efficiency data
    assert data["data"]["scan_efficiency"] is not None
    assert data["data"]["scan_efficiency"]["scan_count"] == 1
    assert data["data"]["scan_efficiency"]["vulnerability_count"] == 3


def test_generate_report_compliance_module(client, admin_token):
    """Test report generation with compliance module"""
    # First upload an audit scan
    with patch("routers.nist.fetch_epss_scores", new=AsyncMock(return_value={})):
        client.post(
            "/api/nist/upload",
            data={"name": "Audit1", "scan_date": "2024-01-15"},
            files={"file": ("audit.csv", io.BytesIO(AUDIT_CSV), "text/csv")},
            headers=auth(admin_token),
        )
    
    # Generate a compliance report
    request_body = {
        "modules": ["compliance"],
        "timeRange": "30d",
        "exportFormat": "csv",
        "title": "Compliance Report",
    }
    resp = client.post(
        "/api/reports/generate",
        json=request_body,
        headers=auth(admin_token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["compliance"] is not None
    assert data["data"]["compliance"]["passed"] == 3
    assert data["data"]["compliance"]["failed"] == 1


def test_generate_report_no_modules_fails(client, admin_token):
    """Test that report generation fails with no modules selected"""
    request_body = {
        "modules": [],
        "timeRange": "30d",
        "exportFormat": "html",
    }
    resp = client.post(
        "/api/reports/generate",
        json=request_body,
        headers=auth(admin_token),
    )
    assert resp.status_code == 400
    data = resp.json()
    assert "detail" in data


def test_generate_report_custom_date_range(client, admin_token):
    """Test report generation with custom date range"""
    request_body = {
        "modules": ["risk_overview"],
        "timeRange": "custom",
        "customStart": "2024-01-01",
        "customEnd": "2024-01-31",
        "exportFormat": "html",
        "title": "Custom Date Report",
    }
    resp = client.post(
        "/api/reports/generate",
        json=request_body,
        headers=auth(admin_token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["title"] == "Custom Date Report"


def test_generate_report_requires_auth(client):
    """Test that report generation requires authentication"""
    request_body = {
        "modules": ["risk_overview"],
        "timeRange": "30d",
        "exportFormat": "html",
    }
    resp = client.post("/api/reports/generate", json=request_body)
    assert resp.status_code == 401
