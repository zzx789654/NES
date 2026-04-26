"""initial schema

Revision ID: 0001
Revises:
Create Date: 2025-04-26
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "scans",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("scan_date", sa.Date, nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("host_count", sa.Integer, default=0),
        sa.Column("vuln_count", sa.Integer, default=0),
    )
    op.create_table(
        "vulnerabilities",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("scan_id", sa.Integer, sa.ForeignKey("scans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plugin_id", sa.String(50), nullable=True),
        sa.Column("cve", sa.String(50), nullable=True),
        sa.Column("risk", sa.String(20), nullable=True),
        sa.Column("host", sa.String(50), nullable=True),
        sa.Column("port", sa.String(10), nullable=True),
        sa.Column("protocol", sa.String(10), nullable=True),
        sa.Column("name", sa.Text, nullable=True),
        sa.Column("cvss", sa.Numeric(4, 1), nullable=True),
        sa.Column("epss", sa.Numeric(6, 4), nullable=True),
        sa.Column("vpr", sa.Numeric(4, 1), nullable=True),
        sa.Column("synopsis", sa.Text, nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("solution", sa.Text, nullable=True),
        sa.Column("plugin_output", sa.Text, nullable=True),
    )
    op.create_table(
        "audit_scans",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("scan_date", sa.Date, nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("total", sa.Integer, default=0),
        sa.Column("passed", sa.Integer, default=0),
        sa.Column("failed", sa.Integer, default=0),
        sa.Column("warning", sa.Integer, default=0),
    )
    op.create_table(
        "audit_results",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("scan_id", sa.Integer, sa.ForeignKey("audit_scans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("check_name", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("policy_val", sa.Text, nullable=True),
        sa.Column("actual_val", sa.Text, nullable=True),
    )
    op.create_table(
        "ip_groups",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("ips", sa.JSON, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("username", sa.String(100), nullable=False, unique=True),
        sa.Column("hashed_pw", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="viewer"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("users")
    op.drop_table("ip_groups")
    op.drop_table("audit_results")
    op.drop_table("audit_scans")
    op.drop_table("vulnerabilities")
    op.drop_table("scans")
