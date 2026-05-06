from decimal import Decimal

from schemas.scan import VulnerabilityOut, VulnSlim


class _VulnObj:
    id = 1
    scan_id = 1
    plugin_id = "90001"
    cve = "CVE-2024-9001"
    risk = "High"
    host = "192.0.2.10"
    port = "443"
    protocol = "tcp"
    name = "Stored NaN regression"
    cvss_v2_base = Decimal("NaN")
    cvss_v2_temporal = None
    cvss_v3_base = float("nan")
    cvss_v3_temporal = None
    cvss_v4_base = None
    cvss_v4_threat_score = None
    vpr = float("inf")
    epss = Decimal("NaN")
    risk_factor = None
    stig_severity = None
    synopsis = None
    description = None
    solution = None
    plugin_output = None
    see_also = None
    bid = None
    xref = None
    mskb = None
    plugin_publication_date = None
    plugin_modification_date = None
    metasploit = False
    core_impact = False
    canvas = False


def test_vulnerability_response_schemas_convert_non_finite_numbers_to_null():
    full = VulnerabilityOut.model_validate(_VulnObj())
    slim = VulnSlim.model_validate(_VulnObj())

    assert full.cvss_v2_base is None
    assert full.cvss_v3_base is None
    assert full.vpr is None
    assert full.epss is None
    assert '"epss":null' in full.model_dump_json()

    assert slim.cvss_v2_base is None
    assert slim.cvss_v3_base is None
    assert slim.vpr is None
    assert slim.epss is None
    assert '"epss":null' in slim.model_dump_json()
