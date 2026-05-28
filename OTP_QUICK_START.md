# OTP Testing Quick Start

## Current Setup Status
✅ OTP system is fully implemented and ready to use
✅ Default mode: TESTING (OTP prints to console)
✅ `.env` file configured in `taskflow-backend/`

---

## Quick Test (5 minutes)

### Step 1: Start Backend
```bash
cd d:\Company Project\taskflow-backend
python main.py
```
**Expected output in console:**
```
INFO:     Application startup complete
```

### Step 2: Start Frontend
```bash
cd d:\Company Project\taskflow
npm start
```
**Expected:** Browser opens at `http://localhost:3000`

### Step 3: Test OTP Signup
1. Click **"SignUp"** on landing page
2. Or visit: `http://localhost:3000/signup-otp`
3. Fill form:
   - First name: `John`
   - Last name: `Doe`
   - Email: `john@example.com`
4. Click **"Send OTP"** button
5. **Check backend terminal** for OTP (like: `DEV OTP for john@example.com: 123456`)
6. Copy the 6-digit code from console
7. Enter OTP in form
8. Set password (min 8 characters)
9. Click **"Verify OTP"**
10. ✅ Redirected to login page
11. Login with email and password

---

## What Happens Behind the Scenes

### When you click "Send OTP":
```
Frontend: POST /api/auth/send-otp
    ↓
Backend: generate_otp() → 6-digit random number
    ↓
Backend: Save OTP to database with 5-min expiry
    ↓
Backend: send_otp_email() 
    ↓
If SMTP_ENABLED=false: Print to console ✓ (Testing Mode)
If SMTP_ENABLED=true: Send via email to user
    ↓
Frontend: Display timer countdown (5:00 → 0:00)
```

### When you click "Verify OTP":
```
Frontend: POST /api/auth/verify-otp
    ↓
Backend: Check if OTP matches and not expired
    ↓
If valid: Mark as verified, create user account
    ↓
If invalid: Return error "Invalid OTP" or "OTP expired"
    ↓
Frontend: Redirect to login page
```

---

## Email Configuration (Optional - Production)

### To enable real email sending:

1. **Get Gmail app password** (or use SendGrid/Mailgun):
   - Go to: https://myaccount.google.com/apppasswords
   - Or use any SMTP provider (SendGrid, Mailgun, etc.)

2. **Edit `.env` file** in `taskflow-backend/`:
   ```env
   SMTP_ENABLED=true
   SMTP_SERVER=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USERNAME=your-email@gmail.com
   SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx  # App password (16 chars)
   SENDER_EMAIL=your-email@gmail.com
   ```

3. **Restart backend**:
   ```bash
   # Ctrl+C to stop
   python main.py
   ```

4. **Test**:
   - Fill signup form
   - Click "Send OTP"
   - **Check email inbox** instead of console
   - Enter OTP and verify

---

## File Locations

| File | Purpose |
|------|---------|
| `taskflow-backend/.env` | Configuration (SMTP settings) |
| `taskflow-backend/email_service.py` | OTP generation & email sending |
| `taskflow-backend/models.py` | OTPRecord database model |
| `taskflow-backend/main.py` | API endpoints (/api/auth/send-otp, /api/auth/verify-otp) |
| `taskflow/src/pages/SignupWithOTP.js` | Frontend signup form |
| `taskflow/src/services/api.js` | Frontend API client (authAPI.sendOTP()) |

---

## Common Issues

### Issue: Nothing shows in backend console after "Send OTP"
**Solution:** Make sure SMTP_ENABLED is set to `false` in `.env`, then restart backend

### Issue: Error "Backend API is not running"
**Solution:** Start backend: `cd taskflow-backend && python main.py`

### Issue: "Email already registered"
**Solution:** Use a different email address (emails are unique in database)

### Issue: OTP keeps saying "Invalid OTP"
**Solution:** Copy the OTP exactly from console (no spaces), must be 6 digits

### Issue: OTP expired (shows in browser timer)
**Solution:** Click "Resend OTP" and use the new code from console/email

---

## Next Customizations

Once working, you can:
- ✅ Customize email template in `email_service.py`
- ✅ Change OTP expiry time in `.env` (OTP_EXPIRY_MINUTES)
- ✅ Change OTP length in `email_service.py` (default 6 digits)
- ✅ Add SMS OTP option (instead of email)
- ✅ Add OTP resend limit (prevent spam)
- ✅ Add OTP attempt limit (security)

