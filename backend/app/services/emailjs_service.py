import json
import urllib.error
import urllib.request

from app.config import (
    EMAILJS_PRIVATE_KEY,
    EMAILJS_PUBLIC_KEY,
    EMAILJS_SERVICE_ID,
    EMAILJS_TEMPLATE_ID,
    FRONTEND_URL,
    OTP_EXPIRY_MINUTES,
)


EMAILJS_API_URL = "https://api.emailjs.com/api/v1.0/email/send"


def send_otp_via_emailjs(
    recipient_email: str,
    otp: str,
    display_name: str,
) -> tuple[bool, str]:
    payload = {
        "service_id": EMAILJS_SERVICE_ID,
        "template_id": EMAILJS_TEMPLATE_ID,
        "user_id": EMAILJS_PUBLIC_KEY,
        "accessToken": EMAILJS_PRIVATE_KEY,
        "template_params": {
            "to_email": recipient_email,
            "user_email": recipient_email,
            "user_name": display_name,
            "otp_code": otp,
            "expiry_minutes": str(OTP_EXPIRY_MINUTES),
            "signup_url": f"{FRONTEND_URL}/signup-otp",
            "subject": "TaskFlow - Your 6-Digit Verification Code",
            "message": (
                f"Hello {display_name}, your TaskFlow verification code is {otp}. "
                f"It expires in {OTP_EXPIRY_MINUTES} minutes."
            ),
        },
    }

    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        EMAILJS_API_URL,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            if response.status == 200:
                return True, f"Verification code sent to {recipient_email}."
            return False, f"EmailJS returned status {response.status}."
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace").strip()
        if exc.code == 403 and "non-browser" in detail.lower():
            return (
                False,
                "Enable EmailJS server API: dashboard.emailjs.com -> Account -> Security -> allow non-browser requests.",
            )
        return False, f"EmailJS error ({exc.code}): {detail or exc.reason}"
    except Exception as exc:
        return False, f"EmailJS request failed: {exc}"
