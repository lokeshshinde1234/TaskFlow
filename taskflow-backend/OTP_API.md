# OTP Email API

FastAPI creates the database tables on server start with SQLAlchemy:

- `otp_records` stores the email, 6 digit OTP, verification state, creation time, and expiry time.
- `users` and `employees` store the employee account after OTP verification.

## Gmail SMTP Setup

Create `taskflow-backend/.env`:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/taskflow_db
SECRET_KEY=replace-with-a-long-random-secret
FRONTEND_URL=http://localhost:3000

SMTP_ENABLED=true
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USE_SSL=false
SMTP_USERNAME=your-sender@gmail.com
SMTP_PASSWORD=your-16-character-google-app-password
SENDER_EMAIL=your-sender@gmail.com
OTP_EXPIRY_MINUTES=5
```

Gmail requires a Google App Password for SMTP. A normal Gmail password will fail.

## Send OTP

```http
POST /api/otp/send
Content-Type: application/json

{
  "email": "employee@gmail.com"
}
```

Equivalent frontend route:

```http
POST /api/auth/send-otp
```

Success response:

```json
{
  "message": "OTP sent successfully",
  "email": "employee@gmail.com",
  "expires_in_seconds": 300
}
```

## Verify OTP

```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "email": "employee@gmail.com",
  "otp": "123456"
}
```

## Start API

```bash
cd taskflow-backend
uvicorn main:app --reload
```

Swagger docs:

```text
http://localhost:8000/docs
```
