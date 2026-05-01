from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from limiter import limiter
from models.user import User
from pydantic import BaseModel, field_validator
from schemas.auth import Token, TokenData, UserCreate, UserDetail, UserOut, PasswordChange

router = APIRouter(prefix="/api/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def _is_password_expired(user: User) -> bool:
    if user.password_expires_days == 0:
        return False
    changed = user.password_changed_at
    if changed.tzinfo is None:
        changed = changed.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) > changed + timedelta(days=user.password_expires_days)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exc
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    return user


def require_role(*roles: str):
    def dependency(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return dependency


@router.post("/token", response_model=Token)
@limiter.limit("10/minute")
def login(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form.username).first()
    if not user or not verify_password(form.password, user.hashed_pw):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    # Password expiry check — return 403 with flag so frontend can redirect
    if _is_password_expired(user):
        raise HTTPException(
            status_code=403,
            detail={"password_expired": True, "username": user.username},
        )

    # Update last login time
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    token = create_access_token({"sub": user.username, "role": user.role})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/register", response_model=UserOut, status_code=201)
def register(
    body: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can register new users")
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=409, detail="Username already exists")
    allowed_roles = {"admin", "analyst", "viewer"}
    if body.role not in allowed_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(allowed_roles)}")
    user = User(
        username=body.username,
        hashed_pw=hash_password(body.password),
        role=body.role,
        password_expires_days=body.password_expires_days,
        password_changed_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/me", response_model=UserDetail)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/change-password", status_code=204)
def change_password(
    body: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(body.old_password, current_user.hashed_pw):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if body.old_password == body.new_password:
        raise HTTPException(status_code=400, detail="New password must differ from current password")
    current_user.hashed_pw = hash_password(body.new_password)
    current_user.password_changed_at = datetime.now(timezone.utc)
    db.commit()


class ExpiredPasswordChange(BaseModel):
    username: str
    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def strength(cls, v: str) -> str:
        import re
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one digit")
        if not re.search(r"[@$!%*?&_\-#^]", v):
            raise ValueError("Password must contain at least one special character")
        return v


@router.post("/change-expired-password", response_model=Token)
def change_expired_password(body: ExpiredPasswordChange, db: Session = Depends(get_db)):
    """Allow an unauthenticated user with an expired password to change it and receive a token."""
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.old_password, user.hashed_pw):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    if not _is_password_expired(user):
        raise HTTPException(status_code=400, detail="Password is not expired")
    if body.old_password == body.new_password:
        raise HTTPException(status_code=400, detail="New password must differ from current password")
    user.hashed_pw = hash_password(body.new_password)
    user.password_changed_at = datetime.now(timezone.utc)
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    token = create_access_token({"sub": user.username, "role": user.role})
    return {"access_token": token, "token_type": "bearer"}
