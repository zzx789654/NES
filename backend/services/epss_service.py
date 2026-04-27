"""Fetch EPSS scores from FIRST.org API."""
import logging

import httpx

logger = logging.getLogger(__name__)

EPSS_API = "https://api.first.org/data/1.0/epss"


async def fetch_epss_scores(cves: list[str]) -> dict[str, float]:
    """Return {cve_id: epss_score} for given CVEs. Silently skips on error."""
    if not cves:
        return {}

    valid = [c for c in cves if c and c.upper().startswith("CVE-")]
    if not valid:
        return {}

    results: dict[str, float] = {}
    # API accepts up to 100 CVEs per request
    chunk_size = 100
    async with httpx.AsyncClient(timeout=15) as client:
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
            except Exception as exc:
                logger.warning("EPSS fetch failed for chunk %d: %s", i, exc)

    return results
