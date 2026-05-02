from datetime import date, datetime
from pydantic import BaseModel, field_validator


class VulnerabilityBase(BaseModel):
    # 基本識別
    plugin_id: str | None = None
    cve: str | None = None
    
    # 風險分類
    risk: str | None = None
    risk_factor: str | None = None
    stig_severity: str | None = None
    
    # 位置信息
    host: str | None = None
    port: str | None = None
    protocol: str | None = None
    
    # 外掛信息
    name: str | None = None
    synopsis: str | None = None
    description: str | None = None
    solution: str | None = None
    plugin_output: str | None = None
    see_also: str | None = None
    
    # CVSS 評分 - 多版本
    cvss_v2_base: float | None = None
    cvss_v2_temporal: float | None = None
    cvss_v3_base: float | None = None
    cvss_v3_temporal: float | None = None
    cvss_v4_base: float | None = None
    cvss_v4_threat_score: float | None = None
    
    # 風險指標
    vpr: float | None = None
    epss: float | None = None
    
    # 參考信息
    bid: str | None = None
    xref: str | None = None
    mskb: str | None = None
    
    # 元數據
    plugin_publication_date: date | None = None
    plugin_modification_date: date | None = None
    
    # 利用方式
    metasploit: bool = False
    core_impact: bool = False
    canvas: bool = False


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
    uploaded_at: datetime | None = None
    host_count: int = 0
    vuln_count: int = 0

    model_config = {"from_attributes": True}

    @field_validator("host_count", "vuln_count", mode="before")
    @classmethod
    def int_default(cls, v):
        if v is None:
            return 0
        return int(v)


class ScanDetail(ScanOut):
    vulnerabilities: list[VulnerabilityOut] = []


class HostHistoryEntry(BaseModel):
    scan_id: int
    scan_name: str
    scan_date: date | None = None
    uploaded_at: datetime
    vuln_count: int
    critical: int
    high: int
    medium: int
    low: int
    info: int


class HostHistory(BaseModel):
    host: str
    history: list[HostHistoryEntry] = []
    total_scans: int
    first_seen: datetime | None = None
    last_seen: datetime | None = None

    model_config = {"from_attributes": True}


class DiffVuln(BaseModel):
    status: str  # new | resolved | persistent
    vuln: VulnerabilityOut


class ScanDiff(BaseModel):
    base_scan: ScanOut
    compare_scan: ScanOut
    new: list[VulnerabilityOut]
    resolved: list[VulnerabilityOut]
    persistent: list[VulnerabilityOut]
