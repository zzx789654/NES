"""Tests for epss_service — uses httpx mock to avoid real network calls."""
import pytest
import httpx
from unittest.mock import patch, AsyncMock, MagicMock

from services.epss_service import fetch_epss_scores


def _make_resp(data: dict) -> MagicMock:
    """Build a synchronous MagicMock mimicking an httpx.Response."""
    resp = MagicMock()
    resp.raise_for_status.return_value = None
    resp.json.return_value = data
    return resp


def _make_async_client(get_side_effect=None, get_return_value=None):
    """Build an async-context-manager mock for httpx.AsyncClient."""
    mock_client = MagicMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    if get_side_effect is not None:
        mock_client.get = AsyncMock(side_effect=get_side_effect)
    else:
        mock_client.get = AsyncMock(return_value=get_return_value)
    return mock_client


@pytest.mark.asyncio
async def test_fetch_epss_empty_list():
    result = await fetch_epss_scores([])
    assert result == {}


@pytest.mark.asyncio
async def test_fetch_epss_no_valid_cves():
    result = await fetch_epss_scores(["NOTACVE-123", "", None])
    assert result == {}


@pytest.mark.asyncio
async def test_fetch_epss_success():
    cves = ["CVE-2023-0001", "CVE-2022-9999"]
    api_data = {"data": [{"cve": c, "epss": "0.1234"} for c in cves]}
    mock_client = _make_async_client(get_return_value=_make_resp(api_data))

    with patch("services.epss_service.httpx.AsyncClient", return_value=mock_client):
        result = await fetch_epss_scores(cves)

    assert "CVE-2023-0001" in result
    assert "CVE-2022-9999" in result
    assert result["CVE-2023-0001"] == 0.1234


@pytest.mark.asyncio
async def test_fetch_epss_graceful_on_network_error():
    """EPSS fetch failure should not raise — returns empty dict."""
    mock_client = _make_async_client(get_side_effect=httpx.ConnectError("timeout"))

    with patch("services.epss_service.httpx.AsyncClient", return_value=mock_client):
        result = await fetch_epss_scores(["CVE-2023-0001"])

    assert result == {}


@pytest.mark.asyncio
async def test_fetch_epss_batches_large_input():
    """More than 100 CVEs should be sent in chunks of 100."""
    cves = [f"CVE-2023-{str(i).zfill(4)}" for i in range(250)]
    call_count = 0

    async def fake_get(url, params=None):
        nonlocal call_count
        call_count += 1
        chunk = params["cve"].split(",")
        return _make_resp({"data": [{"cve": c, "epss": "0.05"} for c in chunk]})

    mock_client = MagicMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_client.get = fake_get

    with patch("services.epss_service.httpx.AsyncClient", return_value=mock_client):
        result = await fetch_epss_scores(cves)

    assert call_count == 3  # 100 + 100 + 50
    assert len(result) == 250


@pytest.mark.asyncio
async def test_fetch_epss_http_error_returns_empty():
    """HTTP error response should be silently ignored."""
    resp = MagicMock()
    resp.raise_for_status.side_effect = httpx.HTTPStatusError(
        "500", request=MagicMock(), response=MagicMock()
    )
    mock_client = _make_async_client(get_return_value=resp)

    with patch("services.epss_service.httpx.AsyncClient", return_value=mock_client):
        result = await fetch_epss_scores(["CVE-2023-0001"])

    assert result == {}


@pytest.mark.asyncio
async def test_fetch_epss_case_insensitive_cve_filter():
    """lowercase CVE- prefix should still be sent to the API."""
    cves = ["cve-2023-1234", "Cve-2022-5678"]
    mock_client = _make_async_client(get_return_value=_make_resp({"data": []}))

    with patch("services.epss_service.httpx.AsyncClient", return_value=mock_client):
        result = await fetch_epss_scores(cves)

    assert isinstance(result, dict)
    mock_client.get.assert_called_once()
