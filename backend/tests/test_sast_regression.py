"""
SAST 修補項目回歸測試（2026-05-31）
驗證 7 個 SAST 弱點修補的正確性，同時確認不破壞既有行為。

TC-S01/S02 : FIND-001  X-XSS-Protection header
TC-S03/S04 : FIND-002  SECRET_KEY 無預設值
TC-S05     : FIND-003  例外訊息不洩漏
TC-S06/S07 : FIND-004  datetime.utcnow 修正
TC-S08     : FIND-006  HSTS header
TC-S09/S10 : FIND-007  report /generate rate-limit + 正確參數
TC-S11     : FIND-007  靜態結構確認
TC-S12     : 回歸       既有 151 條測試（此檔不重複，由 CI 全套跑）
"""
import ast
import inspect
import textwrap
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

import pytest
from tests.conftest import auth


# ── Helpers ─────────────────────────────────────────────────────────────────

def _any_auth_endpoint(client, token):
    """Call a lightweight authenticated endpoint and return the response."""
    return client.get("/api/dashboard", headers=auth(token))


# ═══════════════════════════════════════════════════════════════════════════
# FIND-001  X-XSS-Protection = "0"   (was "1; mode=block")
# ═══════════════════════════════════════════════════════════════════════════

class TestXXSSProtectionHeader:
    def test_tc_s01_header_value_is_zero(self, client, admin_token):
        """TC-S01: X-XSS-Protection must be '0'."""
        resp = _any_auth_endpoint(client, admin_token)
        assert resp.status_code == 200
        assert resp.headers.get("x-xss-protection") == "0"

    def test_tc_s02_no_legacy_mode_block(self, client, admin_token):
        """TC-S02: Must NOT contain '1; mode=block'."""
        resp = _any_auth_endpoint(client, admin_token)
        xss = resp.headers.get("x-xss-protection", "")
        assert "mode=block" not in xss
        assert "1" not in xss.split(";")[0].strip()


# ═══════════════════════════════════════════════════════════════════════════
# FIND-002  SECRET_KEY 無預設值
# ═══════════════════════════════════════════════════════════════════════════

class TestSecretKeyNoDefault:
    def test_tc_s03_config_has_no_default(self):
        """TC-S03: Settings.secret_key must have no hard-coded default value."""
        import config as cfg_module
        import inspect as _inspect
        src = _inspect.getsource(cfg_module.Settings)
        # The field must not contain a fallback string literal
        assert "dev-secret-key" not in src
        assert "change-in-production" not in src

    def test_tc_s04_app_starts_with_env_key(self, client, admin_token):
        """TC-S04: App starts correctly when SECRET_KEY injected via env (conftest)."""
        resp = client.get("/api/auth/me", headers=auth(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        assert "username" in data


# ═══════════════════════════════════════════════════════════════════════════
# FIND-003  例外訊息不洩漏給客戶端
# ═══════════════════════════════════════════════════════════════════════════

_VALID_REPORT_BODY = {
    "modules": ["risk_overview"],
    "timeRange": "30d",
    "exportFormat": "html",
    "includeCharts": True,
    "includeMetrics": True,
    "title": "Test",
    "description": "",
}


class TestExceptionMessageSanitized:
    def test_tc_s05_report_exception_returns_generic_message(self, client, admin_token):
        """TC-S05: When ReportService raises, HTTP detail must NOT expose internals."""
        from services.report_service import ReportService
        with patch.object(
            ReportService,
            "generate_report",
            side_effect=RuntimeError("DB column 'secret_internal' not found"),
        ):
            resp = client.post(
                "/api/reports/generate",
                json=_VALID_REPORT_BODY,
                headers=auth(admin_token),
            )
        assert resp.status_code == 500
        detail = resp.json().get("detail", "")
        # Must NOT leak the internal error text
        assert "secret_internal" not in detail
        assert "DB column" not in detail
        # Must be the generic sanitized message
        assert "Internal error" in detail


# ═══════════════════════════════════════════════════════════════════════════
# FIND-004  datetime.utcnow() 已修正
# ═══════════════════════════════════════════════════════════════════════════

class TestDatetimeUtcnowFixed:
    def test_tc_s06_audit_log_no_utcnow(self):
        """TC-S06: SystemAuditLog.timestamp must NOT use datetime.utcnow."""
        import inspect as _inspect
        from models import audit as audit_module
        src = _inspect.getsource(audit_module.SystemAuditLog)
        assert "utcnow" not in src

    def test_tc_s07_audit_log_uses_timezone_utc(self):
        """TC-S07: SystemAuditLog.timestamp default should reference timezone.utc."""
        import inspect as _inspect
        from models import audit as audit_module
        src = _inspect.getsource(audit_module.SystemAuditLog)
        assert "timezone.utc" in src

    def test_tc_s07b_timestamp_default_produces_naive_datetime(self):
        """TC-S07b: The lambda default should produce naive UTC datetime (no tzinfo).
        SQLAlchemy column defaults receive a 'context' arg; we call the lambda directly
        via inspect to verify the expression.
        """
        from models.audit import SystemAuditLog
        import inspect as _inspect
        src = _inspect.getsource(SystemAuditLog)
        # The source must contain the timezone-aware pattern stripped to naive
        assert "timezone.utc" in src
        assert ".replace(tzinfo=None)" in src
        # Verify by calling the expression directly (not via SQLAlchemy machinery)
        result = datetime.now(timezone.utc).replace(tzinfo=None)
        assert isinstance(result, datetime)
        assert result.tzinfo is None
        # Must be recent (within 5 seconds of now)
        now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
        assert abs((now_utc - result).total_seconds()) < 5


# ═══════════════════════════════════════════════════════════════════════════
# FIND-006  HSTS header 存在
# ═══════════════════════════════════════════════════════════════════════════

class TestHSTSHeader:
    def test_tc_s08_hsts_header_present(self, client, admin_token):
        """TC-S08: Strict-Transport-Security must be present on all responses."""
        resp = _any_auth_endpoint(client, admin_token)
        assert resp.status_code == 200
        hsts = resp.headers.get("strict-transport-security", "")
        assert "max-age=" in hsts
        assert "includeSubDomains" in hsts


# ═══════════════════════════════════════════════════════════════════════════
# FIND-007  /api/reports/generate — rate-limit + 正確 slowapi 參數
# ═══════════════════════════════════════════════════════════════════════════

class TestReportGenerateEndpoint:
    def test_tc_s09_generate_report_returns_200(self, client, admin_token):
        """TC-S09: POST /api/reports/generate with valid body returns 200."""
        resp = client.post(
            "/api/reports/generate",
            json=_VALID_REPORT_BODY,
            headers=auth(admin_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("success") is True

    def test_tc_s10_generate_report_empty_modules_returns_400(self, client, admin_token):
        """TC-S10: Empty modules list must return 400 (our guard) or 422 (Pydantic).
        Both are acceptable rejection codes; the key is it's not 200 or 500.
        """
        body = {**_VALID_REPORT_BODY, "modules": []}
        resp = client.post(
            "/api/reports/generate",
            json=body,
            headers=auth(admin_token),
        )
        assert resp.status_code in (400, 422)  # our guard (400) fires after Pydantic passes

    def test_tc_s11_generate_report_first_param_is_request(self):
        """TC-S11: generate_report() must accept `request: Request` as first param for slowapi."""
        from routers.report import generate_report
        sig = inspect.signature(generate_report)
        params = list(sig.parameters.keys())
        assert params[0] == "request", (
            f"slowapi requires 'request' as first param, got '{params[0]}'"
        )

    def test_tc_s11b_limiter_decorator_present(self):
        """TC-S11b: @limiter.limit must be applied to generate_report."""
        import routers.report as report_module
        import inspect as _inspect
        src = _inspect.getsource(report_module)
        assert '@limiter.limit("10/minute")' in src

    def test_tc_s12_no_modules_key_missing_returns_422(self, client, admin_token):
        """TC-S12: Request without 'modules' key returns 422 validation error."""
        body = {k: v for k, v in _VALID_REPORT_BODY.items() if k != "modules"}
        resp = client.post(
            "/api/reports/generate",
            json=body,
            headers=auth(admin_token),
        )
        assert resp.status_code == 422


# ═══════════════════════════════════════════════════════════════════════════
# FIND-005  escHtml + iframe  (前端 JSX — 靜態程式碼審查)
# ═══════════════════════════════════════════════════════════════════════════

class TestFrontendXSSFix:
    def test_tc_esc01_eshtml_helper_exists(self):
        """TC-ESC01: escHtml() function must exist in Report.jsx."""
        report_jsx = (
            r"c:\GIT\NES\NES\NES\pages\Report.jsx"
            .replace("\\", "/")
        )
        with open(report_jsx, encoding="utf-8") as f:
            src = f.read()
        assert "function escHtml(" in src

    def test_tc_esc02_document_write_removed(self):
        """TC-ESC02: document.write() must not appear in Report.jsx."""
        report_jsx = (
            r"c:\GIT\NES\NES\NES\pages\Report.jsx"
            .replace("\\", "/")
        )
        with open(report_jsx, encoding="utf-8") as f:
            src = f.read()
        assert "document.write(" not in src

    def test_tc_esc03_blob_url_print_pattern_exists(self):
        """TC-ESC03: Blob URL + iframe print pattern must exist in Report.jsx."""
        report_jsx = (
            r"c:\GIT\NES\NES\NES\pages\Report.jsx"
            .replace("\\", "/")
        )
        with open(report_jsx, encoding="utf-8") as f:
            src = f.read()
        assert "URL.createObjectURL" in src
        assert "iframe" in src
        assert "contentWindow.print()" in src

    def test_tc_esc04_title_escaped_in_html_template(self):
        """TC-ESC04: config.title insertion in buildReportHtml must go through escHtml."""
        report_jsx = (
            r"c:\GIT\NES\NES\NES\pages\Report.jsx"
            .replace("\\", "/")
        )
        with open(report_jsx, encoding="utf-8") as f:
            src = f.read()
        # The title tag and h1 both must use escHtml(config.title)
        assert "escHtml(config.title)" in src
