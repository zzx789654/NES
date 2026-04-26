from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database import get_db
from models.scan import Scan, Vulnerability
from routers.auth import get_current_user, require_role
from schemas.scan import ScanOut, ScanDetail, ScanDiff
from services.nessus_parser import parse_nessus_csv
from services.cve_parser import parse_nvd_json
from services.diff_service import diff_scans
from services.epss_service import fetch_epss_scores

router = APIRouter(prefix="/api/scans", tags=["scans"])


@router.get("", response_model=list[ScanOut])
def list_scans(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Scan).order_by(Scan.scan_date.desc().nullslast(), Scan.uploaded_at.desc()).all()


@router.get("/{scan_id}", response_model=ScanDetail)
def get_scan(scan_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan


@router.delete("/{scan_id}", status_code=204)
def delete_scan(scan_id: int, db: Session = Depends(get_db), _=Depends(require_role("admin", "analyst"))):
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    db.delete(scan)
    db.commit()


@router.post("/upload", response_model=ScanOut, status_code=201)
async def upload_scan(
    file: UploadFile = File(...),
    name: str = Form(...),
    scan_date: str = Form(None),
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "analyst")),
):
    content = await file.read()
    filename = file.filename or ""

    parsed_date: date | None = None
    if scan_date:
        try:
            parsed_date = date.fromisoformat(scan_date)
        except ValueError:
            pass

    if filename.endswith(".csv"):
        parsed = parse_nessus_csv(content, name, parsed_date)
    elif filename.endswith(".json"):
        parsed = parse_nvd_json(content, name, parsed_date)
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type. Upload .csv or .json")

    scan = Scan(
        name=parsed["name"],
        source=parsed["source"],
        scan_date=parsed["scan_date"],
        host_count=parsed["host_count"],
        vuln_count=parsed["vuln_count"],
    )
    db.add(scan)
    db.flush()

    cves = [v["cve"] for v in parsed["vulnerabilities"] if v.get("cve")]
    epss_map = await fetch_epss_scores(cves)

    for v in parsed["vulnerabilities"]:
        cve = (v.get("cve") or "").upper()
        vuln = Vulnerability(
            scan_id=scan.id,
            plugin_id=v.get("plugin_id"),
            cve=v.get("cve"),
            risk=v.get("risk"),
            host=v.get("host"),
            port=v.get("port"),
            protocol=v.get("protocol"),
            name=v.get("name"),
            cvss=v.get("cvss"),
            epss=epss_map.get(cve),
            synopsis=v.get("synopsis"),
            description=v.get("description"),
            solution=v.get("solution"),
            plugin_output=v.get("plugin_output"),
        )
        db.add(vuln)

    db.commit()
    db.refresh(scan)
    return scan


@router.get("/diff", response_model=ScanDiff)
def scan_diff(
    base: int,
    comp: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    base_scan = db.query(Scan).filter(Scan.id == base).first()
    comp_scan = db.query(Scan).filter(Scan.id == comp).first()
    if not base_scan or not comp_scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    result = diff_scans(base_scan.vulnerabilities, comp_scan.vulnerabilities)
    return ScanDiff(
        base_scan=base_scan,
        compare_scan=comp_scan,
        **result,
    )
