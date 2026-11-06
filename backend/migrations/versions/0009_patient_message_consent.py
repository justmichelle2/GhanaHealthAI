"""Persist a patient's message storage consent preference."""
from alembic import op
import sqlalchemy as sa

revision = "0009_patient_message_consent"
down_revision = "0008_recovery_and_shares"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "patient_profiles",
        sa.Column("message_storage_consent", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("patient_profiles", "message_storage_consent")
