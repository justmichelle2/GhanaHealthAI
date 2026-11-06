"""Persist patient message-storage consent on the profile."""
from alembic import op
import sqlalchemy as sa

revision = "0009_patient_message_consent"
down_revision = "0008_recovery_and_shares"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "patient_profiles",
        sa.Column("messages_consent_given_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("patient_profiles", "messages_consent_given_at")
