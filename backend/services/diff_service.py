"""Compute diff between two scan records."""
from models.scan import Vulnerability
from models.audit import AuditResult


def _vuln_key(v: Vulnerability) -> str:
    return f"{v.plugin_id or ''}|{v.cve or ''}|{v.host or ''}|{v.port or ''}"


def diff_scans(
    base_vulns: list[Vulnerability],
    compare_vulns: list[Vulnerability],
) -> dict:
    base_map = {_vuln_key(v): v for v in base_vulns}
    comp_map = {_vuln_key(v): v for v in compare_vulns}

    base_keys = set(base_map)
    comp_keys = set(comp_map)

    return {
        "new": [comp_map[k] for k in comp_keys - base_keys],
        "resolved": [base_map[k] for k in base_keys - comp_keys],
        "persistent": [comp_map[k] for k in base_keys & comp_keys],
    }


def _audit_key(r: AuditResult) -> str:
    # Fall back to "" so unnamed checks from different scans can still match
    return r.check_name or ""


def diff_audits(
    base_results: list[AuditResult],
    compare_results: list[AuditResult],
) -> dict:
    base_failed = {_audit_key(r): r for r in base_results if r.status == "FAILED"}
    comp_failed = {_audit_key(r): r for r in compare_results if r.status == "FAILED"}

    base_keys = set(base_failed)
    comp_keys = set(comp_failed)

    return {
        "new_failures": [comp_failed[k] for k in comp_keys - base_keys],
        "resolved_failures": [base_failed[k] for k in base_keys - comp_keys],
        "persistent_failures": [comp_failed[k] for k in base_keys & comp_keys],
    }
