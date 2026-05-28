from datetime import datetime, timedelta
import hashlib
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func
from sqlalchemy.orm import Session

from config import ACCESS_TOKEN_EXPIRE_MINUTES, ALGORITHM, EMPLOYEE_SESSION_TIMEOUT_SECONDS, SECRET_KEY
from database import get_db
from models import ActiveSession, User
from roles import (
    is_company_founder_user,
    is_founder_admin_role,
    is_platform_super_admin_user,
)
from time_utils import normalize_email


bearer_scheme = HTTPBearer()


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    payload = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    payload.update({"exp": expire})
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = verify_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user = db.query(User).filter(func.lower(User.email) == normalize_email(payload.get("sub"))).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive or missing user")

    if user.role == "employee":
        now = datetime.utcnow()
        session = db.query(ActiveSession).filter(ActiveSession.user_id == user.id).first()
        if not session or not session.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Please login again.")
        inactive_at = (
            session.last_active_time + timedelta(seconds=EMPLOYEE_SESSION_TIMEOUT_SECONDS)
            if session.last_active_time
            else now
        )
        if not session.last_active_time or session.expires_at <= now or inactive_at <= now:
            session.is_active = False
            session.expires_at = now
            session.last_active_time = session.last_active_time or now
            db.commit()
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Please login again.")
        if session.token_hash != hash_session_token(credentials.credentials):
            session.is_active = False
            session.expires_at = now
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session replaced or inactive. Please login again.",
            )
        session.expires_at = now + timedelta(seconds=EMPLOYEE_SESSION_TIMEOUT_SECONDS)
        session.last_active_time = now
        session.session_token = session.token_hash
        db.commit()
    return user


def require_founder_admin(current_user: User = Depends(get_current_user)) -> User:
    if not is_founder_admin_role(current_user.role) and not is_company_founder_user(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Founder Admin access required")
    return current_user


def require_platform_super_admin(current_user: User = Depends(get_current_user)) -> User:
    if not is_platform_super_admin_user(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super Admin access required")
    return current_user
