"""add password reset and pipeline logs

Revision ID: 9a1b2c3d4e5f
Revises: 6f4a2c9d8b10
Create Date: 2026-07-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "9a1b2c3d4e5f"
down_revision: Union[str, Sequence[str], None] = "6f4a2c9d8b10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("password_reset_pin_hash", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("password_reset_expires_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "invoice_processing_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("invoice_file_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("stage", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["invoice_file_id"],
            ["invoice_files.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_invoice_processing_logs_invoice_file_id"),
        "invoice_processing_logs",
        ["invoice_file_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_invoice_processing_logs_stage"),
        "invoice_processing_logs",
        ["stage"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_invoice_processing_logs_stage"), table_name="invoice_processing_logs")
    op.drop_index(op.f("ix_invoice_processing_logs_invoice_file_id"), table_name="invoice_processing_logs")
    op.drop_table("invoice_processing_logs")
    op.drop_column("users", "password_reset_expires_at")
    op.drop_column("users", "password_reset_pin_hash")
