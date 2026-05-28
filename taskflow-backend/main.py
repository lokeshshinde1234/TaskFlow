from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.encoders import jsonable_encoder
from starlette.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth_utils import create_access_token, get_current_user, hash_session_token, require_founder_admin, verify_token
from attendance_checkout import AUTO_CHECKOUT_REASON, auto_checkout_open_attendance_for_company
from config import ACCESS_TOKEN_EXPIRE_MINUTES, CORS_ORIGINS, EMPLOYEE_SESSION_TIMEOUT_SECONDS, OTP_EXPIRY_MINUTES
from database import SessionLocal, engine, get_db
from roles import FOUNDER_ADMIN_ROLE, is_company_founder_user, is_founder_admin_role, platform_super_admin_email
from realtime_status import (
    clear_company_presence,
    company_is_online_for_db,
    touch_company_presence,
)
from email_service import generate_otp, send_otp_email
from time_utils import normalize_email, otp_is_expired, utc_now
from models import ActiveSession, Attendance, Base, Company, Employee, Location, OTPRecord, Salary, User
from schemas import (
    AuthResponse,
    AttendanceActionLocation,
    AttendanceLateReasonUpdate,
    AttendanceResponse,
    CompanyLocationUpdate,
    CompanyRegister,
    CompanyResponse,
    CompanyTimingUpdate,
    DashboardAnalytics,
    EmployeeCreate,
    EmployeeResponse,
    EmployeeUpdate,
    LocationCreate,
    LocationResponse,
    OTPRequest,
    OTPResponse,
    OTPVerify,
    SalaryCreate,
    SalaryResponse,
    UserLogin,
    UserRegister,
)
from security import hash_password, verify_password
from employee_access import (
    employees_query_for_user,
    get_manageable_employee,
    repair_employee_company_links,
    valid_company_id,
)
from employee_delete import delete_employee_cascade
from employee_login_accounts import upsert_employee_login_account
from employee_utils import generate_unique_employee_id
from platform_routes import router as platform_router
from platform_bootstrap import ensure_platform_super_admin
from enterprise_routes import public_router as enterprise_public_router
from enterprise_routes import router as enterprise_router
from salary_routes import admin_router as salary_admin_router
from salary_routes import ensure_salary_schema
from salary_routes import router as salary_router


Base.metadata.create_all(bind=engine)


def ensure_attendance_timing_columns() -> None:
    if not engine.url.get_backend_name().startswith("sqlite"):
        return
    with engine.begin() as connection:
        company_columns = {row[1] for row in connection.exec_driver_sql("PRAGMA table_info(companies)").fetchall()}
        attendance_columns = {row[1] for row in connection.exec_driver_sql("PRAGMA table_info(attendance)").fetchall()}
        if "start_time" not in company_columns:
            connection.exec_driver_sql("ALTER TABLE companies ADD COLUMN start_time VARCHAR(5)")
        if "end_time" not in company_columns:
            connection.exec_driver_sql("ALTER TABLE companies ADD COLUMN end_time VARCHAR(5)")
        if "company_start_time" not in attendance_columns:
            connection.exec_driver_sql("ALTER TABLE attendance ADD COLUMN company_start_time VARCHAR(5)")
        if "company_end_time" not in attendance_columns:
            connection.exec_driver_sql("ALTER TABLE attendance ADD COLUMN company_end_time VARCHAR(5)")
        if "is_late" not in attendance_columns:
            connection.exec_driver_sql("ALTER TABLE attendance ADD COLUMN is_late BOOLEAN DEFAULT 0")
        if "late_reason" not in attendance_columns:
            connection.exec_driver_sql("ALTER TABLE attendance ADD COLUMN late_reason TEXT")
        if "checkout_type" not in attendance_columns:
            connection.exec_driver_sql("ALTER TABLE attendance ADD COLUMN checkout_type VARCHAR(50)")
        if "checkout_reason" not in attendance_columns:
            connection.exec_driver_sql("ALTER TABLE attendance ADD COLUMN checkout_reason TEXT")
        if "auto_checkout_at" not in attendance_columns:
            connection.exec_driver_sql("ALTER TABLE attendance ADD COLUMN auto_checkout_at DATETIME")
        active_session_columns = {row[1] for row in connection.exec_driver_sql("PRAGMA table_info(active_sessions)").fetchall()}
        if "employee_id" not in active_session_columns:
            connection.exec_driver_sql("ALTER TABLE active_sessions ADD COLUMN employee_id INTEGER")
        if "session_token" not in active_session_columns:
            connection.exec_driver_sql("ALTER TABLE active_sessions ADD COLUMN session_token VARCHAR(64)")
        if "device_info" not in active_session_columns:
            connection.exec_driver_sql("ALTER TABLE active_sessions ADD COLUMN device_info VARCHAR(255)")
        if "browser_info" not in active_session_columns:
            connection.exec_driver_sql("ALTER TABLE active_sessions ADD COLUMN browser_info VARCHAR(500)")
        if "ip_address" not in active_session_columns:
            connection.exec_driver_sql("ALTER TABLE active_sessions ADD COLUMN ip_address VARCHAR(100)")
        if "login_time" not in active_session_columns:
            connection.exec_driver_sql("ALTER TABLE active_sessions ADD COLUMN login_time DATETIME")
        if "last_active_time" not in active_session_columns:
            connection.exec_driver_sql("ALTER TABLE active_sessions ADD COLUMN last_active_time DATETIME")
        if "is_active" not in active_session_columns:
            connection.exec_driver_sql("ALTER TABLE active_sessions ADD COLUMN is_active BOOLEAN DEFAULT 1")
        employee_columns = {row[1] for row in connection.exec_driver_sql("PRAGMA table_info(employees)").fetchall()}
        if "is_registered" not in employee_columns:
            connection.exec_driver_sql("ALTER TABLE employees ADD COLUMN is_registered BOOLEAN NOT NULL DEFAULT 0")
        if "signup_completed" not in employee_columns:
            connection.exec_driver_sql("ALTER TABLE employees ADD COLUMN signup_completed BOOLEAN NOT NULL DEFAULT 0")
        connection.exec_driver_sql(
            """
            UPDATE employees
            SET is_registered = 1,
                signup_completed = 1
            WHERE id IN (
                SELECT employee_id
                FROM users
                WHERE employee_id IS NOT NULL
                  AND role = 'employee'
            )
            """
        )
        connection.exec_driver_sql(
            """
            UPDATE employees
            SET is_registered = 0,
                signup_completed = 0
            WHERE id IN (
                SELECT employee_id
                FROM users
                WHERE employee_id IS NOT NULL
                  AND role = 'employee'
                  AND COALESCE(is_email_verified, 0) = 0
            )
            """
        )


ensure_attendance_timing_columns()
ensure_salary_schema()

_startup_db = SessionLocal()
try:
    repair_employee_company_links(_startup_db)
finally:
    _startup_db.close()

ensure_platform_super_admin()


app = FastAPI(
    title="TaskFlow Employee Management API",
    description="Company onboarding, JWT auth, OTP signup, attendance, salary, and live location APIs.",
    version="1.0.0",
)

# simple in-memory websocket manager for broadcasting locations
from fastapi import WebSocket, WebSocketDisconnect
from threading import Thread, Event
import time

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        try:
            self.active_connections.remove(websocket)
        except ValueError:
            pass

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

manager = ConnectionManager()


def push_realtime(message: dict) -> None:
    try:
        import anyio

        anyio.from_thread.run(manager.broadcast, message)
    except Exception:
        try:
            import asyncio

            loop = asyncio.get_running_loop()
            loop.create_task(manager.broadcast(message))
        except Exception:
            pass


def employee_checked_in(db: Session, employee_id: int) -> bool:
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


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    from math import atan2, cos, radians, sin, sqrt

    radius = 6371000
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return radius * 2 * atan2(sqrt(a), sqrt(1 - a))


def employee_geofence_state(
    db: Session,
    employee: Employee,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
) -> dict:
    company = db.query(Company).filter(Company.id == employee.company_id).first() if employee.company_id else None
    if not company or company.latitude is None or company.longitude is None:
        return {"configured": False, "inside": False, "company": company, "distance": None}

    if latitude is None or longitude is None:
        latest_location = (
            db.query(Location)
            .filter(Location.employee_id == employee.id)
            .order_by(Location.timestamp.desc())
            .first()
        )
        if latest_location:
            latitude = latest_location.latitude
            longitude = latest_location.longitude

    if latitude is None or longitude is None:
        return {"configured": True, "inside": False, "company": company, "distance": None}

    distance = haversine_distance_meters(company.latitude, company.longitude, latitude, longitude)
    return {
        "configured": True,
        "inside": distance <= (company.geo_radius_meters or 100),
        "company": company,
        "distance": distance,
    }


def employee_response_payload(employee: Employee, db: Session) -> dict:
    checked_in = employee_checked_in(db, employee.id)
    return {
        "id": employee.id,
        "company_id": employee.company_id,
        "company_name": employee.company_name,
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
        "is_registered": bool(getattr(employee, "is_registered", False)),
        "signup_completed": bool(getattr(employee, "signup_completed", False)),
        "is_checked_in": checked_in,
        "work_status": "active" if checked_in else "inactive",
    }


def resolve_employee_user(db: Session, user: User) -> Employee:
    employee = None
    if user.employee_id:
        employee = db.query(Employee).filter(Employee.id == user.employee_id).first()
    if not employee:
        employee = db.query(Employee).filter(func.lower(Employee.email) == normalize_email(user.email)).first()
    if not employee:
        raise HTTPException(status_code=403, detail="Only employees can update their late reason")
    if user.employee_id != employee.id or user.company_id != employee.company_id:
        user.employee_id = employee.id
        user.company_id = employee.company_id
        db.flush()
    return employee


def broadcast_employee_work_status(db: Session, employee_id: int) -> None:
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        return
    checked_in = employee_checked_in(db, employee_id)
    employee_payload = employee_response_payload(employee, db)
    push_realtime(
        {
            "type": "employee_work_status",
            "employee_db_id": employee.id,
            "employee_id": employee.id,
            "employee_code": employee.employee_id,
            "employee_name": f"{employee.first_name} {employee.last_name}".strip(),
            "company_id": employee.company_id,
            "is_checked_in": checked_in,
            "work_status": "active" if checked_in else "inactive",
            "employee": employee_payload,
            "timestamp": utc_now().isoformat(),
        }
    )


def broadcast_company_online_status(db: Session, company_id: Optional[int], is_online: bool) -> None:
    if not company_id:
        return
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        return
    push_realtime(
        {
            "type": "company_online_status",
            "company_id": company.id,
            "is_online": is_online,
            "company_name": company.name,
            "company": company_realtime_payload(db, company),
            "timestamp": utc_now().isoformat(),
        }
    )


def company_realtime_payload(db: Session, company: Company) -> dict:
    return {
        "id": company.id,
        "name": company.name,
        "email": company.email,
        "phone": company.phone,
        "address": company.address,
        "latitude": company.latitude,
        "longitude": company.longitude,
        "geo_radius_meters": company.geo_radius_meters,
        "start_time": company.start_time,
        "end_time": company.end_time,
        "description": company.description,
        "is_active": company.is_active,
        "is_online": company_is_online_for_db(db, company.id),
        "created_at": company.created_at.isoformat() if company.created_at else None,
    }


def company_timing_is_configured(company: Optional[Company]) -> bool:
    return bool(company and company.start_time and company.end_time)


def parse_company_time(value: str):
    return datetime.strptime(value, "%H:%M").time()


def apply_attendance_timing(attendance: Attendance, company: Company, late_reason: Optional[str] = None) -> None:
    attendance.company_start_time = company.start_time
    attendance.company_end_time = company.end_time
    attendance.is_late = False
    attendance.late_reason = None
    attendance.status = "present"
    if not company_timing_is_configured(company):
        return

    start_time = parse_company_time(company.start_time)
    end_time = parse_company_time(company.end_time)
    now_local = datetime.now()
    if end_time <= start_time:
        raise HTTPException(status_code=400, detail="Company ending time must be greater than starting time.")
    if now_local.time() < start_time:
        raise HTTPException(status_code=403, detail="You cannot check in before company starting time.")

    late_after = datetime.combine(now_local.date(), start_time) + timedelta(minutes=30)
    if now_local > late_after:
        attendance.is_late = True
        attendance.status = "late"
        attendance.late_reason = late_reason.strip() if late_reason and late_reason.strip() else None


def attendance_response_payload(attendance: Attendance, db: Session) -> dict:
    employee = db.query(Employee).filter(Employee.id == attendance.employee_id).first()
    company = db.query(Company).filter(Company.id == employee.company_id).first() if employee and employee.company_id else None
    return {
        "id": attendance.id,
        "employee_id": attendance.employee_id,
        "employee_code": employee.employee_id if employee else None,
        "employee_name": f"{employee.first_name} {employee.last_name}".strip() if employee else None,
        "company_name": company.name if company else None,
        "date": attendance.date,
        "time_in": attendance.time_in,
        "time_out": attendance.time_out,
        "working_hours": attendance.working_hours,
        "company_start_time": attendance.company_start_time,
        "company_end_time": attendance.company_end_time,
        "is_late": bool(attendance.is_late),
        "late_reason": attendance.late_reason,
        "checkout_type": attendance.checkout_type,
        "checkout_reason": attendance.checkout_reason,
        "auto_checkout_at": attendance.auto_checkout_at,
        "status": attendance.status,
    }


def broadcast_attendance_update(db: Session, attendance: Attendance) -> None:
    employee = db.query(Employee).filter(Employee.id == attendance.employee_id).first()
    if not employee:
        return
    push_realtime(
        {
            "type": "attendance_update",
            "company_id": employee.company_id,
            "employee_id": employee.id,
            "attendance": jsonable_encoder(attendance_response_payload(attendance, db)),
            "timestamp": utc_now().isoformat(),
        }
    )


def broadcast_company_update(db: Session, company: Company) -> None:
    push_realtime(
        {
            "type": "company_update",
            "company_id": company.id,
            "company": company_realtime_payload(db, company),
            "timestamp": utc_now().isoformat(),
        }
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys([*CORS_ORIGINS, "http://localhost:3000", "http://127.0.0.1:3000"])),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(platform_router)
app.include_router(enterprise_router)
app.include_router(enterprise_public_router)
app.include_router(salary_router)
app.include_router(salary_admin_router)


# Background absent detector: runs periodically and marks employees absent if no check-in during working hours
stop_event = Event()

def parse_working_hours(wh: str):
    # expected format "HH:MM-HH:MM"
    try:
        start, end = wh.split('-')
        sh, sm = map(int, start.split(':'))
        eh, em = map(int, end.split(':'))
        return (sh, sm), (eh, em)
    except Exception:
        return (9, 0), (18, 0)

def absent_worker_loop():
    from sqlalchemy import func
    from time_utils import utc_now
    db = SessionLocal()
    try:
        while not stop_event.is_set():
            now = utc_now()
            companies = db.query(Company).all()
            for company in companies:
                (sh, sm), (eh, em) = parse_working_hours(company.working_hours or '')
                # if current hour past company's end hour (UTC)
                if now.hour >= eh:
                    # mark absent for employees who have no attendance today
                    employee_ids = [r[0] for r in db.query(Employee.id).filter(Employee.company_id == company.id).all()]
                    if not employee_ids:
                        continue
                    today = now.date()
                    from models import Attendance
                    present_ids = [row[0] for row in db.query(Attendance.employee_id).filter(func.date(Attendance.date) == today, Attendance.employee_id.in_(employee_ids)).all()]
                    absent_ids = set(employee_ids) - set(present_ids)
                    for eid in absent_ids:
                        # create absent attendance record
                        att = Attendance(
                            employee_id=eid,
                            date=now,
                            status='absent',
                            company_start_time=company.start_time,
                            company_end_time=company.end_time,
                            is_late=False,
                        )
                        db.add(att)
                    db.commit()
            # sleep 1 hour
            for _ in range(60):
                if stop_event.is_set():
                    break
                time.sleep(60)
    finally:
        db.close()

bg_thread = Thread(target=absent_worker_loop, daemon=True)
bg_thread.start()


EMPLOYEE_ALREADY_LOGGED_IN_MESSAGE = (
    "You are already logged in on another device/browser. Please logout from that device first."
)


def auth_payload(user: User) -> dict:
    return {
        "sub": user.email,
        "role": user.role,
        "user_id": user.id,
        "company_id": user.company_id,
        "employee_id": user.employee_id,
    }


def auth_response(user: User, token: Optional[str] = None) -> AuthResponse:
    access_token = token or create_access_token(auth_payload(user))
    return AuthResponse(access_token=access_token, role=user.role, user=user)


def create_employee_session(db: Session, user: User, token: str, request: Optional[Request] = None) -> None:
    now = datetime.utcnow()
    token_hash = hash_session_token(token)
    user_agent = request.headers.get("user-agent", "") if request else ""
    client_host = request.client.host if request and request.client else None
    db.query(ActiveSession).filter(ActiveSession.user_id == user.id).delete(synchronize_session=False)
    db.add(
        ActiveSession(
            user_id=user.id,
            employee_id=user.employee_id,
            session_token=token_hash,
            token_hash=token_hash,
            device_info=user_agent[:255],
            browser_info=user_agent[:500],
            ip_address=client_host,
            login_time=now,
            last_active_time=now,
            is_active=True,
            expires_at=now + timedelta(seconds=EMPLOYEE_SESSION_TIMEOUT_SECONDS),
        )
    )
    db.commit()


def employee_session_is_stale(session: ActiveSession, now: datetime) -> bool:
    if not session.is_active:
        return True
    if not session.last_active_time:
        return True
    if not session.expires_at or session.expires_at <= now:
        return True
    inactive_at = session.last_active_time + timedelta(seconds=EMPLOYEE_SESSION_TIMEOUT_SECONDS)
    return inactive_at <= now


def ensure_employee_can_login(db: Session, user: User, request: Optional[Request] = None) -> None:
    if user.role != "employee":
        return

    session = db.query(ActiveSession).filter(ActiveSession.user_id == user.id).first()
    if not session:
        return
    now = datetime.utcnow()
    if employee_session_is_stale(session, now):
        session.is_active = False
        session.expires_at = now
        session.last_active_time = session.last_active_time or now
        db.commit()
        return
    user_agent = request.headers.get("user-agent", "") if request else ""
    client_host = request.client.host if request and request.client else None
    same_browser = bool(user_agent and session.device_info == user_agent[:255])
    same_ip = bool(client_host and session.ip_address == client_host)
    if same_browser and same_ip:
        session.is_active = False
        session.expires_at = now
        session.last_active_time = now
        db.commit()
        return
    raise HTTPException(status_code=409, detail=EMPLOYEE_ALREADY_LOGGED_IN_MESSAGE)


def employee_auth_response(db: Session, user: User, request: Optional[Request] = None) -> AuthResponse:
    token = create_access_token(auth_payload(user))
    create_employee_session(db, user, token, request)
    db.refresh(user)
    return auth_response(user, token)


def employee_matches_legacy_login_password(employee: Employee, password: str) -> bool:
    allowed_passwords = {employee.employee_id}
    if employee.phone:
        allowed_passwords.add(employee.phone)
    return password in allowed_passwords


def clear_employee_session(db: Session, user: User) -> None:
    if user.role == "employee":
        session = db.query(ActiveSession).filter(ActiveSession.user_id == user.id).first()
        if session:
            session.is_active = False
            session.expires_at = datetime.utcnow()
            session.last_active_time = datetime.utcnow()
        db.commit()


def clear_employee_session_token(db: Session, token: str) -> None:
    payload = verify_token(token)
    if not payload:
        return

    user = db.query(User).filter(func.lower(User.email) == normalize_email(payload.get("sub"))).first()
    if not user or user.role != "employee":
        return

    session = db.query(ActiveSession).filter(
        ActiveSession.user_id == user.id,
        ActiveSession.token_hash == hash_session_token(token),
    ).first()
    if session:
        session.is_active = False
        session.expires_at = datetime.utcnow()
        session.last_active_time = datetime.utcnow()
        db.commit()


def close_open_attendance_for_company(db: Session, company_id: Optional[int]) -> list[int]:
    employee_ids = auto_checkout_open_attendance_for_company(db, company_id, AUTO_CHECKOUT_REASON)
    if employee_ids:
        db.commit()
    return employee_ids


def founder_company_id(current_user: User, db: Session, submitted_company_id: Optional[int] = None) -> int:
    company_id = current_user.company_id
    if valid_company_id(company_id) and db.query(Company).filter(Company.id == company_id).first():
        return company_id

    if valid_company_id(submitted_company_id):
        company = (
            db.query(Company)
            .filter(Company.id == submitted_company_id, func.lower(Company.email) == normalize_email(current_user.email))
            .first()
        )
        if company:
            current_user.company_id = submitted_company_id
            current_user.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(current_user)
            return current_user.company_id

    company = db.query(Company).filter(func.lower(Company.email) == normalize_email(current_user.email)).first()
    if company:
        current_user.company_id = company.id
        current_user.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(current_user)
        return current_user.company_id

    raise HTTPException(status_code=400, detail="Your company workspace is not configured.")


@app.post("/api/company/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register_company(company_data: CompanyRegister, db: Session = Depends(get_db)):
    email = normalize_email(company_data.email)

    if email == platform_super_admin_email():
        raise HTTPException(
            status_code=400,
            detail="This email is reserved for platform Super Admin. Use a different company email.",
        )

    if db.query(User).filter(func.lower(User.email) == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    password_hash = hash_password(company_data.password)
    company = db.query(Company).filter(func.lower(Company.email) == email).first()
    if company and db.query(User).filter(
        User.company_id == company.id,
        User.role == FOUNDER_ADMIN_ROLE,
    ).first():
        raise HTTPException(status_code=400, detail="Company email already registered")

    try:
        if company:
            company.name = company_data.name
            company.email = email
            company.address = company_data.address
            company.phone = company_data.phone
            company.latitude = company_data.latitude
            company.longitude = company_data.longitude
            company.geo_radius_meters = company_data.geo_radius_meters or 100
            company.start_time = company_data.start_time
            company.end_time = company_data.end_time
            company.logo_url = company_data.logo_url
            company.description = company_data.description
            company.password_hash = password_hash
            company.updated_at = datetime.utcnow()
        else:
            company = Company(
                name=company_data.name,
                email=email,
                address=company_data.address,
                phone=company_data.phone,
                latitude=company_data.latitude,
                longitude=company_data.longitude,
                geo_radius_meters=company_data.geo_radius_meters or 100,
                start_time=company_data.start_time,
                end_time=company_data.end_time,
                logo_url=company_data.logo_url,
                description=company_data.description,
                password_hash=password_hash,
            )
            db.add(company)
            db.flush()

        user = User(
            email=email,
            password_hash=password_hash,
            role=FOUNDER_ADMIN_ROLE,
            company_id=company.id,
            is_email_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        broadcast_company_update(db, company)
        return auth_response(user)
    except Exception:
        db.rollback()
        raise


@app.get("/api/company/me", response_model=CompanyResponse)
def get_company(current_user: User = Depends(require_founder_admin), db: Session = Depends(get_db)):
    company_id = founder_company_id(current_user, db)
    company = db.query(Company).filter(Company.id == company_id).first()
    payload = company_realtime_payload(db, company)
    payload["working_hours"] = company.working_hours
    payload["logo_url"] = company.logo_url
    payload["start_time"] = company.start_time
    payload["end_time"] = company.end_time
    return payload


@app.get("/api/company/employee", response_model=CompanyResponse)
def get_employee_company(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.employee:
        raise HTTPException(status_code=404, detail="Employee profile not found")
    company = db.query(Company).filter(Company.id == current_user.employee.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company workspace not found")
    payload = company_realtime_payload(db, company)
    payload["working_hours"] = company.working_hours
    payload["logo_url"] = company.logo_url
    payload["start_time"] = company.start_time
    payload["end_time"] = company.end_time
    return payload


@app.put("/api/company/location", response_model=CompanyResponse)
def update_company_location(
    payload: CompanyLocationUpdate,
    current_user: User = Depends(require_founder_admin),
    db: Session = Depends(get_db),
):
    company_id = founder_company_id(current_user, db)
    company = db.query(Company).filter(Company.id == company_id).first()

    company.latitude = payload.latitude
    company.longitude = payload.longitude
    company.geo_radius_meters = payload.geo_radius_meters
    company.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(company)
    broadcast_company_update(db, company)
    return company


@app.get("/api/company/timing", response_model=CompanyResponse)
def get_company_timing(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if is_company_founder_user(current_user):
        company_id = founder_company_id(current_user, db)
    elif current_user.employee and current_user.employee.company_id:
        company_id = current_user.employee.company_id
    else:
        raise HTTPException(status_code=404, detail="Company workspace not found")
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company workspace not found")
    return company_realtime_payload(db, company)


@app.put("/api/company/timing", response_model=CompanyResponse)
def update_company_timing(
    payload: CompanyTimingUpdate,
    current_user: User = Depends(require_founder_admin),
    db: Session = Depends(get_db),
):
    company_id = founder_company_id(current_user, db)
    company = db.query(Company).filter(Company.id == company_id).first()
    company.start_time = payload.start_time
    company.end_time = payload.end_time
    company.working_hours = f"{payload.start_time}-{payload.end_time}"
    company.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(company)
    broadcast_company_update(db, company)
    return company_realtime_payload(db, company)


@app.post("/api/auth/send-otp", response_model=OTPResponse)
@app.post("/api/otp/send", response_model=OTPResponse)
def send_otp(payload: OTPRequest, db: Session = Depends(get_db)):
    """Send OTP to user email for verification"""
    import re

    email = normalize_email(payload.email)

    # Validate email format
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_regex, email):
        raise HTTPException(status_code=400, detail="Invalid email format")

    existing_employee = db.query(Employee).filter(func.lower(func.trim(Employee.email)) == email).first()
    if not existing_employee:
        raise HTTPException(status_code=400, detail="Your email is not added by your company admin.")

    existing_user = db.query(User).filter(func.lower(User.email) == email).first()
    if (
        existing_user
        and existing_user.employee_id != existing_employee.id
    ):
        raise HTTPException(status_code=400, detail="This employee account is already registered.")
    if existing_user and existing_user.is_email_verified:
        raise HTTPException(status_code=400, detail="This employee account is already registered.")

    # Rate limiting: Check if OTP was sent in last 30 seconds
    recent_otp = db.query(OTPRecord).filter(
        func.lower(OTPRecord.email) == email,
        OTPRecord.created_at > utc_now() - timedelta(seconds=30),
    ).first()
    
    if recent_otp and not recent_otp.is_verified:
        raise HTTPException(
            status_code=429,
            detail="Please wait 30 seconds before requesting a new OTP"
        )
    
    # Generate new OTP
    otp = generate_otp()
    
    # Delete previous OTP records for this email
    db.query(OTPRecord).filter(func.lower(OTPRecord.email) == email).delete(synchronize_session=False)
    db.commit()

    # Create new OTP record
    otp_record = OTPRecord(
        email=email,
        otp_code=otp,
        expires_at=utc_now() + timedelta(minutes=OTP_EXPIRY_MINUTES),
    )
    db.add(otp_record)
    db.commit()

    # Send OTP to the email entered on the signup form
    email_sent, email_message, delivery = send_otp_email(
        email,
        otp,
        first_name=payload.first_name,
        last_name=payload.last_name,
    )

    if not email_sent:
        db.query(OTPRecord).filter(func.lower(OTPRecord.email) == email).delete(synchronize_session=False)
        db.commit()
        raise HTTPException(status_code=500, detail=email_message)

    return {
        "message": email_message,
        "email": email,
        "expires_in_seconds": OTP_EXPIRY_MINUTES * 60,
        "delivery": delivery,
    }


@app.post("/api/auth/verify-otp")
def verify_otp(payload: OTPVerify, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    submitted_otp = payload.otp

    otp_record = (
        db.query(OTPRecord)
        .filter(func.lower(OTPRecord.email) == email)
        .order_by(OTPRecord.created_at.desc())
        .first()
    )

    if not otp_record:
        raise HTTPException(status_code=400, detail="No OTP found for this email. Please send OTP first.")

    if otp_record.is_verified and otp_record.otp_code == submitted_otp:
        return {"message": "Email verified successfully"}

    if otp_is_expired(otp_record.expires_at):
        db.delete(otp_record)
        db.commit()
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new OTP.")

    if otp_record.otp_code != submitted_otp:
        raise HTTPException(
            status_code=400,
            detail="Invalid OTP. A newer code may have been sent. Use the latest 6-digit code from your email.",
        )

    otp_record.is_verified = True
    # Extra time to finish password and create account
    otp_record.expires_at = utc_now() + timedelta(minutes=15)
    db.commit()

    return {"message": "Email verified successfully"}


@app.post("/api/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register_employee(user_data: UserRegister, db: Session = Depends(get_db)):
    email = normalize_email(user_data.email)

    otp_record = (
        db.query(OTPRecord)
        .filter(func.lower(OTPRecord.email) == email, OTPRecord.is_verified == True)
        .order_by(OTPRecord.created_at.desc())
        .first()
    )
    if not otp_record or otp_is_expired(otp_record.expires_at):
        raise HTTPException(
            status_code=400,
            detail="OTP verification expired. Send a new OTP, verify it, then create your account.",
        )

    employee_query = db.query(Employee).filter(func.lower(func.trim(Employee.email)) == email)
    if valid_company_id(user_data.company_id):
        employee_query = employee_query.filter(Employee.company_id == user_data.company_id)
    employee = employee_query.first()
    if not employee:
        raise HTTPException(status_code=400, detail="Your email is not added by your company admin.")

    existing_user = db.query(User).filter(func.lower(User.email) == email).first()
    if existing_user and existing_user.employee_id != employee.id:
        raise HTTPException(status_code=400, detail="This employee account is already registered.")
    if existing_user and existing_user.is_email_verified:
        raise HTTPException(status_code=400, detail="This employee account is already registered.")

    employee.first_name = user_data.first_name
    employee.last_name = user_data.last_name
    employee.is_registered = True
    employee.signup_completed = True
    employee.updated_at = datetime.utcnow()

    if existing_user:
        user = existing_user
        user.email = email
        user.password_hash = hash_password(user_data.password)
        user.role = "employee"
        user.employee_id = employee.id
        user.company_id = employee.company_id
        user.is_email_verified = True
        user.is_active = bool(employee.is_active)
        user.updated_at = datetime.utcnow()
    else:
        user = User(
            email=email,
            password_hash=hash_password(user_data.password),
            role="employee",
            employee_id=employee.id,
            company_id=employee.company_id,
            is_email_verified=True,
            is_active=bool(employee.is_active),
        )
        db.add(user)
    db.flush()
    otp_record.user_id = user.id
    db.commit()
    db.refresh(user)
    return employee_auth_response(db, user)


@app.post("/api/auth/login", response_model=AuthResponse)
def login(credentials: UserLogin, request: Request, db: Session = Depends(get_db)):
    email = normalize_email(credentials.email)
    user = db.query(User).filter(func.lower(User.email) == email).first()
    if not user:
        employee = db.query(Employee).filter(func.lower(Employee.email) == email).first()
        if employee:
            if employee_matches_legacy_login_password(employee, credentials.password):
                upsert_employee_login_account(db, employee, credentials.password)
                db.commit()
                user = db.query(User).filter(func.lower(User.email) == email).first()
            else:
                raise HTTPException(
                    status_code=401,
                    detail="Employee record found, but login password is not set. Use employee ID or phone number once, or ask admin to set a password.",
                )
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="User account is inactive")
    ensure_employee_can_login(db, user, request)
    if user.role == "employee":
        return employee_auth_response(db, user, request)
    if is_company_founder_user(user):
        touch_company_presence(db, user.company_id)
        broadcast_company_online_status(db, user.company_id, True)
    return auth_response(user)


@app.post("/api/auth/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if is_company_founder_user(current_user):
        checked_out_employee_ids = close_open_attendance_for_company(db, current_user.company_id)
        clear_company_presence(db, current_user.company_id)
        broadcast_company_online_status(db, current_user.company_id, False)
        for employee_id in checked_out_employee_ids:
            broadcast_employee_work_status(db, employee_id)
    clear_employee_session(db, current_user)
    return {"message": "Logged out"}


@app.post("/api/auth/logout-on-close")
async def logout_on_close(request: Request, db: Session = Depends(get_db)):
    token = ""
    try:
        payload = await request.json()
        if isinstance(payload, dict):
            token = payload.get("token") or ""
    except Exception:
        body = await request.body()
        token = body.decode("utf-8").strip()

    if token:
        clear_employee_session_token(db, token)
    return {"message": "Logged out"}


@app.post("/api/auth/presence")
def presence(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if is_company_founder_user(current_user):
        touch_company_presence(db, current_user.company_id)
        broadcast_company_online_status(db, current_user.company_id, True)
        return {"status": "online", "company_id": current_user.company_id}
    return {"status": "ignored"}


@app.get("/api/auth/me")
def me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "company_id": current_user.company_id,
        "employee_id": current_user.employee_id,
    }


@app.get("/api/employees/me", response_model=EmployeeResponse)
def get_current_employee(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.employee:
        raise HTTPException(status_code=404, detail="Employee profile not found")
    return employee_response_payload(current_user.employee, db)


@app.post("/api/employees", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
def create_employee(
    employee_data: EmployeeCreate,
    current_user: User = Depends(require_founder_admin),
    db: Session = Depends(get_db),
):
    if db.query(Employee).filter(Employee.email == employee_data.email).first():
        raise HTTPException(status_code=400, detail="Employee email already exists")

    company_id = founder_company_id(current_user, db, employee_data.company_id)

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
    return employee_response_payload(employee, db)


@app.get("/api/employees", response_model=List[EmployeeResponse])
def list_employees(
    search: Optional[str] = None,
    department: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = employees_query_for_user(db, current_user)
    if search:
        term = f"%{search.lower()}%"
        query = query.filter(
            func.lower(Employee.first_name + " " + Employee.last_name).like(term)
            | func.lower(Employee.email).like(term)
        )
    if department:
        query = query.filter(Employee.department == department)
    employees = query.order_by(Employee.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return [employee_response_payload(employee, db) for employee in employees]


@app.get("/api/employees/{employee_id}", response_model=EmployeeResponse)
def get_employee(employee_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return employee_response_payload(get_manageable_employee(db, employee_id, current_user), db)


@app.put("/api/employees/{employee_id}", response_model=EmployeeResponse)
def update_employee(
    employee_id: int,
    employee_data: EmployeeUpdate,
    current_user: User = Depends(require_founder_admin),
    db: Session = Depends(get_db),
):
    submitted_company_id = employee_data.company_id
    founder_company_id(current_user, db, submitted_company_id)
    employee = get_manageable_employee(db, employee_id, current_user)
    updates = employee_data.model_dump(exclude_unset=True)
    new_password = updates.pop("password", None)
    updates.pop("company_id", None)

    new_email = updates.get("email")
    if new_email:
        existing = (
            db.query(Employee)
            .filter(func.lower(Employee.email) == normalize_email(new_email), Employee.id != employee_id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Employee email already exists")

        existing_user = (
            db.query(User)
            .filter(func.lower(User.email) == normalize_email(new_email), User.employee_id != employee_id)
            .first()
        )
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered to another user")

    new_employee_id = updates.get("employee_id")
    if new_employee_id:
        existing = (
            db.query(Employee)
            .filter(Employee.employee_id == new_employee_id, Employee.id != employee_id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Employee ID already exists")

    for field, value in updates.items():
        setattr(employee, field, value)

    if new_email or new_password or employee.user:
        upsert_employee_login_account(db, employee, new_password)

    employee.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(employee)
    return employee_response_payload(employee, db)


@app.delete("/api/employees/{employee_id}")
def delete_employee(employee_id: int, current_user: User = Depends(require_founder_admin), db: Session = Depends(get_db)):
    employee = get_manageable_employee(db, employee_id, current_user)

    try:
        delete_employee_cascade(db, employee)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Unable to delete employee: {exc}") from exc

    return {"message": "Employee deleted successfully"}


GEOFENCE_ATTENDANCE_MESSAGE = "You are outside from company location. We cannot check in or check out."
COMPANY_OFFLINE_ATTENDANCE_MESSAGE = "Company is not active right now. You can check in or check out only when the company owner is logged in."


def require_company_active_for_attendance(db: Session, employee: Employee) -> None:
    if not employee.company_id or not company_is_online_for_db(db, employee.company_id):
        raise HTTPException(status_code=403, detail=COMPANY_OFFLINE_ATTENDANCE_MESSAGE)


@app.post("/api/attendance/time-in", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED)
def time_in(
    location_data: Optional[AttendanceActionLocation] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.employee_id:
        raise HTTPException(status_code=400, detail="Only employees can time in")
    employee = db.query(Employee).filter(Employee.id == current_user.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee profile not found")
    require_company_active_for_attendance(db, employee)
    geofence = employee_geofence_state(
        db,
        employee,
        location_data.latitude if location_data else None,
        location_data.longitude if location_data else None,
    )
    if not geofence["configured"]:
        raise HTTPException(status_code=400, detail="Company location is not configured. Ask your Founder Admin to set it on the map.")
    if not geofence["inside"]:
        raise HTTPException(status_code=403, detail=GEOFENCE_ATTENDANCE_MESSAGE)
    company = geofence["company"]
    existing = (
        db.query(Attendance)
        .filter(Attendance.employee_id == current_user.employee_id, Attendance.time_in.isnot(None), Attendance.time_out.is_(None))
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Already timed in. Please time out first.")
    now = utc_now()
    attendance = Attendance(employee_id=current_user.employee_id, date=now, time_in=now)
    apply_attendance_timing(attendance, company, location_data.late_reason if location_data else None)
    db.add(attendance)
    db.commit()
    db.refresh(attendance)
    broadcast_attendance_update(db, attendance)
    broadcast_employee_work_status(db, current_user.employee_id)
    return attendance_response_payload(attendance, db)


@app.post("/api/attendance/time-out/{attendance_id}", response_model=AttendanceResponse)
def time_out(
    attendance_id: int,
    location_data: Optional[AttendanceActionLocation] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.employee_id:
        raise HTTPException(status_code=400, detail="Only employees can time out")
    employee = db.query(Employee).filter(Employee.id == current_user.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee profile not found")
    require_company_active_for_attendance(db, employee)
    geofence = employee_geofence_state(
        db,
        employee,
        location_data.latitude if location_data else None,
        location_data.longitude if location_data else None,
    )
    if not geofence["configured"]:
        raise HTTPException(status_code=400, detail="Company location is not configured. Ask your Founder Admin to set it on the map.")
    if not geofence["inside"]:
        raise HTTPException(status_code=403, detail=GEOFENCE_ATTENDANCE_MESSAGE)
    attendance = (
        db.query(Attendance)
        .filter(Attendance.id == attendance_id, Attendance.employee_id == current_user.employee_id)
        .first()
    )
    if not attendance:
        attendance = (
            db.query(Attendance)
            .filter(
                Attendance.employee_id == current_user.employee_id,
                Attendance.time_in.isnot(None),
                Attendance.time_out.is_(None),
            )
            .order_by(Attendance.date.desc())
            .first()
        )
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    if attendance.time_out:
        raise HTTPException(status_code=400, detail="Already timed out")
    time_out = utc_now()
    time_in = attendance.time_in
    if time_in and time_in.tzinfo is None:
        time_in = time_in.replace(tzinfo=timezone.utc)
    attendance.time_out = time_out
    attendance.working_hours = round((time_out - time_in).total_seconds() / 3600, 2)
    attendance.checkout_type = "manual_checkout"
    attendance.checkout_reason = None
    attendance.auto_checkout_at = None
    attendance.status = "checked_out"
    db.commit()
    db.refresh(attendance)
    broadcast_attendance_update(db, attendance)
    broadcast_employee_work_status(db, current_user.employee_id)
    return attendance_response_payload(attendance, db)


@app.put("/api/attendance/{attendance_id}/late-reason", response_model=AttendanceResponse)
def update_late_reason(
    attendance_id: int,
    payload: AttendanceLateReasonUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    employee = resolve_employee_user(db, current_user)
    attendance = (
        db.query(Attendance)
        .filter(Attendance.id == attendance_id, Attendance.employee_id == employee.id)
        .first()
    )
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    if not attendance.is_late:
        raise HTTPException(status_code=400, detail="Late reason can only be saved for late attendance")
    attendance.late_reason = payload.late_reason
    db.commit()
    db.refresh(attendance)
    broadcast_attendance_update(db, attendance)
    return attendance_response_payload(attendance, db)


@app.get("/api/attendance/employee/{employee_id}", response_model=List[AttendanceResponse])
def get_employee_attendance(employee_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "super_admin":
        if not db.query(Employee).filter(Employee.id == employee_id).first():
            raise HTTPException(status_code=404, detail="Employee not found")
    elif is_company_founder_user(current_user):
        get_manageable_employee(db, employee_id, current_user)
    else:
        employee = resolve_employee_user(db, current_user)
        if employee.id != employee_id:
            raise HTTPException(status_code=403, detail="Not allowed")
    records = db.query(Attendance).filter(Attendance.employee_id == employee_id).order_by(Attendance.date.desc()).all()
    return [attendance_response_payload(record, db) for record in records]


@app.post("/api/location/track", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
def track_location(location_data: LocationCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if is_company_founder_user(current_user):
        get_manageable_employee(db, location_data.employee_id, current_user)
    elif current_user.employee_id != location_data.employee_id:
        raise HTTPException(status_code=403, detail="Not allowed")
    # Basic spoof detection: require reasonable accuracy
    if location_data.accuracy and location_data.accuracy > 1000:
        raise HTTPException(status_code=400, detail="Location accuracy too low")

    location = Location(**location_data.model_dump())
    db.add(location)
    db.commit()
    db.refresh(location)

    # Geofence and attendance processing
    try:
        employee = db.query(Employee).filter(Employee.id == location.employee_id).first()
        if employee:
            geofence = employee_geofence_state(db, employee, location.latitude, location.longitude)
            if geofence["configured"] and company_is_online_for_db(db, employee.company_id):
                open_att = (
                    db.query(Attendance)
                    .filter(Attendance.employee_id == employee.id, Attendance.time_in.isnot(None), Attendance.time_out.is_(None))
                    .first()
                )
                now = utc_now()

                if geofence["inside"] and not open_att:
                    att = Attendance(employee_id=employee.id, date=now, time_in=now, status='present')
                    if geofence.get("company"):
                        apply_attendance_timing(att, geofence["company"])
                    db.add(att)
                    db.commit()
                    broadcast_employee_work_status(db, employee.id)
                elif not geofence["inside"] and open_att:
                    open_att.time_out = now
                    open_att.checkout_type = "auto_checkout"
                    open_att.checkout_reason = "Employee left company location."
                    open_att.auto_checkout_at = now
                    open_att.status = "checked_out"
                    if open_att.time_in:
                        time_in = open_att.time_in
                        if time_in.tzinfo is None:
                            time_in = time_in.replace(tzinfo=timezone.utc)
                        open_att.working_hours = round((now - time_in).total_seconds() / 3600, 2)
                    db.commit()
                    broadcast_employee_work_status(db, employee.id)
    except Exception:
        # fail silently for tracking to avoid breaking client
        pass

    # broadcast latest location to websocket listeners (non-blocking)
    try:
        employee = db.query(Employee).filter(Employee.id == location.employee_id).first()
        company = db.query(Company).filter(Company.id == employee.company_id).first() if employee and employee.company_id else None

        push_realtime({
            "type": "location",
            "id": location.id,
            "employee_id": location.employee_id,
            "employee_code": employee.employee_id if employee else None,
            "employee_name": f"{employee.first_name} {employee.last_name}".strip() if employee else None,
            "company_id": employee.company_id if employee else None,
            "company_name": company.name if company else None,
            "latitude": location.latitude,
            "longitude": location.longitude,
            "accuracy": location.accuracy,
            "address": location.address,
            "timestamp": location.timestamp.isoformat(),
        })
    except Exception:
        pass

    return location


@app.websocket("/ws/locations")
async def websocket_locations(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # keep connection alive; clients don't need to send data
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.get("/api/location/employee/{employee_id}", response_model=List[LocationResponse])
def get_employee_locations(employee_id: int, limit: int = 100, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if is_company_founder_user(current_user):
        get_manageable_employee(db, employee_id, current_user)
    elif current_user.employee_id != employee_id:
        raise HTTPException(status_code=403, detail="Not allowed")
    return db.query(Location).filter(Location.employee_id == employee_id).order_by(Location.timestamp.desc()).limit(limit).all()


@app.get("/api/location/company", response_model=List[LocationResponse])
def get_company_locations(current_user: User = Depends(require_founder_admin), db: Session = Depends(get_db)):
    company_id = founder_company_id(current_user, db)
    return (
        db.query(Location)
        .join(Employee)
        .filter(Employee.company_id == company_id)
        .order_by(Location.timestamp.desc())
        .all()
    )


@app.post("/api/salary", response_model=SalaryResponse, status_code=status.HTTP_201_CREATED)
def create_salary(salary_data: SalaryCreate, current_user: User = Depends(require_founder_admin), db: Session = Depends(get_db)):
    company_id = founder_company_id(current_user, db)
    employee = db.query(Employee).filter(Employee.id == salary_data.employee_id, Employee.company_id == company_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    salary = Salary(**salary_data.model_dump(), net_salary=salary_data.base_salary + salary_data.bonus - salary_data.deduction)
    db.add(salary)
    db.commit()
    db.refresh(salary)
    return salary


@app.get("/api/salary/employee/{employee_id}", response_model=List[SalaryResponse])
def get_employee_salary(employee_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "super_admin":
        if not db.query(Employee).filter(Employee.id == employee_id).first():
            raise HTTPException(status_code=404, detail="Employee not found")
    elif is_company_founder_user(current_user):
        get_manageable_employee(db, employee_id, current_user)
    elif current_user.employee_id != employee_id:
        raise HTTPException(status_code=403, detail="Not allowed")
    return db.query(Salary).filter(Salary.employee_id == employee_id).order_by(Salary.year.desc(), Salary.month.desc()).all()


@app.put("/api/salary/{salary_id}", response_model=SalaryResponse)
def update_salary(salary_id: int, salary_data: SalaryCreate, current_user: User = Depends(require_founder_admin), db: Session = Depends(get_db)):
    company_id = founder_company_id(current_user, db)
    salary = db.query(Salary).join(Employee).filter(Salary.id == salary_id, Employee.company_id == company_id).first()
    if not salary:
        raise HTTPException(status_code=404, detail="Salary record not found")
    for field, value in salary_data.model_dump().items():
        setattr(salary, field, value)
    salary.net_salary = salary.base_salary + salary.bonus - salary.deduction
    db.commit()
    db.refresh(salary)
    return salary


@app.get("/api/admin/analytics", response_model=DashboardAnalytics)
def analytics(current_user: User = Depends(require_founder_admin), db: Session = Depends(get_db)):
    company_id = founder_company_id(current_user, db)
    employee_ids = [row[0] for row in db.query(Employee.id).filter(Employee.company_id == company_id).all()]
    today = datetime.utcnow().date()
    recent = (
        db.query(Attendance)
        .filter(Attendance.employee_id.in_(employee_ids) if employee_ids else False)
        .order_by(Attendance.date.desc())
        .limit(10)
        .all()
    )
    payroll_total = (
        db.query(func.coalesce(func.sum(Salary.net_salary), 0))
        .join(Employee)
        .filter(Employee.company_id == company_id)
        .scalar()
    )
    return DashboardAnalytics(
        total_employees=len(employee_ids),
        active_today=db.query(Attendance).filter(func.date(Attendance.date) == today, Attendance.employee_id.in_(employee_ids) if employee_ids else False).count(),
        open_attendance_sessions=db.query(Attendance).filter(Attendance.time_out.is_(None), Attendance.employee_id.in_(employee_ids) if employee_ids else False).count(),
        payroll_total=float(payroll_total or 0),
        recent_attendance=[attendance_response_payload(record, db) for record in recent],
    )


@app.get("/health")
def health_check():
    return {"status": "ok", "message": "TaskFlow API is running"}


@app.get("/")
def root():
    return {"message": "Welcome to TaskFlow Employee Management API", "docs": "/docs"}
