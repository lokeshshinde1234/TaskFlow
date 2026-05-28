# TaskFlow Online Backend Setup

## What Stores Online

The backend stores company registration, company login, employee signup, employee records, attendance, salary, OTP, and location data in the database configured by `DATABASE_URL`.

For local development, it falls back to `taskflow-backend/taskflow.db`.

For production, use an online PostgreSQL database such as Neon or Supabase and set `DATABASE_URL` in FastAPI Cloud.

## FastAPI Cloud Deploy

From `D:\Company Project`:

```powershell
cd "D:\Company Project\taskflow-backend"
fastapi login
fastapi deploy
```

The first deploy will ask you to select or create the FastAPI Cloud app.

## Connect Online Database

In FastAPI Cloud, connect a Neon or Supabase database to the app. FastAPI Cloud can create the `DATABASE_URL` environment variable automatically.

If setting variables manually:

```powershell
fastapi cloud env set DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DBNAME?sslmode=require"
fastapi cloud env set SECRET_KEY="replace-with-a-long-random-secret"
fastapi cloud env set FRONTEND_URL="https://your-frontend-domain.com"
fastapi cloud env set CORS_ORIGINS="https://your-frontend-domain.com,http://localhost:3000"
```

Then deploy again:

```powershell
fastapi deploy
```

## Frontend API URL

After the backend is deployed, set the React API URL to the online backend:

```env
REACT_APP_API_URL=https://your-fastapi-cloud-app-url/api
```

Then rebuild/redeploy the frontend.
