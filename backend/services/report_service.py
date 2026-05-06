"""
Report service — generate aggregated security reports
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models.scan import Scan, Vulnerability
from models.audit import AuditScan
from schemas.report import (
    RiskStats,
    ComplianceStats,
    ScanEfficiencyStats,
    RemediationStats,
    AuditStats,
    ReportData,
)


class ReportService:
    """Generate comprehensive security reports"""

    @staticmethod
    def _get_date_range(time_range: str, custom_start: str | None, custom_end: str | None):
        """Parse date range from time_range parameter"""
        end_date = datetime.utcnow()
        
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
            .filter(Scan.scan_date >= start_date, Scan.scan_date <= end_date)
            .order_by(Scan.scan_date.desc())
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
            .filter(AuditScan.scan_date >= start_date, AuditScan.scan_date <= end_date)
            .order_by(AuditScan.scan_date.desc())
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
            Scan.scan_date >= start_date,
            Scan.scan_date <= end_date,
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
                    total_epss += vuln.epss
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
        # Query vulnerabilities with status tracking (placeholder)
        latest_scan = (
            db.query(Scan)
            .filter(Scan.scan_date >= start_date, Scan.scan_date <= end_date)
            .order_by(Scan.scan_date.desc())
            .first()
        )
        
        if not latest_scan or not latest_scan.vulnerabilities:
            return None
        
        # Count by status (assuming status field exists or can be computed)
        # For now, return mock data based on actual structures
        total = len(latest_scan.vulnerabilities)
        remediated = max(0, int(total * 0.42))  # Placeholder: 42% remediation rate
        pending = total - remediated
        
        return RemediationStats(
            remediation_rate=42.0,  # Placeholder
            average_remediation_days=14.0,  # Placeholder
            pending_count=pending,
        )

    @staticmethod
    def get_audit_stats(db: Session, start_date: datetime, end_date: datetime) -> AuditStats | None:
        """Get audit log statistics"""
        # Query audit events (placeholder - would need audit log table)
        # For now return mock data
        return AuditStats(
            operation_count=234,
            anomaly_count=3,
            permission_changes=2,
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
            "generated_at": datetime.utcnow(),
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
