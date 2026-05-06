from pydantic import BaseModel
from datetime import datetime


class ReportRequest(BaseModel):
    """Report generation request"""
    modules: list[str]  # risk_overview, compliance, scan_efficiency, remediation_progress, audit_log
    timeRange: str  # 7d, 30d, 90d, custom
    customStart: str | None = None  # ISO format date
    customEnd: str | None = None    # ISO format date
    exportFormat: str  # html, pdf, csv
    includeCharts: bool = True
    includeMetrics: bool = True
    includeDetails: bool = False
    title: str = "資安態勢報表"
    description: str = ""


class RiskStats(BaseModel):
    """Risk overview statistics"""
    critical: int
    high: int
    medium: int
    low: int
    info: int


class ComplianceStats(BaseModel):
    """Compliance report statistics"""
    passed: int
    failed: int
    warning: int
    pass_rate: float


class ScanEfficiencyStats(BaseModel):
    """Scan efficiency statistics"""
    scan_count: int
    vulnerability_count: int
    average_epss: float
    latest_scan_name: str | None
    latest_scan_date: str | None


class RemediationStats(BaseModel):
    """Remediation progress statistics"""
    remediation_rate: float
    average_remediation_days: float
    pending_count: int


class AuditStats(BaseModel):
    """Audit log statistics"""
    operation_count: int
    anomaly_count: int
    permission_changes: int


class ReportData(BaseModel):
    """Complete report data"""
    title: str
    description: str
    generated_at: datetime
    modules: list[str]
    risk: RiskStats | None = None
    compliance: ComplianceStats | None = None
    scan_efficiency: ScanEfficiencyStats | None = None
    remediation: RemediationStats | None = None
    audit: AuditStats | None = None


class ReportResponse(BaseModel):
    """Report API response"""
    success: bool
    data: ReportData
