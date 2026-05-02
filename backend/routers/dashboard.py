from fastapi import APIRouter, Depends
from sqlalchemy import nulls_last
from sqlalchemy.orm import Session

from database import get_db
from models.scan import Scan, Vulnerability
from models.audit import AuditScan
from routers.auth import get_current_user
from schemas.dashboard import DashboardSummary, RiskSummary, NistSummary

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardSummary)
def get_dashboard(db: Session = Depends(get_db), _=Depends(get_current_user)):
    # Latest scan vulnerabilities
    latest_scan = (
        db.query(Scan)
        .order_by(nulls_last(Scan.scan_date.desc()), Scan.uploaded_at.desc())
        .first()
    )
    risk_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0, "total": 0}
    latest_scan_date = None
    if latest_scan:
        latest_scan_date = str(latest_scan.scan_date) if latest_scan.scan_date else None
        for v in latest_scan.vulnerabilities:
            risk = (v.risk or "Info").lower()
            if risk in risk_counts:
                risk_counts[risk] += 1
            risk_counts["total"] += 1

    # Latest audit scan
    latest_audit = (
        db.query(AuditScan)
        .order_by(nulls_last(AuditScan.scan_date.desc()), AuditScan.uploaded_at.desc())
        .first()
    )
    nist_data = {"passed": 0, "failed": 0, "warning": 0, "total": 0, "pass_rate": 0.0}
    latest_audit_date = None
    if latest_audit:
        latest_audit_date = str(latest_audit.scan_date) if latest_audit.scan_date else None
        total = latest_audit.total or 0
        passed = latest_audit.passed or 0
        failed = latest_audit.failed or 0
        warning = latest_audit.warning or 0
        nist_data = {
            "passed": passed,
            "failed": failed,
            "warning": warning,
            "total": total,
            "pass_rate": round(passed / total * 100, 1) if total > 0 else 0.0,
        }

    return DashboardSummary(
        risk=RiskSummary(**risk_counts),
        nist=NistSummary(**nist_data),
        scan_count=db.query(Scan).count(),
        audit_scan_count=db.query(AuditScan).count(),
        latest_scan_date=latest_scan_date,
        latest_audit_date=latest_audit_date,
    )
