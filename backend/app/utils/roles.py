import os

FOUNDER_ADMIN_ROLE = "founder_admin"
PLATFORM_SUPER_ADMIN_ROLE = "super_admin"


def platform_super_admin_email() -> str:
    return os.getenv("PLATFORM_SUPER_ADMIN_EMAIL", "superadmin@gmail.com").strip().lower()


def is_founder_admin_role(role: str) -> bool:
    return role == FOUNDER_ADMIN_ROLE


def is_platform_super_admin_role(role: str) -> bool:
    return role == PLATFORM_SUPER_ADMIN_ROLE


def is_company_founder_user(user) -> bool:
    if user is None or user.company_id is None:
        return False
    return user.role == FOUNDER_ADMIN_ROLE


def is_platform_super_admin_user(user) -> bool:
    if user is None or user.company_id is not None:
        return False
    if user.role != PLATFORM_SUPER_ADMIN_ROLE:
        return False
    return str(user.email).strip().lower() == platform_super_admin_email()
