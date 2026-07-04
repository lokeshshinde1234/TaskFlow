# 🎯 TaskFlow OTP Email Verification - Production Setup Guide

## ✅ System Status: READY

Your project now has a **production-grade OTP verification system** with:
- ✅ 6-digit random OTP generation
- ✅ Email sending via Nodemailer-like SMTP
- ✅ 5-minute OTP expiry
- ✅ Rate limiting (30-second resend delay)
- ✅ Email format validation
- ✅ Professional HTML email templates
- ✅ Complete error handling
- ✅ Frontend UI with timer and loading states

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Start Backend (Terminal 1)
```bash
cd d:\Company Project\backend
uvicorn app.main:app --reload
```

**Expected Output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete
```

### Step 2: Start Frontend (Terminal 2)
```bash
cd d:\Company Project\taskflow
npm start
```

**Expected Output:**
```
Compiled successfully!
You can now view taskflow in the browser.
  Local:            http://localhost:3000
```

### Step 3: Test OTP Flow
1. Open browser: `http://localhost:3000`
2. Click "SignUp" → "SignUp with OTP"
3. Fill form:
   - First name: `John`
   - Last name: `Doe`
   - Email: `test@example.com`
4. Click **"Send OTP"**
5. **Check backend console** for OTP (example: `🔐 DEV MODE: OTP for test@example.com: 123456`)
6. Enter OTP in form
7. Set password (min 8 characters)
8. Click **"Verify OTP"**
9. ✅ Success! Redirect to login

---

## 📧 Enable Real Email Sending (Optional)

### Step 1: Create Gmail App Password
1. Go to: [Google Account Settings](https://myaccount.google.com/apppasswords)
2. Login with your Gmail account
3. Select **"Mail"** and **"Windows Computer"**
4. Google generates a **16-character password**
5. Copy this password

### Step 2: Update `.env` File
Edit: `d:\Company Project\backend\.env`

```env
SMTP_ENABLED=true
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USE_SSL=false
SMTP_USERNAME=your-gmail@gmail.com
SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx    # Your 16-char app password
SENDER_EMAIL=your-gmail@gmail.com
```

### Step 3: Restart Backend
```bash
# Ctrl+C to stop
# Then restart:
uvicorn app.main:app --reload
```

### Step 4: Test Real Email
1. Fill signup form with real email
2. Click "Send OTP"
3. ✅ Check email inbox for OTP message
4. Complete signup flow

---

## 📊 API Endpoints Reference

### Send OTP
```
POST /api/auth/send-otp

Request:
{
  "email": "user@example.com"
}

Response (Success):
{
  "message": "OTP sent successfully to your email",
  "email": "user@example.com",
  "expires_in_seconds": 300
}

Response (Error - Rate Limited):
Status: 429
{
  "detail": "Please wait 30 seconds before requesting a new OTP"
}
```

### Verify OTP
```
POST /api/auth/verify-otp

Request:
{
  "email": "user@example.com",
  "otp": "123456"
}

Response (Success):
{
  "message": "Email verified successfully"
}

Response (Error - Invalid):
Status: 400
{
  "detail": "Invalid OTP. Please try again."
}

Response (Error - Expired):
Status: 400
{
  "detail": "OTP expired. Please request a new OTP."
}
```

---

## 🔒 Security Features Implemented

| Feature | Details |
|---------|---------|
| **OTP Generation** | Cryptographically secure 6-digit code |
| **Expiry** | 5 minutes (configurable in .env) |
| **Rate Limiting** | 30-second minimum between resend requests |
| **Email Validation** | Regex-based email format validation |
| **One-Time Use** | OTP deleted after verification |
| **Error Messages** | Clear, actionable error messages |
| **Secure SMTP** | Supports SSL/TLS encryption |
| **Password Hashing** | Bcrypt with salt |
| **JWT Tokens** | Secure token-based authentication |

---

## 📁 Project Structure

```
backend/
├── app/services/email_service.py          ← OTP generation & email sending
├── app/main.py                   ← API endpoints
├── app/models/models.py                 ← OTPRecord database model
├── config.py                 ← Configuration settings
├── schemas.py                ← Request/response validation
└── .env                      ← Environment variables (secret)

frontend/src/
├── pages/
│   └── SignupWithOTP.js      ← Signup form UI
└── services/
    └── api.js                ← API client (authAPI.sendOTP)
```

---

## 🛠️ Configuration Guide

### Development Mode (Default - No Email Needed)
```env
SMTP_ENABLED=false
```
- OTP prints to backend console
- Perfect for local testing
- No email setup required

### Production Mode (Real Email)
```env
SMTP_ENABLED=true
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```
- OTP sent to user's email
- Professional HTML template
- Works with Gmail, SendGrid, Mailgun, etc.

### OTP Settings
```env
OTP_EXPIRY_MINUTES=5    # Change if needed
```

---

## 🧪 Testing Scenarios

### Scenario 1: Happy Path (Dev Mode)
1. Send OTP
2. Copy from console
3. Enter OTP
4. Verify successfully
5. ✅ Account created

### Scenario 2: Invalid OTP
1. Send OTP
2. Enter wrong 6 digits
3. ❌ Get error: "Invalid OTP"
4. Can retry with correct OTP

### Scenario 3: Expired OTP
1. Send OTP
2. Wait 5+ minutes
3. Try to verify
4. ❌ Get error: "OTP expired"
5. Must send new OTP

### Scenario 4: Rate Limiting
1. Send OTP
2. Immediately click "Send OTP" again
3. ❌ Get error: "Please wait 30 seconds"
4. Wait 30 seconds
5. Can send again

### Scenario 5: Email Already Registered
1. Create account with `test@example.com`
2. Try signup again with same email
3. Click "Send OTP"
4. ❌ Get error: "Email already registered"

---

## 📞 Troubleshooting

### Backend won't start
```bash
# Check Python
python --version

# Install dependencies
cd backend
pip install -r requirements.txt

# Start
uvicorn app.main:app --reload
```

### "Backend API is not running" error
- Make sure backend terminal shows "Application startup complete"
- Check that backend is on `http://localhost:8000`

### OTP not appearing in console
- Ensure `SMTP_ENABLED=false` in `.env`
- Check backend terminal window
- Restart backend after .env changes

### "Email already registered" when signing up
- Try with a different email address
- Or delete the user from database for testing

### Email sending fails in production mode
- Verify Gmail app password is correct (16 characters)
- Ensure 2FA is enabled on your Gmail account
- Check that SMTP credentials are exactly right
- Verify SMTP_PORT=587 for Gmail

### "Please wait 30 seconds" error
- This is rate limiting working correctly
- Wait 30 seconds and try again
- Prevents spam and brute force

---

## 🎓 File Locations

| Component | File Path |
|-----------|-----------|
| OTP Generation | `backend/app/services/email_service.py` |
| Email Sending | `backend/app/services/email_service.py` |
| OTP API Endpoints | `backend/app/main.py` (lines 130-165) |
| OTP Database Model | `backend/app/models/models.py` |
| Configuration | `backend/.env` |
| Frontend Form | `frontend/src/pages/SignupWithOTP.js` |
| API Client | `frontend/src/services/api.js` |

---

## 📝 Next Steps

1. **Test in Development Mode** (default - console prints OTP)
2. **Setup Gmail App Password** for production email
3. **Enable SMTP_ENABLED=true** in `.env`
4. **Test email flow** with real Gmail delivery
5. **Deploy to production** when ready

---

## 🎉 You're Ready!

Your OTP email verification system is **production-ready** and fully tested. Start the backend and frontend using the commands above!

