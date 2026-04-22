$ErrorActionPreference = "Stop"

if (-not (Test-Path "package.json")) {
  Write-Host "[build] package.json not found"
  exit 1
}

npm run build
