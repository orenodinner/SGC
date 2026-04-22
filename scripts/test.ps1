$ErrorActionPreference = "Stop"

if (-not (Test-Path "package.json")) {
  Write-Host "[test] package.json not found"
  exit 1
}

npm run lint
npm run typecheck
npm run test
