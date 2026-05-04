"""Parse Nessus CSV export into scan + vulnerability records."""
import io
import math
from datetime import date

import pandas as pd

RISK_MAP = {"Critical": "Critical", "High": "High", "Medium": "Medium", "Low": "Low", "None": "Info"}

COL_ALIASES = {
    "plugin_id":                ["Plugin ID", "PluginID", "plugin id"],
    "cve":                      ["CVE", "cve"],
    "risk":                     ["Risk", "Severity", "risk"],
    "risk_factor":              ["Risk Factor", "risk_factor"],
    "stig_severity":            ["STIG Severity", "stig_severity"],
    "host":                     ["Host", "IP Address", "host"],
    "port":                     ["Port", "port"],
    "protocol":                 ["Protocol", "protocol"],
    "name":                     ["Name", "Plugin Name", "name"],
    "synopsis":                 ["Synopsis", "synopsis"],
    "description":              ["Description", "description"],
    "solution":                 ["Solution", "solution"],
    "plugin_output":            ["Plugin Output", "plugin_output"],
    "see_also":                 ["See Also", "see_also"],
    "cvss_v2_base":             ["CVSS v2.0 Base Score", "CVSS v2 Base", "cvss_v2_base"],
    "cvss_v2_temporal":         ["CVSS v2.0 Temporal Score", "CVSS v2 Temporal", "cvss_v2_temporal"],
    "cvss_v3_base":             ["CVSS v3.0 Base Score", "CVSS Base Score", "cvss_base_score", "cvss", "cvss_v3_base"],
    "cvss_v3_temporal":         ["CVSS v3.0 Temporal Score", "CVSS v3 Temporal", "cvss_v3_temporal"],
    "cvss_v4_base":             ["CVSS v4.0 Base Score", "CVSS v4 Base", "cvss_v4_base"],
    "cvss_v4_threat_score":     ["CVSS v4.0 Base+Threat Score", "CVSS v4 Threat", "cvss_v4_threat"],
    "vpr":                      ["VPR Score", "VPR", "vpr_score", "vpr"],
    "epss":                     ["EPSS Score", "EPSS", "epss_score"],
    "bid":                      ["BID", "bid"],
    "xref":                     ["XREF", "xref"],
    "mskb":                     ["MSKB", "mskb"],
    "plugin_publication_date":  ["Plugin Publication Date", "publication_date"],
    "plugin_modification_date": ["Plugin Modification Date", "modification_date"],
    "metasploit":               ["Metasploit", "metasploit"],
    "core_impact":              ["Core Impact", "core_impact"],
    "canvas":                   ["CANVAS", "canvas"],
}

_STR_KEYS = (
    "plugin_id", "cve", "risk_factor", "stig_severity", "host", "port", "protocol",
    "name", "synopsis", "description", "solution", "plugin_output", "see_also",
    "bid", "xref", "mskb",
)


def _find_col(df: pd.DataFrame, key: str) -> str | None:
    for alias in COL_ALIASES.get(key, [key]):
        if alias in df.columns:
            return alias
    return None


def parse_nessus_csv(content: bytes, scan_name: str, scan_date: date | None = None) -> dict:
    """Parse Nessus CSV — fully vectorised, no iterrows."""
    df = pd.read_csv(io.BytesIO(content), low_memory=False)
    df.columns = df.columns.str.strip()

    col_map = {key: _find_col(df, key) for key in COL_ALIASES}

    required = ("risk", "host", "name")
    missing = [k for k in required if not col_map.get(k)]
    if missing:
        raise ValueError(f"Missing required Nessus columns: {', '.join(missing)}")

    # Rename matched alias columns → internal key names
    rename = {
        found: key
        for key, found in col_map.items()
        if found and found != key and found in df.columns
    }
    if rename:
        df = df.rename(columns=rename)

    # Add any keys not present in CSV
    for key in COL_ALIASES:
        if key not in df.columns:
            df[key] = None

    # ── Risk ──────────────────────────────────────────────────────────────────
    raw_risk = df["risk"].astype(str).str.strip()
    df["risk"] = raw_risk.map(RISK_MAP).fillna(raw_risk).where(raw_risk != "nan", "Info").fillna("Info")

    # ── Unique host count ─────────────────────────────────────────────────────
    hosts = set(
        df["host"].dropna()
            .astype(str).str.strip()
            .replace({"nan": None, "": None})
            .dropna()
            .unique()
    )

    # ── Numeric: float 1-decimal ──────────────────────────────────────────────
    for col in ("cvss_v2_base", "cvss_v2_temporal", "cvss_v3_base", "cvss_v3_temporal",
                "cvss_v4_base", "cvss_v4_threat_score", "vpr"):
        df[col] = pd.to_numeric(df[col], errors="coerce").round(1)

    # ── EPSS 3-decimal ────────────────────────────────────────────────────────
    df["epss"] = pd.to_numeric(df["epss"], errors="coerce").round(3)

    # ── Date columns ──────────────────────────────────────────────────────────
    for col in ("plugin_publication_date", "plugin_modification_date"):
        try:
            parsed = pd.to_datetime(df[col], errors="coerce", dayfirst=False, format="mixed")
        except TypeError:
            parsed = pd.to_datetime(df[col], errors="coerce", dayfirst=False)
        df[col] = [d.date() if not pd.isna(d) else None for d in parsed]

    # ── Bool columns ──────────────────────────────────────────────────────────
    for col in ("metasploit", "core_impact", "canvas"):
        df[col] = (
            df[col].astype(str).str.strip().str.lower()
            .isin(["true", "yes", "1", "enabled"])
        )

    # cvss alias for backward compat with scans.py
    df["cvss"] = df["cvss_v3_base"]

    # ── Serialise: NaN → None ─────────────────────────────────────────────────
    vulns = df.where(pd.notnull(df), None).to_dict("records")

    _NUMERIC_KEYS = (
        "cvss_v2_base", "cvss_v2_temporal", "cvss_v3_base", "cvss_v3_temporal",
        "cvss_v4_base", "cvss_v4_threat_score", "vpr", "epss",
    )
    # Clean string fields: strip whitespace, convert 'nan' string → None
    # Clean numeric fields: convert float NaN → None (pandas stores None as NaN in float cols)
    for v in vulns:
        for k in _STR_KEYS:
            val = v.get(k)
            if val is not None:
                s = str(val).strip()
                v[k] = s if s and s.lower() != "nan" else None
        for k in _NUMERIC_KEYS:
            val = v.get(k)
            if isinstance(val, float) and math.isnan(val):
                v[k] = None

    return {
        "name": scan_name,
        "source": "nessus_csv",
        "scan_date": scan_date,
        "host_count": len(hosts),
        "vuln_count": len(vulns),
        "vulnerabilities": vulns,
    }
