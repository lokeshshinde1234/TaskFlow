from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Query, Session

from models import Employee, User
from roles import is_company_founder_user, is_platform_super_admin_user


def valid_company_id(company_id: Optional[int]) -> bool:
    return company_id is not None and company_id != 0


def repair_employee_company_links(db: Session) -> None:
    """Align employee.company_id with linked user accounts; clear invalid 0 values."""
    db.query(User).filter(User.company_id == 0).update({User.company_id: None}, synchronize_session=False)
    db.query(Employee).filter(Employee.company_id == 0).update({Employee.company_id: None}, synchronize_session=False)

    for user in db.query(User).filter(User.employee_id.isnot(None)).all():
        company_id = user.company_id if valid_company_id(user.company_id) else None
        if company_id is None:
            continue
        employee = db.query(Employee).filter(Employee.id == user.employee_id).first()
        if employee and employee.company_id != company_id:
            employee.company_id = company_id

    db.commit()


def employees_query_for_user(db: Session, current_user: User) -> Query:
    query = db.query(Employee)

    if is_company_founder_user(current_user):
        company_id = current_user.company_id
        if not valid_company_id(company_id):
            return query.filter(False)
        return query.filter(Employee.company_id == company_id)

    if is_platform_super_admin_user(current_user):
        return query

    if current_user.employee_id:
        return query.filter(Employee.id == current_user.employee_id)

    return query.filter(False)


def get_manageable_employee(db: Session, employee_id: int, current_user: User) -> Employee:
    if not is_company_founder_user(current_user):
        employee = employees_query_for_user(db, current_user).filter(Employee.id == employee_id).first()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        return employee

    company_id = current_user.company_id
    if not valid_company_id(company_id):
        raise HTTPException(status_code=403, detail="Your company workspace is not configured.")

    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    if employee.company_id == company_id:
        return employee

    linked_user = (
        db.query(User)
        .filter(User.employee_id == employee_id, User.company_id == company_id)
        .first()
    )
    if linked_user:
        employee.company_id = company_id
        db.commit()
        db.refresh(employee)
        return employee

    raise HTTPException(
        status_code=404,
        detail="Employee not found in your company. Refresh the page and try again.",
    )
