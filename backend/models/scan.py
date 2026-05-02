from datetime import date, datetime
from typing import Optional
from sqlalchemy import Integer, String, Date, DateTime, Numeric, Text, ForeignKey, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Scan(Base):
    __tablename__ = "scans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    source: Mapped[str] = mapped_column(String(20))  # nessus_csv | nvd_json
    scan_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
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
    plugin_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    cve: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    risk: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # Critical/High/Medium/Low/Info
    host: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    port: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    protocol: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # CVSS 評分 - 多版本支持
    cvss_v2_base: Mapped[Optional[float]] = mapped_column(Numeric(4, 1), nullable=True)
    cvss_v2_temporal: Mapped[Optional[float]] = mapped_column(Numeric(4, 1), nullable=True)
    cvss_v3_base: Mapped[Optional[float]] = mapped_column(Numeric(4, 1), nullable=True)  # 原 cvss
    cvss_v3_temporal: Mapped[Optional[float]] = mapped_column(Numeric(4, 1), nullable=True)
    cvss_v4_base: Mapped[Optional[float]] = mapped_column(Numeric(4, 1), nullable=True)
    cvss_v4_threat_score: Mapped[Optional[float]] = mapped_column(Numeric(4, 1), nullable=True)
    
    # 風險評分
    epss: Mapped[Optional[float]] = mapped_column(Numeric(6, 4), nullable=True)
    vpr: Mapped[Optional[float]] = mapped_column(Numeric(4, 1), nullable=True)
    
    # 風險分類
    risk_factor: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    stig_severity: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    
    # 詳細描述
    synopsis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    solution: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    plugin_output: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # 參考資訊
    see_also: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    bid: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    xref: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    mskb: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    # 元數據
    plugin_publication_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    plugin_modification_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    
    # 利用方式
    metasploit: Mapped[bool] = mapped_column(default=False)
    core_impact: Mapped[bool] = mapped_column(default=False)
    canvas: Mapped[bool] = mapped_column(default=False)

    scan: Mapped["Scan"] = relationship("Scan", back_populates="vulnerabilities")
