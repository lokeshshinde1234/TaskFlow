from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from models import User
from roles import FOUNDER_ADMIN_ROLE

online_company_ids: set[int] = set()
ONLINE_WINDOW_SECONDS = 90


def mark_company_online(company_id: int | None) -> None:
    if company_id:
        online_company_ids.add(int(company_id))


def mark_company_offline(company_id: int | None) -> None:
    if company_id:
        online_company_ids.discard(int(company_id))


def company_is_online(company_id: int | None) -> bool:
    return bool(company_id) and int(company_id) in online_company_ids


def touch_company_presence(db: Session, company_id: int | None) -> None:
    if not company_id:
        return
    db.query(User).filter(User.company_id == company_id, User.role == FOUNDER_ADMIN_ROLE).update(
        {User.updated_at: datetime.utcnow()},
        synchronize_session=False,
    )
    db.commit()
    mark_company_online(company_id)


def clear_company_presence(db: Session, company_id: int | None) -> None:
    if not company_id:
        return
    stale_time = datetime.utcnow() - timedelta(days=1)
    db.query(User).filter(User.company_id == company_id, User.role == FOUNDER_ADMIN_ROLE).update(
        {User.updated_at: stale_time},
        synchronize_session=False,
    )
    db.commit()
    mark_company_offline(company_id)


def company_is_online_for_db(db: Session, company_id: int | None) -> bool:
    if not company_id:
        return False
    if company_is_online(company_id):
        return True
    cutoff = datetime.utcnow() - timedelta(seconds=ONLINE_WINDOW_SECONDS)
    return (
        db.query(User)
        .filter(
            User.company_id == company_id,
            User.role == FOUNDER_ADMIN_ROLE,
            User.updated_at >= cutoff,
        )
        .first()
        is not None
    )
