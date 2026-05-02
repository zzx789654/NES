from datetime import date, datetime
from pydantic import BaseModel, field_validator


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
    uploaded_at: datetime | None = None
    total: int = 0
    passed: int = 0
    failed: int = 0
    warning: int = 0

    model_config = {"from_attributes": True}

    @field_validator("total", "passed", "failed", "warning", mode="before")
    @classmethod
    def int_default(cls, v):
        if v is None:
            return 0
        return int(v)


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
