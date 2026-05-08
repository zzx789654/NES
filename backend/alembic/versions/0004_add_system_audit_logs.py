"""add system_audit_logs table

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-08
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "system_audit_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("timestamp", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("user_id", sa.Integer, nullable=True),
        sa.Column("action", sa.String(100), nullable=False, server_default=""),
        sa.Column("resource", sa.String(100), nullable=False, server_default=""),
        sa.Column("details", sa.Text, nullable=True),
        sa.Column("status_code", sa.Integer, nullable=False, server_default="200"),
    )
    op.create_index("ix_audit_log_timestamp",   "system_audit_logs", ["timestamp"])
    op.create_index("ix_audit_log_status_code", "system_audit_logs", ["status_code"])


def downgrade() -> None:
    op.drop_index("ix_audit_log_status_code", table_name="system_audit_logs")
    op.drop_index("ix_audit_log_timestamp",   table_name="system_audit_logs")
    op.drop_table("system_audit_logs")
