from datetime import date, datetime
from sqlalchemy import Integer, String, Date, DateTime, Text, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class AuditScan(Base):
    __tablename__ = "audit_scans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    scan_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    total: Mapped[int] = mapped_column(Integer, default=0)
    passed: Mapped[int] = mapped_column(Integer, default=0)
    failed: Mapped[int] = mapped_column(Integer, default=0)
    warning: Mapped[int] = mapped_column(Integer, default=0)

    results: Mapped[list["AuditResult"]] = relationship(
        "AuditResult", back_populates="scan", cascade="all, delete-orphan"
    )


class AuditResult(Base):
    __tablename__ = "audit_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    scan_id: Mapped[int] = mapped_column(Integer, ForeignKey("audit_scans.id", ondelete="CASCADE"))
    check_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str | None] = mapped_column(String(20), nullable=True)  # PASSED/FAILED/WARNING
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    policy_val: Mapped[str | None] = mapped_column(Text, nullable=True)
    actual_val: Mapped[str | None] = mapped_column(Text, nullable=True)

    scan: Mapped["AuditScan"] = relationship("AuditScan", back_populates="results")
