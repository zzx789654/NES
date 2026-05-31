"""QA Round-1 coverage supplement tests (TC-301 ~ TC-342)."""
import io
import json
import asyncio
from datetime import date, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.conftest import auth

# ─────────────────────────────────────────────
# Helpers / fixtures
# ─────────────────────────────────────────────

NVD_JSON_20 = json.dumps({
    "vulnerabilities": [
        {
            "cve": {
                "id": "CVE-2024-1111",
                "descriptions": [{"lang": "en", "value": "A" * 400}],
                "metrics": {
                    "cvssMetricV31": [{"cvssData": {"baseScore": 9.8}}]
                },
            }
        }
    ]
}).encode()

NVD_JSON_11 = json.dumps({
    "CVE_Items": [
        {
            "cve": {
                "CVE_data_meta": {"ID": "CVE-2019-0001"},
                "description": {"description_data": [{"lang": "en", "value": "old format"}]},
                "metrics": {
                    "cvssMetricV2": [{"cvss": {"score": 7.5}}]
                },
            }
        }
    ]
}).encode()

_EPSS_MOCK = {"CVE-2024-0001": 0.9}

NESSUS_CSV = b"""Plugin ID,CVE,Risk,Host,Port,Protocol,Name,CVSS v3.0 Base Score,Synopsis,Description,Solution,Plugin Output
12345,CVE-2024-0001,Critical,192.168.1.1,443,TCP,Vuln A,9.8,Synopsis A,Desc A,Fix A,Out A
"""


def _upload_csv(client, token):
    with patch("routers.scans.fetch_epss_scores", new=AsyncMock(return_value=_EPSS_MOCK)):
        return client.post(
            "/api/scans/upload",
            data={"name": "S1", "scan_date": "2024-01-15"},
            files={"file": ("scan.csv", io.BytesIO(NESSUS_CSV), "text/csv")},
            headers=auth(token),
        )


def _upload_json(client, token, content=None, filename="nvd.json"):
    if content is None:
        content = NVD_JSON_20
    with patch("routers.scans.fetch_epss_scores", new=AsyncMock(return_value={})):
        return client.post(
            "/api/scans/upload",
            data={"name": "NVD Scan"},
            files={"file": (filename, io.BytesIO(content), "application/json")},
            headers=auth(token),
        )


# ─────────────────────────────────────────────
# TC-301~308  services/cve_parser.py
# ─────────────────────────────────────────────

class TestCveParser:
    def test_nvd_json_20_parse(self):
        from services.cve_parser import parse_nvd_json
        result = parse_nvd_json(NVD_JSON_20, "scan1")
        assert result["vuln_count"] == 1
        v = result["vulnerabilities"][0]
        assert v["cve"] == "CVE-2024-1111"
        assert v["risk"] == "Critical"
        assert v["cvss"] == 9.8

    def test_nvd_json_11_parse(self):
        from services.cve_parser import parse_nvd_json
        result = parse_nvd_json(NVD_JSON_11, "scan2")
        assert result["vuln_count"] == 1
        v = result["vulnerabilities"][0]
        assert v["cve"] == "CVE-2019-0001"
        assert v["risk"] == "High"

    def test_cvss_v30_fallback(self):
        from services.cve_parser import parse_nvd_json
        data = json.dumps({
            "vulnerabilities": [{
                "cve": {
                    "id": "CVE-2024-V30",
                    "descriptions": [],
                    "metrics": {
                        "cvssMetricV30": [{"cvssData": {"baseScore": 7.2}}]
                    },
                }
            }]
        }).encode()
        result = parse_nvd_json(data, "s")
        assert result["vulnerabilities"][0]["cvss"] == 7.2

    def test_cvss_v2_fallback(self):
        from services.cve_parser import parse_nvd_json
        data = json.dumps({
            "vulnerabilities": [{
                "cve": {
                    "id": "CVE-2024-V2",
                    "descriptions": [],
                    "metrics": {
                        "cvssMetricV2": [{"cvssData": {"baseScore": 5.0}}]
                    },
                }
            }]
        }).encode()
        result = parse_nvd_json(data, "s")
        assert result["vulnerabilities"][0]["cvss"] == 5.0

    def test_no_metrics_risk_info(self):
        from services.cve_parser import parse_nvd_json
        data = json.dumps({
            "vulnerabilities": [{
                "cve": {"id": "CVE-2024-NOMET", "descriptions": [], "metrics": {}}
            }]
        }).encode()
        v = parse_nvd_json(data, "s")["vulnerabilities"][0]
        assert v["cvss"] is None
        assert v["risk"] == "Info"

    def test_cvss_to_risk_boundaries(self):
        from services.cve_parser import _cvss_to_risk
        assert _cvss_to_risk(None) == "Info"
        assert _cvss_to_risk(0.0) == "Info"
        assert _cvss_to_risk(0.1) == "Low"
        assert _cvss_to_risk(4.0) == "Medium"
        assert _cvss_to_risk(7.0) == "High"
        assert _cvss_to_risk(9.0) == "Critical"

    def test_description_truncated_at_300(self):
        from services.cve_parser import parse_nvd_json
        long_desc = "X" * 500
        data = json.dumps({
            "vulnerabilities": [{
                "cve": {
                    "id": "CVE-2024-LONG",
                    "descriptions": [{"lang": "en", "value": long_desc}],
                    "metrics": {},
                }
            }]
        }).encode()
        v = parse_nvd_json(data, "s")["vulnerabilities"][0]
        assert len(v["synopsis"]) == 300

    def test_empty_vulnerabilities(self):
        from services.cve_parser import parse_nvd_json
        data = json.dumps({"vulnerabilities": []}).encode()
        result = parse_nvd_json(data, "empty")
        assert result["vuln_count"] == 0
        assert result["vulnerabilities"] == []


# ─────────────────────────────────────────────
# TC-309~313  services/epss_service.py
# ─────────────────────────────────────────────

class TestEpssService:
    def test_empty_list_returns_empty(self):
        from services.epss_service import fetch_epss_scores
        result = asyncio.run(fetch_epss_scores([]))
        assert result == {}

    def test_non_cve_prefix_filtered(self):
        from services.epss_service import fetch_epss_scores
        result = asyncio.run(fetch_epss_scores(["NOTCVE-1234", "random", ""]))
        assert result == {}

    def test_normal_fetch(self):
        from services.epss_service import fetch_epss_scores
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {
            "data": [{"cve": "cve-2024-0001", "epss": "0.95432"}]
        }
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("services.epss_service.httpx.AsyncClient", return_value=mock_client):
            result = asyncio.run(fetch_epss_scores(["CVE-2024-0001"]))
        assert result == {"CVE-2024-0001": 0.954}

    def test_http_exception_silently_ignored(self):
        from services.epss_service import fetch_epss_scores
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=Exception("network error"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("services.epss_service.httpx.AsyncClient", return_value=mock_client):
            result = asyncio.run(fetch_epss_scores(["CVE-2024-0001"]))
        assert result == {}

    def test_over_100_cves_batched(self):
        from services.epss_service import fetch_epss_scores
        cves = [f"CVE-2024-{i:04d}" for i in range(150)]
        call_count = 0

        async def _mock_get(url, **kwargs):
            nonlocal call_count
            call_count += 1
            m = MagicMock()
            m.raise_for_status = MagicMock()
            m.json.return_value = {"data": []}
            return m

        mock_client = AsyncMock()
        mock_client.get = _mock_get
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("services.epss_service.httpx.AsyncClient", return_value=mock_client):
            asyncio.run(fetch_epss_scores(cves))

        assert call_count == 2  # 150 CVEs → 2 batches of 100/50


# ─────────────────────────────────────────────
# TC-314  models/verify_matrix_flow.py
# ─────────────────────────────────────────────

def test_matrix_data_flow_verification():
    from models.verify_matrix_flow import test_matrix_data_parsing_verification
    test_matrix_data_parsing_verification()


# ─────────────────────────────────────────────
# TC-315~321  routers/auth.py
# ─────────────────────────────────────────────

class TestAuthRouterCoverage:
    def test_list_users_admin(self, client, db, admin_token):
        from tests.conftest import _seed_user
        _seed_user(db, "other", "Other@pass1!", "viewer")
        resp = client.get("/api/auth/users", headers=auth(admin_token))
        assert resp.status_code == 200
        names = [u["username"] for u in resp.json()]
        assert "admin" in names
        assert "other" in names

    def test_delete_other_user(self, client, db, admin_token):
        from tests.conftest import _seed_user
        _seed_user(db, "todelete", "Todel@pass1!", "viewer")
        resp = client.get("/api/auth/users", headers=auth(admin_token))
        uid = next(u["id"] for u in resp.json() if u["username"] == "todelete")
        resp = client.delete(f"/api/auth/users/{uid}", headers=auth(admin_token))
        assert resp.status_code == 204

    def test_delete_self_forbidden(self, client, db, admin_token):
        resp = client.get("/api/auth/me", headers=auth(admin_token))
        uid = resp.json()["id"]
        resp = client.delete(f"/api/auth/users/{uid}", headers=auth(admin_token))
        assert resp.status_code == 400

    def test_delete_nonexistent_user(self, client, admin_token):
        resp = client.delete("/api/auth/users/99999", headers=auth(admin_token))
        assert resp.status_code == 404

    def test_put_password_admin_changes_other(self, client, db, admin_token):
        from tests.conftest import _seed_user
        _seed_user(db, "u2", "User2@pass1!", "viewer")
        resp = client.get("/api/auth/users", headers=auth(admin_token))
        uid = next(u["id"] for u in resp.json() if u["username"] == "u2")
        resp = client.put(
            f"/api/auth/users/{uid}/password",
            json={"new_password": "NewPass@999"},
            headers=auth(admin_token),
        )
        assert resp.status_code == 204

    def test_put_password_non_admin_other_forbidden(self, client, db, admin_token, viewer_token):
        resp = client.get("/api/auth/users", headers=auth(admin_token))
        uid = next(u["id"] for u in resp.json() if u["username"] == "admin")
        resp = client.put(
            f"/api/auth/users/{uid}/password",
            json={"new_password": "NewPass@999"},
            headers=auth(viewer_token),
        )
        assert resp.status_code == 403

    def test_put_password_user_changes_own(self, client, db, viewer_token):
        resp = client.get("/api/auth/me", headers=auth(viewer_token))
        uid = resp.json()["id"]
        resp = client.put(
            f"/api/auth/users/{uid}/password",
            json={"new_password": "NewPass@999"},
            headers=auth(viewer_token),
        )
        assert resp.status_code == 204


# ─────────────────────────────────────────────
# TC-322~328  schemas/auth.py validators
# ─────────────────────────────────────────────

class TestAuthSchemaValidators:
    def _register(self, client, admin_token, username, password, role="viewer"):
        return client.post(
            "/api/auth/register",
            json={"username": username, "password": password, "role": role},
            headers=auth(admin_token),
        )

    def test_username_too_short(self, client, admin_token):
        resp = self._register(client, admin_token, "ab", "Valid@pass1!")
        assert resp.status_code == 422

    def test_username_too_long(self, client, admin_token):
        resp = self._register(client, admin_token, "a" * 51, "Valid@pass1!")
        assert resp.status_code == 422

    def test_username_special_chars(self, client, admin_token):
        resp = self._register(client, admin_token, "user@name", "Valid@pass1!")
        assert resp.status_code == 422

    def test_password_no_uppercase(self, client, admin_token):
        resp = self._register(client, admin_token, "testuser1", "nouppercase1!")
        assert resp.status_code == 422

    def test_password_no_digit(self, client, admin_token):
        resp = self._register(client, admin_token, "testuser2", "NoDigit!!")
        assert resp.status_code == 422

    def test_password_no_special(self, client, admin_token):
        resp = self._register(client, admin_token, "testuser3", "NoSpecial1")
        assert resp.status_code == 422

    def test_change_password_weak(self, client, viewer_token):
        resp = client.post(
            "/api/auth/change-password",
            json={"current_password": "viewerpass", "new_password": "weak"},
            headers=auth(viewer_token),
        )
        assert resp.status_code == 422


# ─────────────────────────────────────────────
# TC-329~331  schemas/ipgroup.py normalize_ips
# ─────────────────────────────────────────────

class TestIPGroupSchema:
    def test_ips_none_normalized(self):
        from schemas.ipgroup import IPGroupOut
        obj = IPGroupOut.model_validate({"id": 1, "name": "g", "ips": None, "created_at": None})
        assert obj.ips == []

    def test_ips_json_string_parsed(self):
        from schemas.ipgroup import IPGroupOut
        obj = IPGroupOut.model_validate({
            "id": 1, "name": "g",
            "ips": '["10.0.0.1","10.0.0.2"]',
            "created_at": None,
        })
        assert obj.ips == ["10.0.0.1", "10.0.0.2"]

    def test_ips_non_json_string_wrapped(self):
        from schemas.ipgroup import IPGroupOut
        obj = IPGroupOut.model_validate({
            "id": 1, "name": "g", "ips": "10.0.0.1", "created_at": None,
        })
        assert obj.ips == ["10.0.0.1"]


# ─────────────────────────────────────────────
# TC-332~337  services/report_service.py
# ─────────────────────────────────────────────

class TestReportService:
    def _seed_scan_with_vulns(self, db):
        from models.scan import Scan, Vulnerability
        scan = Scan(
            name="RS1",
            source="nessus_csv",
            scan_date=date(2024, 1, 1),
            host_count=1,
            vuln_count=3,
        )
        db.add(scan)
        db.commit()
        db.refresh(scan)
        for risk in ["Critical", "High", "fixed"]:
            v = Vulnerability(
                scan_id=scan.id,
                plugin_id=1,
                risk="Critical" if risk != "fixed" else "High",
                host="10.0.0.1",
                name="V",
                status="fixed" if risk == "fixed" else "open",
            )
            db.add(v)
        db.commit()
        return scan

    def _seed_audit(self, db):
        from models.audit import AuditScan
        audit = AuditScan(
            name="A1",
            scan_date=date(2024, 1, 1),
            total=10,
            passed=8,
            failed=1,
            warning=1,
        )
        db.add(audit)
        db.commit()
        return audit

    def _seed_system_audit_log(self, db):
        from models.audit import SystemAuditLog
        log_ok = SystemAuditLog(
            action="GET_scans", resource="/api/scans", status_code=200,
            user_id=1,
            timestamp=datetime(2024, 1, 10),
        )
        log_err = SystemAuditLog(
            action="POST_scans", resource="/api/scans", status_code=403,
            user_id=1,
            timestamp=datetime(2024, 1, 10),
        )
        db.add_all([log_ok, log_err])
        db.commit()

    def test_get_risk_stats(self, db):
        from services.report_service import ReportService
        self._seed_scan_with_vulns(db)
        start = datetime(2023, 1, 1)
        end = datetime(2025, 1, 1)
        stats = ReportService.get_risk_stats(db, start, end)
        assert stats is not None
        assert stats.critical == 2

    def test_get_compliance_stats(self, db):
        from services.report_service import ReportService
        self._seed_audit(db)
        start = datetime(2023, 1, 1)
        end = datetime(2025, 1, 1)
        stats = ReportService.get_compliance_stats(db, start, end)
        assert stats is not None
        assert stats.pass_rate == 80.0

    def test_get_scan_efficiency_stats(self, db):
        from services.report_service import ReportService
        self._seed_scan_with_vulns(db)
        stats = ReportService.get_scan_efficiency_stats(
            db, datetime(2023, 1, 1), datetime(2025, 1, 1)
        )
        assert stats is not None
        assert stats.scan_count == 1
        assert stats.vulnerability_count == 3

    def test_get_remediation_stats(self, db):
        from services.report_service import ReportService
        self._seed_scan_with_vulns(db)
        stats = ReportService.get_remediation_stats(
            db, datetime(2023, 1, 1), datetime(2025, 1, 1)
        )
        assert stats is not None
        assert stats.remediation_rate == pytest.approx(33.3, abs=0.2)

    def test_get_audit_stats(self, db):
        from services.report_service import ReportService
        self._seed_system_audit_log(db)
        stats = ReportService.get_audit_stats(
            db, datetime(2024, 1, 1), datetime(2024, 12, 31)
        )
        assert stats.operation_count == 2
        assert stats.anomaly_count == 1

    def test_get_date_range_variants(self):
        from services.report_service import ReportService
        s7, e7 = ReportService._get_date_range("7d", None, None)
        assert (e7 - s7).days == 7

        s90, e90 = ReportService._get_date_range("90d", None, None)
        assert (e90 - s90).days == 90

        sc, ec = ReportService._get_date_range(
            "custom", "2024-01-01", "2024-06-30"
        )
        assert sc == datetime(2024, 1, 1)
        assert ec == datetime(2024, 6, 30)

        sd, ed = ReportService._get_date_range("invalid", None, None)
        assert (ed - sd).days == 30


# ─────────────────────────────────────────────
# TC-338~342  routers/scans.py coverage
# ─────────────────────────────────────────────

class TestScanRouterCoverage:
    def test_get_vuln_detail_success(self, client, db, admin_token):
        resp = _upload_csv(client, admin_token)
        assert resp.status_code == 201
        scan_id = resp.json()["id"]
        resp = client.get(f"/api/scans/{scan_id}/vulns", headers=auth(admin_token))
        vuln_id = resp.json()["items"][0]["id"]
        resp = client.get(f"/api/scans/{scan_id}/vulns/{vuln_id}", headers=auth(admin_token))
        assert resp.status_code == 200
        assert resp.json()["id"] == vuln_id

    def test_get_vuln_detail_not_found(self, client, db, admin_token):
        resp = _upload_csv(client, admin_token)
        scan_id = resp.json()["id"]
        resp = client.get(f"/api/scans/{scan_id}/vulns/99999", headers=auth(admin_token))
        assert resp.status_code == 404

    def test_upload_nvd_json(self, client, admin_token):
        resp = _upload_json(client, admin_token)
        assert resp.status_code == 201
        assert resp.json()["name"] == "NVD Scan"

    def test_upload_too_large(self, client, admin_token):
        big = b"a" * (51 * 1024 * 1024)
        with patch("routers.scans.fetch_epss_scores", new=AsyncMock(return_value={})):
            resp = client.post(
                "/api/scans/upload",
                data={"name": "Big"},
                files={"file": ("big.csv", io.BytesIO(big), "text/csv")},
                headers=auth(admin_token),
            )
        assert resp.status_code == 413

    def test_upload_invalid_json_content(self, client, admin_token):
        resp = _upload_json(client, admin_token, content=b"not json at all {{}}", filename="bad.json")
        assert resp.status_code == 400
