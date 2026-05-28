import secrets
import smtplib
import string
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from config import (
    FRONTEND_URL,
    OTP_EXPIRY_MINUTES,
    SENDER_EMAIL,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_SERVER,
    SMTP_USERNAME,
    SMTP_USE_SSL,
    get_email_provider,
    is_emailjs_ready,
    is_smtp_ready,
)
from emailjs_service import send_otp_via_emailjs


def generate_otp(length: int = 6) -> str:
    return "".join(secrets.choice(string.digits) for _ in range(length))


def _console_log(message: str) -> None:
    """Print safely on Windows consoles that use cp1252."""
    try:
        print(message)
    except UnicodeEncodeError:
        print(message.encode("ascii", errors="replace").decode("ascii"))


def _recipient_display_name(first_name: str | None, last_name: str | None) -> str:
    parts = [part.strip() for part in (first_name, last_name) if part and part.strip()]
    return " ".join(parts) if parts else "there"


def _send_via_console(recipient_email: str, otp: str) -> tuple[bool, str, str]:
    _console_log(f"\n{'='*60}")
    _console_log(f"[DEV] OTP for {recipient_email}")
    _console_log(f"OTP Code: {otp}")
    _console_log("Expires in: 5 minutes")
    _console_log(f"{'='*60}\n")
    return True, "OTP printed in backend console (email not configured).", "console"


def send_otp_email(
    recipient_email: str,
    otp: str,
    first_name: str | None = None,
    last_name: str | None = None,
) -> tuple[bool, str, str]:
    """Send OTP email. Returns (success, message, delivery: email|console)."""
    display_name = _recipient_display_name(first_name, last_name)
    provider = get_email_provider()

    if provider == "emailjs":
        if not is_emailjs_ready():
            return (
                False,
                "EmailJS is not configured. Run setup-emailjs.ps1 or set EMAILJS_* keys in taskflow-backend/.env.",
                "email",
            )
        success, message = send_otp_via_emailjs(recipient_email, otp, display_name)
        if success:
            _console_log(f"[OK] EmailJS OTP sent to {recipient_email}")
        else:
            _console_log(f"[ERROR] {message}")
        return success, message, "email"

    if provider == "console":
        return _send_via_console(recipient_email, otp)

    if not is_smtp_ready():
        return (
            False,
            "Gmail SMTP is not configured. Prefer EmailJS: run setup-emailjs.ps1 (free, connect Gmail in browser).",
            "email",
        )

    subject = "TaskFlow - Your 6-Digit Verification Code"  # SMTP only
    
    # Plain text version for email clients that don't support HTML
    plain_body = f"""Hello {display_name},

Your TaskFlow signup verification code is:

{otp}

This code expires in {OTP_EXPIRY_MINUTES} minutes.

Open the signup page and enter this 6-digit code to continue:
{FRONTEND_URL}/signup-otp

If you did not request this code, you can ignore this email.

TaskFlow Team
    """
    
    # HTML version with professional styling
    html_body = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TaskFlow Verification</title>
</head>
<body style="margin:0; padding:0; background:#f5f5f5; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5; padding:20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background:white; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1); overflow:hidden;">
                    <!-- Header -->
                    <tr style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                        <td align="center" style="padding:40px 20px;">
                            <h1 style="color:white; margin:0; font-size:28px; font-weight:700;">🔐 TaskFlow</h1>
                            <p style="color:rgba(255,255,255,0.9); margin:5px 0 0; font-size:14px;">Email Verification</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding:40px 30px;">
                            <p style="color:#333; font-size:16px; margin:0 0 20px; font-weight:500;">Hello {display_name},</p>
                            <p style="color:#666; font-size:14px; margin:0 0 30px; line-height:1.6;">
                                Use this 6-digit verification code to complete your TaskFlow employee signup for <strong>{recipient_email}</strong>.
                            </p>
                            
                            <!-- OTP Box -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa; border:2px solid #667eea; border-radius:8px; margin:30px 0;">
                                <tr>
                                    <td align="center" style="padding:30px 20px;">
                                        <p style="color:#999; font-size:12px; margin:0 0 10px; text-transform:uppercase; letter-spacing:1px;">Your Verification Code</p>
                                        <p style="color:#667eea; font-size:48px; font-weight:700; margin:0; letter-spacing:8px; font-family:'Courier New', monospace;">{otp}</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Instructions -->
                            <p style="color:#666; font-size:13px; margin:0 0 20px; line-height:1.6;">
                                <strong>How to use this code:</strong><br>
                                1. Go back to the TaskFlow signup page<br>
                                2. Enter the code above in the OTP field<br>
                                3. Click "Verify OTP" to complete signup
                            </p>
                            
                            <!-- Timer -->
                            <div style="background:#fff3cd; border-left:4px solid #ffc107; padding:15px; margin:20px 0; border-radius:4px;">
                                <p style="color:#856404; font-size:13px; margin:0;">
                                    <strong>Time limit:</strong> This code expires in {OTP_EXPIRY_MINUTES} minutes. Please verify as soon as possible.
                                </p>
                            </div>
                            
                            <!-- Security Note -->
                            <div style="background:#e8f5e9; border-left:4px solid #4caf50; padding:15px; margin:20px 0; border-radius:4px;">
                                <p style="color:#2e7d32; font-size:12px; margin:0;">
                                    <strong>🔒 Security:</strong> Never share this code with anyone. TaskFlow team will never ask for your OTP.
                                </p>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr style="background:#f8f9fa; border-top:1px solid #e0e0e0;">
                        <td align="center" style="padding:20px 30px;">
                            <p style="color:#999; font-size:12px; margin:0 0 10px;">
                                If you didn't request this code, please ignore this email or contact support.
                            </p>
                            <p style="color:#999; font-size:11px; margin:0;">
                                © 2026 TaskFlow. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    """

    try:
        # Create multipart message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SENDER_EMAIL
        msg["To"] = recipient_email
        
        # Attach both plain text and HTML versions
        msg.attach(MIMEText(plain_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        # Create SMTP connection
        if SMTP_USE_SSL or SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, timeout=20)
        else:
            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=20)

        # Send email
        with server:
            if not (SMTP_USE_SSL or SMTP_PORT == 465):
                server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(SENDER_EMAIL, recipient_email, msg.as_string())
        
        _console_log(f"[OK] OTP email sent successfully to {recipient_email}")
        return True, f"Verification code sent to {recipient_email}.", "email"
    except smtplib.SMTPAuthenticationError:
        message = "Gmail login failed. Use your full Gmail address and a Google App Password in taskflow-backend/.env."
        _console_log(f"[ERROR] {message}")
        return False, message, "email"
    except smtplib.SMTPException as exc:
        message = f"SMTP error: {str(exc)}"
        _console_log(f"[ERROR] {message}")
        return False, message, "email"
    except Exception as exc:
        message = f"Email sending failed: {str(exc)}"
        _console_log(f"[ERROR] {message}")
        return False, message, "email"
