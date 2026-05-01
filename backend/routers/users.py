from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from routers.auth import get_current_user, hash_password, require_role
from schemas.auth import AdminPasswordReset, UserCreate, UserDetail, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=List[UserDetail])
def list_users(
    db: Session = Depends(get_db),
    _=Depends(require_role("admin")),
):
    return db.query(User).order_by(User.id).all()


@router.put("/{user_id}", response_model=UserDetail)
def update_user(
    user_id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    allowed_roles = {"admin", "analyst", "viewer"}
    if body.role is not None:
        if body.role not in allowed_roles:
            raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(allowed_roles)}")
        user.role = body.role

    if body.password_expires_days is not None:
        if body.password_expires_days < 0:
            raise HTTPException(status_code=400, detail="password_expires_days must be >= 0")
        user.password_expires_days = body.password_expires_days

    if body.is_active is not None:
        # Admin cannot deactivate themselves
        if not body.is_active and user.id == current_user.id:
            raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
        user.is_active = body.is_active

    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}/activate", response_model=UserDetail)
def toggle_active(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return user


@router.post("/{user_id}/reset-password", status_code=204)
def reset_password(
    user_id: int,
    body: AdminPasswordReset,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.hashed_pw = hash_password(body.new_password)
    user.password_changed_at = datetime.now(timezone.utc)
    db.commit()


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    db.delete(user)
    db.commit()
