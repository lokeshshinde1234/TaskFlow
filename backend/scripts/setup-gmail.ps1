$ErrorActionPreference = "Stop"
$envPath = Join-Path $PSScriptRoot ".env"

if (-not (Test-Path $envPath)) {
    Copy-Item (Join-Path $PSScriptRoot ".env.example") $envPath
}

Write-Host ""
Write-Host "TaskFlow Gmail OTP setup"
Write-Host "1. Enable 2-Step Verification on your Google account"
Write-Host "2. Create an App Password: https://myaccount.google.com/apppasswords"
Write-Host ""

$gmail = Read-Host "Gmail address (sender + login)"
$appPassword = Read-Host "16-character Google App Password" -AsSecureString
$plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($appPassword)
)
$plainPassword = $plainPassword -replace '\s', ''

$content = Get-Content $envPath -Raw
$content = $content -replace '(?m)^SMTP_ENABLED=.*$', 'SMTP_ENABLED=true'
$content = $content -replace '(?m)^SMTP_USERNAME=.*$', "SMTP_USERNAME=$gmail"
$content = $content -replace '(?m)^SMTP_PASSWORD=.*$', "SMTP_PASSWORD=$plainPassword"
$content = $content -replace '(?m)^SENDER_EMAIL=.*$', "SENDER_EMAIL=$gmail"
Set-Content -Path $envPath -Value $content.TrimEnd() -NoNewline
Add-Content -Path $envPath -Value ""

Write-Host ""
Write-Host "Saved Gmail SMTP settings to .env"
Write-Host "Restart the backend, then click Send OTP on the signup page."
