"""Add a private clinician review note to submissions."""
from alembic import op
import sqlalchemy as sa

revision = "0005_clinician_review_note"
down_revision = "0004_patient_full_name"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("conversations", sa.Column("review_note", sa.Text(), nullable=True))

def downgrade() -> None:
    op.drop_column("conversations", "review_note")
