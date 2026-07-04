from calendar import monthrange
from datetime import date, datetime, timedelta
import json
import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.utils.auth_utils import get_current_user
from app.database import engine, get_db
from app.utils.employee_access import get_manageable_employee
from app.models import (
    Attendance,
    AuditLog,
    Company,
    Employee,
    LeaveRequest,
    Notification,
    Payslip,
    SalaryRecord,
    SalaryStructure,
    User,
)
from app.utils.roles import is_company_founder_user, is_platform_super_admin_user
from app.services.salary_service import calculate_salary, month_start, working_days_in_month


router = APIRouter(prefix="/api/v1/salary", tags=["salary"])
admin_router = APIRouter(prefix="/api/v1/admin/salary", tags=["salary-super-admin"])

PAYSLIP_DIR = Path(os.getenv("TASKFLOW_STORAGE_DIR", "storage")).resolve() / "salary-payslips"

HR_ROLES = {"hr_manager", "hr"}
EMPLOYEE_VIEW_ROLES = {"employee", "founder_admin", "hr_manager", "hr", "super_admin"}


class SalaryStructurePayload(BaseModel):
    employee_id: int
    basic: float = Field(ge=0)
    hra: float = Field(default=0, ge=0)
    special_allowance: float = Field(default=0, ge=0)
    travel_allowance: float = Field(default=0, ge=0)
    medical_allowance: float = Field(default=0, ge=0)
    pf_rate: float = Field(default=12, ge=0)
    esi_rate: float = Field(default=0.75, ge=0)
    professional_tax: float = Field(default=200, ge=0)
    tds_monthly: float = Field(default=0, ge=0)
    effective_from: datetime


class SalaryCalculatePayload(BaseModel):
    employee_id: int
    month: str
    paid_leaves_used: int = Field(default=0, ge=0)
    overtime_hours: float = Field(default=0, ge=0)
    overtime_pay: Optional[float] = Field(default=None, ge=0)
    loan_deduction: float = Field(default=0, ge=0)
    other_deductions: float = Field(default=0, ge=0)
    remarks: Optional[str] = None


class SalaryRecordPayload(BaseModel):
    employee_id: int
    salary_structure_id: int
    month: str
    working_days: int
    days_present: int
    days_absent: int
    paid_leaves_used: int = 0
    lop_days: int
    gross_salary: float
    per_day_rate: float
    attendance_salary: float
    pf_deduction: float
    esi_deduction: float
    professional_tax: float
    tds_deduction: float = 0
    loan_deduction: float = 0
    other_deductions: float = 0
    total_deductions: float
    lop_deduction: float
    net_salary: float
    overtime_hours: float = 0
    overtime_pay: float = 0
    remarks: Optional[str] = None


class OverridePayload(BaseModel):
    reason: str = Field(min_length=3)


class SendPayslipPayload(BaseModel):
    sent_via: str = Field(default="email", pattern="^(email|sms|whatsapp)$")


def ensure_salary_schema() -> None:
    if not engine.url.get_backend_name().startswith("sqlite"):
        return
    with engine.begin() as connection:
        columns_by_table = {}
        for table in ("salary_structures", "payslips", "audit_logs"):
            try:
                columns_by_table[table] = {row[1] for row in connection.exec_driver_sql(f"PRAGMA table_info({table})").fetchall()}
            except Exception:
                columns_by_table[table] = set()

        def add(table: str, column: str, ddl: str) -> None:
            if column not in columns_by_table.get(table, set()):
                connection.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")

        for column, ddl in {
            "name": "VARCHAR(120)",
            "components_json": "TEXT",
            "effective_to": "DATETIME",
            "basic": "FLOAT DEFAULT 0",
            "hra": "FLOAT DEFAULT 0",
            "special_allowance": "FLOAT DEFAULT 0",
            "travel_allowance": "FLOAT DEFAULT 0",
            "medical_allowance": "FLOAT DEFAULT 0",
            "overtime_pay": "FLOAT DEFAULT 0",
            "pf_rate": "FLOAT DEFAULT 12",
            "esi_rate": "FLOAT DEFAULT 0.75",
            "professional_tax": "FLOAT DEFAULT 200",
            "tds_monthly": "FLOAT DEFAULT 0",
            "created_by": "INTEGER",
            "updated_by": "INTEGER",
            "created_at": "DATETIME",
            "updated_at": "DATETIME",
        }.items():
            add("salary_structures", column, ddl)

        for column, ddl in {
            "salary_record_id": "INTEGER",
            "pdf_url": "VARCHAR(1000)",
            "pdf_generated_at": "DATETIME",
            "sent_at": "DATETIME",
            "sent_via": "VARCHAR(20)",
            "viewed_at": "DATETIME",
        }.items():
            add("payslips", column, ddl)

        for column, ddl in {
            "actor_role": "VARCHAR(50)",
            "target_id": "VARCHAR(80)",
            "old_value": "TEXT",
            "new_value": "TEXT",
        }.items():
            add("audit_logs", column, ddl)


def money(value) -> float:
    return round(float(value or 0), 2)


def company_scope(current_user: User) -> int:
    if not current_user.company_id:
        raise HTTPException(status_code=403, detail="Company-scoped account required")
    return current_user.company_id


def is_hr_user(user: User) -> bool:
    return user.role in HR_ROLES


def require_company_salary_read(user: User = Depends(get_current_user)) -> User:
    if is_company_founder_user(user) or is_hr_user(user) or is_platform_super_admin_user(user) or user.role == "employee":
        return user
    raise HTTPException(status_code=403, detail="Salary read permission required")


def require_salary_structure_write(user: User = Depends(get_current_user)) -> User:
    if is_company_founder_user(user) or is_hr_user(user):
        return user
    raise HTTPException(status_code=403, detail="Salary structure write permission required")


def require_payroll_process(user: User = Depends(get_current_user)) -> User:
    if is_company_founder_user(user):
        return user
    raise HTTPException(status_code=403, detail="Founder Admin permission required")


def require_payslip_generate(user: User = Depends(get_current_user)) -> User:
    if is_company_founder_user(user) or is_hr_user(user):
        return user
    raise HTTPException(status_code=403, detail="Payslip generation permission required")


def require_super_admin(user: User = Depends(get_current_user)) -> User:
    if is_platform_super_admin_user(user):
        return user
    raise HTTPException(status_code=403, detail="Super Admin access required")


def audit_salary(db: Session, request: Request, actor: User, action: str, target_id=None, old_value=None, new_value=None, company_id: Optional[int] = None) -> None:
    db.add(
        AuditLog(
            company_id=company_id if company_id is not None else actor.company_id,
            user_id=actor.id,
            actor_role=actor.role,
            action=action,
            entity_type="salary",
            entity_id=str(target_id) if target_id is not None else None,
            target_id=str(target_id) if target_id is not None else None,
            old_value=json.dumps(old_value, default=str) if old_value is not None else None,
            new_value=json.dumps(new_value, default=str) if new_value is not None else None,
            metadata_json=json.dumps({"module": "salary"}, default=str),
            ip_address=request.client.host if request.client else None,
        )
    )


def serialize_structure(row: Optional[SalaryStructure]) -> Optional[dict]:
    if not row:
        return None
    return {
        "id": row.id,
        "company_id": row.company_id,
        "employee_id": row.employee_id,
        "effective_from": row.effective_from,
        "effective_to": row.effective_to,
        "basic": money(row.basic),
        "hra": money(row.hra),
        "special_allowance": money(row.special_allowance),
        "travel_allowance": money(row.travel_allowance),
        "medical_allowance": money(row.medical_allowance),
        "overtime_pay": money(row.overtime_pay),
        "pf_rate": money(row.pf_rate),
        "esi_rate": money(row.esi_rate),
        "professional_tax": money(row.professional_tax),
        "tds_monthly": money(row.tds_monthly),
        "is_active": bool(row.is_active),
        "created_by": row.created_by,
        "updated_by": row.updated_by,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def serialize_record(row: SalaryRecord, db: Optional[Session] = None) -> dict:
    employee = db.query(Employee).filter(Employee.id == row.employee_id).first() if db else None
    company = db.query(Company).filter(Company.id == row.company_id).first() if db else None
    payslip = (
        db.query(Payslip)
        .filter(Payslip.company_id == row.company_id, Payslip.salary_record_id == row.id)
        .first()
        if db
        else None
    )
    return {
        "id": row.id,
        "company_id": row.company_id,
        "company_name": company.name if company else None,
        "employee_id": row.employee_id,
        "employee_code": employee.employee_id if employee else None,
        "employee_name": f"{employee.first_name} {employee.last_name}".strip() if employee else None,
        "department": employee.department if employee else None,
        "designation": employee.position if employee else None,
        "salary_structure_id": row.salary_structure_id,
        "month": row.month.date().isoformat() if row.month else None,
        "working_days": row.working_days,
        "days_present": row.days_present,
        "days_absent": row.days_absent,
        "paid_leaves_used": row.paid_leaves_used,
        "lop_days": row.lop_days,
        "gross_salary": money(row.gross_salary),
        "per_day_rate": money(row.per_day_rate),
        "attendance_salary": money(row.attendance_salary),
        "pf_deduction": money(row.pf_deduction),
        "esi_deduction": money(row.esi_deduction),
        "professional_tax": money(row.professional_tax),
        "tds_deduction": money(row.tds_deduction),
        "loan_deduction": money(row.loan_deduction),
        "other_deductions": money(row.other_deductions),
        "total_deductions": money(row.total_deductions),
        "lop_deduction": money(row.lop_deduction),
        "net_salary": money(row.net_salary),
        "status": row.status,
        "overtime_hours": money(row.overtime_hours),
        "overtime_pay": money(row.overtime_pay),
        "remarks": row.remarks,
        "processed_by": row.processed_by,
        "approved_by": row.approved_by,
        "processed_at": row.processed_at,
        "approved_at": row.approved_at,
        "paid_at": row.paid_at,
        "payslip_id": payslip.id if payslip else None,
        "payslip_pdf_url": payslip.pdf_url if payslip else None,
        "payslip_generated_at": payslip.pdf_generated_at if payslip else None,
        "payslip_sent_at": payslip.sent_at if payslip else None,
        "payslip_sent_via": payslip.sent_via if payslip else None,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def get_employee_for_salary(db: Session, current_user: User, employee_id: int) -> Employee:
    if is_platform_super_admin_user(current_user):
        employee = db.query(Employee).filter(Employee.id == employee_id).first()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        return employee
    if current_user.role == "employee":
        if current_user.employee_id != employee_id:
            raise HTTPException(status_code=403, detail="Employees can only view their own salary")
        employee = db.query(Employee).filter(Employee.id == employee_id, Employee.company_id == current_user.company_id).first()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        return employee
    return get_manageable_employee(db, employee_id, current_user)


def active_structure(db: Session, company_id: int, employee_id: int) -> Optional[SalaryStructure]:
    return (
        db.query(SalaryStructure)
        .filter(
            SalaryStructure.company_id == company_id,
            SalaryStructure.employee_id == employee_id,
            SalaryStructure.is_active == True,
        )
        .order_by(SalaryStructure.effective_from.desc(), SalaryStructure.id.desc())
        .first()
    )


def attendance_summary(db: Session, employee: Employee, month: datetime) -> dict:
    start = month_start(month)
    _, last_day = monthrange(start.year, start.month)
    end = start + timedelta(days=last_day)
    working_days = working_days_in_month(start)
    records = (
        db.query(Attendance)
        .filter(Attendance.employee_id == employee.id, Attendance.date >= start, Attendance.date < end)
        .all()
    )
    attended_dates = {
        record.date.date()
        for record in records
        if record.time_in or record.status in ("present", "late", "checked_out")
    }
    days_present = len(attended_dates)
    paid_leaves_used = int(
        db.query(func.coalesce(func.sum(LeaveRequest.days), 0))
        .filter(
            LeaveRequest.company_id == employee.company_id,
            LeaveRequest.employee_id == employee.id,
            LeaveRequest.status == "approved",
            LeaveRequest.start_date < end,
            LeaveRequest.end_date >= start,
        )
        .scalar()
        or 0
    )
    days_absent = max(0, working_days - days_present)
    late_count = sum(1 for record in records if record.is_late)
    early_departure_count = 0
    overtime_hours = 0.0
    for record in records:
        if record.working_hours and record.working_hours > 8:
            overtime_hours += float(record.working_hours) - 8
        if record.working_hours is not None and record.working_hours < 8 and record.time_out:
            early_departure_count += 1
    return {
        "working_days": working_days,
        "days_present": days_present,
        "days_absent": days_absent,
        "paid_leaves_used": paid_leaves_used,
        "late_count": late_count,
        "early_departure_count": early_departure_count,
        "overtime_hours": round(overtime_hours, 2),
    }


def record_payload_from_calculation(employee: Employee, structure: SalaryStructure, month: datetime, summary: dict, payload: SalaryCalculatePayload) -> dict:
    overtime_pay = payload.overtime_pay
    if overtime_pay is None:
        hourly = (float(structure.basic or 0) / max(1, summary["working_days"]) / 8)
        overtime_pay = hourly * payload.overtime_hours
    calculated = calculate_salary(
        {
            "company_id": employee.company_id,
            "employee_id": employee.id,
            "salary_structure_id": structure.id,
            "month": month.date().isoformat(),
            "basic": structure.basic,
            "hra": structure.hra,
            "special_allowance": structure.special_allowance,
            "travel_allowance": structure.travel_allowance,
            "medical_allowance": structure.medical_allowance,
            "pf_rate": structure.pf_rate,
            "esi_rate": structure.esi_rate,
            "professional_tax": structure.professional_tax,
            "tds_deduction": structure.tds_monthly,
            "working_days": summary["working_days"],
            "days_present": summary["days_present"],
            "days_absent": summary["days_absent"],
            "paid_leaves_used": payload.paid_leaves_used if payload.paid_leaves_used is not None else summary["paid_leaves_used"],
            "overtime_hours": payload.overtime_hours,
            "overtime_pay": overtime_pay,
            "loan_deduction": payload.loan_deduction,
            "other_deductions": payload.other_deductions,
            "remarks": payload.remarks,
        }
    )
    calculated["status"] = "draft"
    return calculated


def write_payslip_pdf(path: Path, lines: list[str]) -> None:
    escaped = [line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") for line in lines]
    commands = ["BT", "/F1 11 Tf", "54 790 Td"]
    for index, line in enumerate(escaped):
        if index:
            commands.append("0 -18 Td")
        commands.append(f"({line}) Tj")
    commands.append("ET")
    stream = "\n".join(commands).encode("utf-8")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for number, obj in enumerate(objects, 1):
        offsets.append(len(pdf))
        pdf.extend(f"{number} 0 obj\n".encode("ascii"))
        pdf.extend(obj)
        pdf.extend(b"\nendobj\n")
    xref_at = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode("ascii"))
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    pdf.extend(f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_at}\n%%EOF\n".encode("ascii"))
    path.write_bytes(bytes(pdf))


@router.get("/structure/{employee_id}")
def get_salary_structure(employee_id: int, current_user: User = Depends(require_company_salary_read), db: Session = Depends(get_db)):
    employee = get_employee_for_salary(db, current_user, employee_id)
    structure = active_structure(db, employee.company_id, employee.id)
    if not structure:
        raise HTTPException(status_code=404, detail="Active salary structure not found")
    return serialize_structure(structure)


@router.post("/structure", status_code=status.HTTP_201_CREATED)
def upsert_salary_structure(payload: SalaryStructurePayload, request: Request, current_user: User = Depends(require_salary_structure_write), db: Session = Depends(get_db)):
    company_id = company_scope(current_user)
    employee = get_manageable_employee(db, payload.employee_id, current_user)
    if employee.company_id != company_id:
        raise HTTPException(status_code=404, detail="Employee not found in your company")
    previous = active_structure(db, company_id, employee.id)
    old_value = serialize_structure(previous)
    if previous:
        previous.is_active = False
        previous.effective_to = datetime.utcnow()
        previous.updated_by = current_user.id
    structure = SalaryStructure(
        company_id=company_id,
        employee_id=employee.id,
        name="Standard salary structure",
        components_json=json.dumps(payload.model_dump(), default=str),
        basic=payload.basic,
        hra=payload.hra,
        special_allowance=payload.special_allowance,
        travel_allowance=payload.travel_allowance,
        medical_allowance=payload.medical_allowance,
        overtime_pay=0,
        pf_rate=payload.pf_rate,
        esi_rate=payload.esi_rate,
        professional_tax=payload.professional_tax,
        tds_monthly=payload.tds_monthly,
        effective_from=payload.effective_from,
        created_by=current_user.id,
        updated_by=current_user.id,
        is_active=True,
    )
    db.add(structure)
    db.flush()
    audit_salary(
        db,
        request,
        current_user,
        "SALARY_STRUCTURE_UPDATED" if previous else "SALARY_STRUCTURE_CREATED",
        structure.id,
        old_value=old_value,
        new_value=serialize_structure(structure),
    )
    db.commit()
    db.refresh(structure)
    return serialize_structure(structure)


@router.get("/attendance-summary/{employee_id}")
def get_attendance_summary(employee_id: int, month: str = Query(...), current_user: User = Depends(require_company_salary_read), db: Session = Depends(get_db)):
    employee = get_employee_for_salary(db, current_user, employee_id)
    return attendance_summary(db, employee, month_start(month))


@router.post("/calculate")
def calculate_salary_record(payload: SalaryCalculatePayload, current_user: User = Depends(require_company_salary_read), db: Session = Depends(get_db)):
    employee = get_employee_for_salary(db, current_user, payload.employee_id)
    if current_user.role == "employee":
        raise HTTPException(status_code=403, detail="Employees cannot calculate payroll")
    month = month_start(payload.month)
    structure = active_structure(db, employee.company_id, employee.id)
    if not structure:
        raise HTTPException(status_code=404, detail="Active salary structure not found")
    summary = attendance_summary(db, employee, month)
    return record_payload_from_calculation(employee, structure, month, summary, payload)


@router.post("/records", status_code=status.HTTP_201_CREATED)
def save_salary_record(payload: SalaryRecordPayload, request: Request, current_user: User = Depends(require_salary_structure_write), db: Session = Depends(get_db)):
    company_id = company_scope(current_user)
    employee = get_manageable_employee(db, payload.employee_id, current_user)
    month = month_start(payload.month)
    structure = db.query(SalaryStructure).filter(SalaryStructure.id == payload.salary_structure_id, SalaryStructure.company_id == company_id, SalaryStructure.employee_id == employee.id).first()
    if not structure:
        raise HTTPException(status_code=404, detail="Salary structure not found")
    expected = calculate_salary(
        {
            "basic": structure.basic,
            "hra": structure.hra,
            "special_allowance": structure.special_allowance,
            "travel_allowance": structure.travel_allowance,
            "medical_allowance": structure.medical_allowance,
            "pf_rate": structure.pf_rate,
            "esi_rate": structure.esi_rate,
            "professional_tax": payload.professional_tax,
            "tds_deduction": payload.tds_deduction,
            "working_days": payload.working_days,
            "days_present": payload.days_present,
            "days_absent": payload.days_absent,
            "paid_leaves_used": payload.paid_leaves_used,
            "overtime_pay": payload.overtime_pay,
            "loan_deduction": payload.loan_deduction,
            "other_deductions": payload.other_deductions,
        }
    )
    existing = db.query(SalaryRecord).filter(SalaryRecord.company_id == company_id, SalaryRecord.employee_id == employee.id, SalaryRecord.month == month).first()
    if existing and existing.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft salary records can be edited")
    row = existing or SalaryRecord(company_id=company_id, employee_id=employee.id, month=month)
    row.salary_structure_id = structure.id
    for key in (
        "working_days",
        "days_present",
        "days_absent",
        "paid_leaves_used",
        "lop_days",
        "gross_salary",
        "per_day_rate",
        "attendance_salary",
        "pf_deduction",
        "esi_deduction",
        "professional_tax",
        "tds_deduction",
        "loan_deduction",
        "other_deductions",
        "total_deductions",
        "lop_deduction",
        "net_salary",
    ):
        setattr(row, key, expected[key])
    row.overtime_hours = payload.overtime_hours
    row.overtime_pay = payload.overtime_pay
    row.remarks = payload.remarks
    row.status = "draft"
    row.updated_at = datetime.utcnow()
    if not existing:
        db.add(row)
    db.flush()
    audit_salary(db, request, current_user, "SALARY_RECORD_CREATED", row.id, new_value=serialize_record(row, db))
    db.commit()
    db.refresh(row)
    return serialize_record(row, db)


def get_company_record(db: Session, record_id: int, current_user: User) -> SalaryRecord:
    query = db.query(SalaryRecord).filter(SalaryRecord.id == record_id)
    if not is_platform_super_admin_user(current_user):
        query = query.filter(SalaryRecord.company_id == company_scope(current_user))
        if current_user.role == "employee":
            query = query.filter(SalaryRecord.employee_id == current_user.employee_id)
    row = query.first()
    if not row:
        raise HTTPException(status_code=404, detail="Salary record not found")
    return row


@router.patch("/records/{record_id}/process")
def process_salary_record(record_id: int, request: Request, current_user: User = Depends(require_payroll_process), db: Session = Depends(get_db)):
    row = get_company_record(db, record_id, current_user)
    if row.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft records can be processed")
    old_value = serialize_record(row, db)
    row.status = "processed"
    row.processed_by = current_user.id
    row.processed_at = datetime.utcnow()
    audit_salary(db, request, current_user, "SALARY_RECORD_PROCESSED", row.id, old_value, serialize_record(row, db))
    db.commit()
    return serialize_record(row, db)


@router.patch("/records/{record_id}/approve")
def approve_salary_record(record_id: int, request: Request, current_user: User = Depends(require_payroll_process), db: Session = Depends(get_db)):
    row = get_company_record(db, record_id, current_user)
    if row.status != "processed":
        raise HTTPException(status_code=400, detail="Only processed records can be approved")
    old_value = serialize_record(row, db)
    row.status = "approved"
    row.approved_by = current_user.id
    row.approved_at = datetime.utcnow()
    employee = db.query(Employee).filter(Employee.id == row.employee_id).first()
    if employee and employee.user:
        db.add(Notification(company_id=row.company_id, user_id=employee.user.id, title="Salary approved", body=f"Your salary for {row.month:%B %Y} has been approved."))
    audit_salary(db, request, current_user, "SALARY_RECORD_APPROVED", row.id, old_value, serialize_record(row, db))
    db.commit()
    return serialize_record(row, db)


@router.patch("/records/{record_id}/mark-paid")
def mark_salary_paid(record_id: int, request: Request, current_user: User = Depends(require_payroll_process), db: Session = Depends(get_db)):
    row = get_company_record(db, record_id, current_user)
    if row.status not in ("approved", "processed"):
        raise HTTPException(status_code=400, detail="Only approved or processed records can be marked paid")
    old_value = serialize_record(row, db)
    row.status = "paid"
    row.paid_at = datetime.utcnow()
    audit_salary(db, request, current_user, "SALARY_RECORD_MARKED_PAID", row.id, old_value, serialize_record(row, db))
    db.commit()
    return serialize_record(row, db)


@router.get("/records")
def list_salary_records(
    month: Optional[str] = None,
    status: Optional[str] = None,
    employee_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_company_salary_read),
    db: Session = Depends(get_db),
):
    query = db.query(SalaryRecord)
    if is_platform_super_admin_user(current_user):
        pass
    elif current_user.role == "employee":
        query = query.filter(SalaryRecord.company_id == company_scope(current_user), SalaryRecord.employee_id == current_user.employee_id)
    else:
        query = query.filter(SalaryRecord.company_id == company_scope(current_user))
    if month:
        query = query.filter(SalaryRecord.month == month_start(month))
    if status:
        query = query.filter(SalaryRecord.status == status)
    if employee_id:
        query = query.filter(SalaryRecord.employee_id == employee_id)
    rows = query.order_by(SalaryRecord.month.desc(), SalaryRecord.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return [serialize_record(row, db) for row in rows]


@router.get("/records/{record_id}")
def get_salary_record(record_id: int, current_user: User = Depends(require_company_salary_read), db: Session = Depends(get_db)):
    return serialize_record(get_company_record(db, record_id, current_user), db)


@router.delete("/records/{record_id}")
def delete_salary_record(record_id: int, request: Request, current_user: User = Depends(require_salary_structure_write), db: Session = Depends(get_db)):
    row = get_company_record(db, record_id, current_user)
    if row.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft records can be deleted")
    old_value = serialize_record(row, db)
    db.delete(row)
    audit_salary(db, request, current_user, "SALARY_RECORD_CANCELLED", record_id, old_value=old_value)
    db.commit()
    return {"message": "Salary draft deleted"}


@router.post("/payslip/{record_id}/generate")
def generate_payslip(record_id: int, request: Request, current_user: User = Depends(require_payslip_generate), db: Session = Depends(get_db)):
    row = get_company_record(db, record_id, current_user)
    employee = db.query(Employee).filter(Employee.id == row.employee_id).first()
    company = db.query(Company).filter(Company.id == row.company_id).first()
    if not employee or not company:
        raise HTTPException(status_code=404, detail="Company or employee missing")
    PAYSLIP_DIR.mkdir(parents=True, exist_ok=True)
    path = PAYSLIP_DIR / f"payslip-{row.company_id}-{row.employee_id}-{row.month:%Y-%m}.pdf"
    lines = [
        f"{company.name}",
        f"{company.address}",
        "CIN/GSTIN: Not configured",
        "",
        f"Employee: {employee.first_name} {employee.last_name}",
        f"Employee ID: {employee.employee_id}",
        f"Department: {employee.department}",
        f"Designation: {employee.position}",
        "Bank account: ****",
        f"Pay period: {row.month:%B %Y}",
        "",
        "Earnings",
        f"Gross salary: {money(row.gross_salary):,.2f}",
        f"Attendance salary: {money(row.attendance_salary):,.2f}",
        f"Overtime pay: {money(row.overtime_pay):,.2f}",
        "",
        "Deductions",
        f"PF: {money(row.pf_deduction):,.2f}",
        f"ESI: {money(row.esi_deduction):,.2f}",
        f"Professional tax: {money(row.professional_tax):,.2f}",
        f"TDS: {money(row.tds_deduction):,.2f}",
        f"Loan/advance: {money(row.loan_deduction):,.2f}",
        f"Other deductions: {money(row.other_deductions):,.2f}",
        f"LOP deduction: {money(row.lop_deduction):,.2f}",
        "",
        f"NET SALARY: {money(row.net_salary):,.2f}",
        f"Attendance: Working {row.working_days} / Present {row.days_present} / Absent {row.days_absent} / LOP {row.lop_days}",
        "",
        f"This is a system-generated payslip. Generated at {datetime.utcnow().isoformat()}Z",
    ]
    write_payslip_pdf(path, lines)
    payslip = db.query(Payslip).filter(Payslip.company_id == row.company_id, Payslip.salary_record_id == row.id).first()
    if not payslip:
        payslip = Payslip(company_id=row.company_id, salary_record_id=row.id, employee_id=row.employee_id, month=row.month.month, year=row.month.year)
        db.add(payslip)
    payslip.pdf_path = str(path)
    payslip.pdf_url = f"/api/v1/salary/payslip/{record_id}/download"
    payslip.pdf_generated_at = datetime.utcnow()
    payslip.gross_pay = row.gross_salary
    payslip.deductions = row.total_deductions
    payslip.net_pay = row.net_salary
    audit_salary(db, request, current_user, "PAYSLIP_GENERATED", row.id, new_value={"pdf_url": payslip.pdf_url})
    db.commit()
    return {"payslip_id": payslip.id, "pdf_url": payslip.pdf_url, "pdf_generated_at": payslip.pdf_generated_at}


@router.get("/payslip/{record_id}/download")
def download_payslip(record_id: int, request: Request, current_user: User = Depends(require_company_salary_read), db: Session = Depends(get_db)):
    row = get_company_record(db, record_id, current_user)
    payslip = db.query(Payslip).filter(Payslip.company_id == row.company_id, Payslip.salary_record_id == row.id).first()
    if not payslip or not payslip.pdf_path or not Path(payslip.pdf_path).exists():
        raise HTTPException(status_code=404, detail="Payslip PDF not generated")
    payslip.viewed_at = datetime.utcnow()
    audit_salary(db, request, current_user, "PAYSLIP_VIEWED", row.id)
    db.commit()
    return FileResponse(payslip.pdf_path, media_type="application/pdf", filename=Path(payslip.pdf_path).name)


@router.post("/payslip/{record_id}/send")
def send_payslip(record_id: int, payload: SendPayslipPayload, request: Request, current_user: User = Depends(require_payslip_generate), db: Session = Depends(get_db)):
    row = get_company_record(db, record_id, current_user)
    payslip = db.query(Payslip).filter(Payslip.company_id == row.company_id, Payslip.salary_record_id == row.id).first()
    if not payslip:
        raise HTTPException(status_code=404, detail="Generate payslip before sending")
    employee = db.query(Employee).filter(Employee.id == row.employee_id).first()
    if employee and employee.user:
        db.add(Notification(company_id=row.company_id, user_id=employee.user.id, title="Payslip sent", body=f"Your payslip for {row.month:%B %Y} is available."))
    payslip.sent_at = datetime.utcnow()
    payslip.sent_via = payload.sent_via
    audit_salary(db, request, current_user, "PAYSLIP_SENT", row.id, new_value={"sent_via": payload.sent_via})
    db.commit()
    return {"message": f"Payslip sent via {payload.sent_via}"}


@admin_router.get("/records")
def admin_salary_records(
    company_id: Optional[int] = None,
    month: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    query = db.query(SalaryRecord)
    if company_id:
        query = query.filter(SalaryRecord.company_id == company_id)
    if month:
        query = query.filter(SalaryRecord.month == month_start(month))
    if status:
        query = query.filter(SalaryRecord.status == status)
    return [serialize_record(row, db) for row in query.order_by(SalaryRecord.month.desc(), SalaryRecord.created_at.desc()).limit(1000)]


@admin_router.get("/analytics")
def admin_salary_analytics(current_user: User = Depends(require_super_admin), db: Session = Depends(get_db)):
    rows = (
        db.query(SalaryRecord.company_id, SalaryRecord.month, func.sum(SalaryRecord.net_salary), func.count(SalaryRecord.id))
        .group_by(SalaryRecord.company_id, SalaryRecord.month)
        .order_by(SalaryRecord.month.desc())
        .all()
    )
    pending = db.query(SalaryRecord).filter(SalaryRecord.status.in_(["draft", "processed"])).count()
    processed = db.query(SalaryRecord).filter(SalaryRecord.status.in_(["processed", "approved", "paid"])).count()
    companies = {company.id: company.name for company in db.query(Company).all()}
    return {
        "total_companies_with_payroll": len({row[0] for row in rows}),
        "pending_approvals": pending,
        "processed_count": processed,
        "total_payslips_processed": db.query(Payslip).filter(Payslip.pdf_generated_at.isnot(None)).count(),
        "payroll_by_company_month": [
            {
                "company_id": company_id,
                "company_name": companies.get(company_id),
                "month": month.date().isoformat() if month else None,
                "total_net": money(total_net),
                "record_count": record_count,
            }
            for company_id, month, total_net, record_count in rows
        ],
    }


@admin_router.patch("/records/{record_id}/override")
def admin_override_salary_record(record_id: int, payload: OverridePayload, request: Request, current_user: User = Depends(require_super_admin), db: Session = Depends(get_db)):
    row = get_company_record(db, record_id, current_user)
    old_value = serialize_record(row, db)
    row.remarks = f"{row.remarks or ''}\nSuper admin flag: {payload.reason}".strip()
    audit_salary(db, request, current_user, "SALARY_OVERRIDE_BY_SUPERADMIN", row.id, old_value=old_value, new_value={"reason": payload.reason}, company_id=row.company_id)
    db.commit()
    return serialize_record(row, db)
