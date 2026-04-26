from datetime import date, datetime
from pydantic import BaseModel


class AuditResultBase(BaseModel):
    check_name: str | None = None
    status: str | None = None
    description: str | None = None
    policy_val: str | None = None
    actual_val: str | None = None


class AuditResultOut(AuditResultBase):
    id: int
    scan_id: int

    model_config = {"from_attributes": True}


class AuditScanBase(BaseModel):
    name: str
    scan_date: date | None = None


class AuditScanOut(AuditScanBase):
    id: int
    uploaded_at: datetime
    total: int
    passed: int
    failed: int
    warning: int

    model_config = {"from_attributes": True}


class AuditScanDetail(AuditScanOut):
    results: list[AuditResultOut] = []


class AuditDiff(BaseModel):
    base_scan: AuditScanOut
    compare_scan: AuditScanOut
    new_failures: list[AuditResultOut]
    resolved_failures: list[AuditResultOut]
    persistent_failures: list[AuditResultOut]


class AuditTrendPoint(BaseModel):
    scan_id: int
    name: str
    scan_date: date | None
    pass_rate: float
    passed: int
    failed: int
    total: int
