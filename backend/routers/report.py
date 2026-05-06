"""
Reports API router — generate and export security reports
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from routers.auth import get_current_user
from schemas.report import ReportRequest, ReportResponse, ReportData
from services.report_service import ReportService

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.post("/generate", response_model=ReportResponse)
def generate_report(
    request: ReportRequest,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Generate a report based on selected modules and time range.
    
    Modules:
    - risk_overview: Vulnerability distribution and CVSS scores
    - compliance: NIST framework compliance status
    - scan_efficiency: Scan coverage and CVE/EPSS trends
    - remediation_progress: Remediation rate and pending items
    - audit_log: System operations and security events
    
    Time ranges:
    - 7d, 30d, 90d: predefined ranges
    - custom: use customStart and customEnd (ISO format)
    """
    if not request.modules:
        raise HTTPException(status_code=400, detail="At least one module must be selected")
    
    try:
        report_data = ReportService.generate_report(
            db=db,
            modules=request.modules,
            time_range=request.timeRange,
            custom_start=request.customStart,
            custom_end=request.customEnd,
            title=request.title,
            description=request.description,
        )
        
        return ReportResponse(
            success=True,
            data=report_data,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")


@router.get("/modules", response_model=dict)
def get_available_modules(_=Depends(get_current_user)):
    """Get list of available report modules"""
    return {
        "modules": [
            {
                "id": "risk_overview",
                "name": "風險概覽報表",
                "description": "弱點分布、CVSS評分、高風險資產排名",
            },
            {
                "id": "compliance",
                "name": "合規性報表",
                "description": "NIST框架合規率、控制措施狀態",
            },
            {
                "id": "scan_efficiency",
                "name": "掃描效能報表",
                "description": "掃描覆蓋率、CVE/EPSS趨勢分析",
            },
            {
                "id": "remediation_progress",
                "name": "修復進度報表",
                "description": "已修復數量、優先級分布、修復週期",
            },
            {
                "id": "audit_log",
                "name": "審計日誌報表",
                "description": "系統操作記錄、權限變更、異常檢測",
            },
        ]
    }
