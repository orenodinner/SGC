$ErrorActionPreference = "Stop"

Write-Host "[setup] starting worktree setup..."

if (Test-Path "package-lock.json") {
  Write-Host "[setup] npm ci"
  npm ci
} elseif (Test-Path "pnpm-lock.yaml") {
  Write-Host "[setup] pnpm install --frozen-lockfile"
  pnpm install --frozen-lockfile
} elseif (Test-Path "yarn.lock") {
  Write-Host "[setup] yarn install --frozen-lockfile"
  yarn install --frozen-lockfile
} elseif (Test-Path "package.json") {
  Write-Host "[setup] npm install"
  npm install
} else {
  Write-Host "[setup] no package manager files yet; skipping dependency install"
}

if (Test-Path "package.json") {
  $pkg = Get-Content "package.json" -Raw
  if ($pkg -match '"build"\s*:') {
    Write-Host "[setup] npm run build"
    npm run build
  } else {
    Write-Host "[setup] no build script yet; skipping build"
  }
}

Write-Host "[setup] completed"
