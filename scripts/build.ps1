$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot

try {
  if (-not (Test-Path "package.json")) {
    Write-Host "[build] package.json not found"
    exit 1
  }

  npm run build
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
  $artifactName = "sgc-portable-win-x64-v$($packageJson.version)"
  $artifactsDir = Join-Path $repoRoot "artifacts"
  $stageDir = Join-Path $artifactsDir $artifactName
  $zipPath = Join-Path $artifactsDir "$artifactName.zip"
  $runtimeDir = Join-Path $stageDir "runtime"
  $stageNodeModulesDir = Join-Path $stageDir "node_modules"
  $bundledDependencies = @(
    "date-fns",
    "sql.js",
    "zod"
  )

  if (Test-Path $stageDir) {
    Remove-Item -LiteralPath $stageDir -Recurse -Force
  }

  if (Test-Path $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
  }

  New-Item -ItemType Directory -Path $artifactsDir -Force | Out-Null
  New-Item -ItemType Directory -Path $stageDir -Force | Out-Null
  New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
  New-Item -ItemType Directory -Path $stageNodeModulesDir -Force | Out-Null

  Copy-Item -LiteralPath "dist" -Destination $stageDir -Recurse -Force
  Copy-Item -LiteralPath "dist-electron" -Destination $stageDir -Recurse -Force
  Get-ChildItem "node_modules\\electron\\dist" | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $runtimeDir -Recurse -Force
  }

  foreach ($dependency in $bundledDependencies) {
    $sourceDependencyDir = Join-Path $repoRoot "node_modules\\$dependency"
    if (-not (Test-Path $sourceDependencyDir)) {
      throw "Missing runtime dependency for portable build: $dependency"
    }

    Copy-Item -LiteralPath $sourceDependencyDir -Destination $stageNodeModulesDir -Recurse -Force
  }

  $portablePackageJson = [ordered]@{
    name = $packageJson.name
    productName = "SGC"
    version = $packageJson.version
    description = $packageJson.description
    main = $packageJson.main
  } | ConvertTo-Json -Depth 4

  Set-Content -LiteralPath (Join-Path $stageDir "package.json") -Value $portablePackageJson -Encoding utf8

  $launchScript = @'
@echo off
setlocal
set SCRIPT_DIR=%~dp0
pushd "%SCRIPT_DIR%"
".\runtime\electron.exe" .
set EXIT_CODE=%ERRORLEVEL%
popd
exit /b %EXIT_CODE%
'@
  Set-Content -LiteralPath (Join-Path $stageDir "Launch SGC.cmd") -Value $launchScript -Encoding ascii

  $manifest = [ordered]@{
    artifactName = $artifactName
    version = $packageJson.version
    builtAt = (Get-Date).ToString("o")
    runtime = @{
      launcher = "Launch SGC.cmd"
      electronExecutable = "runtime/electron.exe"
    }
    includedPaths = @(
      "dist"
      "dist-electron"
      "node_modules/date-fns"
      "node_modules/sql.js"
      "node_modules/zod"
      "runtime"
      "Launch SGC.cmd"
      "package.json"
    )
  } | ConvertTo-Json -Depth 4

  Set-Content -LiteralPath (Join-Path $stageDir "build-manifest.json") -Value $manifest -Encoding utf8

  Compress-Archive -LiteralPath $stageDir -DestinationPath $zipPath -Force

  Write-Host "[build] Portable artifact ready:"
  Write-Host "  staging: $stageDir"
  Write-Host "  zip:     $zipPath"
} finally {
  Pop-Location
}
