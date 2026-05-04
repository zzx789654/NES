"""Fetch EPSS scores from FIRST.org API."""
import httpx

EPSS_API = "https://api.first.org/data/1.0/epss"


async def fetch_epss_scores(cves: list[str]) -> dict[str, float]:
    """Return {cve_id: epss_score} for given CVEs. Silently skips on error."""
    if not cves:
        return {}

    valid = [c for c in cves if c and c.upper().startswith("CVE-")]
    if not valid:
        return {}

    results: dict[str, float] = {}
    chunk_size = 100
    # Use a short connect timeout + per-request timeout to avoid blocking uploads
    timeout = httpx.Timeout(connect=5.0, read=10.0, write=5.0, pool=5.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        for i in range(0, len(valid), chunk_size):
            chunk = valid[i : i + chunk_size]
            params = {"cve": ",".join(chunk)}
            try:
                resp = await client.get(EPSS_API, params=params)
                resp.raise_for_status()
                data = resp.json().get("data", [])
                for item in data:
                    cve_id = item.get("cve", "")
                    epss = item.get("epss")
                    if cve_id and epss is not None:
                        results[cve_id.upper()] = round(float(epss), 4)
            except Exception:
                pass  # EPSS enrichment is best-effort

    return results
