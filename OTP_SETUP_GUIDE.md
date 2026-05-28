# TaskFlow OTP Email Verification System

## Overview
The OTP (One-Time Password) system is fully implemented for employee signup with email verification.

### Current Features:
✅ **6-digit random OTP generation**
✅ **Email sending with SMTP support**
✅ **5-minute OTP expiration**
✅ **HTML formatted email templates**
✅ **Console fallback for testing (SMTP disabled by default)**
✅ **OTP verification before account creation**

---

## How It Works

### 1. **Employee Signup Flow**
```
Employee visits /signup-otp
↓
Enters: First name, Last name, Email
↓
Clicks "Send OTP" button
↓
Backend generates random 6-digit code (000000-999999)
↓
Email sent with message: "Your TaskFlow OTP is [CODE]"
↓
Employee receives email and enters OTP
↓
Enters Password & Confirm Password
↓
Clicks "Verify OTP" button
↓
OTP verified and account created
```

### 2. **Email Message Format**

**Subject:** TaskFlow verification code

**HTML Message:**
```
Verify your email

Use this one-time password to complete your TaskFlow employee signup.

[6-DIGIT CODE]

This code expires in 5 minutes.
```

**Plain Text:** `Your TaskFlow OTP is [CODE]. This code expires in 5 minutes.`

---

## Setup Instructions

### Option A: Testing Mode (Current - No Email Needed)
By default, `SMTP_ENABLED=false`. When you click "Send OTP":
- OTP is printed to the **backend console**
- Copy the OTP from console and enter it in the form
- **Perfect for development/testing**

### Option B: Enable Email Sending (Production)

#### Step 1: Create `.env` file in `taskflow-backend/` folder

Create `d:\Company Project\taskflow-backend\.env` with:

```env
# Database
DATABASE_URL=sqlite:///./taskflow.db

# Auth
SECRET_KEY=your-super-secret-key-change-this
ACCESS_TOKEN_EXPIRE_MINUTES=480

# Email Configuration
SMTP_ENABLED=true
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USE_SSL=false
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SENDER_EMAIL=your-email@gmail.com

# OTP Settings
OTP_EXPIRY_MINUTES=5

# Frontend
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

#### Step 2: Get Gmail App Password (Recommended)

If using Gmail with 2FA enabled:
1. Go to [Google Account](https://myaccount.google.com)
2. Click **Security** (left menu)
3. Search for "App passwords"
4. Select "Mail" and "Windows Computer"
5. Copy the 16-character password
6. Use it as `SMTP_PASSWORD` in `.env`

#### Step 3: Alternative SMTP Providers

**SendGrid:**
```env
SMTP_SERVER=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=SG.your-sendgrid-api-key
SENDER_EMAIL=noreply@yourcompany.com
```

**Mailgun:**
```env
SMTP_SERVER=smtp.mailgun.org
SMTP_PORT=587
SMTP_USERNAME=postmaster@your-domain.com
SMTP_PASSWORD=your-mailgun-password
SENDER_EMAIL=noreply@your-domain.com
```

#### Step 4: Restart Backend
```bash
# Stop current backend (Ctrl+C)
# In taskflow-backend folder:
python main.py
```

---

## API Endpoints

### 1. Send OTP
**POST** `/api/auth/send-otp` or `/api/otp/send`

**Request:**
```json
{
  "email": "employee@example.com"
}
```

**Response (Success):**
```json
{
  "message": "OTP sent successfully",
  "email": "employee@example.com",
  "expires_in_seconds": 300
}
```

**Response (Error - Email already registered):**
```json
{
  "detail": "Email already registered"
}
```

### 2. Verify OTP
**POST** `/api/auth/verify-otp`

**Request:**
```json
{
  "email": "employee@example.com",
  "otp": "123456"
}
```

**Response (Success):**
```json
{
  "message": "Email verified successfully"
}
```

**Response (Error):**
```json
{
  "detail": "Invalid OTP"
}
or
{
  "detail": "OTP expired"
}
```

### 3. Register Employee (After OTP Verification)
**POST** `/api/auth/register`

**Request:**
```json
{
  "email": "employee@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "password": "securepassword123",
  "company_id": 1
}
```

---

## Frontend Integration (Already Implemented)

The signup page at `src/pages/SignupWithOTP.js` includes:

✅ Email input with validation
✅ Send OTP button with countdown timer (300 seconds = 5 minutes)
✅ OTP input field (6 digits)
✅ Password fields with strength indicator
✅ Verify button
✅ Error and success messages
✅ Loading states

### Key Functions:
```javascript
// Send OTP
const sendOTP = async () => {
  await authAPI.sendOTP(form.email);
  setOtpSent(true);
  setTimer(300); // 5-minute countdown
};

// Verify and Create Account
const verifyOTPAndCreateAccount = async () => {
  await authAPI.verifyOTP(form.email, form.otp);
  await authAPI.register(payload);
  navigate('/login'); // Redirect to login
};
```

---

## Troubleshooting

### Issue: "Backend API is not running"
**Solution:** Start backend with:
```bash
cd d:\Company Project\taskflow-backend
python main.py
```

### Issue: "SMTP email sending failed"
**Solution:** 
- Verify SMTP credentials in `.env` are correct
- Check Gmail app password (not regular password)
- Ensure "Less secure app access" is disabled for Gmail
- Check firewall/antivirus isn't blocking SMTP port

### Issue: OTP not appearing in console
**Solution:**
- Make sure `SMTP_ENABLED=false` or commented out in `.env`
- Restart backend server
- Check backend terminal window for printed OTP

### Issue: "Email already registered"
**Solution:**
- This email is already in the system
- Try with a different email address
- Or delete the user from database if testing

### Issue: OTP expires too quickly
**Solution:**
- Increase in `.env`: `OTP_EXPIRY_MINUTES=10`
- Restart backend server

---

## File Structure

```
taskflow-backend/
├── email_service.py          # OTP generation & email sending
├── models.py                 # OTPRecord database model
├── schemas.py                # OTPRequest, OTPVerify, OTPResponse
├── main.py                   # OTP API endpoints
├── config.py                 # SMTP configuration
└── .env                      # (Create this file) SMTP credentials

taskflow/src/
├── pages/
│   └── SignupWithOTP.js      # Employee signup form
└── services/
    └── api.js                # authAPI.sendOTP() & authAPI.verifyOTP()
```

---

## Testing Checklist

- [ ] Backend running with `python main.py`
- [ ] Visit `http://localhost:3000/signup-otp`
- [ ] Enter first name, last name, email
- [ ] Click "Send OTP"
- [ ] **Option A (Testing):** Copy OTP from backend console
- [ ] **Option B (With Email):** Check email inbox for OTP message
- [ ] Enter OTP in form (6 digits)
- [ ] Enter password (min 8 characters)
- [ ] Click "Verify OTP"
- [ ] Redirected to login page
- [ ] Can login with email and password
- [ ] User appears in Founder Admin employee list

---

## Security Notes

✅ OTP expires after 5 minutes (configurable)
✅ OTP is 6 random digits (1 in 1 million chance)
✅ Invalid OTP attempts are logged
✅ Passwords hashed with bcrypt
✅ Email must be verified before account creation
✅ JWT tokens with expiry for authentication
✅ CORS protection enabled

---

## Next Steps

1. **Test in development mode** (console OTP printing)
2. **Set up email credentials** when ready for production
3. **Customize email template** (optional - in `email_service.py`)
4. **Configure OTP expiry time** if needed (in `.env`)

