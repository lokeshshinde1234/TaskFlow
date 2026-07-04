import traceback
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.utils.auth_utils import require_platform_super_admin
from app.services.attendance_checkout import AUTO_CHECKOUT_REASON, auto_checkout_open_attendance_for_company
from app.database import get_db
from app.utils.employee_delete import delete_employee_cascade
from app.utils.employee_login_accounts import upsert_employee_login_account
from app.utils.employee_utils import generate_unique_employee_id
from app.models import Attendance, Company, Employee, Location, Salary, User
from app.utils.roles import FOUNDER_ADMIN_ROLE
from app.services.realtime_status import company_is_online_for_db
from app.schemas import (
    AttendanceResponse,
    CompanyAdminUpdate,
    CompanyDetailBundle,
    CompanyDetailResponse,
    CompanyListItem,
    CompanyTimingUpdate,
    DashboardAnalytics,
    EmployeeCreate,
    EmployeeResponse,
    EmployeeUpdate,
    LocationResponse,
    PlatformLocationResponse,
    PlatformOverview,
    SalaryResponse,
)
from app.utils.security import hash_password
from app.utils.time_utils import normalize_email


router = APIRouter(prefix="/api/platform", tags=["platform-super-admin"])


def _employee_checked_in(db: Session, employee_id: int) -> bool:
    return (
        db.query(Attendance)
        .filter(
            Attendance.employee_id == employee_id,
            Attendance.time_in.isnot(None),
            Attendance.time_out.is_(None),
        )
        .first()
        is not None
    )


def _employee_payload(db: Session, employee: Employee) -> dict:
    checked_in = _employee_checked_in(db, employee.id)
    return {
        "id": employee.id,
        "company_id": employee.company_id,
        "company_name": employee.company_name,
        "company_logo_url": employee.company_logo_url,
        "employee_id": employee.employee_id,
        "first_name": employee.first_name,
        "last_name": employee.last_name,
        "email": employee.email,
        "phone": employee.phone,
        "department": employee.department,
        "position": employee.position,
        "salary": employee.salary,
        "profile_image_url": employee.profile_image_url,
        "date_of_joining": employee.date_of_joining,
        "is_active": employee.is_active,
        "is_checked_in": checked_in,
        "work_status": "active" if checked_in else "inactive",
    }


def _company_detail_payload(db: Session, company: Company) -> CompanyDetailResponse:
    return CompanyDetailResponse(
        id=company.id,
        name=company.name,
        email=company.email,
        address=company.address,
        phone=company.phone,
        latitude=company.latitude,
        longitude=company.longitude,
        geo_radius_meters=company.geo_radius_meters,
        working_hours=company.working_hours,
        start_time=company.start_time,
        end_time=company.end_time,
        logo_url=company.logo_url,
        description=company.description,
        created_at=company.created_at,
        is_active=company.is_active,
        is_online=company_is_online_for_db(db, company.id),
        updated_at=company.updated_at,
    )


def _company_analytics(db: Session, company_id: int) -> DashboardAnalytics:
    employees = db.query(Employee).filter(Employee.company_id == company_id).order_by(Employee.created_at.desc()).all()
    employee_ids = [employee.id for employee in employees]
    today = datetime.utcnow().date()
    recent = []
    for employee in employees:
        latest_attendance = (
            db.query(Attendance)
            .filter(Attendance.employee_id == employee.id)
            .order_by(Attendance.date.desc())
            .first()
        )
        if latest_attendance:
            recent.append(
                AttendanceResponse(
                    id=latest_attendance.id,
                    employee_id=latest_attendance.employee_id,
                    employee_code=employee.employee_id,
                    employee_name=f"{employee.first_name} {employee.last_name}".strip(),
                    company_name=employee.company_name,
                    date=latest_attendance.date,
                    time_in=latest_attendance.time_in,
                    time_out=latest_attendance.time_out,
                    working_hours=latest_attendance.working_hours,
                    company_start_time=latest_attendance.company_start_time,
                    company_end_time=latest_attendance.company_end_time,
                    is_late=bool(latest_attendance.is_late),
                    late_reason=latest_attendance.late_reason,
                    checkout_type=latest_attendance.checkout_type,
                    checkout_reason=latest_attendance.checkout_reason,
                    auto_checkout_at=latest_attendance.auto_checkout_at,
                    status=latest_attendance.status,
                )
            )
    payroll_total = (
        db.query(func.coalesce(func.sum(Salary.net_salary), 0))
        .join(Employee)
        .filter(Employee.company_id == company_id)
        .scalar()
    )
    return DashboardAnalytics(
        total_employees=len(employee_ids),
        active_today=db.query(Attendance)
        .filter(func.date(Attendance.date) == today, Attendance.employee_id.in_(employee_ids) if employee_ids else False)
        .count(),
        open_attendance_sessions=db.query(Attendance)
        .filter(Attendance.time_out.is_(None), Attendance.employee_id.in_(employee_ids) if employee_ids else False)
        .count(),
        payroll_total=float(payroll_total or 0),
        recent_attendance=recent,
    )


@router.get("/overview", response_model=PlatformOverview)
def platform_overview(
    _current_user: User = Depends(require_platform_super_admin),
    db: Session = Depends(get_db),
):
    try:
        total_companies = db.query(Company).count()
        active_companies = db.query(Company).filter(Company.is_active == True).count()
        total_employees = db.query(Employee).count()
        total_users = db.query(User).count()
        payroll_total = db.query(func.coalesce(func.sum(Salary.net_salary), 0)).scalar()
        print(f"DEBUG: overview query completed - companies: {total_companies}, employees: {total_employees}")
        return PlatformOverview(
            total_companies=total_companies,
            active_companies=active_companies,
            total_employees=total_employees,
            total_users=total_users,
            payroll_total=float(payroll_total or 0),
        )
    except Exception as e:
        print(f"ERROR in platform_overview: {e}")
        print(f"TRACEBACK: {traceback.format_exc()}")
        raise


@router.get("/companies", response_model=List[CompanyListItem])
def list_all_companies(
    _current_user: User = Depends(require_platform_super_admin),
    db: Session = Depends(get_db),
):
    companies = db.query(Company).order_by(Company.created_at.desc()).all()
    today = datetime.utcnow().date()
    rows: List[CompanyListItem] = []
    for company in companies:
        employee_ids = [row[0] for row in db.query(Employee.id).filter(Employee.company_id == company.id).all()]
        payroll_total = (
            db.query(func.coalesce(func.sum(Salary.net_salary), 0))
            .join(Employee)
            .filter(Employee.company_id == company.id)
            .scalar()
        )
        active_today = (
            db.query(Attendance)
            .filter(
                func.date(Attendance.date) == today,
                Attendance.employee_id.in_(employee_ids) if employee_ids else False,
            )
            .count()
        )
        rows.append(
            CompanyListItem(
                id=company.id,
                name=company.name,
                email=company.email,
                phone=company.phone,
                address=company.address,
                latitude=company.latitude,
                longitude=company.longitude,
                geo_radius_meters=company.geo_radius_meters,
                start_time=company.start_time,
                end_time=company.end_time,
                logo_url=company.logo_url,
                description=company.description,
                is_active=company.is_active,
                is_online=company_is_online_for_db(db, company.id),
                employee_count=len(employee_ids),
                user_count=db.query(User).filter(User.company_id == company.id).count(),
                payroll_total=float(payroll_total or 0),
                active_today=active_today,
                created_at=company.created_at,
            )
        )
    return rows


@router.get("/locations", response_model=List[PlatformLocationResponse])
def list_recent_locations(
    limit: int = 100,
    _current_user: User = Depends(require_platform_super_admin),
    db: Session = Depends(get_db),
):
    safe_limit = max(1, min(limit, 500))
    rows = (
        db.query(Location, Employee, Company)
        .join(Employee, Location.employee_id == Employee.id)
        .join(Company, Employee.company_id == Company.id)
        .order_by(Location.timestamp.desc())
        .limit(safe_limit)
        .all()
    )
    return [
        PlatformLocationResponse(
            id=location.id,
            employee_id=location.employee_id,
            employee_code=employee.employee_id,
            employee_name=f"{employee.first_name} {employee.last_name}".strip(),
            company_id=company.id,
            company_name=company.name,
            latitude=location.latitude,
            longitude=location.longitude,
            accuracy=location.accuracy,
            address=location.address,
            timestamp=location.timestamp,
        )
        for location, employee, company in rows
    ]


@router.get("/companies/{company_id}", response_model=CompanyDetailBundle)
def get_company_detail(
    company_id: int,
    _current_user: User = Depends(require_platform_super_admin),
    db: Session = Depends(get_db),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    employees = db.query(Employee).filter(Employee.company_id == company_id).order_by(Employee.created_at.desc()).all()
    location_rows = (
        db.query(Location, Employee, Company)
        .join(Employee, Location.employee_id == Employee.id)
        .join(Company, Employee.company_id == Company.id)
        .filter(Employee.company_id == company_id)
        .order_by(Location.timestamp.desc())
        .limit(100)
        .all()
    )
    locations = [
        PlatformLocationResponse(
            id=location.id,
            employee_id=location.employee_id,
            employee_code=employee.employee_id,
            employee_name=f"{employee.first_name} {employee.last_name}".strip(),
            company_id=company.id,
            company_name=company.name,
            latitude=location.latitude,
            longitude=location.longitude,
            accuracy=location.accuracy,
            address=location.address,
            timestamp=location.timestamp,
        )
        for location, employee, company in location_rows
    ]
    salaries = (
        db.query(Salary)
        .join(Employee)
        .filter(Employee.company_id == company_id)
        .order_by(Salary.year.desc(), Salary.month.desc())
        .limit(100)
        .all()
    )
    return CompanyDetailBundle(
        company=_company_detail_payload(db, company),
        employees=[_employee_payload(db, employee) for employee in employees],
        analytics=_company_analytics(db, company_id),
        locations=locations,
        salaries=salaries,
    )


@router.get("/attendance", response_model=List[AttendanceResponse])
def list_all_attendance(
    limit: int = 500,
    _current_user: User = Depends(require_platform_super_admin),
    db: Session = Depends(get_db),
):
    safe_limit = max(1, min(limit, 1000))
    rows = (
        db.query(Attendance, Employee, Company)
        .join(Employee, Attendance.employee_id == Employee.id)
        .join(Company, Employee.company_id == Company.id)
        .order_by(Attendance.date.desc())
        .limit(safe_limit)
        .all()
    )
    return [
        AttendanceResponse(
            id=attendance.id,
            employee_id=attendance.employee_id,
            employee_code=employee.employee_id,
            employee_name=f"{employee.first_name} {employee.last_name}".strip(),
            company_name=company.name,
            date=attendance.date,
            time_in=attendance.time_in,
            time_out=attendance.time_out,
            working_hours=attendance.working_hours,
            company_start_time=attendance.company_start_time,
            company_end_time=attendance.company_end_time,
            is_late=bool(attendance.is_late),
            late_reason=attendance.late_reason,
            checkout_type=attendance.checkout_type,
            checkout_reason=attendance.checkout_reason,
            auto_checkout_at=attendance.auto_checkout_at,
            status=attendance.status,
        )
        for attendance, employee, company in rows
    ]


@router.put("/companies/{company_id}/timing", response_model=CompanyDetailResponse)
def update_company_timing(
    company_id: int,
    payload: CompanyTimingUpdate,
    _current_user: User = Depends(require_platform_super_admin),
    db: Session = Depends(get_db),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    company.start_time = payload.start_time
    company.end_time = payload.end_time
    company.working_hours = f"{payload.start_time}-{payload.end_time}"
    company.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(company)
    return _company_detail_payload(db, company)


@router.put("/companies/{company_id}", response_model=CompanyDetailResponse)
def update_company(
    company_id: int,
    payload: CompanyAdminUpdate,
    _current_user: User = Depends(require_platform_super_admin),
    db: Session = Depends(get_db),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    updates = payload.model_dump(exclude_unset=True)
    was_active = bool(company.is_active)
    new_password = updates.pop("password", None)
    new_email = updates.get("email")
    if new_email:
        new_email = normalize_email(str(new_email))
        updates["email"] = new_email
        existing = db.query(Company).filter(func.lower(Company.email) == new_email, Company.id != company_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Company email already in use")

    for field, value in updates.items():
        setattr(company, field, value)
    if company.start_time and company.end_time:
        company.working_hours = f"{company.start_time}-{company.end_time}"
    company.updated_at = datetime.utcnow()

    founder_user = (
        db.query(User)
        .filter(User.company_id == company_id, User.role == FOUNDER_ADMIN_ROLE)
        .first()
    )
    if founder_user:
        if new_email:
            founder_user.email = new_email
        if new_password:
            hashed = hash_password(new_password)
            founder_user.password_hash = hashed
            company.password_hash = hashed
        founder_user.updated_at = datetime.utcnow()

    checked_out_employee_ids = []
    if was_active and updates.get("is_active") is False:
        checked_out_employee_ids = auto_checkout_open_attendance_for_company(db, company_id, AUTO_CHECKOUT_REASON)

    db.commit()
    db.refresh(company)
    return _company_detail_payload(db, company)


@router.post("/companies/{company_id}/employees", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
def create_company_employee(
    company_id: int,
    employee_data: EmployeeCreate,
    _current_user: User = Depends(require_platform_super_admin),
    db: Session = Depends(get_db),
):
    if not db.query(Company).filter(Company.id == company_id).first():
        raise HTTPException(status_code=404, detail="Company not found")
    if db.query(Employee).filter(Employee.email == employee_data.email).first():
        raise HTTPException(status_code=400, detail="Employee email already exists")

    employee_id = employee_data.employee_id or generate_unique_employee_id(db, company_id)
    
    if db.query(Employee).filter(Employee.employee_id == employee_id).first():
        raise HTTPException(status_code=400, detail="Employee ID already exists")

    employee = Employee(
        company_id=company_id,
        employee_id=employee_id,
        first_name=employee_data.first_name,
        last_name=employee_data.last_name,
        email=employee_data.email,
        phone=employee_data.phone,
        department=employee_data.department,
        position=employee_data.position,
        salary=employee_data.salary,
        profile_image_url=employee_data.profile_image_url,
        date_of_joining=employee_data.date_of_joining or datetime.utcnow(),
        is_active=employee_data.is_active,
    )
    db.add(employee)
    db.flush()
    upsert_employee_login_account(db, employee, employee_data.password)
    db.commit()
    db.refresh(employee)
    return _employee_payload(db, employee)


@router.put("/employees/{employee_id}", response_model=EmployeeResponse)
def update_any_employee(
    employee_id: int,
    employee_data: EmployeeUpdate,
    _current_user: User = Depends(require_platform_super_admin),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    updates = employee_data.model_dump(exclude_unset=True)
    new_password = updates.pop("password", None)
    new_email = updates.get("email")
    if new_email:
        existing = db.query(Employee).filter(Employee.email == new_email, Employee.id != employee_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Employee email already exists")

    new_employee_id_str = updates.get("employee_id")
    if new_employee_id_str:
        existing = db.query(Employee).filter(Employee.employee_id == new_employee_id_str, Employee.id != employee_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Employee ID already exists")

    new_company_id = updates.get("company_id")
    if new_company_id is not None and not db.query(Company).filter(Company.id == new_company_id).first():
        raise HTTPException(status_code=400, detail="Company not found")

    for field, value in updates.items():
        setattr(employee, field, value)
    if new_email or new_password or employee.user:
        upsert_employee_login_account(db, employee, new_password)
    employee.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(employee)
    return _employee_payload(db, employee)


@router.delete("/employees/{employee_id}")
def delete_any_employee(
    employee_id: int,
    _current_user: User = Depends(require_platform_super_admin),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    try:
        delete_employee_cascade(db, employee)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Unable to delete employee: {exc}") from exc

    return {"message": "Employee deleted successfully"}
