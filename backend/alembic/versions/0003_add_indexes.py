"""add indexes for query performance

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-04
"""
from typing import Sequence, Union
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # vulnerabilities — most queried columns
    op.create_index("ix_vuln_scan_id",   "vulnerabilities", ["scan_id"])
    op.create_index("ix_vuln_risk",      "vulnerabilities", ["risk"])
    op.create_index("ix_vuln_host",      "vulnerabilities", ["host"])
    op.create_index("ix_vuln_cve",       "vulnerabilities", ["cve"])
    op.create_index("ix_vuln_epss",      "vulnerabilities", ["epss"])
    op.create_index("ix_vuln_plugin_id", "vulnerabilities", ["plugin_id"])

    # scans — ordering / filtering
    op.create_index("ix_scan_uploaded_at", "scans", ["uploaded_at"])
    op.create_index("ix_scan_scan_date",   "scans", ["scan_date"])

    # audit_results — same pattern
    op.create_index("ix_audit_result_scan_id", "audit_results", ["scan_id"])
    op.create_index("ix_audit_result_status",  "audit_results", ["status"])


def downgrade() -> None:
    op.drop_index("ix_audit_result_status",  table_name="audit_results")
    op.drop_index("ix_audit_result_scan_id", table_name="audit_results")
    op.drop_index("ix_scan_scan_date",       table_name="scans")
    op.drop_index("ix_scan_uploaded_at",     table_name="scans")
    op.drop_index("ix_vuln_plugin_id",       table_name="vulnerabilities")
    op.drop_index("ix_vuln_epss",            table_name="vulnerabilities")
    op.drop_index("ix_vuln_cve",             table_name="vulnerabilities")
    op.drop_index("ix_vuln_host",            table_name="vulnerabilities")
    op.drop_index("ix_vuln_risk",            table_name="vulnerabilities")
    op.drop_index("ix_vuln_scan_id",         table_name="vulnerabilities")
