"""add public id to users

Revision ID: 8f2c7d4a9b10
Revises: 2d98b507a1f0
Create Date: 2026-06-27 20:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "8f2c7d4a9b10"
down_revision: Union[str, Sequence[str], None] = "2d98b507a1f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.execute("UPDATE users SET public_id = gen_random_uuid() WHERE public_id IS NULL")
    op.alter_column("users", "public_id", nullable=False)
    op.create_index(op.f("ix_users_public_id"), "users", ["public_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_public_id"), table_name="users")
    op.drop_column("users", "public_id")
