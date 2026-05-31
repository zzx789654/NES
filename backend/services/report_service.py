"""
Report service — generate aggregated security reports
"""
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_, cast, Date
from models.scan import Scan, Vulnerability
from models.audit import AuditScan, SystemAuditLog
from schemas.report import (
    RiskStats,
    ComplianceStats,
    ScanEfficiencyStats,
    RemediationStats,
    AuditStats,
    ReportData,
)


def _scan_in_range(model, start_date: datetime, end_date: datetime):
    """Return a filter expression that matches scans within the date range.
    Falls back to uploaded_at when scan_date is NULL."""
    start = start_date.date()
    end = end_date.date()
    return or_(
        and_(model.scan_date.isnot(None), model.scan_date >= start, model.scan_date <= end),
        and_(model.scan_date.is_(None), model.uploaded_at >= start_date, model.uploaded_at <= end_date),
    )


from decimal import Decimal

def _to_float(v):
    if v is None:
        return None
    if isinstance(v, Decimal):
        try:
            return float(v)
        except Exception:
            return None
    try:
        return float(v)
    except Exception:
        return None


class ReportService:
    """Generate comprehensive security reports"""

    @staticmethod
    def _get_date_range(time_range: str, custom_start: str | None, custom_end: str | None):
        """Parse date range from time_range parameter"""
        end_date = datetime.now(timezone.utc).replace(tzinfo=None)
        
        if time_range == "custom" and custom_start and custom_end:
            start_date = datetime.fromisoformat(custom_start)
            end_date = datetime.fromisoformat(custom_end)
        elif time_range == "7d":
            start_date = end_date - timedelta(days=7)
        elif time_range == "30d":
            start_date = end_date - timedelta(days=30)
        elif time_range == "90d":
            start_date = end_date - timedelta(days=90)
        else:
            start_date = end_date - timedelta(days=30)  # Default to 30 days
        
        return start_date, end_date

    @staticmethod
    def get_risk_stats(db: Session, start_date: datetime, end_date: datetime) -> RiskStats | None:
        """Get risk overview statistics"""
        # Query vulnerabilities from latest scan
        latest_scan = (
            db.query(Scan)
            .filter(_scan_in_range(Scan, start_date, end_date))
            .order_by(Scan.scan_date.desc().nullslast(), Scan.uploaded_at.desc())
            .first()
        )
        
        if not latest_scan:
            return None
        
        risk_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        for vuln in latest_scan.vulnerabilities:
            risk = (vuln.risk or "info").lower()
            if risk in risk_counts:
                risk_counts[risk] += 1
        
        return RiskStats(**risk_counts)

    @staticmethod
    def get_compliance_stats(db: Session, start_date: datetime, end_date: datetime) -> ComplianceStats | None:
        """Get NIST compliance statistics"""
        latest_audit = (
            db.query(AuditScan)
            .filter(_scan_in_range(AuditScan, start_date, end_date))
            .order_by(AuditScan.scan_date.desc().nullslast(), AuditScan.uploaded_at.desc())
            .first()
        )
        
        if not latest_audit:
            return None
        
        total = latest_audit.total or 0
        passed = latest_audit.passed or 0
        failed = latest_audit.failed or 0
        warning = latest_audit.warning or 0
        pass_rate = (passed / total * 100) if total > 0 else 0.0
        
        return ComplianceStats(
            passed=passed,
            failed=failed,
            warning=warning,
            pass_rate=round(pass_rate, 1),
        )

    @staticmethod
    def get_scan_efficiency_stats(db: Session, start_date: datetime, end_date: datetime) -> ScanEfficiencyStats | None:
        """Get scan efficiency statistics"""
        scans = db.query(Scan).filter(
            _scan_in_range(Scan, start_date, end_date)
        ).all()
        
        if not scans:
            return None
        
        # Count vulnerabilities
        total_vulns = 0
        total_epss = 0.0
        epss_count = 0
        
        for scan in scans:
            total_vulns += len(scan.vulnerabilities or [])
            for vuln in scan.vulnerabilities or []:
                if vuln.epss is not None:
                    total_epss += (_to_float(vuln.epss) or 0.0)
                    epss_count += 1
        
        average_epss = (total_epss / epss_count) if epss_count > 0 else 0.0
        latest_scan = max(scans, key=lambda s: s.scan_date or s.uploaded_at)
        
        return ScanEfficiencyStats(
            scan_count=len(scans),
            vulnerability_count=total_vulns,
            average_epss=round(average_epss, 2),
            latest_scan_name=latest_scan.name,
            latest_scan_date=str(latest_scan.scan_date) if latest_scan.scan_date else None,
        )

    @staticmethod
    def get_remediation_stats(db: Session, start_date: datetime, end_date: datetime) -> RemediationStats | None:
        """Get remediation progress statistics"""
        total = db.query(Vulnerability).join(Scan).filter(
            _scan_in_range(Scan, start_date, end_date)
        ).count()

        if total == 0:
            return None

        fixed = db.query(Vulnerability).join(Scan).filter(
            _scan_in_range(Scan, start_date, end_date),
            Vulnerability.status == "fixed"
        ).count()
        
        remediation_rate = (fixed / total * 100)
        
        return RemediationStats(
            remediation_rate=round(remediation_rate, 1),
            average_remediation_days=14.0,  # TODO: 需實作 remediation_date 減法計算
            pending_count=total - fixed,
        )

    @staticmethod
    def get_audit_stats(db: Session, start_date: datetime, end_date: datetime) -> AuditStats | None:
        """Get audit log statistics"""
        count = db.query(SystemAuditLog).filter(
            SystemAuditLog.timestamp >= start_date,
            SystemAuditLog.timestamp <= end_date
        ).count()

        anomalies = db.query(SystemAuditLog).filter(
            SystemAuditLog.timestamp >= start_date,
            SystemAuditLog.timestamp <= end_date,
            SystemAuditLog.status_code >= 400
        ).count()

        return AuditStats(
            operation_count=count,
            anomaly_count=anomalies,
            permission_changes=0, # TODO: 基於 action 類型過濾
        )

    @classmethod
    def generate_report(
        cls,
        db: Session,
        modules: list[str],
        time_range: str,
        custom_start: str | None = None,
        custom_end: str | None = None,
        title: str = "資安態勢報表",
        description: str = "",
    ) -> ReportData:
        """Generate complete report with requested modules"""
        start_date, end_date = cls._get_date_range(time_range, custom_start, custom_end)
        
        report_data = {
            "title": title,
            "description": description,
            "generated_at": datetime.now(timezone.utc).replace(tzinfo=None),
            "modules": modules,
            "risk": None,
            "compliance": None,
            "scan_efficiency": None,
            "remediation": None,
            "audit": None,
        }
        
        # Generate requested modules
        if "risk_overview" in modules:
            report_data["risk"] = cls.get_risk_stats(db, start_date, end_date)
        
        if "compliance" in modules:
            report_data["compliance"] = cls.get_compliance_stats(db, start_date, end_date)
        
        if "scan_efficiency" in modules:
            report_data["scan_efficiency"] = cls.get_scan_efficiency_stats(db, start_date, end_date)
        
        if "remediation_progress" in modules:
            report_data["remediation"] = cls.get_remediation_stats(db, start_date, end_date)
        
        if "audit_log" in modules:
            report_data["audit"] = cls.get_audit_stats(db, start_date, end_date)
        
        return ReportData(**report_data)
