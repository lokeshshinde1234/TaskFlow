# OTP System - Technical Flow & Code Reference

## 1. OTP Signup Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    EMPLOYEE SIGNUP WITH OTP                      │
└─────────────────────────────────────────────────────────────────┘

STEP 1: Visit Signup Page
┌────────────────────────────────────────┐
│  http://localhost:3000/signup-otp      │
│                                        │
│  Form Fields:                          │
│  - First name                          │
│  - Last name                           │
│  - Email                               │
│  [SEND OTP]                           │
└────────────────────────────────────────┘
         ↓
         ↓
STEP 2: Send OTP (5 seconds)
┌────────────────────────────────────────┐
│  Frontend: authAPI.sendOTP(email)      │
│           ↓                            │
│  POST /api/auth/send-otp               │
│           ↓                            │
│  Backend: generate_otp() → "123456"    │
│           ↓                            │
│  Save to DB: OTPRecord {               │
│    email: "john@example.com"           │
│    otp_code: "123456"                  │
│    expires_at: NOW + 5 minutes         │
│  }                                     │
│           ↓                            │
│  send_otp_email("john@example.com",    │
│                 "123456")              │
│           ↓                            │
│  Output: Console print OR Email        │
│  "DEV OTP for john@example.com: 123456"│
└────────────────────────────────────────┘
         ↓
         ↓
STEP 3: Receive OTP (in console or email)
┌────────────────────────────────────────┐
│  Testing Mode (Default):               │
│  Check backend terminal window         │
│  Copy: 123456                          │
│                                        │
│  Production Mode (with email):         │
│  Check email inbox                     │
│  Subject: TaskFlow verification code   │
│  Message: Your OTP is 123456           │
└────────────────────────────────────────┘
         ↓
         ↓
STEP 4: Enter OTP & Password
┌────────────────────────────────────────┐
│  Form Fields:                          │
│  - OTP: [123456]                       │
│  - Password: [securepassword123]       │
│  - Confirm Password: [match]           │
│  [VERIFY OTP]                          │
│                                        │
│  Timer: 4:30 → 0:00                    │
│  (5 minute countdown)                  │
└────────────────────────────────────────┘
         ↓
         ↓
STEP 5: Verify OTP (2 seconds)
┌────────────────────────────────────────┐
│  Frontend: authAPI.verifyOTP(email,    │
│                              "123456") │
│           ↓                            │
│  POST /api/auth/verify-otp             │
│           ↓                            │
│  Backend: Check OTPRecord {            │
│    email matches? ✓                    │
│    otp_code matches? ✓                 │
│    not expired? ✓                      │
│  }                                     │
│           ↓                            │
│  Mark: is_verified = true              │
│           ↓                            │
│  Frontend: authAPI.register({          │
│    email, first_name, last_name,       │
│    password, company_id                │
│  })                                    │
└────────────────────────────────────────┘
         ↓
         ↓
STEP 6: Create Account (2 seconds)
┌────────────────────────────────────────┐
│  Backend: register_employee() {        │
│    Check: OTP verified? ✓              │
│           OTP not expired? ✓           │
│                                        │
│    Create Employee record              │
│    Create User record                  │
│    Hash password with bcrypt           │
│  }                                     │
│           ↓                            │
│  Response: JWT token + user role       │
└────────────────────────────────────────┘
         ↓
         ↓
STEP 7: Redirect to Login
┌────────────────────────────────────────┐
│  Frontend navigates to /login          │
│                                        │
│  ✅ Account Created Successfully       │
│  Ready to login with credentials       │
└────────────────────────────────────────┘
```

---

## 2. Code Examples

### Frontend: Send OTP

**File:** `frontend/src/pages/SignupWithOTP.js`

```javascript
const sendOTP = async () => {
  setError('');
  setSuccess('');
  setLoadingAction('send');
  try {
    // Call backend API
    await authAPI.sendOTP(form.email);
    
    // Update UI
    setOtpSent(true);
    setTimer(300); // 5 minute countdown
    setSuccess(`OTP sent successfully to ${form.email}.`);
  } catch (err) {
    setError(err.response?.data?.detail || 'Unable to send OTP.');
  } finally {
    setLoadingAction('');
  }
};
```

### Frontend: Verify OTP

```javascript
const verifyOTPAndCreateAccount = async () => {
  setError('');
  setSuccess('');

  if (form.password.length < 8) {
    setError('Password must be at least 8 characters.');
    return;
  }

  if (form.password !== form.confirm_password) {
    setError('Passwords do not match.');
    return;
  }

  setLoadingAction('verify');
  try {
    // Step 1: Verify OTP
    await authAPI.verifyOTP(form.email, form.otp);
    
    // Step 2: Create account
    await authAPI.register(form);
    
    // Step 3: Redirect to login
    navigate('/login', {
      state: {
        message: 'OTP verified successfully. Please login.',
        email: form.email,
      },
    });
  } catch (err) {
    setError(err.response?.data?.detail || 'Wrong OTP. Please try again.');
  } finally {
    setLoadingAction('');
  }
};
```

### Backend: Generate OTP

**File:** `backend/app/services/email_service.py`

```python
import secrets
import string

def generate_otp(length: int = 6) -> str:
    """Generate a random OTP of specified length (default 6 digits)"""
    return "".join(secrets.choice(string.digits) for _ in range(length))

# Example output:
# "123456" or "789012" or "654321"
```

### Backend: Send OTP Email

**File:** `backend/app/services/email_service.py`

```python
def send_otp_email(recipient_email: str, otp: str) -> tuple[bool, str]:
    """Send OTP email with HTML template"""
    
    # Testing mode: print to console
    if not SMTP_ENABLED:
        print(f"DEV OTP for {recipient_email}: {otp}")
        return True, "SMTP disabled. OTP printed in console."
    
    # Production mode: send via SMTP
    subject = "TaskFlow verification code"
    
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background:#f8fafc; padding:24px;">
        <main style="max-width:560px; margin:auto; background:white; border:1px solid #e2e8f0; border-radius:12px; padding:28px;">
          <h2 style="margin:0 0 12px; color:#0f172a;">Verify your email</h2>
          <p style="color:#475569;">Use this one-time password to complete your TaskFlow employee signup.</p>
          <p style="font-size:32px; letter-spacing:8px; font-weight:700; color:#2563eb;">{otp}</p>
          <p style="color:#64748b;">This code expires in 5 minutes.</p>
        </main>
      </body>
    </html>
    """
    
    # Send via SMTP...
    # Returns: (True, "Success message") or (False, "Error message")
```

### Backend: API Endpoints

**File:** `backend/app/main.py`

```python
from datetime import datetime, timedelta

@app.post("/api/auth/send-otp", response_model=OTPResponse)
def send_otp(payload: OTPRequest, db: Session = Depends(get_db)):
    """Generate and send OTP to email"""
    
    # Check if email already registered
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Generate OTP
    otp = generate_otp()  # Returns 6-digit string
    
    # Clear previous OTPs for this email
    db.query(OTPRecord).filter(OTPRecord.email == payload.email).delete()
    
    # Save new OTP to database
    db.add(
        OTPRecord(
            email=payload.email,
            otp_code=otp,
            expires_at=datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES),
        )
    )
    db.commit()
    
    # Send email
    email_sent, email_message = send_otp_email(payload.email, otp)
    if not email_sent:
        db.query(OTPRecord).filter(OTPRecord.email == payload.email).delete()
        db.commit()
        raise HTTPException(status_code=500, detail=email_message)
    
    return {
        "message": "OTP sent successfully",
        "email": payload.email,
        "expires_in_seconds": OTP_EXPIRY_MINUTES * 60,
    }


@app.post("/api/auth/verify-otp")
def verify_otp(payload: OTPVerify, db: Session = Depends(get_db)):
    """Verify OTP before account creation"""
    
    # Find matching OTP record
    otp_record = (
        db.query(OTPRecord)
        .filter(OTPRecord.email == payload.email, OTPRecord.otp_code == payload.otp)
        .order_by(OTPRecord.created_at.desc())
        .first()
    )
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    if datetime.utcnow() > otp_record.expires_at:
        raise HTTPException(status_code=400, detail="OTP expired")
    
    # Mark as verified
    otp_record.is_verified = True
    db.commit()
    
    return {"message": "Email verified successfully"}


@app.post("/api/auth/register", response_model=AuthResponse, status_code=201)
def register_employee(user_data: UserRegister, db: Session = Depends(get_db)):
    """Create employee account after OTP verification"""
    
    # Verify OTP was verified
    otp_record = (
        db.query(OTPRecord)
        .filter(OTPRecord.email == user_data.email, OTPRecord.is_verified == True)
        .order_by(OTPRecord.created_at.desc())
        .first()
    )
    
    if not otp_record or datetime.utcnow() > otp_record.expires_at:
        raise HTTPException(status_code=400, detail="Verify your email with OTP first")
    
    # Create employee record
    employee = Employee(
        company_id=user_data.company_id,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        email=user_data.email,
    )
    db.add(employee)
    db.commit()
    
    # Create user account
    password_hash = hash_password(user_data.password)
    user = User(
        email=user_data.email,
        password_hash=password_hash,
        role="employee",
        employee_id=employee.id,
        is_email_verified=True,
    )
    db.add(user)
    db.commit()
    
    # Return JWT token
    return auth_response(user)
```

### Backend: Database Model

**File:** `backend/app/models/models.py`

```python
from datetime import datetime
from sqlalchemy import Column, DateTime, String, Boolean, Integer, ForeignKey
from sqlalchemy.orm import relationship

class OTPRecord(Base):
    __tablename__ = "otp_records"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), nullable=False, index=True)
    otp_code = Column(String(6), nullable=False)  # 6-digit code
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)  # Expiry time
    
    # Relationships
    user = relationship("User", back_populates="otp_records")
```

### API Client

**File:** `frontend/src/services/api.js`

```javascript
export const authAPI = {
  sendOTP: (email) => api.post('/auth/send-otp', { email }),
  
  verifyOTP: (email, otp) => api.post('/auth/verify-otp', { email, otp }),
  
  register: (data) => api.post('/auth/register', data),
  
  login: (email, password) => api.post('/auth/login', { email, password }),
};
```

---

## 3. Configuration Variables

**File:** `backend/.env`

```env
# OTP Expiry Time
OTP_EXPIRY_MINUTES=5

# SMTP Configuration
SMTP_ENABLED=false                    # false = console mode, true = email mode
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SENDER_EMAIL=your-email@gmail.com
```

---

## 4. Database Schema

```sql
CREATE TABLE otp_records (
    id INTEGER PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    is_verified BOOLEAN DEFAULT false,
    created_at DATETIME DEFAULT now(),
    expires_at DATETIME NOT NULL,
    user_id INTEGER FOREIGN KEY
);

CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'employee',
    is_email_verified BOOLEAN DEFAULT false,
    company_id INTEGER FOREIGN KEY,
    employee_id INTEGER FOREIGN KEY
);

CREATE TABLE employees (
    id INTEGER PRIMARY KEY,
    company_id INTEGER FOREIGN KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    ...
);
```

---

## 5. Error Handling

| Scenario | Error Response |
|----------|---|
| Email already registered | 400: "Email already registered" |
| SMTP failed to send | 500: "SMTP email failed: [error]" |
| OTP not found | 400: "Invalid OTP" |
| OTP expired | 400: "OTP expired" |
| Wrong password | 400: "Invalid password" |
| OTP not verified | 400: "Verify your email with OTP first" |

---

## 6. Security Features

✅ **6-digit random OTP** - 1 in 1,000,000 combinations
✅ **5-minute expiry** - Prevents long-term attack window
✅ **One-time use** - Each OTP can only be used once
✅ **Email verification** - Must verify email before account creation
✅ **Password hashing** - bcrypt with salt
✅ **JWT tokens** - Expiring authentication tokens
✅ **CORS protection** - Only allowed origins can access API

