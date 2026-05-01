from datetime import datetime
from sqlalchemy import Boolean, Integer, String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True)
    hashed_pw: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="viewer")  # admin/analyst/viewer
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    password_changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    password_expires_days: Mapped[int] = mapped_column(Integer, default=90)  # 0 = never
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
