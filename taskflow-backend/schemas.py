from datetime import date, datetime, time, timezone
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, field_serializer, field_validator


class CompanyRegister(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    address: str = Field(min_length=3, max_length=500)
    phone: str = Field(min_length=5, max_length=40)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    geo_radius_meters: Optional[int] = Field(default=100, ge=25, le=5000)
    start_time: str
    end_time: str
    logo_url: Optional[str] = None
    description: Optional[str] = None
    password: str = Field(min_length=6)

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_company_time(cls, value):
        try:
            time.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("Use HH:MM time format") from exc
        return value[:5]

    @field_validator("end_time")
    @classmethod
    def validate_company_time_order(cls, value, info):
        start_value = info.data.get("start_time")
        if start_value and time.fromisoformat(value) <= time.fromisoformat(start_value):
            raise ValueError("Ending time must be greater than starting time")
        return value[:5]


class CompanyLocationUpdate(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    geo_radius_meters: int = Field(default=100, ge=25, le=5000)


class CompanyTimingUpdate(BaseModel):
    start_time: str
    end_time: str

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_company_time(cls, value):
        try:
            time.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("Use HH:MM time format") from exc
        return value[:5]

    @field_validator("end_time")
    @classmethod
    def validate_company_time_order(cls, value, info):
        start_value = info.data.get("start_time")
        if start_value and time.fromisoformat(value) <= time.fromisoformat(start_value):
            raise ValueError("Ending time must be greater than starting time")
        return value[:5]


class CompanyResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    address: str
    phone: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    geo_radius_meters: Optional[int] = 100
    working_hours: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    logo_url: Optional[str] = None
    description: Optional[str] = None
    is_online: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class CompanyDetailResponse(CompanyResponse):
    is_active: bool
    is_online: bool = False
    updated_at: datetime


class CompanyAdminUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    address: Optional[str] = Field(default=None, min_length=3, max_length=500)
    phone: Optional[str] = Field(default=None, min_length=5, max_length=40)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    geo_radius_meters: Optional[int] = Field(default=None, ge=25, le=5000)
    working_hours: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    logo_url: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=6)

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_optional_company_time(cls, value):
        if value in (None, ""):
            return None
        try:
            time.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("Use HH:MM time format") from exc
        return str(value)[:5]

    @field_validator("end_time")
    @classmethod
    def validate_optional_company_time_order(cls, value, info):
        start_value = info.data.get("start_time")
        if value and start_value and time.fromisoformat(value) <= time.fromisoformat(start_value):
            raise ValueError("Ending time must be greater than starting time")
        return value


class CompanyListItem(BaseModel):
    id: int
    name: str
    email: EmailStr
    phone: str
    address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    geo_radius_meters: Optional[int] = 100
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    description: Optional[str] = None
    is_active: bool
    is_online: bool = False
    employee_count: int
    user_count: int
    payroll_total: float
    active_today: int
    created_at: datetime


class PlatformOverview(BaseModel):
    total_companies: int
    total_employees: int
    total_users: int
    active_companies: int
    payroll_total: float


class OTPRequest(BaseModel):
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        return str(value).strip().lower()


class OTPResponse(BaseModel):
    message: str
    email: EmailStr
    expires_in_seconds: int
    delivery: str = "email"


class OTPVerify(BaseModel):
    email: EmailStr
    otp: str

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        return str(value).strip().lower()

    @field_validator("otp", mode="before")
    @classmethod
    def normalize_otp(cls, value):
        return "".join(ch for ch in str(value) if ch.isdigit())

    @field_validator("otp")
    @classmethod
    def validate_otp_length(cls, value):
        if len(value) != 6:
            raise ValueError("OTP must be exactly 6 digits")
        return value


class UserRegister(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6)
    confirm_password: str = Field(min_length=6)
    company_id: Optional[int] = None

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        return str(value).strip().lower()

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, value, info):
        if info.data.get("password") and value != info.data["password"]:
            raise ValueError("Passwords do not match")
        return value


class UserLogin(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        return str(value).strip().lower()


class UserOut(BaseModel):
    id: int
    email: EmailStr
    role: str
    company_id: Optional[int] = None
    employee_id: Optional[int] = None
    is_email_verified: bool

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user: UserOut


class EmployeeCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    department: str = "General"
    position: str = "Employee"
    phone: Optional[str] = None
    salary: Optional[float] = None
    profile_image_url: Optional[str] = None
    date_of_joining: Optional[datetime] = None
    is_active: Optional[bool] = True
    company_id: Optional[int] = None
    employee_id: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=6)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        return str(value).strip().lower()

    @field_validator("phone", mode="before")
    @classmethod
    def validate_phone(cls, value):
        if value in (None, ""):
            return None
        phone = str(value).strip()
        if not phone.isdigit() or len(phone) != 10:
            raise ValueError("Phone must be exactly 10 digits")
        return phone

    @field_validator("date_of_joining", mode="before")
    @classmethod
    def parse_date_of_joining(cls, value):
        if isinstance(value, date) and not isinstance(value, datetime):
            return datetime.combine(value, time.min)
        if isinstance(value, str) and value:
            try:
                return datetime.combine(date.fromisoformat(value), time.min)
            except ValueError:
                return value
        return value


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    department: Optional[str] = None
    position: Optional[str] = None
    phone: Optional[str] = None
    salary: Optional[float] = None
    profile_image_url: Optional[str] = None
    date_of_joining: Optional[datetime] = None
    is_active: Optional[bool] = None
    employee_id: Optional[str] = None
    company_id: Optional[int] = None
    password: Optional[str] = Field(default=None, min_length=6)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        return str(value).strip().lower() if value is not None else value

    @field_validator("phone", mode="before")
    @classmethod
    def validate_phone(cls, value):
        if value in (None, ""):
            return None
        phone = str(value).strip()
        if not phone.isdigit() or len(phone) != 10:
            raise ValueError("Phone must be exactly 10 digits")
        return phone

    @field_validator("date_of_joining", mode="before")
    @classmethod
    def parse_date_of_joining(cls, value):
        if isinstance(value, date) and not isinstance(value, datetime):
            return datetime.combine(value, time.min)
        if isinstance(value, str) and value:
            try:
                return datetime.combine(date.fromisoformat(value), time.min)
            except ValueError:
                return value
        return value


class EmployeeResponse(BaseModel):
    id: int
    company_id: Optional[int] = None
    company_name: Optional[str] = None
    employee_id: str
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    department: str
    position: str
    salary: Optional[float] = None
    profile_image_url: Optional[str] = None
    date_of_joining: datetime
    is_active: bool
    is_registered: bool = False
    signup_completed: bool = False
    is_checked_in: bool = False
    work_status: str = "inactive"

    class Config:
        from_attributes = True


class AttendanceResponse(BaseModel):
    id: int
    employee_id: int
    employee_code: Optional[str] = None
    employee_name: Optional[str] = None
    company_name: Optional[str] = None
    date: datetime
    time_in: Optional[datetime] = None
    time_out: Optional[datetime] = None
    working_hours: Optional[float] = None
    company_start_time: Optional[str] = None
    company_end_time: Optional[str] = None
    is_late: bool = False
    late_reason: Optional[str] = None
    checkout_type: Optional[str] = None
    checkout_reason: Optional[str] = None
    auto_checkout_at: Optional[datetime] = None
    status: str

    @field_serializer("date", "time_in", "time_out", "auto_checkout_at", when_used="json")
    def serialize_utc_datetime(self, value: Optional[datetime]) -> Optional[str]:
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        else:
            value = value.astimezone(timezone.utc)
        return value.isoformat().replace("+00:00", "Z")

    class Config:
        from_attributes = True


class AttendanceActionLocation(BaseModel):
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    accuracy: Optional[float] = None
    late_reason: Optional[str] = None


class AttendanceLateReasonUpdate(BaseModel):
    late_reason: str = Field(min_length=1, max_length=500)

    @field_validator("late_reason", mode="before")
    @classmethod
    def normalize_late_reason(cls, value):
        return str(value).strip()


class LocationCreate(BaseModel):
    employee_id: int
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    address: Optional[str] = None


class LocationResponse(BaseModel):
    id: int
    employee_id: int
    employee_code: Optional[str] = None
    employee_name: Optional[str] = None
    company_id: Optional[int] = None
    company_name: Optional[str] = None
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    address: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True


class PlatformLocationResponse(LocationResponse):
    employee_code: Optional[str] = None
    employee_name: Optional[str] = None
    company_id: Optional[int] = None
    company_name: Optional[str] = None


class SalaryCreate(BaseModel):
    employee_id: int
    base_salary: float = Field(ge=0)
    bonus: float = Field(default=0, ge=0)
    deduction: float = Field(default=0, ge=0)
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2000, le=2100)
    status: str = "pending"


class SalaryResponse(BaseModel):
    id: int
    employee_id: int
    base_salary: float
    bonus: float
    deduction: float
    net_salary: float
    month: int
    year: int
    status: str

    class Config:
        from_attributes = True


class DashboardAnalytics(BaseModel):
    total_employees: int
    active_today: int
    open_attendance_sessions: int
    payroll_total: float
    recent_attendance: List[AttendanceResponse]


class CompanyDetailBundle(BaseModel):
    company: CompanyDetailResponse
    employees: List[EmployeeResponse]
    analytics: DashboardAnalytics
    locations: List[LocationResponse]
    salaries: List[SalaryResponse]
