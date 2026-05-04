from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from sqlalchemy import nulls_last
from sqlalchemy.orm import Session

from database import get_db
from limiter import limiter
from models.audit import AuditScan, AuditResult
from routers.auth import get_current_user, require_role
from schemas.audit import AuditScanOut, AuditScanDetail, AuditDiff, AuditTrendPoint
from services.audit_parser import parse_audit_csv
from services.diff_service import diff_audits

router = APIRouter(prefix="/api/nist", tags=["nist"])

MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB


@router.get("/scans", response_model=list[AuditScanOut])
def list_audit_scans(
    page: Optional[int] = Query(None, ge=1, description="Page number (1-based)"),
    page_size: int = Query(100, ge=1, le=500, description="Results per page (max 500)"),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = (
        db.query(AuditScan)
        .order_by(nulls_last(AuditScan.scan_date.desc()), AuditScan.uploaded_at.desc())
    )
    if page is not None:
        q = q.offset((page - 1) * page_size).limit(page_size)
    return q.all()


@router.get("/scans/{scan_id}", response_model=AuditScanDetail)
def get_audit_scan(scan_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    scan = db.query(AuditScan).filter(AuditScan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Audit scan not found")
    return scan


@router.delete("/scans/{scan_id}", status_code=204)
def delete_audit_scan(
    scan_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin")),
):
    scan = db.query(AuditScan).filter(AuditScan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Audit scan not found")
    db.delete(scan)
    db.commit()


@router.post("/upload", response_model=AuditScanOut, status_code=201)
@limiter.limit("5/minute")
async def upload_audit(
    request: Request,
    file: UploadFile = File(...),
    name: str | None = Form(None),
    scan_date: str = Form(None),
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "analyst")),
):
    content = await file.read()
    filename = (file.filename or "").strip()
    filename_lower = filename.lower()
    if not name:
        name = filename or "Uploaded Audit"

    # File size guard
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum allowed size is 50 MB")

    if not filename_lower.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported")

    # Basic CSV content sanity check
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    parsed_date: date | None = None
    if scan_date:
        try:
            parsed_date = date.fromisoformat(scan_date)
        except ValueError:
            pass

    try:
        parsed = parse_audit_csv(content, name, parsed_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    scan = AuditScan(
        name=parsed["name"],
        scan_date=parsed["scan_date"],
        total=parsed["total"],
        passed=parsed["passed"],
        failed=parsed["failed"],
        warning=parsed["warning"],
    )
    db.add(scan)
    db.flush()

    for r in parsed["results"]:
        db.add(AuditResult(
            scan_id=scan.id,
            check_name=r["check_name"],
            status=r["status"],
            description=r["description"],
            policy_val=r["policy_val"],
            actual_val=r["actual_val"],
        ))

    db.commit()
    db.refresh(scan)
    return scan


@router.get("/diff", response_model=AuditDiff)
def audit_diff(
    base: int,
    comp: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    base_scan = db.query(AuditScan).filter(AuditScan.id == base).first()
    comp_scan = db.query(AuditScan).filter(AuditScan.id == comp).first()
    if not base_scan or not comp_scan:
        raise HTTPException(status_code=404, detail="Audit scan not found")

    result = diff_audits(base_scan.results, comp_scan.results)
    return AuditDiff(base_scan=base_scan, compare_scan=comp_scan, **result)


@router.get("/trend", response_model=list[AuditTrendPoint])
def audit_trend(db: Session = Depends(get_db), _=Depends(get_current_user)):
    scans = (
        db.query(AuditScan)
        .order_by(AuditScan.scan_date.asc().nullsfirst(), AuditScan.uploaded_at.asc())
        .all()
    )
    result = []
    for s in scans:
        pass_rate = round(s.passed / s.total * 100, 1) if s.total > 0 else 0.0
        result.append(AuditTrendPoint(
            scan_id=s.id,
            name=s.name,
            scan_date=s.scan_date,
            pass_rate=pass_rate,
            passed=s.passed,
            failed=s.failed,
            total=s.total,
        ))
    return result
