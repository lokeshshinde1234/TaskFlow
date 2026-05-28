$ErrorActionPreference = "Stop"
$envPath = Join-Path $PSScriptRoot ".env"

Write-Host ""
Write-Host "TaskFlow EmailJS setup (free Gmail via browser)"
Write-Host "1. Open https://dashboard.emailjs.com and sign up (free)"
Write-Host "2. Email Services -> Add Gmail -> connect your Google account in the browser"
Write-Host "3. Email Templates -> Create template (see EMAILJS_SETUP.md for copy/paste HTML)"
Write-Host "4. Account -> API Keys: copy Public Key and Private Key"
Write-Host "5. Account -> Security: enable 'Allow non-browser API requests'"
Write-Host ""

$serviceId = Read-Host "EmailJS Service ID"
$templateId = Read-Host "EmailJS Template ID"
$publicKey = Read-Host "EmailJS Public Key"
$privateKey = Read-Host "EmailJS Private Key" -AsSecureString
$plainPrivate = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($privateKey)
)

if (-not (Test-Path $envPath)) {
    Copy-Item (Join-Path $PSScriptRoot ".env.example") $envPath
}

$content = Get-Content $envPath -Raw
$replacements = @{
    '(?m)^EMAIL_PROVIDER=.*$' = 'EMAIL_PROVIDER=emailjs'
    '(?m)^SMTP_ENABLED=.*$' = 'SMTP_ENABLED=false'
    '(?m)^EMAILJS_SERVICE_ID=.*$' = "EMAILJS_SERVICE_ID=$serviceId"
    '(?m)^EMAILJS_TEMPLATE_ID=.*$' = "EMAILJS_TEMPLATE_ID=$templateId"
    '(?m)^EMAILJS_PUBLIC_KEY=.*$' = "EMAILJS_PUBLIC_KEY=$publicKey"
    '(?m)^EMAILJS_PRIVATE_KEY=.*$' = "EMAILJS_PRIVATE_KEY=$plainPrivate"
}

foreach ($pattern in $replacements.Keys) {
    if ($content -match $pattern) {
        $content = $content -replace $pattern, $replacements[$pattern]
    } else {
        $content += "`n$($replacements[$pattern])"
    }
}

Set-Content -Path $envPath -Value $content.TrimEnd()
Add-Content -Path $envPath -Value ""

Write-Host ""
Write-Host "Saved EmailJS settings. Restart the backend, then use Send OTP on signup."
