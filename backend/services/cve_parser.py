"""Parse NVD CVE JSON feed (2.0 format) into scan + vulnerability records."""
import json
from datetime import date


def parse_nvd_json(content: bytes, scan_name: str, scan_date: date | None = None) -> dict:
    data = json.loads(content)

    # Support both NVD JSON 1.1 and 2.0 formats
    items = []
    if "vulnerabilities" in data:
        # NVD JSON 2.0
        items = data["vulnerabilities"]
    elif "CVE_Items" in data:
        # NVD JSON 1.1
        items = data["CVE_Items"]

    vulns = []
    for item in items:
        cve_obj = item.get("cve", item)
        cve_id = cve_obj.get("id") or cve_obj.get("CVE_data_meta", {}).get("ID", "")

        # Description
        descs = (
            cve_obj.get("descriptions", [])
            or cve_obj.get("description", {}).get("description_data", [])
        )
        description = next(
            (d.get("value", "") for d in descs if d.get("lang") in ("en", "eng")), ""
        )

        # CVSS score
        cvss = None
        metrics = cve_obj.get("metrics", {})
        for key in ("cvssMetricV31", "cvssMetricV30", "cvssMetricV2"):
            entries = metrics.get(key, [])
            if entries:
                cvss_data = entries[0].get("cvssData", entries[0].get("cvss", {}))
                raw = cvss_data.get("baseScore") or cvss_data.get("score")
                if raw is not None:
                    cvss = round(float(raw), 1)
                break

        risk = _cvss_to_risk(cvss)

        vulns.append({
            "plugin_id": None,
            "cve": cve_id,
            "risk": risk,
            "host": None,
            "port": None,
            "protocol": None,
            "name": cve_id,
            "cvss": cvss,
            "cvss_v3_base": cvss,
            "synopsis": description[:300] if description else None,
            "description": description,
            "solution": None,
            "plugin_output": None,
        })

    return {
        "name": scan_name,
        "source": "nvd_json",
        "scan_date": scan_date,
        "host_count": 0,
        "vuln_count": len(vulns),
        "vulnerabilities": vulns,
    }


def _cvss_to_risk(cvss: float | None) -> str:
    if cvss is None:
        return "Info"
    if cvss >= 9.0:
        return "Critical"
    if cvss >= 7.0:
        return "High"
    if cvss >= 4.0:
        return "Medium"
    if cvss > 0:
        return "Low"
    return "Info"
