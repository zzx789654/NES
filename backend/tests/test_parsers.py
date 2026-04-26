"""Tests for nessus_parser, audit_parser, cve_parser, diff_service."""
import json
from datetime import date

from services.nessus_parser import parse_nessus_csv
from services.audit_parser import parse_audit_csv
from services.cve_parser import parse_nvd_json
from services.diff_service import diff_scans, diff_audits


# ─── Nessus CSV Parser ───────────────────────────────────────────────────────

NESSUS_CSV_MINIMAL = b"""Plugin ID,CVE,Risk,Host,Port,Protocol,Name,CVSS v3.0 Base Score,Synopsis,Description,Solution,Plugin Output
12345,CVE-2023-1234,Critical,192.168.1.1,443,tcp,Test Plugin,9.8,Synopsis text,Desc text,Fix it,Output text
23456,CVE-2022-5678,High,192.168.1.2,80,tcp,Another Plugin,7.5,Synopsis 2,Desc 2,Update,
34567,,Medium,192.168.1.1,22,tcp,No CVE plugin,5.0,Synopsis 3,Desc 3,Patch,
"""

NESSUS_CSV_EMPTY = b"Plugin ID,CVE,Risk,Host,Port,Protocol,Name\n"


def test_nessus_parse_returns_correct_structure():
    result = parse_nessus_csv(NESSUS_CSV_MINIMAL, "Test Scan", date(2024, 1, 15))
    assert result["name"] == "Test Scan"
    assert result["source"] == "nessus_csv"
    assert result["scan_date"] == date(2024, 1, 15)
    assert result["vuln_count"] == 3
    assert result["host_count"] == 2  # 192.168.1.1 and 192.168.1.2


def test_nessus_parse_risk_normalization():
    result = parse_nessus_csv(NESSUS_CSV_MINIMAL, "Test")
    risks = {v["risk"] for v in result["vulnerabilities"]}
    assert "Critical" in risks
    assert "High" in risks
    assert "Medium" in risks


def test_nessus_parse_cve_extraction():
    result = parse_nessus_csv(NESSUS_CSV_MINIMAL, "Test")
    cves = [v["cve"] for v in result["vulnerabilities"]]
    assert "CVE-2023-1234" in cves
    assert "CVE-2022-5678" in cves
    assert None in cves  # third row has no CVE


def test_nessus_parse_cvss_float():
    result = parse_nessus_csv(NESSUS_CSV_MINIMAL, "Test")
    critical_vuln = next(v for v in result["vulnerabilities"] if v["risk"] == "Critical")
    assert critical_vuln["cvss"] == 9.8


def test_nessus_parse_empty_csv():
    result = parse_nessus_csv(NESSUS_CSV_EMPTY, "Empty Scan")
    assert result["vuln_count"] == 0
    assert result["host_count"] == 0
    assert result["vulnerabilities"] == []


def test_nessus_parse_none_risk_maps_to_info():
    csv = b"Plugin ID,CVE,Risk,Host,Port,Protocol,Name\n99999,,None,10.0.0.1,0,tcp,Info Plugin\n"
    result = parse_nessus_csv(csv, "Test")
    assert result["vulnerabilities"][0]["risk"] == "Info"


def test_nessus_parse_no_date():
    result = parse_nessus_csv(NESSUS_CSV_MINIMAL, "No Date Scan", None)
    assert result["scan_date"] is None


# ─── Audit CSV Parser ────────────────────────────────────────────────────────

AUDIT_CSV = b"""Check Name,Status,Description,Policy Value,Actual Value
1.1 Enable auditing,PASSED,auditd running,enabled,enabled
1.2 Disable root login,FAILED,PermitRootLogin=yes,no,yes
1.3 Password complexity,WARNING,pam_pwquality not optimal,minlen=12,minlen=8
2.1 Unused ports,FAILED,port 23 open,closed,open
"""


def test_audit_parse_structure():
    result = parse_audit_csv(AUDIT_CSV, "Q1 Audit", date(2024, 3, 31))
    assert result["name"] == "Q1 Audit"
    assert result["scan_date"] == date(2024, 3, 31)
    assert result["total"] == 4
    assert result["passed"] == 1
    assert result["failed"] == 2
    assert result["warning"] == 1


def test_audit_parse_result_fields():
    result = parse_audit_csv(AUDIT_CSV, "Test")
    first = result["results"][0]
    assert first["status"] == "PASSED"
    assert "1.1" in first["check_name"]
    assert first["policy_val"] == "enabled"
    assert first["actual_val"] == "enabled"


def test_audit_parse_status_mapping():
    result = parse_audit_csv(AUDIT_CSV, "Test")
    statuses = [r["status"] for r in result["results"]]
    assert "PASSED" in statuses
    assert "FAILED" in statuses
    assert "WARNING" in statuses


def test_audit_parse_error_maps_to_warning():
    csv = b"Check Name,Status\nsome check,ERROR\n"
    result = parse_audit_csv(csv, "Test")
    assert result["results"][0]["status"] == "WARNING"


def test_audit_parse_skipped_maps_to_warning():
    csv = b"Check Name,Status\nsome check,SKIPPED\n"
    result = parse_audit_csv(csv, "Test")
    assert result["results"][0]["status"] == "WARNING"


# ─── NVD JSON Parser ────────────────────────────────────────────────────────

NVD_JSON = json.dumps({
    "vulnerabilities": [
        {
            "cve": {
                "id": "CVE-2024-0001",
                "descriptions": [{"lang": "en", "value": "Test vulnerability description"}],
                "metrics": {
                    "cvssMetricV31": [{
                        "cvssData": {"baseScore": 8.5, "baseSeverity": "HIGH"}
                    }]
                },
                "published": "2024-01-15T00:00:00.000"
            }
        },
        {
            "cve": {
                "id": "CVE-2024-0002",
                "descriptions": [{"lang": "en", "value": "Another vuln"}],
                "metrics": {},
                "published": "2024-02-01T00:00:00.000"
            }
        }
    ]
}).encode()


def test_nvd_parse_structure():
    result = parse_nvd_json(NVD_JSON, "NVD Import")
    assert result["name"] == "NVD Import"
    assert result["source"] == "nvd_json"
    assert result["vuln_count"] == 2


def test_nvd_parse_cve_ids():
    result = parse_nvd_json(NVD_JSON, "NVD Import")
    cves = [v["cve"] for v in result["vulnerabilities"]]
    assert "CVE-2024-0001" in cves
    assert "CVE-2024-0002" in cves


def test_nvd_parse_cvss_score():
    result = parse_nvd_json(NVD_JSON, "NVD Import")
    vuln1 = next(v for v in result["vulnerabilities"] if v["cve"] == "CVE-2024-0001")
    assert vuln1["cvss"] == 8.5


def test_nvd_parse_invalid_json():
    import pytest
    with pytest.raises(Exception):
        parse_nvd_json(b"not valid json at all", "Bad")


# ─── Diff Service ────────────────────────────────────────────────────────────

class FakeVuln:
    def __init__(self, plugin_id, cve, host, port, risk="High"):
        self.plugin_id = plugin_id
        self.cve = cve
        self.host = host
        self.port = port
        self.risk = risk


class FakeAuditResult:
    def __init__(self, check_name, status):
        self.check_name = check_name
        self.status = status
        self.id = check_name


def test_diff_scans_new_vulns():
    base = [FakeVuln("100", "CVE-A", "10.0.0.1", "443")]
    comp = [
        FakeVuln("100", "CVE-A", "10.0.0.1", "443"),
        FakeVuln("200", "CVE-B", "10.0.0.2", "80"),
    ]
    result = diff_scans(base, comp)
    assert len(result["new"]) == 1
    assert len(result["resolved"]) == 0
    assert len(result["persistent"]) == 1
    assert result["new"][0].cve == "CVE-B"


def test_diff_scans_resolved_vulns():
    base = [
        FakeVuln("100", "CVE-A", "10.0.0.1", "443"),
        FakeVuln("200", "CVE-B", "10.0.0.2", "80"),
    ]
    comp = [FakeVuln("100", "CVE-A", "10.0.0.1", "443")]
    result = diff_scans(base, comp)
    assert len(result["resolved"]) == 1
    assert len(result["new"]) == 0
    assert result["resolved"][0].cve == "CVE-B"


def test_diff_scans_identical():
    vulns = [FakeVuln("100", "CVE-A", "10.0.0.1", "443")]
    result = diff_scans(vulns, vulns)
    assert result["new"] == []
    assert result["resolved"] == []
    assert len(result["persistent"]) == 1


def test_diff_scans_empty():
    result = diff_scans([], [])
    assert result == {"new": [], "resolved": [], "persistent": []}


def test_diff_audits_new_failures():
    base = [FakeAuditResult("check-1", "PASSED")]
    comp = [
        FakeAuditResult("check-1", "PASSED"),
        FakeAuditResult("check-2", "FAILED"),
    ]
    result = diff_audits(base, comp)
    assert len(result["new_failures"]) == 1
    assert result["new_failures"][0].check_name == "check-2"


def test_diff_audits_resolved_failures():
    base = [
        FakeAuditResult("check-1", "FAILED"),
        FakeAuditResult("check-2", "FAILED"),
    ]
    comp = [FakeAuditResult("check-2", "FAILED")]
    result = diff_audits(base, comp)
    assert len(result["resolved_failures"]) == 1
    assert result["resolved_failures"][0].check_name == "check-1"


def test_diff_audits_persistent_failures():
    base = [FakeAuditResult("check-1", "FAILED")]
    comp = [FakeAuditResult("check-1", "FAILED")]
    result = diff_audits(base, comp)
    assert len(result["persistent_failures"]) == 1
    assert result["new_failures"] == []
    assert result["resolved_failures"] == []
