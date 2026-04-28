"""Parse Nessus CSV export into scan + vulnerability records."""
import io
from datetime import date

import pandas as pd

RISK_MAP = {"Critical": "Critical", "High": "High", "Medium": "Medium", "Low": "Low", "None": "Info"}

# Expected Nessus CSV column names (case-insensitive match)
COL_ALIASES = {
    "plugin_id": ["Plugin ID", "PluginID", "plugin id"],
    "cve": ["CVE", "cve"],
    "risk": ["Risk", "Severity", "risk"],
    "host": ["Host", "IP Address", "host"],
    "port": ["Port", "port"],
    "protocol": ["Protocol", "protocol"],
    "name": ["Name", "Plugin Name", "name"],
    "cvss": ["CVSS v3.0 Base Score", "CVSS Base Score", "cvss_base_score", "cvss"],
    "vpr": ["VPR Score", "VPR", "vpr_score", "vpr"],
    "synopsis": ["Synopsis", "synopsis"],
    "description": ["Description", "description"],
    "solution": ["Solution", "solution"],
    "plugin_output": ["Plugin Output", "plugin_output"],
}


def _find_col(df: pd.DataFrame, key: str) -> str | None:
    for alias in COL_ALIASES.get(key, [key]):
        if alias in df.columns:
            return alias
    return None


def parse_nessus_csv(content: bytes, scan_name: str, scan_date: date | None = None) -> dict:
    df = pd.read_csv(io.BytesIO(content))
    df.columns = df.columns.str.strip()

    col_map = {key: _find_col(df, key) for key in COL_ALIASES}
    required = ("risk", "host", "name")
    missing = [k for k in required if not col_map.get(k)]
    if missing:
        raise ValueError(f"Missing required Nessus columns: {', '.join(missing)}")

    vulns = []
    hosts = set()

    for _, row in df.iterrows():
        def g(key, _row=row):
            col = col_map.get(key)
            val = _row.get(col, None) if col else None
            return None if pd.isna(val) else str(val).strip()

        risk_raw = g("risk") or "Info"
        risk = RISK_MAP.get(risk_raw, risk_raw)

        host = g("host")
        if host:
            hosts.add(host)

        cvss_raw = g("cvss")
        cvss = None
        if cvss_raw:
            try:
                cvss = round(float(cvss_raw), 1)
            except ValueError:
                pass

        vpr_raw = g("vpr")
        vpr = None
        if vpr_raw:
            try:
                vpr = round(float(vpr_raw), 1)
            except ValueError:
                pass

        vulns.append({
            "plugin_id": g("plugin_id"),
            "cve": g("cve"),
            "risk": risk,
            "host": host,
            "port": g("port"),
            "protocol": g("protocol"),
            "name": g("name"),
            "cvss": cvss,
            "vpr": vpr,
            "synopsis": g("synopsis"),
            "description": g("description"),
            "solution": g("solution"),
            "plugin_output": g("plugin_output"),
        })

    return {
        "name": scan_name,
        "source": "nessus_csv",
        "scan_date": scan_date,
        "host_count": len(hosts),
        "vuln_count": len(vulns),
        "vulnerabilities": vulns,
    }
