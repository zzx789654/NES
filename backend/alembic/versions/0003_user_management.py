"""add user management fields (is_active, password expiry, last_login)

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-01
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    def _col_exists(table: str, col: str) -> bool:
        if dialect == "postgresql":
            r = bind.execute(sa.text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name=:t AND column_name=:c"
            ), {"t": table, "c": col})
        else:
            r = bind.execute(sa.text(f"PRAGMA table_info({table})"))
            return any(row[1] == col for row in r.fetchall())
        return r.fetchone() is not None

    if not _col_exists("users", "is_active"):
        op.add_column("users", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))

    if not _col_exists("users", "password_changed_at"):
        op.add_column("users", sa.Column(
            "password_changed_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.func.now()
        ))

    if not _col_exists("users", "password_expires_days"):
        op.add_column("users", sa.Column("password_expires_days", sa.Integer(), nullable=False, server_default="90"))

    if not _col_exists("users", "last_login_at"):
        op.add_column("users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "last_login_at")
    op.drop_column("users", "password_expires_days")
    op.drop_column("users", "password_changed_at")
    op.drop_column("users", "is_active")
