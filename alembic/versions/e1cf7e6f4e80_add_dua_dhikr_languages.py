from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e1cf7e6f4e80"
down_revision: str | None | Sequence[str] = "e1cf7e6f4e79"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


NEW_LANG_COLUMNS = {
    "guj": ("guj_short_name", "guj_full_name", "guj_fazilat"),
    "hin": ("hin_short_name", "hin_full_name", "hin_fazilat"),
    "ur": ("ur_short_name", "ur_full_name", "ur_fazilat"),
    "sw": ("sw_short_name", "sw_full_name", "sw_fazilat"),
}


EN_AR_FAZILAT = {"en": "en_fazilat", "ar": "ar_fazilat"}


def _add_lang_columns(table: str) -> None:
    for lang, (short_col, full_col, fazilat_col) in NEW_LANG_COLUMNS.items():
        op.add_column(table, sa.Column(short_col, sa.String(255), nullable=True))
        op.add_column(table, sa.Column(full_col, sa.Text(), nullable=True))
        op.add_column(table, sa.Column(fazilat_col, sa.Text(), nullable=True))

    for lang, fazilat_col in EN_AR_FAZILAT.items():
        op.add_column(table, sa.Column(fazilat_col, sa.Text(), nullable=True))


def _drop_lang_columns(table: str) -> None:
    for lang, (short_col, full_col, fazilat_col) in NEW_LANG_COLUMNS.items():
        op.drop_column(table, short_col)
        op.drop_column(table, full_col)
        op.drop_column(table, fazilat_col)
    for lang, fazilat_col in EN_AR_FAZILAT.items():
        op.drop_column(table, fazilat_col)


def upgrade() -> None:
    _add_lang_columns("duas")
    _add_lang_columns("dhikrs")


def downgrade() -> None:
    _drop_lang_columns("dhikrs")
    _drop_lang_columns("duas")
