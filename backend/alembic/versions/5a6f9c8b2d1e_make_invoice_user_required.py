"""make invoice user required

Revision ID: 5a6f9c8b2d1e
Revises: f9e0211f85cf
Create Date: 2026-07-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "5a6f9c8b2d1e"
down_revision: Union[str, Sequence[str], None] = "f9e0211f85cf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("invoices", sa.Column("user_id", sa.Integer(), nullable=True))
    op.execute(
        """
        UPDATE invoices
        SET user_id = invoice_files.user_id
        FROM invoice_files
        WHERE invoices.invoice_file_id = invoice_files.id
          AND invoices.user_id IS NULL
        """
    )
    op.execute(
        """
        UPDATE invoices
        SET user_id = (SELECT id FROM users ORDER BY id LIMIT 1)
        WHERE user_id IS NULL
          AND EXISTS (SELECT 1 FROM users)
        """
    )
    op.alter_column("invoices", "user_id", existing_type=sa.Integer(), nullable=False)
    op.create_index(op.f("ix_invoices_user_id"), "invoices", ["user_id"], unique=False)
    op.create_foreign_key(
        "fk_invoices_user_id_users",
        "invoices",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("fk_invoices_user_id_users", "invoices", type_="foreignkey")
    op.drop_index(op.f("ix_invoices_user_id"), table_name="invoices")
    op.drop_column("invoices", "user_id")
