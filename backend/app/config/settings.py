import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./taskflow.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

SECRET_KEY = os.getenv("SECRET_KEY", "change-this-secret-before-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))
EMPLOYEE_SESSION_TIMEOUT_SECONDS = int(os.getenv("EMPLOYEE_SESSION_TIMEOUT_SECONDS", "1800"))

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USE_SSL = os.getenv("SMTP_USE_SSL", "false").lower() == "true"
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", SMTP_USERNAME or "noreply@taskflow.local")
SMTP_ENABLED = os.getenv("SMTP_ENABLED", "false").lower() == "true"

EMAIL_PROVIDER = os.getenv("EMAIL_PROVIDER", "auto").lower()
EMAILJS_SERVICE_ID = os.getenv("EMAILJS_SERVICE_ID", "")
EMAILJS_TEMPLATE_ID = os.getenv("EMAILJS_TEMPLATE_ID", "")
EMAILJS_PUBLIC_KEY = os.getenv("EMAILJS_PUBLIC_KEY", "")
EMAILJS_PRIVATE_KEY = os.getenv("EMAILJS_PRIVATE_KEY", "")

_PLACEHOLDER_MARKERS = (
    "your-email",
    "your-16",
    "your-sender",
    "your-password",
    "your-service",
    "your-template",
    "your-public",
    "your-private",
    "example.com",
    "change-this",
)


def _has_placeholder(*values: str) -> bool:
    combined = "".join(values).lower()
    return any(marker in combined for marker in _PLACEHOLDER_MARKERS)


def is_emailjs_ready() -> bool:
    if not all([EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY]):
        return False
    return not _has_placeholder(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        EMAILJS_PUBLIC_KEY,
        EMAILJS_PRIVATE_KEY,
    )


def is_smtp_ready() -> bool:
    if not SMTP_ENABLED:
        return False
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        return False
    return not _has_placeholder(SMTP_USERNAME, SMTP_PASSWORD, SENDER_EMAIL)


def get_email_provider() -> str:
    if EMAIL_PROVIDER == "console":
        return "console"
    if EMAIL_PROVIDER == "emailjs":
        return "emailjs"
    if EMAIL_PROVIDER == "smtp":
        return "smtp"
    if is_emailjs_ready():
        return "emailjs"
    if is_smtp_ready():
        return "smtp"
    return "console"


FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", FRONTEND_URL).split(",")
    if origin.strip()
]
OTP_EXPIRY_MINUTES = int(os.getenv("OTP_EXPIRY_MINUTES", "5"))
REDIS_URL = os.getenv("REDIS_URL", "")
PUBLIC_STATS_CACHE_SECONDS = int(os.getenv("PUBLIC_STATS_CACHE_SECONDS", "60"))
TASKFLOW_STORAGE_DIR = os.getenv("TASKFLOW_STORAGE_DIR", "storage")
