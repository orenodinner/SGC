$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot

try {
  $iexpress = Get-Command "iexpress.exe" -ErrorAction SilentlyContinue
  if (-not $iexpress) {
    throw "iexpress.exe was not found. This installer builder requires Windows IExpress."
  }

  powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "build.ps1")
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
  $portableContract = Get-Content "spec\portable-artifact-contract.json" -Raw | ConvertFrom-Json
  $installerContract = Get-Content "spec\installer-artifact-contract.json" -Raw | ConvertFrom-Json
  $artifactsDir = Join-Path $repoRoot "artifacts"
  $portableName = "$($portableContract.artifactPrefix)-v$($packageJson.version)"
  $portableStageDir = Join-Path $artifactsDir $portableName
  $installerName = "$($installerContract.artifactPrefix)-v$($packageJson.version)"
  $installerStageDir = Join-Path $artifactsDir "$installerName-staging"
  $installerPath = Join-Path $artifactsDir "$installerName.exe"
  $payloadPath = Join-Path $installerStageDir "payload.zip"
  $installScriptPath = Join-Path $installerStageDir "install.ps1"
  $setupScriptPath = Join-Path $installerStageDir "setup.cmd"
  $sedPath = Join-Path $installerStageDir "installer.sed"

  if (-not (Test-Path $portableStageDir)) {
    throw "Portable staging folder was not created: $portableStageDir"
  }

  if (Test-Path $installerStageDir) {
    Remove-Item -LiteralPath $installerStageDir -Recurse -Force
  }
  if (Test-Path $installerPath) {
    Remove-Item -LiteralPath $installerPath -Force
  }

  New-Item -ItemType Directory -Path $installerStageDir -Force | Out-Null
  Compress-Archive -Path (Join-Path $portableStageDir "*") -DestinationPath $payloadPath -Force

  $installScript = @'
$ErrorActionPreference = "Stop"

$packageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$payloadPath = Join-Path $packageRoot "payload.zip"
$installDir = Join-Path $env:LOCALAPPDATA "Programs\SGC"
$desktopShortcutPath = Join-Path ([Environment]::GetFolderPath("DesktopDirectory")) "SGC.lnk"
$startMenuDir = Join-Path ([Environment]::GetFolderPath("Programs")) "SGC"
$startMenuShortcutPath = Join-Path $startMenuDir "SGC.lnk"

if (-not (Test-Path $payloadPath)) {
  throw "Installer payload was not found: $payloadPath"
}

if (Test-Path $installDir) {
  Remove-Item -LiteralPath $installDir -Recurse -Force
}

New-Item -ItemType Directory -Path $installDir -Force | Out-Null
Expand-Archive -LiteralPath $payloadPath -DestinationPath $installDir -Force

$launcherPath = Join-Path $installDir "Launch SGC.cmd"
if (-not (Test-Path $launcherPath)) {
  throw "Installed launcher was not found: $launcherPath"
}

New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null
$shell = New-Object -ComObject WScript.Shell

foreach ($shortcutPath in @($desktopShortcutPath, $startMenuShortcutPath)) {
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $launcherPath
  $shortcut.WorkingDirectory = $installDir
  $shortcut.IconLocation = (Join-Path $installDir "runtime\electron.exe")
  $shortcut.Description = "SGC - Simple Gantt Chart"
  $shortcut.Save()
}

Write-Host "SGC installed to $installDir"
Write-Host "Shortcuts created on Desktop and Start Menu."
'@
  Set-Content -LiteralPath $installScriptPath -Value $installScript -Encoding utf8

  $setupScript = @'
@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
exit /b %ERRORLEVEL%
'@
  Set-Content -LiteralPath $setupScriptPath -Value $setupScript -Encoding ascii

  $targetName = $installerPath
  $sourceDir = $installerStageDir
  $sed = @"
[Version]
Class=IEXPRESS
SEDVersion=3

[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=1
HideExtractAnimation=0
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=
DisplayLicense=
FinishMessage=SGC installer finished.
TargetName=$targetName
FriendlyName=SGC Setup
AppLaunched=setup.cmd
PostInstallCmd=<None>
AdminQuietInstCmd=setup.cmd
UserQuietInstCmd=setup.cmd
SourceFiles=SourceFiles

[Strings]
FILE0="payload.zip"
FILE1="install.ps1"
FILE2="setup.cmd"

[SourceFiles]
SourceFiles0=$sourceDir

[SourceFiles0]
%FILE0%=
%FILE1%=
%FILE2%=
"@
  Set-Content -LiteralPath $sedPath -Value $sed -Encoding ascii

  foreach ($requiredFile in @($installerContract.requiredInstallerStagingFiles)) {
    $requiredPath = Join-Path $installerStageDir $requiredFile
    if (-not (Test-Path $requiredPath)) {
      throw "Installer staging is missing required file: $requiredFile"
    }
  }

  $iexpressProcess = Start-Process -FilePath $iexpress.Source -ArgumentList @("/N", $sedPath) -Wait -PassThru -WindowStyle Hidden
  if ($iexpressProcess.ExitCode -ne $null -and $iexpressProcess.ExitCode -ne 0) {
    exit $iexpressProcess.ExitCode
  }

  if (-not (Test-Path $installerPath)) {
    throw "Installer artifact was not created: $installerPath"
  }

  $manifest = [ordered]@{
    artifactName = $installerName
    version = $packageJson.version
    builtAt = (Get-Date).ToString("o")
    installer = @{
      channel = $installerContract.channel
      builder = $installerContract.builder
      installScope = $installerContract.installScope
      defaultInstallDirectory = $installerContract.defaultInstallDirectory
      shortcutTargets = @($installerContract.shortcutTargets)
      payloadSource = $installerContract.payloadSource
      unsupported = @($installerContract.unsupportedDistribution)
    }
    portablePayload = @{
      artifactName = $portableName
      stageDir = $portableStageDir
    }
  } | ConvertTo-Json -Depth 4
  Set-Content -LiteralPath (Join-Path $installerStageDir "installer-manifest.json") -Value $manifest -Encoding utf8

  Write-Host "[build-installer] Installer artifact ready:"
  Write-Host "  staging: $installerStageDir"
  Write-Host "  exe:     $installerPath"
} finally {
  Pop-Location
}
