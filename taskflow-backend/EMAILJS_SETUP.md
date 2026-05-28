# EmailJS + Gmail (free, browser setup)

No Gmail App Password needed. You connect Gmail once in the EmailJS website (browser).

## 1. Create free account

Open https://dashboard.emailjs.com and sign up.

## 2. Connect Gmail (browser)

1. **Email Services** → **Add New Service** → **Gmail**
2. Sign in with Google in the browser and allow access
3. Copy the **Service ID** (e.g. `service_abc123`)

## 3. Create OTP email template

1. **Email Templates** → **Create New Template**
2. **To Email**: `{{to_email}}`
3. **Subject**: `{{subject}}`
4. **Content** (paste and save):

```html
<p>Hello {{user_name}},</p>
<p>Your TaskFlow signup verification code is:</p>
<h2 style="letter-spacing:8px;color:#667eea;">{{otp_code}}</h2>
<p>This code expires in {{expiry_minutes}} minutes.</p>
<p><a href="{{signup_url}}">Continue signup</a></p>
<p>If you did not request this, ignore this email.</p>
```

5. Copy the **Template ID** (e.g. `template_xyz789`)

## 4. API keys and security

1. **Account** → **API Keys** → copy **Public Key** and **Private Key**
2. **Account** → **Security** → enable **Allow non-browser API requests** (required for the backend)

## 5. Configure TaskFlow

```powershell
cd taskflow-backend
.\setup-emailjs.ps1
```

Restart the backend. On signup, **Send OTP** emails the 6-digit code to the address in the form.

## Template variables used by the API

| Variable | Description |
|----------|-------------|
| `to_email` | Recipient (signup form email) |
| `user_name` | First + last name |
| `otp_code` | 6-digit code |
| `expiry_minutes` | Usually 5 |
| `signup_url` | Link back to signup page |
| `subject` | Email subject line |

Free plan: about 200 emails/month.
