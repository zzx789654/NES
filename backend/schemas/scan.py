from datetime import date, datetime
from pydantic import BaseModel


class VulnerabilityBase(BaseModel):
    plugin_id: str | None = None
    cve: str | None = None
    risk: str | None = None
    host: str | None = None
    port: str | None = None
    protocol: str | None = None
    name: str | None = None
    cvss: float | None = None
    epss: float | None = None
    vpr: float | None = None
    synopsis: str | None = None
    description: str | None = None
    solution: str | None = None
    plugin_output: str | None = None


class VulnerabilityOut(VulnerabilityBase):
    id: int
    scan_id: int

    model_config = {"from_attributes": True}


class ScanBase(BaseModel):
    name: str
    source: str
    scan_date: date | None = None


class ScanOut(ScanBase):
    id: int
    uploaded_at: datetime
    host_count: int
    vuln_count: int

    model_config = {"from_attributes": True}


class ScanDetail(ScanOut):
    vulnerabilities: list[VulnerabilityOut] = []


class DiffVuln(BaseModel):
    status: str  # new | resolved | persistent
    vuln: VulnerabilityOut


class ScanDiff(BaseModel):
    base_scan: ScanOut
    compare_scan: ScanOut
    new: list[VulnerabilityOut]
    resolved: list[VulnerabilityOut]
    persistent: list[VulnerabilityOut]
