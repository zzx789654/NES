"""extend vulnerabilities table with new fields

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-01
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Rename legacy cvss -> cvss_v3_base (if column exists)
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "postgresql":
        # PostgreSQL: check if old 'cvss' column exists before renaming
        result = bind.execute(sa.text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='vulnerabilities' AND column_name='cvss'"
        ))
        if result.fetchone():
            op.alter_column("vulnerabilities", "cvss", new_column_name="cvss_v3_base")
        else:
            # Already renamed or does not exist - add if missing
            result2 = bind.execute(sa.text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='vulnerabilities' AND column_name='cvss_v3_base'"
            ))
            if not result2.fetchone():
                op.add_column("vulnerabilities", sa.Column("cvss_v3_base", sa.Numeric(4, 1), nullable=True))
    else:
        # SQLite: no ALTER COLUMN RENAME — recreate is complex; just add cvss_v3_base if missing
        try:
            op.add_column("vulnerabilities", sa.Column("cvss_v3_base", sa.Numeric(4, 1), nullable=True))
        except Exception:
            pass  # column already exists

    # Add all new columns (IF NOT EXISTS equivalent via try/except per dialect)
    nullable_columns = [
        ("cvss_v2_base",             sa.Numeric(4, 1)),
        ("cvss_v2_temporal",         sa.Numeric(4, 1)),
        ("cvss_v3_temporal",         sa.Numeric(4, 1)),
        ("cvss_v4_base",             sa.Numeric(4, 1)),
        ("cvss_v4_threat_score",     sa.Numeric(4, 1)),
        ("risk_factor",              sa.String(50)),
        ("stig_severity",            sa.String(20)),
        ("see_also",                 sa.Text()),
        ("bid",                      sa.String(50)),
        ("xref",                     sa.Text()),
        ("mskb",                     sa.String(50)),
        ("plugin_publication_date",  sa.Date()),
        ("plugin_modification_date", sa.Date()),
    ]
    boolean_columns = ["metasploit", "core_impact", "canvas"]

    for col_name, col_type in nullable_columns:
        if dialect == "postgresql":
            exists = bind.execute(sa.text(
                "SELECT column_name FROM information_schema.columns "
                f"WHERE table_name='vulnerabilities' AND column_name='{col_name}'"
            )).fetchone()
            if exists:
                continue
        try:
            op.add_column("vulnerabilities", sa.Column(col_name, col_type, nullable=True))
        except Exception:
            pass  # column already exists (SQLite path)

    for col_name in boolean_columns:
        if dialect == "postgresql":
            exists = bind.execute(sa.text(
                "SELECT column_name FROM information_schema.columns "
                f"WHERE table_name='vulnerabilities' AND column_name='{col_name}'"
            )).fetchone()
            if exists:
                continue
        try:
            op.add_column("vulnerabilities", sa.Column(col_name, sa.Boolean(), nullable=False, server_default="false"))
        except Exception:
            pass  # column already exists (SQLite path)


def downgrade() -> None:
    for col_name in [
        "cvss_v2_base", "cvss_v2_temporal", "cvss_v3_temporal",
        "cvss_v4_base", "cvss_v4_threat_score",
        "risk_factor", "stig_severity", "see_also",
        "bid", "xref", "mskb",
        "plugin_publication_date", "plugin_modification_date",
        "metasploit", "core_impact", "canvas",
    ]:
        try:
            op.drop_column("vulnerabilities", col_name)
        except Exception:
            pass

    # Rename cvss_v3_base back to cvss
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        try:
            op.alter_column("vulnerabilities", "cvss_v3_base", new_column_name="cvss")
        except Exception:
            pass
