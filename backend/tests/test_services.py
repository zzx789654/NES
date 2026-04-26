from datetime import date

from services.nessus_parser import parse_nessus_csv
from services.audit_parser import parse_audit_csv
from services.diff_service import diff_scans, diff_audits

NESSUS_CSV = b"""Plugin ID,CVE,Risk,Host,Port,Protocol,Name,CVSS v3.0 Base Score,Synopsis,Description,Solution,Plugin Output
12345,CVE-2024-0001,Critical,192.168.1.1,443,TCP,Vuln A,9.8,Syn A,Desc A,Fix A,Out A
23456,CVE-2024-0002,High,192.168.1.2,80,TCP,Vuln B,7.5,Syn B,Desc B,Fix B,Out B
34567,,None,192.168.1.1,22,TCP,Vuln C,0.0,Syn C,Desc C,N/A,Out C
"""

AUDIT_CSV = b"""Check Name,Status,Description,Policy Value,Actual Value
Password Policy,PASSED,Check password,8 chars,12 chars
Guest Account,FAILED,Disable guest,Disabled,Enabled
Firewall,WARNING,Enable firewall,On,Not set
Telnet,FAILED,Disable telnet,Off,On
"""


class TestNessusParser:
    def test_basic_fields(self):
        result = parse_nessus_csv(NESSUS_CSV, "My Scan", date(2024, 1, 15))
        assert result["name"] == "My Scan"
        assert result["source"] == "nessus_csv"
        assert result["scan_date"] == date(2024, 1, 15)
        assert result["vuln_count"] == 3
        assert result["host_count"] == 2

    def test_risk_none_maps_to_info(self):
        result = parse_nessus_csv(NESSUS_CSV, "Scan")
        risks = {v["plugin_id"]: v["risk"] for v in result["vulnerabilities"]}
        assert risks["12345"] == "Critical"
        assert risks["23456"] == "High"
        assert risks["34567"] == "Info"  # "None" → "Info"

    def test_cvss_parsed_as_float(self):
        result = parse_nessus_csv(NESSUS_CSV, "Scan")
        crit = next(v for v in result["vulnerabilities"] if v["risk"] == "Critical")
        assert crit["cvss"] == 9.8

    def test_cve_extracted(self):
        result = parse_nessus_csv(NESSUS_CSV, "Scan")
        cves = [v["cve"] for v in result["vulnerabilities"] if v.get("cve")]
        assert len(cves) == 2
        assert "CVE-2024-0001" in cves

    def test_no_date_defaults_to_none(self):
        result = parse_nessus_csv(NESSUS_CSV, "Scan")
        assert result["scan_date"] is None

    def test_host_deduplication(self):
        result = parse_nessus_csv(NESSUS_CSV, "Scan")
        # 192.168.1.1 appears twice but host_count should be 2 unique IPs
        assert result["host_count"] == 2


class TestAuditParser:
    def test_counts(self):
        result = parse_audit_csv(AUDIT_CSV, "Audit", date(2024, 3, 1))
        assert result["total"] == 4
        assert result["passed"] == 1
        assert result["failed"] == 2
        assert result["warning"] == 1

    def test_status_mapping(self):
        result = parse_audit_csv(AUDIT_CSV, "Audit")
        by_name = {r["check_name"]: r["status"] for r in result["results"]}
        assert by_name["Password Policy"] == "PASSED"
        assert by_name["Guest Account"] == "FAILED"
        assert by_name["Firewall"] == "WARNING"
        assert by_name["Telnet"] == "FAILED"

    def test_metadata(self):
        result = parse_audit_csv(AUDIT_CSV, "MyAudit", date(2024, 3, 1))
        assert result["name"] == "MyAudit"
        assert result["scan_date"] == date(2024, 3, 1)


class _V:
    """Minimal Vulnerability-like object for diff tests."""
    def __init__(self, plugin_id, cve, host, port):
        self.plugin_id = plugin_id
        self.cve = cve
        self.host = host
        self.port = port


class _A:
    """Minimal AuditResult-like object for diff tests."""
    def __init__(self, check_name, status):
        self.check_name = check_name
        self.status = status
        self.id = id(self)


class TestDiffScans:
    def test_all_new(self):
        result = diff_scans([], [_V("p1", "CVE-1", "10.0.0.1", "443")])
        assert len(result["new"]) == 1
        assert len(result["resolved"]) == 0
        assert len(result["persistent"]) == 0

    def test_all_resolved(self):
        result = diff_scans([_V("p1", "CVE-1", "10.0.0.1", "443")], [])
        assert len(result["new"]) == 0
        assert len(result["resolved"]) == 1
        assert len(result["persistent"]) == 0

    def test_persistent(self):
        v = _V("p1", "CVE-1", "10.0.0.1", "443")
        result = diff_scans([v], [_V("p1", "CVE-1", "10.0.0.1", "443")])
        assert len(result["new"]) == 0
        assert len(result["resolved"]) == 0
        assert len(result["persistent"]) == 1

    def test_mixed(self):
        base = [_V("p1", "CVE-1", "10.0.0.1", "443"), _V("p2", "CVE-2", "10.0.0.2", "80")]
        comp = [_V("p1", "CVE-1", "10.0.0.1", "443"), _V("p3", "CVE-3", "10.0.0.3", "22")]
        result = diff_scans(base, comp)
        assert len(result["new"]) == 1
        assert len(result["resolved"]) == 1
        assert len(result["persistent"]) == 1


class TestDiffAudits:
    def test_new_failure(self):
        result = diff_audits([], [_A("Check1", "FAILED")])
        assert len(result["new_failures"]) == 1
        assert len(result["resolved_failures"]) == 0

    def test_resolved_failure(self):
        result = diff_audits([_A("Check1", "FAILED")], [_A("Check1", "PASSED")])
        assert len(result["new_failures"]) == 0
        assert len(result["resolved_failures"]) == 1

    def test_persistent_failure(self):
        result = diff_audits([_A("Check1", "FAILED")], [_A("Check1", "FAILED")])
        assert len(result["persistent_failures"]) == 1

    def test_passed_not_in_diff(self):
        base = [_A("C1", "PASSED"), _A("C2", "FAILED")]
        comp = [_A("C1", "FAILED"), _A("C2", "PASSED")]
        result = diff_audits(base, comp)
        assert len(result["new_failures"]) == 1   # C1 became failed
        assert len(result["resolved_failures"]) == 1  # C2 resolved
        assert len(result["persistent_failures"]) == 0
