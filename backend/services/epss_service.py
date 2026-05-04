"""Fetch EPSS scores from FIRST.org API — concurrent batch requests."""
import asyncio
import httpx

EPSS_API = "https://api.first.org/data/1.0/epss"


async def fetch_epss_scores(cves: list[str]) -> dict[str, float]:
    """Return {CVE_ID: epss_score}. Deduplicates input, fetches all batches concurrently."""
    if not cves:
        return {}

    # Deduplicate and validate
    valid = list({c.upper() for c in cves if c and c.upper().startswith("CVE-")})
    if not valid:
        return {}

    chunk_size = 100
    chunks = [valid[i : i + chunk_size] for i in range(0, len(valid), chunk_size)]
    timeout = httpx.Timeout(connect=3.0, read=8.0, write=3.0, pool=3.0)

    async def _fetch(client: httpx.AsyncClient, chunk: list[str]) -> dict[str, float]:
        try:
            resp = await client.get(EPSS_API, params={"cve": ",".join(chunk)})
            resp.raise_for_status()
            return {
                item["cve"].upper(): round(float(item["epss"]), 4)
                for item in resp.json().get("data", [])
                if item.get("cve") and item.get("epss") is not None
            }
        except Exception:
            return {}

    async with httpx.AsyncClient(timeout=timeout) as client:
        results_list = await asyncio.gather(*[_fetch(client, chunk) for chunk in chunks])

    result: dict[str, float] = {}
    for r in results_list:
        result.update(r)
    return result
