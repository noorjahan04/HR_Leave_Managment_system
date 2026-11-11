"""add phone to users

Revision ID: 27918dd58dd1
Revises: 0001_initial
Create Date: 2026-11-11 12:43:41.891132
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '27918dd58dd1'
down_revision: Union[str, None] = '0001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('phone', sa.String(length=15), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'phone')
