$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $scriptDir
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$apiUrl = "http://127.0.0.1:8000/health"

function Test-Api {
  try {
    $response = Invoke-WebRequest -Uri $apiUrl -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Get-PythonCommand {
  $localPython = Join-Path $env:LocalAppData "Programs\Python\Python311\python.exe"
  $commands = @("& '$localPython'", "py -3.11", "py -3", "python", "python3")
  foreach ($command in $commands) {
    $exe = ($command -split " ")[0]
    if ($command.StartsWith("& ") -or (Get-Command $exe -ErrorAction SilentlyContinue)) {
      try {
        $version = Invoke-Expression "$command --version 2>&1"
        if ($LASTEXITCODE -eq 0 -and $version -match "Python 3\.(1[1-9]|[2-9][0-9])\.") {
          return $command
        }
      } catch {
        continue
      }
    }
  }
  throw "Python was not found. Install Python 3.11+ and make sure python or py is available in PATH."
}

if (-not (Test-Api)) {
  $python = Get-PythonCommand
  Write-Host "Starting FastAPI backend on http://127.0.0.1:8000 ..."
  Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$backend'; if (Test-Path '.venv\Scripts\Activate.ps1') { . .\.venv\Scripts\Activate.ps1 }; $python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
  ) -WindowStyle Normal

  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Api) { break }
  }
}

if (Test-Api) {
  Write-Host "FastAPI backend is running."
} else {
  Write-Warning "FastAPI did not respond yet. Check the backend terminal for dependency or .env errors."
}

Write-Host "Starting React frontend on http://localhost:3000 ..."
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "cd '$frontend'; npm start"
) -WindowStyle Normal
