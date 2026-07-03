"""add email verification to users

Revision ID: 1b7c4d9e2a01
Revises: 5a6f9c8b2d1e
Create Date: 2026-07-03 14:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "1b7c4d9e2a01"
down_revision: Union[str, Sequence[str], None] = "5a6f9c8b2d1e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_email_verified", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "users",
        sa.Column("email_verification_pin_hash", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("email_verification_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.alter_column("users", "is_email_verified", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "email_verification_expires_at")
    op.drop_column("users", "email_verification_pin_hash")
    op.drop_column("users", "is_email_verified")
