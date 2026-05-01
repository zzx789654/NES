"""Parse Nessus CSV export into scan + vulnerability records."""
import io
from datetime import date, datetime

import pandas as pd

RISK_MAP = {"Critical": "Critical", "High": "High", "Medium": "Medium", "Low": "Low", "None": "Info"}

# Expected Nessus CSV column names (case-insensitive match with aliases)
COL_ALIASES = {
    # 基本識別
    "plugin_id": ["Plugin ID", "PluginID", "plugin id"],
    "cve": ["CVE", "cve"],
    
    # 風險與評分
    "risk": ["Risk", "Severity", "risk"],
    "risk_factor": ["Risk Factor", "risk_factor"],
    "stig_severity": ["STIG Severity", "stig_severity"],
    
    # 位置
    "host": ["Host", "IP Address", "host"],
    "port": ["Port", "port"],
    "protocol": ["Protocol", "protocol"],
    
    # 外掛信息
    "name": ["Name", "Plugin Name", "name"],
    "synopsis": ["Synopsis", "synopsis"],
    "description": ["Description", "description"],
    "solution": ["Solution", "solution"],
    "plugin_output": ["Plugin Output", "plugin_output"],
    "see_also": ["See Also", "see_also"],
    
    # CVSS 評分 - 多版本
    "cvss_v2_base": ["CVSS v2.0 Base Score", "CVSS v2 Base", "cvss_v2_base"],
    "cvss_v2_temporal": ["CVSS v2.0 Temporal Score", "CVSS v2 Temporal", "cvss_v2_temporal"],
    "cvss_v3_base": ["CVSS v3.0 Base Score", "CVSS Base Score", "cvss_base_score", "cvss", "cvss_v3_base"],
    "cvss_v3_temporal": ["CVSS v3.0 Temporal Score", "CVSS v3 Temporal", "cvss_v3_temporal"],
    "cvss_v4_base": ["CVSS v4.0 Base Score", "CVSS v4 Base", "cvss_v4_base"],
    "cvss_v4_threat_score": ["CVSS v4.0 Base+Threat Score", "CVSS v4 Threat", "cvss_v4_threat"],
    
    # 風險指標
    "vpr": ["VPR Score", "VPR", "vpr_score", "vpr"],
    "epss": ["EPSS Score", "EPSS", "epss_score"],
    
    # 參考信息
    "bid": ["BID", "bid"],
    "xref": ["XREF", "xref"],
    "mskb": ["MSKB", "mskb"],
    
    # 元數據
    "plugin_publication_date": ["Plugin Publication Date", "publication_date"],
    "plugin_modification_date": ["Plugin Modification Date", "modification_date"],
    
    # 利用方式
    "metasploit": ["Metasploit", "metasploit"],
    "core_impact": ["Core Impact", "core_impact"],
    "canvas": ["CANVAS", "canvas"],
}


def _find_col(df: pd.DataFrame, key: str) -> str | None:
    """查找 CSV 中的列（支持多個別名）"""
    for alias in COL_ALIASES.get(key, [key]):
        if alias in df.columns:
            return alias
    return None


def _parse_bool(val) -> bool | None:
    """轉換布林值"""
    if pd.isna(val):
        return None
    val_str = str(val).strip().lower()
    if val_str in ("true", "yes", "1", "enabled"):
        return True
    elif val_str in ("false", "no", "0", "disabled", ""):
        return False
    return None


def _parse_float(val, decimals: int = 1) -> float | None:
    """轉換浮點數"""
    if pd.isna(val):
        return None
    try:
        return round(float(str(val).strip()), decimals)
    except (ValueError, TypeError):
        return None


def _parse_date(val) -> date | None:
    """轉換日期"""
    if pd.isna(val):
        return None
    val_str = str(val).strip()
    if not val_str:
        return None
    
    # 支持多個日期格式
    formats = ["%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d"]
    for fmt in formats:
        try:
            return datetime.strptime(val_str, fmt).date()
        except ValueError:
            continue
    return None


def parse_nessus_csv(content: bytes, scan_name: str, scan_date: date | None = None) -> dict:
    """解析 Nessus CSV 導出"""
    df = pd.read_csv(io.BytesIO(content))
    df.columns = df.columns.str.strip()

    col_map = {key: _find_col(df, key) for key in COL_ALIASES}

    vulns = []
    hosts = set()

    for _, row in df.iterrows():
        def g(key, _row=row):
            """獲取欄位值"""
            col = col_map.get(key)
            val = _row.get(col, None) if col else None
            return None if pd.isna(val) else str(val).strip()

        # 基本欄位
        risk_raw = g("risk") or "Info"
        risk = RISK_MAP.get(risk_raw, risk_raw)

        host = g("host")
        if host:
            hosts.add(host)

        # 數值欄位 - CVSS 評分
        cvss_v2_base = _parse_float(g("cvss_v2_base"))
        cvss_v2_temporal = _parse_float(g("cvss_v2_temporal"))
        cvss_v3_base = _parse_float(g("cvss_v3_base"))
        cvss_v3_temporal = _parse_float(g("cvss_v3_temporal"))
        cvss_v4_base = _parse_float(g("cvss_v4_base"))
        cvss_v4_threat = _parse_float(g("cvss_v4_threat_score"))
        
        # 風險指標
        vpr = _parse_float(g("vpr"))
        epss = _parse_float(g("epss"), decimals=4)
        
        # 日期欄位
        pub_date = _parse_date(g("plugin_publication_date"))
        mod_date = _parse_date(g("plugin_modification_date"))
        
        # 布林欄位
        metasploit = _parse_bool(g("metasploit")) or False
        core_impact = _parse_bool(g("core_impact")) or False
        canvas = _parse_bool(g("canvas")) or False

        vulns.append({
            # 基本識別
            "plugin_id": g("plugin_id"),
            "cve": g("cve"),
            
            # 風險分類
            "risk": risk,
            "risk_factor": g("risk_factor"),
            "stig_severity": g("stig_severity"),
            
            # 位置信息
            "host": host,
            "port": g("port"),
            "protocol": g("protocol"),
            
            # 外掛信息
            "name": g("name"),
            "synopsis": g("synopsis"),
            "description": g("description"),
            "solution": g("solution"),
            "plugin_output": g("plugin_output"),
            "see_also": g("see_also"),
            
            # CVSS 評分
            "cvss_v2_base": cvss_v2_base,
            "cvss_v2_temporal": cvss_v2_temporal,
            "cvss_v3_base": cvss_v3_base,
            "cvss": cvss_v3_base,
            "cvss_v3_temporal": cvss_v3_temporal,
            "cvss_v4_base": cvss_v4_base,
            "cvss_v4_threat_score": cvss_v4_threat,
            
            # 風險指標
            "vpr": vpr,
            "epss": epss,
            
            # 參考信息
            "bid": g("bid"),
            "xref": g("xref"),
            "mskb": g("mskb"),
            
            # 元數據
            "plugin_publication_date": pub_date,
            "plugin_modification_date": mod_date,
            
            # 利用方式
            "metasploit": metasploit,
            "core_impact": core_impact,
            "canvas": canvas,
        })

    return {
        "name": scan_name,
        "source": "nessus_csv",
        "scan_date": scan_date,
        "host_count": len(hosts),
        "vuln_count": len(vulns),
        "vulnerabilities": vulns,
    }
