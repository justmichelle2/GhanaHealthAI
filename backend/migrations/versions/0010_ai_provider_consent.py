"""Persist patient consent for future AI provider requests."""
from alembic import op
import sqlalchemy as sa

revision = "0010_ai_provider_consent"
down_revision = "0009_patient_message_consent"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "patient_profiles",
        sa.Column("ai_provider_consent_given_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("patient_profiles", "ai_provider_consent_given_at")
