"""Track the most recent conversation activity."""
from alembic import op
import sqlalchemy as sa

revision = "0007_conversation_updated_at"
down_revision = "0006_conversation_titles"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("conversations", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE conversations SET updated_at = created_at WHERE updated_at IS NULL")
    op.alter_column("conversations", "updated_at", nullable=False, server_default=sa.func.now())
    op.create_index("ix_conversations_patient_updated", "conversations", ["patient_user_id", "updated_at"])

def downgrade() -> None:
    op.drop_index("ix_conversations_patient_updated", table_name="conversations")
    op.drop_column("conversations", "updated_at")
