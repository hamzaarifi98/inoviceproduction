"""Added category to invoice item

Revision ID: f9e0211f85cf
Revises: 8f2c7d4a9b10
Create Date: 2026-07-01 11:45:35.894140

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f9e0211f85cf'
down_revision: Union[str, Sequence[str], None] = '8f2c7d4a9b10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.add_column(
        "invoice_items",
        sa.Column("category", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("invoice_items", "category")
