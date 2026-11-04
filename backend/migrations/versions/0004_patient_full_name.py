"""Add patient display name to the profile."""
from alembic import op
import sqlalchemy as sa

revision = "0004_patient_full_name"
down_revision = "0003_doctor_review_tracking"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("patient_profiles", sa.Column("full_name", sa.String(length=160), nullable=True))

def downgrade() -> None:
    op.drop_column("patient_profiles", "full_name")
