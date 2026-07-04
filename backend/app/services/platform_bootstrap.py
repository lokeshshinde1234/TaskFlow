import os

from sqlalchemy import func

from app.database import SessionLocal
from app.models import User
from app.utils.employee_access import repair_employee_company_links
from app.utils.roles import FOUNDER_ADMIN_ROLE, PLATFORM_SUPER_ADMIN_ROLE, platform_super_admin_email
from app.utils.security import hash_password


def migrate_company_founders_from_legacy_super_admin() -> None:
    """Company owners registered before founder_admin role was introduced."""
    db = SessionLocal()
    try:
        updated = (
            db.query(User)
            .filter(User.role == PLATFORM_SUPER_ADMIN_ROLE, User.company_id.isnot(None))
            .update({User.role: FOUNDER_ADMIN_ROLE}, synchronize_session=False)
        )
        if updated:
            db.commit()
    finally:
        db.close()


def ensure_platform_super_admin() -> None:
    migrate_company_founders_from_legacy_super_admin()
    db = SessionLocal()
    try:
        repair_employee_company_links(db)
    finally:
        db.close()

    email = platform_super_admin_email()
    password = os.getenv("PLATFORM_SUPER_ADMIN_PASSWORD", "")
    if not email or not password:
        return

    db = SessionLocal()
    try:
        user = db.query(User).filter(func.lower(User.email) == email).first()
        if not user:
            db.add(
                User(
                    email=email,
                    password_hash=hash_password(password),
                    role=PLATFORM_SUPER_ADMIN_ROLE,
                    is_email_verified=True,
                    is_active=True,
                )
            )
            db.commit()
            return

        changed = False
        if user.role != PLATFORM_SUPER_ADMIN_ROLE:
            user.role = PLATFORM_SUPER_ADMIN_ROLE
            changed = True
        if user.company_id is not None:
            user.company_id = None
            changed = True
        if user.employee_id is not None:
            user.employee_id = None
            changed = True
        if not user.is_active:
            user.is_active = True
            changed = True
        user.password_hash = hash_password(password)
        db.commit()
    finally:
        db.close()
