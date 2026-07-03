"""add user to invoice files

Revision ID: 2d98b507a1f0
Revises: c66c9523daa8
Create Date: 2026-06-27 19:48:32.128388

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2d98b507a1f0'
down_revision: Union[str, Sequence[str], None] = 'c66c9523daa8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("""
        INSERT INTO users (id, email, password_hash)
        SELECT 1, 'legacy@example.local', 'legacy'
        WHERE NOT EXISTS (SELECT 1 FROM users)
    """)
    op.execute("""
        SELECT setval(
            pg_get_serial_sequence('users', 'id'),
            (SELECT COALESCE(MAX(id), 1) FROM users),
            true
        )
    """)

    op.add_column('invoice_files', sa.Column('user_id', sa.Integer(), nullable=True))
    op.execute("""
        UPDATE invoice_files
        SET user_id = (SELECT id FROM users ORDER BY id LIMIT 1)
        WHERE user_id IS NULL
    """)
    op.alter_column('invoice_files', 'user_id', nullable=False)
    op.create_index(op.f('ix_invoice_files_user_id'), 'invoice_files', ['user_id'], unique=False)
    op.create_foreign_key(
        'fk_invoice_files_user_id_users',
        'invoice_files',
        'users',
        ['user_id'],
        ['id'],
        ondelete='CASCADE',
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_invoice_files_user_id_users', 'invoice_files', type_='foreignkey')
    op.drop_index(op.f('ix_invoice_files_user_id'), table_name='invoice_files')
    op.drop_column('invoice_files', 'user_id')
