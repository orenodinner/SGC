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
  $artifactContract = Get-Content "spec\\portable-artifact-contract.json" -Raw | ConvertFrom-Json
  $artifactName = "$($artifactContract.artifactPrefix)-v$($packageJson.version)"
  $artifactsDir = Join-Path $repoRoot "artifacts"
  $stageDir = Join-Path $artifactsDir $artifactName
  $zipPath = Join-Path $artifactsDir "$artifactName.zip"
  $runtimeDir = Join-Path $stageDir "runtime"
  $stageNodeModulesDir = Join-Path $stageDir "node_modules"
  $bundledDependencies = @($artifactContract.runtimeDependencies)

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

  $distributionGuide = @"
SGC Windows Portable Distribution

Channel: $($artifactContract.channel)
Update mode: $($artifactContract.updateMode)
Rollback mode: $($artifactContract.rollbackMode)

Install:
1. Extract this zip to a local folder.
2. Run Launch SGC.cmd.

Update:
1. Close SGC.
2. Extract the newer portable zip to a new folder.
3. Run Launch SGC.cmd from the new folder.

Rollback:
1. Close SGC.
2. Run Launch SGC.cmd from the previous unzipped folder.

Not included in this artifact: $($artifactContract.unsupportedDistribution -join ", ").
"@
  Set-Content -LiteralPath (Join-Path $stageDir "DISTRIBUTION.txt") -Value $distributionGuide -Encoding utf8

  $manifest = [ordered]@{
    artifactName = $artifactName
    version = $packageJson.version
    builtAt = (Get-Date).ToString("o")
    distribution = @{
      channel = $artifactContract.channel
      updateMode = $artifactContract.updateMode
      rollbackMode = $artifactContract.rollbackMode
      unsupported = @($artifactContract.unsupportedDistribution)
    }
    runtime = @{
      launcher = "Launch SGC.cmd"
      electronExecutable = "runtime/electron.exe"
    }
    includedPaths = @($artifactContract.requiredPaths)
  } | ConvertTo-Json -Depth 4

  Set-Content -LiteralPath (Join-Path $stageDir "build-manifest.json") -Value $manifest -Encoding utf8

  foreach ($requiredPath in @($artifactContract.requiredPaths)) {
    $resolvedRequiredPath = Join-Path $stageDir $requiredPath
    if (-not (Test-Path $resolvedRequiredPath)) {
      throw "Portable artifact is missing required path: $requiredPath"
    }
  }

  Compress-Archive -LiteralPath $stageDir -DestinationPath $zipPath -Force
  if (-not (Test-Path $zipPath)) {
    throw "Portable artifact zip was not created: $zipPath"
  }

  Write-Host "[build] Portable artifact ready:"
  Write-Host "  staging: $stageDir"
  Write-Host "  zip:     $zipPath"
} finally {
  Pop-Location
}
