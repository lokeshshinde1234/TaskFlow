from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Attendance, Company, Employee
from app.utils.time_utils import utc_now


AUTO_CHECKOUT_REASON = "Company status became inactive before end time"


def _parse_company_time(value: Optional[str]):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%H:%M").time()
    except ValueError:
        return None


def company_is_before_end_time(company: Optional[Company]) -> bool:
    end_time = _parse_company_time(company.end_time if company else None)
    if not end_time:
        return False
    return datetime.now().time() < end_time


def auto_checkout_open_attendance_for_company(
    db: Session,
    company_id: Optional[int],
    reason: str = AUTO_CHECKOUT_REASON,
) -> list[int]:
    if not company_id:
        return []

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company_is_before_end_time(company):
        return []

    open_records = (
        db.query(Attendance)
        .join(Employee, Attendance.employee_id == Employee.id)
        .filter(
            Employee.company_id == company_id,
            Attendance.time_in.isnot(None),
            Attendance.time_out.is_(None),
        )
        .all()
    )
    if not open_records:
        return []

    now = utc_now()
    employee_ids = []
    for attendance in open_records:
        attendance.time_out = now
        attendance.checkout_type = "auto_checkout"
        attendance.checkout_reason = reason
        attendance.auto_checkout_at = now
        attendance.status = "checked_out"
        if attendance.time_in:
            time_in = attendance.time_in
            if time_in.tzinfo is None:
                time_in = time_in.replace(tzinfo=timezone.utc)
            attendance.working_hours = round((now - time_in).total_seconds() / 3600, 2)
        employee_ids.append(attendance.employee_id)

    return employee_ids
