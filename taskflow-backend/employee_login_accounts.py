from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth_utils import normalize_email
from models import Employee, User
from security import hash_password


def upsert_employee_login_account(db: Session, employee: Employee, password: Optional[str] = None) -> Optional[User]:
    normalized_email = normalize_email(employee.email)
    existing_user_for_email = (
        db.query(User)
        .filter(func.lower(User.email) == normalized_email, User.employee_id != employee.id)
        .first()
    )
    if existing_user_for_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered to another user")

    user = db.query(User).filter(User.employee_id == employee.id).first()
    if not user and not password:
        employee.is_registered = False
        employee.signup_completed = False
        return None

    if not user:
        user = User(
            email=normalized_email,
            password_hash=hash_password(password or ""),
            role="employee",
            company_id=employee.company_id,
            employee_id=employee.id,
            is_active=bool(employee.is_active),
        )
        db.add(user)
        return user

    user.email = normalized_email
    user.company_id = employee.company_id
    user.employee_id = employee.id
    user.is_active = bool(employee.is_active)
    if password:
        user.password_hash = hash_password(password)
    return user
