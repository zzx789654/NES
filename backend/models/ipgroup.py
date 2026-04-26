from datetime import datetime
from sqlalchemy import Integer, String, DateTime, JSON, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class IPGroup(Base):
    __tablename__ = "ip_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    ips: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
