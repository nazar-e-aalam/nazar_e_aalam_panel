from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e1cf7e6f4e81"
down_revision: str | None | Sequence[str] = "e1cf7e6f4e80"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_table("verse_translations")
    op.drop_table("chapter_translations")
    op.drop_table("translators")
    op.drop_table("haram_codes")


def downgrade() -> None:
    op.create_table(
        "haram_codes",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("code", sa.String(length=255), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status_info", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "translators",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("short_name", sa.String(length=255), nullable=False),
        sa.Column("language", sa.String(length=255), nullable=False),
        sa.Column("language_code", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "chapter_translations",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("chapter_id", sa.BigInteger(), nullable=False),
        sa.Column("translator_id", sa.BigInteger(), nullable=False),
        sa.Column("translate_name", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["chapter_id"], ["chapters.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["translator_id"], ["translators.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "chapter_translation_index",
        "chapter_translations",
        ["chapter_id", "translator_id", "translate_name"],
        unique=False,
    )
    op.create_table(
        "verse_translations",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("chapter_id", sa.BigInteger(), nullable=False),
        sa.Column("chapter_detail_id", sa.BigInteger(), nullable=False),
        sa.Column("translator_id", sa.BigInteger(), nullable=False),
        sa.Column("verse_number", sa.Integer(), nullable=False),
        sa.Column("translate_name", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["chapter_detail_id"], ["chapter_details.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["chapter_id"], ["chapters.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["translator_id"], ["translators.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "verse_translation_index",
        "verse_translations",
        ["chapter_id", "translator_id", "verse_number"],
        unique=False,
    )
