from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.ipgroup import IPGroup
from routers.auth import get_current_user, require_role
from schemas.ipgroup import IPGroupCreate, IPGroupUpdate, IPGroupOut

router = APIRouter(prefix="/api/ipgroups", tags=["ipgroups"])


@router.get("", response_model=list[IPGroupOut])
def list_groups(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(IPGroup).order_by(IPGroup.name).all()


@router.post("", response_model=IPGroupOut, status_code=201)
def create_group(
    body: IPGroupCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "analyst")),
):
    if db.query(IPGroup).filter(IPGroup.name == body.name).first():
        raise HTTPException(status_code=409, detail="Group name already exists")
    group = IPGroup(name=body.name, ips=body.ips)
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


@router.put("/{group_id}", response_model=IPGroupOut)
def update_group(
    group_id: int,
    body: IPGroupUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "analyst")),
):
    group = db.query(IPGroup).filter(IPGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="IP group not found")
    if body.name is not None:
        dup = (
            db.query(IPGroup)
            .filter(IPGroup.name == body.name, IPGroup.id != group_id)
            .first()
        )
        if dup:
            raise HTTPException(status_code=409, detail="Group name already exists")
        group.name = body.name
    if body.ips is not None:
        group.ips = body.ips
    db.commit()
    db.refresh(group)
    return group


@router.delete("/{group_id}", status_code=204)
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "analyst")),
):
    group = db.query(IPGroup).filter(IPGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="IP group not found")
    db.delete(group)
    db.commit()
