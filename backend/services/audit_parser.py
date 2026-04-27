"""Parse Nessus Audit CSV export into audit scan + result records."""
import io
from datetime import date

import pandas as pd

STATUS_MAP = {
    "PASSED": "PASSED",
    "FAILED": "FAILED",
    "WARNING": "WARNING",
    "ERROR": "WARNING",
    "SKIPPED": "WARNING",
}


def parse_audit_csv(content: bytes, scan_name: str, scan_date: date | None = None) -> dict:
    df = pd.read_csv(io.BytesIO(content))
    df.columns = df.columns.str.strip()

    def col(candidates: list[str]) -> str | None:
        for c in candidates:
            if c in df.columns:
                return c
        return None

    check_col = col(["Check Name", "check_name", "Name", "Plugin Name"])
    status_col = col(["Status", "Result", "status"])
    desc_col = col(["Description", "description"])
    policy_col = col(["Policy Value", "Expected Value", "policy_value"])
    actual_col = col(["Actual Value", "actual_value"])

    results = []
    for _, row in df.iterrows():
        def g(c, _row=row):
            if c is None:
                return None
            val = _row.get(c)
            return None if pd.isna(val) else str(val).strip()

        raw_status = g(status_col) or ""
        status = STATUS_MAP.get(raw_status.upper(), "WARNING")

        results.append({
            "check_name": g(check_col),
            "status": status,
            "description": g(desc_col),
            "policy_val": g(policy_col),
            "actual_val": g(actual_col),
        })

    passed = sum(1 for r in results if r["status"] == "PASSED")
    failed = sum(1 for r in results if r["status"] == "FAILED")
    warning = sum(1 for r in results if r["status"] == "WARNING")

    return {
        "name": scan_name,
        "scan_date": scan_date,
        "total": len(results),
        "passed": passed,
        "failed": failed,
        "warning": warning,
        "results": results,
    }
