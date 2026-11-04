"""Add patient-editable conversation titles."""
from alembic import op
import sqlalchemy as sa

revision = "0006_conversation_titles"
down_revision = "0005_clinician_review_note"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("conversations", sa.Column("title", sa.String(length=160), nullable=False, server_default="Health conversation"))
    op.create_index("ix_conversations_patient_title", "conversations", ["patient_user_id", "title"])

def downgrade() -> None:
    op.drop_index("ix_conversations_patient_title", table_name="conversations")
    op.drop_column("conversations", "title")
