"""Comprehensive test suite for Nessus CSV field compatibility.

Tests all 31 Nessus export fields against the parser and ensure correct
data type conversion and null handling.
"""

import io
import csv
from datetime import date

import pytest

from services.nessus_parser import parse_nessus_csv


class TestNessusFieldParsing:
    """Test parsing of all Nessus CSV fields."""

    @pytest.fixture
    def nessus_header(self):
        """All 31 Nessus export fields."""
        return [
            "Plugin ID",
            "CVE",
            "CVSS v2.0 Base Score",
            "Risk",
            "Host",
            "Protocol",
            "Port",
            "Name",
            "Synopsis",
            "Description",
            "Solution",
            "See Also",
            "Plugin Output",
            "STIG Severity",
            "CVSS v4.0 Base Score",
            "CVSS v4.0 Base+Threat Score",
            "CVSS v3.0 Base Score",
            "CVSS v2.0 Temporal Score",
            "CVSS v3.0 Temporal Score",
            "VPR Score",
            "EPSS Score",
            "Risk Factor",
            "BID",
            "XREF",
            "MSKB",
            "Plugin Publication Date",
            "Plugin Modification Date",
            "Metasploit",
            "Core Impact",
            "CANVAS",
        ]

    def _create_csv(self, headers: list, rows: list[dict]) -> bytes:
        """Create CSV bytes from headers and data rows."""
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=headers)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
        return output.getvalue().encode()

    def test_parse_all_fields_present(self, nessus_header):
        """Test parsing when all 31 fields are present."""
        row = {
            "Plugin ID": "19506",
            "CVE": "CVE-2024-3400",
            "CVSS v2.0 Base Score": "7.5",
            "Risk": "High",
            "Host": "192.168.1.100",
            "Protocol": "tcp",
            "Port": "443",
            "Name": "SSL/TLS Weak Cipher",
            "Synopsis": "Weak cipher detected",
            "Description": "The system uses weak ciphers",
            "Solution": "Update OpenSSL to latest",
            "See Also": "https://example.com",
            "Plugin Output": "Weak cipher found: DES",
            "STIG Severity": "CAT I",
            "CVSS v4.0 Base Score": "8.2",
            "CVSS v4.0 Base+Threat Score": "8.5",
            "CVSS v3.0 Base Score": "8.1",
            "CVSS v2.0 Temporal Score": "6.8",
            "CVSS v3.0 Temporal Score": "7.9",
            "VPR Score": "6.5",
            "EPSS Score": "0.8234",
            "Risk Factor": "CVSS > 7.0",
            "BID": "123456",
            "XREF": "http://xref.example.com",
            "MSKB": "KB123456",
            "Plugin Publication Date": "2024-01-15",
            "Plugin Modification Date": "2024-03-20",
            "Metasploit": "true",
            "Core Impact": "false",
            "CANVAS": "true",
        }

        csv_content = self._create_csv(nessus_header, [row])
        result = parse_nessus_csv(csv_content, "test_scan", date(2024, 4, 20))

        assert result["name"] == "test_scan"
        assert result["vuln_count"] == 1
        assert result["host_count"] == 1

        vuln = result["vulnerabilities"][0]

        # Basic fields
        assert vuln["plugin_id"] == "19506"
        assert vuln["cve"] == "CVE-2024-3400"
        assert vuln["risk"] == "High"
        assert vuln["host"] == "192.168.1.100"
        assert vuln["protocol"] == "tcp"
        assert vuln["port"] == "443"
        assert vuln["name"] == "SSL/TLS Weak Cipher"

        # Text fields
        assert vuln["synopsis"] == "Weak cipher detected"
        assert vuln["description"] == "The system uses weak ciphers"
        assert vuln["solution"] == "Update OpenSSL to latest"
        assert vuln["see_also"] == "https://example.com"

        # Risk fields
        assert vuln["risk_factor"] == "CVSS > 7.0"
        assert vuln["stig_severity"] == "CAT I"

        # CVSS scores (should be rounded to 1 decimal)
        assert vuln["cvss_v2_base"] == 7.5
        assert vuln["cvss_v2_temporal"] == 6.8
        assert vuln["cvss_v3_base"] == 8.1
        assert vuln["cvss_v3_temporal"] == 7.9
        assert vuln["cvss_v4_base"] == 8.2
        assert vuln["cvss_v4_threat_score"] == 8.5

        # Risk metrics
        assert vuln["vpr"] == 6.5
        assert vuln["epss"] == 0.8234  # 4 decimals

        # Reference fields
        assert vuln["bid"] == "123456"
        assert vuln["xref"] == "http://xref.example.com"
        assert vuln["mskb"] == "KB123456"

        # Date fields
        assert vuln["plugin_publication_date"] == date(2024, 1, 15)
        assert vuln["plugin_modification_date"] == date(2024, 3, 20)

        # Boolean fields
        assert vuln["metasploit"] is True
        assert vuln["core_impact"] is False
        assert vuln["canvas"] is True

    def test_parse_partial_fields(self, nessus_header):
        """Test parsing with some fields missing (sparse data)."""
        row = {
            "Plugin ID": "19506",
            "CVE": "CVE-2024-3400",
            "Risk": "High",
            "Host": "192.168.1.100",
            "Port": "443",
            "CVSS v3.0 Base Score": "8.1",
            "VPR Score": "6.5",
            # Missing: Synopsis, Description, Solution, etc.
        }

        csv_content = self._create_csv(nessus_header, [row])
        result = parse_nessus_csv(csv_content, "sparse_scan")

        vuln = result["vulnerabilities"][0]
        assert vuln["plugin_id"] == "19506"
        assert vuln["cvss_v3_base"] == 8.1
        # Missing fields should be None
        assert vuln["synopsis"] is None
        assert vuln["description"] is None
        assert vuln["plugin_publication_date"] is None
        assert vuln["metasploit"] is False  # Default for boolean

    def test_null_handling(self, nessus_header):
        """Test handling of empty and null values."""
        row = {
            "Plugin ID": "19506",
            "CVE": "",  # Empty string
            "Risk": "High",
            "Host": "192.168.1.100",
            "Port": "443",
            "CVSS v3.0 Base Score": "",  # Empty numeric
            "VPR Score": "N/A",  # Invalid numeric
            "Metasploit": "",  # Empty boolean
        }

        csv_content = self._create_csv(nessus_header, [row])
        result = parse_nessus_csv(csv_content, "null_test")

        vuln = result["vulnerabilities"][0]
        assert vuln["cve"] is None  # Empty string converted to None
        assert vuln["cvss_v3_base"] is None  # Empty numeric to None
        assert vuln["vpr"] is None  # Invalid numeric to None
        assert vuln["metasploit"] is False  # Empty boolean to False

    def test_cvss_score_precision(self, nessus_header):
        """Test CVSS score rounding and precision."""
        row = {
            "Plugin ID": "1",
            "Host": "1.1.1.1",
            "CVSS v2.0 Base Score": "7.123456",  # Should round to 1 decimal
            "CVSS v3.0 Base Score": "8.999",  # Should round to 9.0
            "EPSS Score": "0.123456789",  # Should round to 0.1235 (4 decimals)
        }

        csv_content = self._create_csv(nessus_header, [row])
        result = parse_nessus_csv(csv_content, "precision_test")

        vuln = result["vulnerabilities"][0]
        assert vuln["cvss_v2_base"] == 7.1
        assert vuln["cvss_v3_base"] == 9.0
        assert vuln["epss"] == 0.1235

    def test_date_format_flexibility(self, nessus_header):
        """Test multiple date format support."""
        row_iso = {
            "Plugin ID": "1",
            "Host": "1.1.1.1",
            "Plugin Publication Date": "2024-01-15",  # ISO format
        }
        row_us = {
            "Plugin ID": "2",
            "Host": "1.1.1.2",
            "Plugin Publication Date": "01/15/2024",  # US format
        }

        csv_content = self._create_csv(nessus_header, [row_iso, row_us])
        result = parse_nessus_csv(csv_content, "date_format_test")

        assert result["vulnerabilities"][0]["plugin_publication_date"] == date(2024, 1, 15)
        assert result["vulnerabilities"][1]["plugin_publication_date"] == date(2024, 1, 15)

    def test_boolean_type_conversion(self, nessus_header):
        """Test boolean field conversion."""
        test_cases = [
            ("true", True),
            ("True", True),
            ("TRUE", True),
            ("yes", True),
            ("1", True),
            ("enabled", True),
            ("false", False),
            ("False", False),
            ("no", False),
            ("0", False),
            ("disabled", False),
            ("", False),
        ]

        for bool_val, expected in test_cases:
            row = {
                "Plugin ID": "1",
                "Host": "1.1.1.1",
                "Metasploit": bool_val,
            }
            csv_content = self._create_csv(nessus_header, [row])
            result = parse_nessus_csv(csv_content, "bool_test")
            assert result["vulnerabilities"][0]["metasploit"] == expected

    def test_multiple_vulnerabilities(self, nessus_header):
        """Test parsing multiple vulnerability records."""
        rows = [
            {
                "Plugin ID": str(i),
                "Host": f"192.168.1.{100 + i}",
                "CVE": f"CVE-2024-{3400 + i}",
                "Risk": ["Critical", "High", "Medium"][i % 3],
                "CVSS v3.0 Base Score": str(7.0 + i),
            }
            for i in range(10)
        ]

        csv_content = self._create_csv(nessus_header, rows)
        result = parse_nessus_csv(csv_content, "multi_test")

        assert result["vuln_count"] == 10
        assert result["host_count"] == 10  # 10 unique hosts
        assert len(result["vulnerabilities"]) == 10

    def test_special_characters_handling(self, nessus_header):
        """Test handling of special characters and unicode."""
        row = {
            "Plugin ID": "1",
            "Host": "1.1.1.1",
            "Name": "Test with 中文 and émojis 🔒",
            "Description": "Quotes \"test\" and 'apostrophes'",
            "Solution": "Line 1\nLine 2\nLine 3",
        }

        csv_content = self._create_csv(nessus_header, [row])
        result = parse_nessus_csv(csv_content, "special_chars_test")

        vuln = result["vulnerabilities"][0]
        assert "中文" in vuln["name"]
        assert "émojis" in vuln["name"]
        assert "\"test\"" in vuln["description"]
        assert "\n" in vuln["solution"]

    def test_field_aliases(self, nessus_header):
        """Test that field aliases work correctly."""
        # Use alternate field names
        alternate_header = nessus_header.copy()
        alternate_header[0] = "PluginID"  # Alias for Plugin ID
        alternate_header[16] = "CVSS Base Score"  # Alias for CVSS v3.0 Base Score

        row = {
            "PluginID": "19506",
            "CVE": "CVE-2024-3400",
            "Host": "192.168.1.100",
            "CVSS Base Score": "8.1",
        }

        csv_content = self._create_csv(alternate_header, [row])
        result = parse_nessus_csv(csv_content, "alias_test")

        vuln = result["vulnerabilities"][0]
        assert vuln["plugin_id"] == "19506"
        assert vuln["cvss_v3_base"] == 8.1

    def test_large_csv_performance(self, nessus_header):
        """Test parsing large CSV file (1000+ records)."""
        rows = [
            {
                "Plugin ID": str(19500 + i),
                "CVE": f"CVE-2024-{3000 + i % 1000}",
                "Risk": ["Critical", "High", "Medium", "Low", "Info"][i % 5],
                "Host": f"192.168.{i // 256}.{i % 256}",
                "Port": str(1024 + (i % 64000)),
                "CVSS v3.0 Base Score": str(round(3.0 + (i % 10), 1)),
            }
            for i in range(1000)
        ]

        csv_content = self._create_csv(nessus_header, rows)
        result = parse_nessus_csv(csv_content, "large_test")

        assert result["vuln_count"] == 1000
        assert len(result["vulnerabilities"]) == 1000

    def test_empty_csv(self, nessus_header):
        """Test parsing empty CSV with only headers."""
        csv_content = self._create_csv(nessus_header, [])
        result = parse_nessus_csv(csv_content, "empty_test")

        assert result["vuln_count"] == 0
        assert result["host_count"] == 0
        assert result["vulnerabilities"] == []

    def test_duplicate_hosts(self, nessus_header):
        """Test that duplicate hosts are counted once."""
        rows = [
            {"Plugin ID": str(i), "Host": "192.168.1.100"}
            for i in range(5)
        ]

        csv_content = self._create_csv(nessus_header, rows)
        result = parse_nessus_csv(csv_content, "dup_host_test")

        assert result["vuln_count"] == 5
        assert result["host_count"] == 1  # Only 1 unique host

    def test_cvss_legacy_mapping(self, nessus_header):
        """Test that old CVSS field name maps to v3 base score."""
        alternate_header = nessus_header.copy()
        # Replace v3.0 field with generic CVSS
        idx = alternate_header.index("CVSS v3.0 Base Score")
        alternate_header[idx] = "CVSS Base Score"

        row = {
            "Plugin ID": "1",
            "Host": "1.1.1.1",
            "CVSS Base Score": "7.5",
        }

        csv_content = self._create_csv(alternate_header, [row])
        result = parse_nessus_csv(csv_content, "legacy_test")

        vuln = result["vulnerabilities"][0]
        assert vuln["cvss_v3_base"] == 7.5


class TestFieldCountAndMapping:
    """Test field coverage and mapping completeness."""

    def test_all_31_fields_mapped(self):
        """Verify all 31 Nessus fields are mapped in COL_ALIASES."""
        from services.nessus_parser import COL_ALIASES

        expected_fields = {
            "plugin_id",
            "cve",
            "risk",
            "risk_factor",
            "stig_severity",
            "host",
            "port",
            "protocol",
            "name",
            "synopsis",
            "description",
            "solution",
            "plugin_output",
            "see_also",
            "cvss_v2_base",
            "cvss_v2_temporal",
            "cvss_v3_base",
            "cvss_v3_temporal",
            "cvss_v4_base",
            "cvss_v4_threat_score",
            "vpr",
            "epss",
            "bid",
            "xref",
            "mskb",
            "plugin_publication_date",
            "plugin_modification_date",
            "metasploit",
            "core_impact",
            "canvas",
        }

        mapped_fields = set(COL_ALIASES.keys())
        assert mapped_fields == expected_fields

    def test_multiple_aliases_per_field(self):
        """Verify multiple aliases exist for compatibility."""
        from services.nessus_parser import COL_ALIASES

        # Check fields that should have multiple aliases
        assert len(COL_ALIASES["cvss_v3_base"]) >= 3  # Generic + versioned
        assert len(COL_ALIASES["plugin_id"]) >= 2  # Multiple naming styles
        assert len(COL_ALIASES["vpr"]) >= 2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
