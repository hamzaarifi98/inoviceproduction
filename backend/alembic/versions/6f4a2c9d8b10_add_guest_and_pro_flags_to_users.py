"""add guest and pro flags to users

Revision ID: 6f4a2c9d8b10
Revises: 1b7c4d9e2a01
Create Date: 2026-07-03 17:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "6f4a2c9d8b10"
down_revision: Union[str, Sequence[str], None] = "1b7c4d9e2a01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_guest", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "users",
        sa.Column("is_pro", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.alter_column("users", "is_guest", server_default=None)
    op.alter_column("users", "is_pro", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "is_pro")
    op.drop_column("users", "is_guest")
