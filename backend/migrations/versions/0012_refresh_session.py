"""Store session version on refresh tokens for revocation on password change."""
from alembic import op
import sqlalchemy as sa

revision = "0012_refresh_session"
down_revision = "0011_refresh_tokens"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "refresh_tokens",
        sa.Column("session_version", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("refresh_tokens", "session_version")
