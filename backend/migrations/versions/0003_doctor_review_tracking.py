"""Track verified clinician review of patient submissions."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003_doctor_review_tracking"
down_revision = "0002_patient_conversations"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("conversations", sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("conversations", sa.Column("reviewed_by_user_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_conversations_reviewed_by_user_id_users", "conversations", "users", ["reviewed_by_user_id"], ["id"], ondelete="SET NULL")

def downgrade() -> None:
    op.drop_constraint("fk_conversations_reviewed_by_user_id_users", "conversations", type_="foreignkey")
    op.drop_column("conversations", "reviewed_by_user_id")
    op.drop_column("conversations", "reviewed_at")
