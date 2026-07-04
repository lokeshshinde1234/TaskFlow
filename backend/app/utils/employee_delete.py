from sqlalchemy.orm import Session

from app.models import Attendance, Employee, Location, OTPRecord, Salary, User


def delete_employee_cascade(db: Session, employee: Employee) -> None:
    employee_id = employee.id
    employee_email = employee.email

    try:
        db.query(Attendance).filter(Attendance.employee_id == employee_id).delete(synchronize_session=False)
        db.query(Location).filter(Location.employee_id == employee_id).delete(synchronize_session=False)
        db.query(Salary).filter(Salary.employee_id == employee_id).delete(synchronize_session=False)

        linked_users = db.query(User).filter(User.employee_id == employee_id).all()
        for linked_user in linked_users:
            db.query(OTPRecord).filter(OTPRecord.user_id == linked_user.id).delete(synchronize_session=False)
            db.delete(linked_user)

        db.query(OTPRecord).filter(OTPRecord.email == employee_email).delete(synchronize_session=False)

        db.query(User).filter(User.employee_id == employee_id).update(
            {User.employee_id: None},
            synchronize_session=False,
        )

        db.delete(employee)
        db.commit()
    except Exception:
        db.rollback()
        raise
