from datetime import datetime, timedelta
import base64
import hashlib
import hmac
import json
import os
import secrets
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth_utils import get_current_user, require_founder_admin
from database import get_db
from employee_access import get_manageable_employee
from models import (
    ApiKey,
    Attendance,
    AttendanceAnomaly,
    AuditLog,
    BillingInvoice,
    BillingSubscription,
    Company,
    CompanySetting,
    Department,
    Employee,
    LeaveBalance,
    LeaveRequest,
    LeaveType,
    Notification,
    PayrollRun,
    Payslip,
    PerformanceScore,
    Project,
    PunchVerification,
    ReferralAffiliate,
    ReportDefinition,
    RolePermission,
    Salary,
    SalaryStructure,
    Shift,
    Sprint,
    Task,
    TaskComment,
    Team,
    TimeEntry,
    User,
    WebhookDelivery,
    WebhookEndpoint,
)
from roles import is_company_founder_user, is_platform_super_admin_user


router = APIRouter(prefix="/api/enterprise", tags=["enterprise"])
public_router = APIRouter(prefix="/api/v1", tags=["public-api"])

STORAGE_DIR = Path(os.getenv("TASKFLOW_STORAGE_DIR", "storage")).resolve()
PAYSLIP_DIR = STORAGE_DIR / "payslips"
SELFIE_DIR = STORAGE_DIR / "selfies"

DEFAULT_ROLE_PERMISSIONS = {
    "founder_admin": {"*"},
    "super_admin": {"*"},
    "employee": {
        "attendance:self",
        "leave:self",
        "task:self",
        "profile:self",
        "notification:self",
    },
}


class GenericPayload(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    metadata: dict = Field(default_factory=dict)


class DepartmentPayload(BaseModel):
    name: str
    description: Optional[str] = None
    manager_employee_id: Optional[int] = None


class TeamPayload(BaseModel):
    name: str
    department_id: Optional[int] = None
    lead_employee_id: Optional[int] = None


class SettingPayload(BaseModel):
    key: str
    value: Optional[str] = None


class ShiftPayload(BaseModel):
    name: str
    start_at: datetime
    end_at: datetime
    employee_id: Optional[int] = None
    team_id: Optional[int] = None
    timezone: str = "UTC"
    recurrence_rule: Optional[str] = None


class LeaveTypePayload(BaseModel):
    name: str
    annual_allowance: float = 0
    accrual_per_month: float = 0
    requires_approval: bool = True


class LeaveRequestPayload(BaseModel):
    leave_type_id: int
    start_date: datetime
    end_date: datetime
    reason: Optional[str] = None


class LeaveDecisionPayload(BaseModel):
    status: str = Field(pattern="^(approved|rejected)$")


class SalaryStructurePayload(BaseModel):
    employee_id: int
    name: str
    components: dict
    effective_from: Optional[datetime] = None


class PayrollRunPayload(BaseModel):
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2000, le=2100)


class ProjectPayload(BaseModel):
    name: str
    description: Optional[str] = None
    status: str = "active"
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class SprintPayload(BaseModel):
    project_id: int
    name: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: str = "planned"


class TaskPayload(BaseModel):
    title: str
    description: Optional[str] = None
    project_id: Optional[int] = None
    sprint_id: Optional[int] = None
    parent_task_id: Optional[int] = None
    depends_on_task_id: Optional[int] = None
    assignee_employee_id: Optional[int] = None
    status: str = "todo"
    priority: str = "medium"
    due_at: Optional[datetime] = None
    estimate_hours: float = 0


class TaskCommentPayload(BaseModel):
    body: str


class TimeEntryPayload(BaseModel):
    task_id: int
    employee_id: Optional[int] = None
    minutes: int = Field(gt=0)
    note: Optional[str] = None


class ReportPayload(BaseModel):
    name: str
    report_type: str
    config: dict = Field(default_factory=dict)


class WebhookPayload(BaseModel):
    url: str
    events: list[str]


class ApiKeyPayload(BaseModel):
    name: str
    scopes: list[str] = Field(default_factory=list)


class WhiteLabelPayload(BaseModel):
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    custom_domain: Optional[str] = None
    email_sender: Optional[str] = None


class PunchSelfiePayload(BaseModel):
    attendance_id: Optional[int] = None
    punch_type: str = Field(pattern="^(time_in|time_out)$")
    attendance_mode: str = Field(default="office", pattern="^(office|wfh|remote)$")
    selfie_data_url: Optional[str] = None
    selfie_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


def company_id_for_user(user: User) -> int:
    if not user.company_id:
        raise HTTPException(status_code=403, detail="Company-scoped account required")
    return user.company_id


def require_permission(permission: str):
    def dependency(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
        if is_platform_super_admin_user(current_user):
            return current_user
        if not current_user.company_id:
            raise HTTPException(status_code=403, detail="Company-scoped account required")
        if permission in DEFAULT_ROLE_PERMISSIONS.get(current_user.role, set()) or "*" in DEFAULT_ROLE_PERMISSIONS.get(current_user.role, set()):
            return current_user
        allowed = (
            db.query(RolePermission)
            .filter(
                RolePermission.company_id == current_user.company_id,
                RolePermission.role == current_user.role,
                RolePermission.permission.in_([permission, "*"]),
            )
            .first()
        )
        if not allowed:
            raise HTTPException(status_code=403, detail=f"Permission required: {permission}")
        return current_user

    return dependency


def audit(db: Session, user: User, action: str, entity_type: str, entity_id=None, metadata=None, request: Optional[Request] = None) -> None:
    db.add(
        AuditLog(
            company_id=user.company_id,
            user_id=user.id,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            metadata_json=json.dumps(metadata or {}, default=str),
            ip_address=request.client.host if request and request.client else None,
        )
    )


def as_dict(row, extra: Optional[dict] = None) -> dict:
    data = {column.name: getattr(row, column.name) for column in row.__table__.columns}
    if extra:
        data.update(extra)
    return data


def ensure_employee_in_company(db: Session, company_id: int, employee_id: Optional[int]) -> None:
    if employee_id is None:
        return
    if not db.query(Employee).filter(Employee.id == employee_id, Employee.company_id == company_id).first():
        raise HTTPException(status_code=404, detail="Employee not found in this company")


def ensure_project_in_company(db: Session, company_id: int, project_id: Optional[int]) -> None:
    if project_id is None:
        return
    if not db.query(Project).filter(Project.id == project_id, Project.company_id == company_id).first():
        raise HTTPException(status_code=404, detail="Project not found in this company")


def save_data_url(data_url: str, directory: Path, prefix: str) -> str:
    if "," not in data_url:
        raise HTTPException(status_code=400, detail="Invalid data URL")
    header, encoded = data_url.split(",", 1)
    extension = "jpg" if "jpeg" in header or "jpg" in header else "png"
    directory.mkdir(parents=True, exist_ok=True)
    filename = f"{prefix}-{secrets.token_hex(12)}.{extension}"
    path = directory / filename
    path.write_bytes(base64.b64decode(encoded))
    return str(path)


def write_simple_pdf(path: Path, lines: list[str]) -> None:
    escaped_lines = [
        line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        for line in lines
    ]
    text_commands = ["BT", "/F1 12 Tf", "72 760 Td"]
    for index, line in enumerate(escaped_lines):
        if index:
            text_commands.append("0 -18 Td")
        text_commands.append(f"({line}) Tj")
    text_commands.append("ET")
    stream = "\n".join(text_commands).encode("utf-8")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    content = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for number, obj in enumerate(objects, start=1):
        offsets.append(len(content))
        content.extend(f"{number} 0 obj\n".encode("ascii"))
        content.extend(obj)
        content.extend(b"\nendobj\n")
    xref_at = len(content)
    content.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode("ascii"))
    for offset in offsets[1:]:
        content.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    content.extend(f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_at}\n%%EOF\n".encode("ascii"))
    path.write_bytes(bytes(content))


def queue_webhooks(db: Session, company_id: int, event_type: str, payload: dict) -> None:
    endpoints = (
        db.query(WebhookEndpoint)
        .filter(WebhookEndpoint.company_id == company_id, WebhookEndpoint.is_active == True)
        .all()
    )
    for endpoint in endpoints:
        try:
            events = json.loads(endpoint.events)
        except Exception:
            events = []
        if event_type not in events and "*" not in events:
            continue
        db.add(
            WebhookDelivery(
                company_id=company_id,
                endpoint_id=endpoint.id,
                event_type=event_type,
                payload_json=json.dumps(payload, default=str),
                status="queued",
            )
        )


@router.get("/audit-logs")
def list_audit_logs(
    current_user: User = Depends(require_permission("audit:read")),
    db: Session = Depends(get_db),
):
    company_id = company_id_for_user(current_user)
    return [as_dict(row) for row in db.query(AuditLog).filter(AuditLog.company_id == company_id).order_by(AuditLog.created_at.desc()).limit(250)]


@router.get("/settings")
def list_settings(current_user: User = Depends(require_permission("settings:read")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    return {row.key: row.value for row in db.query(CompanySetting).filter(CompanySetting.company_id == company_id).all()}


@router.put("/settings")
def upsert_setting(payload: SettingPayload, request: Request, current_user: User = Depends(require_permission("settings:write")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    setting = db.query(CompanySetting).filter(CompanySetting.company_id == company_id, CompanySetting.key == payload.key).first()
    if not setting:
        setting = CompanySetting(company_id=company_id, key=payload.key)
        db.add(setting)
    setting.value = payload.value
    audit(db, current_user, "setting.upserted", "company_setting", payload.key, request=request)
    db.commit()
    return as_dict(setting)


@router.put("/white-label")
def update_white_label(payload: WhiteLabelPayload, request: Request, current_user: User = Depends(require_permission("settings:write")), db: Session = Depends(get_db)):
    values = payload.model_dump(exclude_none=True)
    company_id = company_id_for_user(current_user)
    for key, value in values.items():
        setting = db.query(CompanySetting).filter(CompanySetting.company_id == company_id, CompanySetting.key == f"white_label.{key}").first()
        if not setting:
            setting = CompanySetting(company_id=company_id, key=f"white_label.{key}")
            db.add(setting)
        setting.value = value
    audit(db, current_user, "white_label.updated", "company", company_id, values, request)
    db.commit()
    return {"message": "White-label settings saved", "settings": values}


@router.post("/departments", status_code=status.HTTP_201_CREATED)
def create_department(payload: DepartmentPayload, request: Request, current_user: User = Depends(require_permission("org:write")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    ensure_employee_in_company(db, company_id, payload.manager_employee_id)
    row = Department(company_id=company_id, **payload.model_dump())
    db.add(row)
    db.flush()
    audit(db, current_user, "department.created", "department", row.id, payload.model_dump(), request)
    db.commit()
    return as_dict(row)


@router.get("/departments")
def list_departments(current_user: User = Depends(require_permission("org:read")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    return [as_dict(row) for row in db.query(Department).filter(Department.company_id == company_id).order_by(Department.name).all()]


@router.post("/teams", status_code=status.HTTP_201_CREATED)
def create_team(payload: TeamPayload, request: Request, current_user: User = Depends(require_permission("org:write")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    ensure_employee_in_company(db, company_id, payload.lead_employee_id)
    if payload.department_id and not db.query(Department).filter(Department.id == payload.department_id, Department.company_id == company_id).first():
        raise HTTPException(status_code=404, detail="Department not found")
    row = Team(company_id=company_id, **payload.model_dump())
    db.add(row)
    db.flush()
    audit(db, current_user, "team.created", "team", row.id, payload.model_dump(), request)
    db.commit()
    return as_dict(row)


@router.get("/teams")
def list_teams(current_user: User = Depends(require_permission("org:read")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    return [as_dict(row) for row in db.query(Team).filter(Team.company_id == company_id).order_by(Team.name).all()]


@router.post("/shifts", status_code=status.HTTP_201_CREATED)
def create_shift(payload: ShiftPayload, request: Request, current_user: User = Depends(require_permission("shift:write")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    if payload.end_at <= payload.start_at:
        raise HTTPException(status_code=400, detail="Shift end must be after start")
    ensure_employee_in_company(db, company_id, payload.employee_id)
    row = Shift(company_id=company_id, **payload.model_dump())
    db.add(row)
    db.flush()
    audit(db, current_user, "shift.created", "shift", row.id, payload.model_dump(), request)
    db.commit()
    return as_dict(row)


@router.get("/shifts")
def list_shifts(current_user: User = Depends(require_permission("shift:read")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    return [as_dict(row) for row in db.query(Shift).filter(Shift.company_id == company_id).order_by(Shift.start_at.desc()).limit(500)]


@router.post("/punch-verifications", status_code=status.HTTP_201_CREATED)
def create_punch_verification(payload: PunchSelfiePayload, request: Request, current_user: User = Depends(require_permission("attendance:self")), db: Session = Depends(get_db)):
    if not current_user.employee_id:
        raise HTTPException(status_code=403, detail="Employee account required")
    company_id = company_id_for_user(current_user)
    selfie_url = payload.selfie_url
    if payload.selfie_data_url:
        selfie_url = save_data_url(payload.selfie_data_url, SELFIE_DIR, f"employee-{current_user.employee_id}")
    row = PunchVerification(
        company_id=company_id,
        employee_id=current_user.employee_id,
        attendance_id=payload.attendance_id,
        punch_type=payload.punch_type,
        attendance_mode=payload.attendance_mode,
        selfie_url=selfie_url,
        latitude=payload.latitude,
        longitude=payload.longitude,
        verification_status="verified" if selfie_url else "pending",
    )
    db.add(row)
    db.flush()
    audit(db, current_user, "punch.selfie_submitted", "punch_verification", row.id, {"mode": payload.attendance_mode}, request)
    db.commit()
    return as_dict(row)


@router.post("/leave-types", status_code=status.HTTP_201_CREATED)
def create_leave_type(payload: LeaveTypePayload, request: Request, current_user: User = Depends(require_permission("leave:admin")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    row = LeaveType(company_id=company_id, **payload.model_dump())
    db.add(row)
    db.flush()
    audit(db, current_user, "leave_type.created", "leave_type", row.id, payload.model_dump(), request)
    db.commit()
    return as_dict(row)


@router.get("/leave-types")
def list_leave_types(current_user: User = Depends(require_permission("leave:self")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    return [as_dict(row) for row in db.query(LeaveType).filter(LeaveType.company_id == company_id).order_by(LeaveType.name)]


def leave_days(start: datetime, end: datetime) -> float:
    return max(1, (end.date() - start.date()).days + 1)


@router.post("/leave-requests", status_code=status.HTTP_201_CREATED)
def create_leave_request(payload: LeaveRequestPayload, request: Request, current_user: User = Depends(require_permission("leave:self")), db: Session = Depends(get_db)):
    if not current_user.employee_id:
        raise HTTPException(status_code=403, detail="Employee account required")
    company_id = company_id_for_user(current_user)
    leave_type = db.query(LeaveType).filter(LeaveType.id == payload.leave_type_id, LeaveType.company_id == company_id).first()
    if not leave_type:
        raise HTTPException(status_code=404, detail="Leave type not found")
    days = leave_days(payload.start_date, payload.end_date)
    row = LeaveRequest(company_id=company_id, employee_id=current_user.employee_id, days=days, **payload.model_dump())
    db.add(row)
    balance = db.query(LeaveBalance).filter(LeaveBalance.employee_id == current_user.employee_id, LeaveBalance.leave_type_id == leave_type.id, LeaveBalance.year == payload.start_date.year).first()
    if not balance:
        balance = LeaveBalance(company_id=company_id, employee_id=current_user.employee_id, leave_type_id=leave_type.id, year=payload.start_date.year, accrued=leave_type.annual_allowance)
        db.add(balance)
    balance.pending += days
    db.flush()
    audit(db, current_user, "leave.requested", "leave_request", row.id, {"days": days}, request)
    queue_webhooks(db, company_id, "leave.requested", as_dict(row))
    db.commit()
    return as_dict(row)


@router.get("/leave-requests")
def list_leave_requests(current_user: User = Depends(require_permission("leave:self")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    query = db.query(LeaveRequest).filter(LeaveRequest.company_id == company_id)
    if current_user.role == "employee":
        query = query.filter(LeaveRequest.employee_id == current_user.employee_id)
    return [as_dict(row) for row in query.order_by(LeaveRequest.created_at.desc()).limit(500)]


@router.put("/leave-requests/{leave_request_id}/decision")
def decide_leave(leave_request_id: int, payload: LeaveDecisionPayload, request: Request, current_user: User = Depends(require_permission("leave:admin")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    row = db.query(LeaveRequest).filter(LeaveRequest.id == leave_request_id, LeaveRequest.company_id == company_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Leave request not found")
    if row.status != "pending":
        raise HTTPException(status_code=400, detail="Leave request already decided")
    row.status = payload.status
    row.approver_user_id = current_user.id
    row.decided_at = datetime.utcnow()
    balance = db.query(LeaveBalance).filter(LeaveBalance.employee_id == row.employee_id, LeaveBalance.leave_type_id == row.leave_type_id, LeaveBalance.year == row.start_date.year).first()
    if balance:
        balance.pending = max(0, balance.pending - row.days)
        if payload.status == "approved":
            balance.used += row.days
    audit(db, current_user, f"leave.{payload.status}", "leave_request", row.id, request=request)
    queue_webhooks(db, company_id, f"leave.{payload.status}", as_dict(row))
    db.commit()
    return as_dict(row)


@router.get("/leave-balances")
def list_leave_balances(current_user: User = Depends(require_permission("leave:self")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    query = db.query(LeaveBalance).filter(LeaveBalance.company_id == company_id)
    if current_user.role == "employee":
        query = query.filter(LeaveBalance.employee_id == current_user.employee_id)
    return [as_dict(row, {"available": row.accrued - row.used - row.pending}) for row in query.all()]


@router.post("/salary-structures", status_code=status.HTTP_201_CREATED)
def create_salary_structure(payload: SalaryStructurePayload, request: Request, current_user: User = Depends(require_permission("payroll:write")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    ensure_employee_in_company(db, company_id, payload.employee_id)
    row = SalaryStructure(
        company_id=company_id,
        employee_id=payload.employee_id,
        name=payload.name,
        components_json=json.dumps(payload.components),
        effective_from=payload.effective_from or datetime.utcnow(),
    )
    db.add(row)
    db.flush()
    audit(db, current_user, "salary_structure.created", "salary_structure", row.id, request=request)
    db.commit()
    return as_dict(row, {"components": payload.components})


def salary_for_period(db: Session, employee_id: int, month: int, year: int) -> tuple[float, float, float]:
    salary = db.query(Salary).filter(Salary.employee_id == employee_id, Salary.month == month, Salary.year == year).first()
    if salary:
        return salary.base_salary + salary.bonus, salary.deduction, salary.net_salary
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    base = float(employee.salary or 0) if employee else 0
    attendance_count = db.query(Attendance).filter(Attendance.employee_id == employee_id, func.strftime("%m", Attendance.date) == f"{month:02d}", func.strftime("%Y", Attendance.date) == str(year)).count()
    deduction = 0 if attendance_count >= 20 else max(0, (20 - attendance_count) * (base / 30 if base else 0))
    return base, deduction, max(0, base - deduction)


@router.post("/payroll-runs", status_code=status.HTTP_201_CREATED)
def create_payroll_run(payload: PayrollRunPayload, request: Request, current_user: User = Depends(require_permission("payroll:write")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    employees = db.query(Employee).filter(Employee.company_id == company_id, Employee.is_active == True).all()
    gross = deductions = net = 0.0
    run = PayrollRun(company_id=company_id, month=payload.month, year=payload.year)
    db.add(run)
    db.flush()
    PAYSLIP_DIR.mkdir(parents=True, exist_ok=True)
    for employee in employees:
        emp_gross, emp_deductions, emp_net = salary_for_period(db, employee.id, payload.month, payload.year)
        gross += emp_gross
        deductions += emp_deductions
        net += emp_net
        pdf_path = PAYSLIP_DIR / f"payslip-{company_id}-{employee.id}-{payload.year}-{payload.month}.pdf"
        write_simple_pdf(
            pdf_path,
            [
                "TaskFlow Payslip",
                f"Employee: {employee.first_name} {employee.last_name}",
                f"Period: {payload.month}/{payload.year}",
                f"Gross: {emp_gross}",
                f"Deductions: {emp_deductions}",
                f"Net: {emp_net}",
            ],
        )
        db.add(Payslip(company_id=company_id, payroll_run_id=run.id, employee_id=employee.id, month=payload.month, year=payload.year, gross_pay=emp_gross, deductions=emp_deductions, net_pay=emp_net, pdf_path=str(pdf_path)))
    run.gross_pay = gross
    run.deductions = deductions
    run.net_pay = net
    run.status = "calculated"
    audit(db, current_user, "payroll_run.created", "payroll_run", run.id, {"employees": len(employees)}, request)
    queue_webhooks(db, company_id, "payroll.generated", {"payroll_run_id": run.id, "month": payload.month, "year": payload.year})
    db.commit()
    return as_dict(run)


@router.get("/payslips")
def list_payslips(current_user: User = Depends(require_permission("payroll:read")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    query = db.query(Payslip).filter(Payslip.company_id == company_id)
    if current_user.role == "employee":
        query = query.filter(Payslip.employee_id == current_user.employee_id)
    return [as_dict(row) for row in query.order_by(Payslip.created_at.desc()).limit(500)]


@router.get("/payslips/{payslip_id}/download")
def download_payslip(payslip_id: int, current_user: User = Depends(require_permission("payroll:read")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    row = db.query(Payslip).filter(Payslip.id == payslip_id, Payslip.company_id == company_id).first()
    if not row or (current_user.role == "employee" and row.employee_id != current_user.employee_id):
        raise HTTPException(status_code=404, detail="Payslip not found")
    if not row.pdf_path or not Path(row.pdf_path).exists():
        raise HTTPException(status_code=404, detail="Payslip file not found")
    return FileResponse(row.pdf_path, media_type="application/pdf", filename=Path(row.pdf_path).name)


@router.post("/payslips/{payslip_id}/distribute")
def distribute_payslip(payslip_id: int, request: Request, current_user: User = Depends(require_permission("payroll:write")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    row = db.query(Payslip).filter(Payslip.id == payslip_id, Payslip.company_id == company_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Payslip not found")
    row.distributed_at = datetime.utcnow()
    employee = db.query(Employee).filter(Employee.id == row.employee_id).first()
    if employee and employee.user:
        db.add(Notification(company_id=company_id, user_id=employee.user.id, title="Payslip available", body=f"Your {row.month}/{row.year} payslip is ready."))
    audit(db, current_user, "payslip.distributed", "payslip", row.id, request=request)
    queue_webhooks(db, company_id, "payslip.generated", as_dict(row))
    db.commit()
    return {"message": "Payslip marked as distributed"}


@router.post("/projects", status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectPayload, request: Request, current_user: User = Depends(require_permission("project:write")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    row = Project(company_id=company_id, **payload.model_dump())
    db.add(row)
    db.flush()
    audit(db, current_user, "project.created", "project", row.id, request=request)
    db.commit()
    return as_dict(row)


@router.get("/projects")
def list_projects(current_user: User = Depends(require_permission("project:read")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    return [as_dict(row) for row in db.query(Project).filter(Project.company_id == company_id).order_by(Project.created_at.desc())]


@router.post("/sprints", status_code=status.HTTP_201_CREATED)
def create_sprint(payload: SprintPayload, request: Request, current_user: User = Depends(require_permission("project:write")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    ensure_project_in_company(db, company_id, payload.project_id)
    row = Sprint(company_id=company_id, **payload.model_dump())
    db.add(row)
    db.flush()
    audit(db, current_user, "sprint.created", "sprint", row.id, request=request)
    db.commit()
    return as_dict(row)


@router.get("/tasks")
def list_tasks(current_user: User = Depends(require_permission("task:self")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    query = db.query(Task).filter(Task.company_id == company_id)
    if current_user.role == "employee":
        query = query.filter(Task.assignee_employee_id == current_user.employee_id)
    return [as_dict(row) for row in query.order_by(Task.updated_at.desc()).limit(1000)]


@router.post("/tasks", status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskPayload, request: Request, current_user: User = Depends(require_permission("task:write")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    ensure_project_in_company(db, company_id, payload.project_id)
    ensure_employee_in_company(db, company_id, payload.assignee_employee_id)
    row = Task(company_id=company_id, **payload.model_dump())
    db.add(row)
    db.flush()
    audit(db, current_user, "task.created", "task", row.id, request=request)
    queue_webhooks(db, company_id, "task.created", as_dict(row))
    db.commit()
    return as_dict(row)


@router.put("/tasks/{task_id}")
def update_task(task_id: int, payload: TaskPayload, request: Request, current_user: User = Depends(require_permission("task:write")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    row = db.query(Task).filter(Task.id == task_id, Task.company_id == company_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Task not found")
    for key, value in payload.model_dump().items():
        setattr(row, key, value)
    row.updated_at = datetime.utcnow()
    audit(db, current_user, "task.updated", "task", row.id, request=request)
    db.commit()
    return as_dict(row)


@router.post("/tasks/{task_id}/comments", status_code=status.HTTP_201_CREATED)
def add_task_comment(task_id: int, payload: TaskCommentPayload, request: Request, current_user: User = Depends(require_permission("task:self")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    task = db.query(Task).filter(Task.id == task_id, Task.company_id == company_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if current_user.role == "employee" and task.assignee_employee_id != current_user.employee_id:
        raise HTTPException(status_code=403, detail="Not assigned to this task")
    row = TaskComment(company_id=company_id, task_id=task_id, user_id=current_user.id, body=payload.body)
    db.add(row)
    db.flush()
    audit(db, current_user, "task.comment.created", "task_comment", row.id, request=request)
    db.commit()
    return as_dict(row)


@router.post("/time-entries", status_code=status.HTTP_201_CREATED)
def create_time_entry(payload: TimeEntryPayload, request: Request, current_user: User = Depends(require_permission("task:self")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    employee_id = payload.employee_id or current_user.employee_id
    ensure_employee_in_company(db, company_id, employee_id)
    task = db.query(Task).filter(Task.id == payload.task_id, Task.company_id == company_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if current_user.role == "employee" and employee_id != current_user.employee_id:
        raise HTTPException(status_code=403, detail="Cannot log time for another employee")
    row = TimeEntry(company_id=company_id, task_id=payload.task_id, employee_id=employee_id, minutes=payload.minutes, note=payload.note)
    db.add(row)
    db.flush()
    audit(db, current_user, "task.time_logged", "time_entry", row.id, request=request)
    db.commit()
    return as_dict(row)


@router.get("/analytics/daily-attendance")
def daily_attendance_summary(current_user: User = Depends(require_permission("attendance:read")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    employee_ids = [row[0] for row in db.query(Employee.id).filter(Employee.company_id == company_id)]
    today = datetime.utcnow().date()
    present = db.query(Attendance).filter(func.date(Attendance.date) == today, Attendance.employee_id.in_(employee_ids) if employee_ids else False).count()
    late = db.query(Attendance).filter(func.date(Attendance.date) == today, Attendance.is_late == True, Attendance.employee_id.in_(employee_ids) if employee_ids else False).count()
    return {"date": str(today), "total_employees": len(employee_ids), "present": present, "absent": max(0, len(employee_ids) - present), "late": late}


@router.get("/analytics/tasks")
def task_analytics(current_user: User = Depends(require_permission("project:read")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    rows = db.query(Task.status, func.count(Task.id)).filter(Task.company_id == company_id).group_by(Task.status).all()
    return {"by_status": {status: count for status, count in rows}}


@router.get("/analytics/payroll")
def payroll_analytics(current_user: User = Depends(require_permission("payroll:read")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    total = db.query(func.coalesce(func.sum(Payslip.net_pay), 0)).filter(Payslip.company_id == company_id).scalar()
    runs = db.query(PayrollRun).filter(PayrollRun.company_id == company_id).order_by(PayrollRun.created_at.desc()).limit(12)
    return {"total_net_pay": float(total or 0), "runs": [as_dict(row) for row in runs]}


@router.post("/reports", status_code=status.HTTP_201_CREATED)
def create_report(payload: ReportPayload, request: Request, current_user: User = Depends(require_permission("report:write")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    row = ReportDefinition(company_id=company_id, name=payload.name, report_type=payload.report_type, config_json=json.dumps(payload.config))
    db.add(row)
    db.flush()
    audit(db, current_user, "report.created", "report_definition", row.id, request=request)
    db.commit()
    return as_dict(row)


@router.get("/reports/{report_type}")
def run_report(report_type: str, current_user: User = Depends(require_permission("report:read")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    if report_type == "attendance_leave":
        return {
            "attendance": daily_attendance_summary(current_user, db),
            "leave_requests": [as_dict(row) for row in db.query(LeaveRequest).filter(LeaveRequest.company_id == company_id).limit(100)],
        }
    if report_type == "productivity_project":
        return {"tasks": task_analytics(current_user, db), "time_minutes": db.query(func.coalesce(func.sum(TimeEntry.minutes), 0)).filter(TimeEntry.company_id == company_id).scalar()}
    if report_type == "statutory_compliance":
        return {"format": "csv", "rows": [as_dict(row) for row in db.query(Payslip).filter(Payslip.company_id == company_id).limit(500)]}
    raise HTTPException(status_code=404, detail="Unknown report type")


@router.post("/billing/checkout")
def create_checkout_session(request: Request, current_user: User = Depends(require_permission("billing:write")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    seats = db.query(Employee).filter(Employee.company_id == company_id, Employee.is_active == True).count()
    subscription = db.query(BillingSubscription).filter(BillingSubscription.company_id == company_id).first()
    if not subscription:
        subscription = BillingSubscription(company_id=company_id)
        db.add(subscription)
    subscription.active_seats = seats
    audit(db, current_user, "billing.checkout_requested", "billing_subscription", company_id, {"seats": seats}, request)
    db.commit()
    return {"checkout_url": os.getenv("STRIPE_CHECKOUT_FALLBACK_URL", "https://dashboard.stripe.com/test/checkouts"), "active_seats": seats}


@router.get("/billing")
def billing_portal(current_user: User = Depends(require_permission("billing:read")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    subscription = db.query(BillingSubscription).filter(BillingSubscription.company_id == company_id).first()
    invoices = db.query(BillingInvoice).filter(BillingInvoice.company_id == company_id).order_by(BillingInvoice.created_at.desc()).limit(100)
    return {"subscription": as_dict(subscription) if subscription else None, "invoices": [as_dict(row) for row in invoices], "portal_url": os.getenv("STRIPE_BILLING_PORTAL_URL")}


@router.post("/api-keys", status_code=status.HTTP_201_CREATED)
def create_api_key(payload: ApiKeyPayload, request: Request, current_user: User = Depends(require_permission("api:write")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    raw_key = f"tf_{secrets.token_urlsafe(32)}"
    row = ApiKey(company_id=company_id, name=payload.name, key_hash=hashlib.sha256(raw_key.encode()).hexdigest(), scopes=json.dumps(payload.scopes))
    db.add(row)
    db.flush()
    audit(db, current_user, "api_key.created", "api_key", row.id, request=request)
    db.commit()
    return {"id": row.id, "name": row.name, "key": raw_key, "scopes": payload.scopes}


@router.post("/webhooks", status_code=status.HTTP_201_CREATED)
def create_webhook(payload: WebhookPayload, request: Request, current_user: User = Depends(require_permission("webhook:write")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    row = WebhookEndpoint(company_id=company_id, url=payload.url, events=json.dumps(payload.events), secret=secrets.token_urlsafe(32))
    db.add(row)
    db.flush()
    audit(db, current_user, "webhook.created", "webhook_endpoint", row.id, request=request)
    db.commit()
    return as_dict(row, {"events": payload.events})


@router.get("/notifications")
def list_notifications(current_user: User = Depends(require_permission("notification:self")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    query = db.query(Notification).filter(Notification.company_id == company_id)
    if current_user.role == "employee":
        query = query.filter(Notification.user_id == current_user.id)
    return [as_dict(row) for row in query.order_by(Notification.created_at.desc()).limit(100)]


@router.post("/anomalies/run")
def run_anomaly_detection(request: Request, current_user: User = Depends(require_permission("attendance:read")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    employees = db.query(Employee).filter(Employee.company_id == company_id).all()
    created = 0
    for employee in employees:
        recent = db.query(Attendance).filter(Attendance.employee_id == employee.id).order_by(Attendance.date.desc()).limit(30).all()
        perfect = len(recent) >= 20 and all(record.status in ("present", "checked_out") and not record.is_late for record in recent)
        if perfect:
            db.add(AttendanceAnomaly(company_id=company_id, employee_id=employee.id, anomaly_type="sudden_perfect_attendance", severity="low", details="30-day rule engine signal"))
            created += 1
        locations = db.query(PunchVerification).filter(PunchVerification.employee_id == employee.id, PunchVerification.latitude.isnot(None), PunchVerification.longitude.isnot(None)).order_by(PunchVerification.created_at.desc()).limit(2).all()
        if len(locations) == 2 and locations[0].created_at and locations[1].created_at:
            minutes = abs((locations[0].created_at - locations[1].created_at).total_seconds()) / 60
            if minutes < 5 and locations[0].latitude != locations[1].latitude and locations[0].longitude != locations[1].longitude:
                db.add(AttendanceAnomaly(company_id=company_id, employee_id=employee.id, anomaly_type="impossible_travel", severity="high", details="Two punch locations changed within five minutes"))
                created += 1
    audit(db, current_user, "anomaly_detection.ran", "attendance_anomaly", metadata={"created": created}, request=request)
    db.commit()
    return {"created": created}


@router.post("/performance-scores/calculate")
def calculate_performance_scores(period: str, request: Request, current_user: User = Depends(require_permission("analytics:write")), db: Session = Depends(get_db)):
    company_id = company_id_for_user(current_user)
    employees = db.query(Employee).filter(Employee.company_id == company_id).all()
    rows = []
    for employee in employees:
        attendance_count = db.query(Attendance).filter(Attendance.employee_id == employee.id).count()
        task_done = db.query(Task).filter(Task.company_id == company_id, Task.assignee_employee_id == employee.id, Task.status.in_(["done", "completed"])).count()
        attendance_score = min(100, attendance_count * 3)
        task_score = min(100, task_done * 10)
        final = round((attendance_score * 0.5) + (task_score * 0.5), 2)
        row = PerformanceScore(company_id=company_id, employee_id=employee.id, period=period, attendance_score=attendance_score, task_score=task_score, final_score=final)
        db.add(row)
        rows.append(row)
    audit(db, current_user, "performance_scores.calculated", "performance_score", metadata={"period": period, "count": len(rows)}, request=request)
    db.commit()
    return [as_dict(row) for row in rows]


@router.post("/referrals", status_code=status.HTTP_201_CREATED)
def create_referral(payload: GenericPayload, request: Request, current_user: User = Depends(require_permission("billing:write")), db: Session = Depends(get_db)):
    code = (payload.name or f"TF-{secrets.token_hex(4)}").upper().replace(" ", "-")
    row = ReferralAffiliate(company_id=current_user.company_id, code=code, owner_email=current_user.email, reward_value=float(payload.metadata.get("reward_value", 0) or 0))
    db.add(row)
    db.flush()
    audit(db, current_user, "referral.created", "referral_affiliate", row.id, request=request)
    db.commit()
    return as_dict(row)


@router.get("/mobile/config")
def mobile_config(current_user: User = Depends(get_current_user)):
    return {
        "api_base_url": os.getenv("PUBLIC_API_BASE_URL", "http://localhost:8000/api"),
        "pwa_url": os.getenv("FRONTEND_URL", "http://localhost:3000"),
        "deep_links": {"attendance": "taskflow://attendance", "tasks": "taskflow://tasks"},
        "native_shell": "React Native compatible API contract",
        "user": {"role": current_user.role, "company_id": current_user.company_id, "employee_id": current_user.employee_id},
    }


def get_public_company(request: Request, db: Session) -> tuple[Company, ApiKey]:
    raw_key = request.headers.get("x-api-key")
    if not raw_key:
        raise HTTPException(status_code=401, detail="x-api-key required")
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    api_key = db.query(ApiKey).filter(ApiKey.key_hash == key_hash, ApiKey.is_active == True).first()
    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    api_key.last_used_at = datetime.utcnow()
    company = db.query(Company).filter(Company.id == api_key.company_id).first()
    if not company:
        raise HTTPException(status_code=401, detail="API key company missing")
    return company, api_key


@public_router.get("/employees")
def public_employees(request: Request, db: Session = Depends(get_db)):
    company, _api_key = get_public_company(request, db)
    rows = db.query(Employee).filter(Employee.company_id == company.id, Employee.is_active == True).all()
    db.commit()
    return [{"id": row.id, "employee_id": row.employee_id, "name": f"{row.first_name} {row.last_name}".strip(), "email": row.email, "department": row.department} for row in rows]


@public_router.get("/attendance")
def public_attendance(request: Request, db: Session = Depends(get_db)):
    company, _api_key = get_public_company(request, db)
    employee_ids = [row[0] for row in db.query(Employee.id).filter(Employee.company_id == company.id)]
    rows = db.query(Attendance).filter(Attendance.employee_id.in_(employee_ids) if employee_ids else False).order_by(Attendance.date.desc()).limit(500)
    db.commit()
    return [as_dict(row) for row in rows]


@public_router.get("/openapi.json")
def public_openapi():
    return {
        "openapi": "3.1.0",
        "info": {"title": "TaskFlow Public API", "version": "1.0.0"},
        "paths": {
            "/api/v1/employees": {"get": {"security": [{"ApiKeyAuth": []}], "summary": "List active employees"}},
            "/api/v1/attendance": {"get": {"security": [{"ApiKeyAuth": []}], "summary": "List attendance records"}},
        },
        "components": {"securitySchemes": {"ApiKeyAuth": {"type": "apiKey", "in": "header", "name": "x-api-key"}}},
    }
