import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    username: str
    role: str


class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "viewer"
    password_expires_days: int = 90

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if not 3 <= len(v) <= 50:
            raise ValueError("Username must be between 3 and 50 characters")
        if not re.match(r"^[a-zA-Z0-9_]+$", v):
            raise ValueError("Username may only contain letters, digits, and underscores")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one digit")
        if not re.search(r"[@$!%*?&_\-#^]", v):
            raise ValueError("Password must contain at least one special character (@$!%*?&_-#^)")
        return v


class PasswordChange(BaseModel):
    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def new_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one digit")
        if not re.search(r"[@$!%*?&_\-#^]", v):
            raise ValueError("Password must contain at least one special character (@$!%*?&_-#^)")
        return v


class AdminPasswordReset(BaseModel):
    new_password: str

    @field_validator("new_password")
    @classmethod
    def new_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one digit")
        if not re.search(r"[@$!%*?&_\-#^]", v):
            raise ValueError("Password must contain at least one special character")
        return v


class UserUpdate(BaseModel):
    role: Optional[str] = None
    password_expires_days: Optional[int] = None
    is_active: Optional[bool] = None


class UserOut(BaseModel):
    id: int
    username: str
    role: str

    model_config = {"from_attributes": True}


class UserDetail(BaseModel):
    id: int
    username: str
    role: str
    is_active: bool
    created_at: datetime
    password_changed_at: datetime
    password_expires_days: int
    last_login_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
