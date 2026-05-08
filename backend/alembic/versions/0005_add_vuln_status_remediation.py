"""add status and remediation_date to vulnerabilities

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-08

These two columns were present in the Vulnerability ORM model but were
never included in any migration, causing HTTP 500 on every endpoint
that reads vulnerabilities (GET /api/scans/{id}/vulns, /api/dashboard,
/api/scans/diff, etc.) in production deployments that use Alembic.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "vulnerabilities",
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
    )
    op.add_column(
        "vulnerabilities",
        sa.Column("remediation_date", sa.DateTime, nullable=True),
    )
    op.create_index("ix_vuln_status", "vulnerabilities", ["status"])


def downgrade() -> None:
    op.drop_index("ix_vuln_status", table_name="vulnerabilities")
    op.drop_column("vulnerabilities", "remediation_date")
    op.drop_column("vulnerabilities", "status")
