from alembic import op
import sqlalchemy as sa

revision = "0001_initial_auth"
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    uid = sa.Uuid(as_uuid=True)
    op.create_table("users", sa.Column("id", uid, primary_key=True), sa.Column("email", sa.String(320), nullable=False), sa.Column("password_hash", sa.String(512), nullable=False), sa.Column("role", sa.String(16), nullable=False), sa.Column("is_active", sa.Boolean(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.CheckConstraint("role IN ('patient', 'doctor', 'admin')", name="ck_users_role"))
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_table("patient_profiles", sa.Column("user_id", uid, sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True), sa.Column("preferred_language", sa.String(32)), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_table("doctor_profiles", sa.Column("user_id", uid, sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True), sa.Column("display_name", sa.String(160)), sa.Column("professional_details", sa.String(500)), sa.Column("is_verified", sa.Boolean(), nullable=False))
    op.create_table("audit_logs", sa.Column("id", uid, primary_key=True), sa.Column("actor_user_id", uid, sa.ForeignKey("users.id", ondelete="SET NULL")), sa.Column("action", sa.String(80), nullable=False), sa.Column("resource_type", sa.String(80), nullable=False), sa.Column("resource_id", sa.String(100)), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])

def downgrade() -> None:
    op.drop_index("ix_audit_logs_created_at", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_table("doctor_profiles")
    op.drop_table("patient_profiles")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
