"""Local operator bootstrap for administrator and unverified clinician accounts.

Passwords are prompted through getpass and never accepted as command-line values.
Run only on a trusted development machine connected to the configured PostgreSQL DB.
"""
import argparse
from getpass import getpass

from email_validator import EmailNotValidError, validate_email
from sqlalchemy import func, select

from app.core.database import get_session_factory
from app.core.security import hash_password, verify_password
from app.models import AuditLog, DoctorProfile, User, UserRole


def ask_email(label: str) -> str:
    try:
        return validate_email(input(label).strip(), check_deliverability=False).normalized.lower()
    except EmailNotValidError:
        raise SystemExit("Enter a valid email address.") from None


def ask_password() -> str:
    password = getpass("Password (minimum 12 characters): ")
    confirmation = getpass("Confirm password: ")
    if len(password) < 12:
        raise SystemExit("Password must be at least 12 characters.")
    if password != confirmation:
        raise SystemExit("Passwords did not match.")
    return password


def create_first_admin() -> None:
    with get_session_factory()() as db:
        if db.scalar(select(User.id).where(User.role == UserRole.ADMIN.value).limit(1)):
            raise SystemExit("An administrator already exists. Use the admin dashboard instead.")
        email = ask_email("Administrator email: ")
        if db.scalar(select(User.id).where(func.lower(User.email) == email)):
            raise SystemExit("An account with that email already exists.")
        user = User(email=email, password_hash=hash_password(ask_password()), role=UserRole.ADMIN.value)
        db.add(user)
        db.flush()
        db.add(AuditLog(actor_user_id=user.id, action="initial_admin_created", resource_type="user", resource_id=str(user.id)))
        db.commit()
        print("Initial administrator created. Keep the sign-in credentials private.")


def create_unverified_doctor() -> None:
    with get_session_factory()() as db:
        admin_email = ask_email("Existing administrator email: ")
        admin = db.scalar(select(User).where(func.lower(User.email) == admin_email))
        if admin is None or not admin.is_active or admin.role != UserRole.ADMIN.value:
            raise SystemExit("Active administrator account not found.")
        if not verify_password(getpass("Administrator password: "), admin.password_hash):
            raise SystemExit("Administrator authentication failed.")

        email = ask_email("Clinician email: ")
        if db.scalar(select(User.id).where(func.lower(User.email) == email)):
            raise SystemExit("An account with that email already exists.")
        display_name = input("Clinician display name: ").strip()
        credential_details = input("Professional credential / registration details: ").strip()
        if len(display_name) < 2 or not credential_details:
            raise SystemExit("Enter the clinician name and credential details.")
        user = User(email=email, password_hash=hash_password(ask_password()), role=UserRole.DOCTOR.value)
        user.doctor_profile = DoctorProfile(
            display_name=display_name,
            professional_details=credential_details,
            is_verified=False,
        )
        db.add(user)
        db.flush()
        db.add(AuditLog(actor_user_id=admin.id, action="doctor_account_created", resource_type="user", resource_id=str(user.id)))
        db.commit()
        print("Clinician account created as unverified. Independently verify credentials in the admin dashboard before approval.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create the initial admin or an unverified clinician account.")
    parser.add_argument("action", choices=("create-admin", "create-doctor"))
    action = parser.parse_args().action
    if action == "create-admin":
        create_first_admin()
    else:
        create_unverified_doctor()


if __name__ == "__main__":
    main()
