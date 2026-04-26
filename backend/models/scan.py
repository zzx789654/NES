from datetime import date, datetime
from sqlalchemy import Integer, String, Date, DateTime, Numeric, Text, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Scan(Base):
    __tablename__ = "scans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    source: Mapped[str] = mapped_column(String(20))  # nessus_csv | nvd_json
    scan_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    host_count: Mapped[int] = mapped_column(Integer, default=0)
    vuln_count: Mapped[int] = mapped_column(Integer, default=0)

    vulnerabilities: Mapped[list["Vulnerability"]] = relationship(
        "Vulnerability", back_populates="scan", cascade="all, delete-orphan"
    )


class Vulnerability(Base):
    __tablename__ = "vulnerabilities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    scan_id: Mapped[int] = mapped_column(Integer, ForeignKey("scans.id", ondelete="CASCADE"))
    plugin_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    cve: Mapped[str | None] = mapped_column(String(50), nullable=True)
    risk: Mapped[str | None] = mapped_column(String(20), nullable=True)  # Critical/High/Medium/Low/Info
    host: Mapped[str | None] = mapped_column(String(50), nullable=True)
    port: Mapped[str | None] = mapped_column(String(10), nullable=True)
    protocol: Mapped[str | None] = mapped_column(String(10), nullable=True)
    name: Mapped[str | None] = mapped_column(Text, nullable=True)
    cvss: Mapped[float | None] = mapped_column(Numeric(4, 1), nullable=True)
    epss: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    vpr: Mapped[float | None] = mapped_column(Numeric(4, 1), nullable=True)
    synopsis: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    solution: Mapped[str | None] = mapped_column(Text, nullable=True)
    plugin_output: Mapped[str | None] = mapped_column(Text, nullable=True)

    scan: Mapped["Scan"] = relationship("Scan", back_populates="vulnerabilities")
