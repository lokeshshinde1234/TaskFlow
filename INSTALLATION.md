# TaskFlow Employee Management

## Start Everything

On Windows, run this from `D:\Company Project`:

```powershell
.\start-app.bat
```

This starts FastAPI on `http://127.0.0.1:8000` and React on `http://localhost:3000`. Keep both terminal windows open while using Send OTP.

## Backend

```bash
cd taskflow-backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload
```

Set `DATABASE_URL` in `.env` to PostgreSQL for production:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/taskflow_db
```

For local demos, the backend defaults to SQLite if no `.env` is present. To send real Gmail OTP emails, create `.env` from `.env.example`, turn on 2-Step Verification in the sending Gmail account, generate a Google App Password, and use that 16-character app password as `SMTP_PASSWORD`.

```env
SMTP_ENABLED=true
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USE_SSL=false
SMTP_USERNAME=your-sender@gmail.com
SMTP_PASSWORD=your-16-character-google-app-password
SENDER_EMAIL=your-sender@gmail.com
```

### OTP email (recommended: EmailJS + Gmail in browser)

Free tier (~200 emails/month). Connect Gmail at https://dashboard.emailjs.com (no App Password):

```powershell
cd taskflow-backend
.\setup-emailjs.ps1
```

See `taskflow-backend/EMAILJS_SETUP.md` for the email template.

With email not configured, the OTP is printed in the backend console instead.

Swagger API docs: `http://localhost:8000/docs`

## Frontend

```bash
cd taskflow
npm install
copy .env.example .env
npm start
```

React app: `http://localhost:3000`

## Included Features

- Company onboarding with Founder Admin creation
- Platform Super Admin dashboard (`/super-admin-dashboard`) — lists and edits every registered company

### Platform Super Admin login

Set in `taskflow-backend/.env` (defaults are created on backend startup):

```
PLATFORM_SUPER_ADMIN_EMAIL=superadmin@gmail.com
PLATFORM_SUPER_ADMIN_PASSWORD=superadmin@12
```

Log in at `/login` with that email and password to open the Super Admin page with all companies in a table.
- JWT login/logout and role-protected routes
- SMTP OTP employee signup with five-minute expiry
- Employee attendance time in/out with duplicate time-in prevention
- Leaflet live location tracking and admin location monitor
- Employee CRUD, search, filters, pagination-ready API
- Salary records with bonus, deduction, and net salary
- Admin analytics, dashboard charts, CSV attendance export
- Tailwind responsive UI with light/dark mode
