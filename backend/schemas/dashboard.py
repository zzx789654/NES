from pydantic import BaseModel


class RiskSummary(BaseModel):
    critical: int
    high: int
    medium: int
    low: int
    info: int
    total: int


class NistSummary(BaseModel):
    passed: int
    failed: int
    warning: int
    total: int
    pass_rate: float


class DashboardSummary(BaseModel):
    risk: RiskSummary
    nist: NistSummary
    scan_count: int
    audit_scan_count: int
    latest_scan_date: str | None
    latest_audit_date: str | None
