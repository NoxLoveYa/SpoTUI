param(
    [switch]$SpoSync,
    [switch]$NoSpoSync,
    [switch]$SpoSyncOnly,
    [string]$SpoSyncExe
)

$Esc   = [char]27
$Reset = "$Esc[0m"

$BlockFull  = [char]0x2588
$BlockLower = [char]0x2584
$BlockUpper = [char]0x2580
$BlockLeft  = [char]0x258C

function Enable-VTMode {
    $sig = @"
using System;
using System.Runtime.InteropServices;
public static class SpoTUIInstallerNative {
    [DllImport("kernel32.dll")]
    public static extern IntPtr GetStdHandle(int nStdHandle);
    [DllImport("kernel32.dll")]
    public static extern bool GetConsoleMode(IntPtr hConsoleHandle, out uint lpMode);
    [DllImport("kernel32.dll")]
    public static extern bool SetConsoleMode(IntPtr hConsoleHandle, uint dwMode);
}
"@
    try {
        Add-Type -TypeDefinition $sig -ErrorAction SilentlyContinue
        $handle = [SpoTUIInstallerNative]::GetStdHandle(-11)
        $mode = 0
        [SpoTUIInstallerNative]::GetConsoleMode($handle, [ref]$mode) | Out-Null
        [SpoTUIInstallerNative]::SetConsoleMode($handle, $mode -bor 0x0004) | Out-Null
    } catch {}
}
Enable-VTMode

try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

$ProgressPreference = 'SilentlyContinue'

function Get-RGBCode($r, $g, $b) {
    return "$Esc[38;2;$r;$g;${b}m"
}

$OrangeLight = Get-RGBCode 255 140 66
$OrangeDark  = Get-RGBCode 224 123 57
$OrangeMid   = Get-RGBCode 240 131 61
$GreenAnsi   = Get-RGBCode 140 255 140
$RedAnsi     = Get-RGBCode 255 110 110
$GrayAnsi    = Get-RGBCode 130 130 130

function Get-GradientColor($index, $total) {
    $r1 = 255; $g1 = 140; $b1 = 66
    $r2 = 224; $g2 = 123; $b2 = 57
    $t = if ($total -le 1) { 0 } else { $index / ($total - 1) }
    $r = [int]($r1 + ($r2 - $r1) * $t)
    $g = [int]($g1 + ($g2 - $g1) * $t)
    $b = [int]($b1 + ($b2 - $b1) * $t)
    return Get-RGBCode $r $g $b
}

function Get-AsciiArtLine($template) {
    $out = $template
    $out = $out.Replace("A", $BlockFull)
    $out = $out.Replace("B", $BlockLower)
    $out = $out.Replace("C", $BlockUpper)
    $out = $out.Replace("D", $BlockLeft)
    return $out
}

function Show-Header {
    Clear-Host
    $templates = @(
        "   BAAAAAAAA    BAAAAAAAB  BAAAAAAAB      AAA    AAA    AB   BA  ",
        "  AAA    AAA   AAA    AAA AAA    AAA CAAAAAAAAAB AAA    AAA AAA  ",
        "  AAA    AC    AAA    AAA AAA    AAA    CAAACCAA AAA    AAA AAAD ",
        "  AAA          AAA    AAA AAA    AAA     AAA   C AAA    AAA AAAD ",
        "CAAAAAAAAAAA CAAAAAAAAAC  AAA    AAA     AAA     AAA    AAA AAAD ",
        "         AAA   AAA        AAA    AAA     AAA     AAA    AAA AAA  ",
        "   BA    AAA   AAA        AAA    AAA     AAA     AAA    AAA AAA  ",
        " BAAAAAAAAC   BAAAAC       CAAAAAAC     BAAAAC   AAAAAAAAC  AC   "
    )
    Write-Host ""
    for ($i = 0; $i -lt $templates.Count; $i++) {
        $color = Get-GradientColor $i $templates.Count
        $line = Get-AsciiArtLine $templates[$i]
        Write-Host "$color$line$Reset"
    }
    Write-Host ""
    Write-Host "$OrangeMid                          Installer$Reset"
    Write-Host "$OrangeDark  =============================================================$Reset"
    Write-Host ""
}

$SpinnerCodes = @(0x280B,0x2819,0x2839,0x2838,0x283C,0x2834,0x2826,0x2827,0x2807,0x280F)
$SpinnerFrames = $SpinnerCodes | ForEach-Object { [char]$_ }
$CheckMark = [char]0x2713
$CrossMark = [char]0x2715
$CR = [char]13

function Invoke-Step {
    param(
        [string]$Label,
        [scriptblock]$Work
    )

    try { [Console]::CursorVisible = $false } catch {}

    $job = Start-Job -ScriptBlock $Work
    $frameIndex = 0

    while ($job.State -eq "Running") {
        $frame = $SpinnerFrames[$frameIndex % $SpinnerFrames.Count]
        $color = Get-GradientColor ($frameIndex % 8) 8
        Write-Host ($CR + "  " + $color + $frame + $Reset + "  " + $Label) -NoNewline
        Start-Sleep -Milliseconds 80
        $frameIndex++
    }

    $jobError  = $null
    $jobOutput = $null
    try {
        $jobOutput = Receive-Job -Job $job -ErrorAction Stop
    } catch {
        $jobError = $_
    }
    $failed = $job.State -eq "Failed" -or ($job.ChildJobs[0].Error.Count -gt 0) -or ($null -ne $jobError)
    Remove-Job -Job $job -Force | Out-Null

    $pad = " " * 40
    if ($failed) {
        Write-Host ($CR + "  " + $RedAnsi + $CrossMark + $Reset + "  " + $Label + $pad)
        if ($jobError) {
            Write-Host ("      " + $RedAnsi + $jobError.Exception.Message + $Reset)
        }
    }
    else {
        Write-Host ($CR + "  " + $GreenAnsi + $CheckMark + $Reset + "  " + $Label + $pad)
    }

    try { [Console]::CursorVisible = $true } catch {}
    return [PSCustomObject]@{ Success = (-not $failed); Output = $jobOutput }
}

Show-Header

$RepoOwner  = "SkenSMasteR"
$RepoName   = "SpoTUI"
$ApiLatest  = "https://api.github.com/repos/$RepoOwner/$RepoName/releases/latest"

$targetDir = "$env:APPDATA\spotui"
$exePath   = "$targetDir\spotui.exe"
$batchPath = "$targetDir\spotui.bat"
function Get-TargetAssetName {
    $arch = [System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture
    switch ($arch) {
        "Arm64" { return "spotui-winarm64.exe" }
        "X64"   { return "spotui-win64.exe" }
        "X86"   { return "spotui-win32.exe" }
        default { return "spotui-win64.exe" }
    }
}

$ok = $true
$runCli        = -not $SpoSyncOnly

# -NoSpoSync contradicts the flags that ask for SpoSync: say so and do nothing.
$argConflict = $NoSpoSync -and ($SpoSync -or $SpoSyncOnly)
if ($argConflict) {
    Write-Host ("  " + $RedAnsi + $CrossMark + $Reset + "  -NoSpoSync contradicts -SpoSync / -SpoSyncOnly. Nothing was installed. Use one or the other.")
    $runCli = $false
}

$releaseInfo   = $null
$selectedAsset = $null
$latestTag     = $null

if ($runCli) {
    $stepResult = Invoke-Step "Looking up latest release" {
        $ProgressPreference = 'SilentlyContinue'
        $headers = @{ "User-Agent" = "SpoTUI-Installer" }
        return Invoke-RestMethod -Uri $using:ApiLatest -Headers $headers
    }
    $ok = $stepResult.Success -and $ok
}

if ($runCli -and $ok) {
    $releaseInfo = $stepResult.Output
    $latestTag   = $releaseInfo.tag_name
    $assetName   = Get-TargetAssetName
    $selectedAsset = $releaseInfo.assets | Where-Object { $_.name -eq $assetName } | Select-Object -First 1

    if (-not $selectedAsset) {
        Write-Host ""
        Write-Host "  $RedAnsi$CrossMark$Reset  No '$assetName' asset found in release $latestTag."
        $ok = $false
    }
}

if ($runCli -and $ok) {
    Write-Host ""
    Write-Host "$OrangeMid  Latest version: $latestTag$Reset"
    Write-Host "$GrayAnsi  Asset: $($selectedAsset.name)  ($([Math]::Round($selectedAsset.size / 1MB, 2)) MB)$Reset"
    Write-Host ""
}
function Get-ExpectedHash($asset, $releaseBody) {
    if ($asset.digest -and $asset.digest -match '^sha256:([a-fA-F0-9]{64})$') {
        return $Matches[1].ToLower()
    }

    if (-not $releaseBody) { return $null }
    $pattern = [regex]::Escape($asset.name) + '[\s\S]{0,200}?\b([a-fA-F0-9]{64})\b'
    $m = [regex]::Match($releaseBody, $pattern)
    if ($m.Success) { return $m.Groups[1].Value.ToLower() }
    return $null
}

$downloadPath = $null

if ($runCli -and $ok) {
    $stepResult = Invoke-Step "Creating install directory" {
        if (-not (Test-Path $using:targetDir)) {
            New-Item -ItemType Directory -Path $using:targetDir -Force | Out-Null
        }
    }
    $ok = $stepResult.Success -and $ok
}

if ($runCli -and $ok) {
    $downloadPath = Join-Path $targetDir $selectedAsset.name
    $stepResult = Invoke-Step "Downloading $($selectedAsset.name)" {
        $ProgressPreference = 'SilentlyContinue'
        Invoke-WebRequest -Uri $using:selectedAsset.browser_download_url -OutFile $using:downloadPath -UseBasicParsing
    }
    $ok = $stepResult.Success -and $ok
}

if ($runCli -and $ok) {
    $expectedHash = Get-ExpectedHash $selectedAsset $releaseInfo.body
    if ($expectedHash) {
        $stepResult = Invoke-Step "Verifying SHA256 checksum" {
            $actual = (Get-FileHash -Path $using:downloadPath -Algorithm SHA256).Hash.ToLower()
            if ($actual -ne $using:expectedHash) {
                throw "Checksum mismatch. Expected $using:expectedHash but got $actual. Aborting - file was not installed."
            }
        }
        $ok = $stepResult.Success -and $ok

        if ($stepResult.Success) {
            Write-Host "$GrayAnsi  SHA256: $expectedHash$Reset"
            Write-Host ""
        }
    }
    else {
        Write-Host ""
        Write-Host "  $RedAnsi!$Reset  No published checksum found for this asset in the release notes."
        Write-Host "     ${GrayAnsi}You can verify it manually at:$Reset"
        Write-Host "     ${GrayAnsi}https://github.com/$RepoOwner/$RepoName/releases/tag/$latestTag$Reset"
        $confirm = Read-Host "  Type Y to continue installing anyway, or anything else to cancel"
        if ($confirm -ne "Y" -and $confirm -ne "y") {
            $ok = $false
        }
    }
}

if ($runCli -and $ok) {
    $stepResult = Invoke-Step "Installing spotui.exe" {
        Copy-Item -Path $using:downloadPath -Destination $using:exePath -Force
        Remove-Item -Path $using:downloadPath -Force -ErrorAction SilentlyContinue
    }
    $ok = $stepResult.Success -and $ok
}

if ($runCli -and $ok) {
    $stepResult = Invoke-Step "Updating PATH" {
        $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
        if ($userPath -notlike "*$using:targetDir*") {
            [Environment]::SetEnvironmentVariable("Path", "$userPath;$using:targetDir", "User")
        }
    }
    $ok = $stepResult.Success -and $ok

    $env:Path = "$env:Path;$targetDir"
}

if ($runCli -and $ok) {
    $stepResult = Invoke-Step "Creating launcher" {
        $batchContent = '@echo off' + [Environment]::NewLine + '"' + $using:exePath + '" %*'
        Set-Content -Path $using:batchPath -Value $batchContent
    }
    $ok = $stepResult.Success -and $ok
}

# ---------------------------------------------------------------------------
# SpoSync (optional helper: visualizer audio + terminal lyrics mirror)
# ---------------------------------------------------------------------------

$SpoSyncRepo      = "NoxLoveYa/SpoTUI"
# Pinned release. Fill these three after a release is published, either with
# scripts\release\pin-sposync.ps1 -Tag <tag>, or by hand: the tag (sposync-vX.Y.Z); the
# lowercase hex for sposync-win64.exe from the release's SHA256SUMS; the tagged commit
# (git rev-list -n 1 <tag>) for the source fallback.
# The download is used only when the tag and the hash are both set.
$SpoSyncTag       = "sposync-v1.2.0"   # release tag holding sposync-win64.exe; empty = no prebuilt pinned
$SpoSyncSha256    = "b5674f770abb85634b09616dcc53788f3fe6271790695ab59f88bcb723097270"   # lowercase hex of sposync-win64.exe
$SpoSyncSourceRef = "4ef1274e2acec412caa56259833870a83967f9c3"   # full commit SHA for the source archive; empty = only a local checkout can build
$SpoSyncPort      = 8765
$SpoSyncDir       = Join-Path $env:LOCALAPPDATA "SpoTUI\sposync"
$SpoSyncTarget    = Join-Path $SpoSyncDir "sposync.exe"
$SpoSyncRunKey    = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$SpoSyncApproved  = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"
$SpoSyncRunName   = "SpoSync"
$Conhost          = Join-Path $env:SystemRoot "System32\conhost.exe"
$SpoSyncRunValue  = '"' + $Conhost + '" "' + $SpoSyncTarget + '" --tray'

if (-not $SpoSyncExe) { $SpoSyncExe = $env:SPOTUI_SPOSYNC_EXE }

# Environment first, flags override it. Returns ask | yes | no.
function Get-SpoSyncChoice($yesFlag, $noFlag, $envValue) {
    $choice = "ask"
    if ($envValue -eq "0") { $choice = "no" } elseif ($envValue -eq "1") { $choice = "yes" }
    if ($noFlag) { $choice = "no" }
    if ($yesFlag) { $choice = "yes" }
    return $choice
}

$SpoSyncChoice = Get-SpoSyncChoice ($SpoSync -or $SpoSyncOnly) $NoSpoSync $env:SPOTUI_SPOSYNC

$script:SpoSyncStatus = ""      # "", running, notrunning, failed, skipped
$script:SpoSyncTemp   = $null

function Write-SpoSyncError($text) {
    Write-Host ("  " + $RedAnsi + $CrossMark + $Reset + "  " + $text)
}

function Write-SpoSyncNote($text) {
    Write-Host ("     " + $GrayAnsi + $text + $Reset)
}

function Read-SpoSyncYesNo($prompt) {
    try {
        $answer = Read-Host $prompt
    } catch {
        return $false
    }
    return ($answer -eq "y" -or $answer -eq "yes")
}

function New-SpoSyncTemp {
    if (-not $script:SpoSyncTemp) {
        $script:SpoSyncTemp = Join-Path $env:TEMP ("spotui-sposync-" + [guid]::NewGuid())
        New-Item -ItemType Directory -Path $script:SpoSyncTemp -Force | Out-Null
    }
    return $script:SpoSyncTemp
}

function Get-SpoSyncProcess {
    $found = @()
    foreach ($p in @(Get-Process -Name 'sposync*' -ErrorAction SilentlyContinue)) {
        $path = $null
        try { $path = $p.Path } catch {}
        if ($path -and ($path -eq $SpoSyncTarget)) { $found += $p }
    }
    return $found
}

# Graceful quit first (releases audio + tray icon), then force-stop anything
# still running from the installed path. Never matches by name alone.
# --quit goes over the port, so any executable of this user can ask a running
# helper to exit, wherever that helper was started from: the installed exe when
# there is one, else the staged new exe ($stagedExe). The helper refuses to quit
# another user's instance. The force-stop below stays limited to the installed path.
function Stop-SpoSync($stagedExe) {
    $quitExe = $null
    if (Test-Path -LiteralPath $SpoSyncTarget) { $quitExe = $SpoSyncTarget }
    elseif ($stagedExe -and (Test-Path -LiteralPath $stagedExe)) { $quitExe = $stagedExe }
    if ($quitExe) {
        try { & $quitExe --quit *> $null } catch {}
    }
    # Give the onefile launcher time to remove its temp folder before forcing anything.
    $deadline = (Get-Date).AddSeconds(3)
    while ((Get-Date) -lt $deadline -and @(Get-SpoSyncProcess).Count -gt 0) {
        Start-Sleep -Milliseconds 250
    }
    $deadline = (Get-Date).AddSeconds(3)
    do {
        $left = @(Get-SpoSyncProcess)
        foreach ($p in $left) {
            Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
        }
        if ($left.Count -eq 0) { break }
        Start-Sleep -Milliseconds 250
    } while ((Get-Date) -lt $deadline)
    return (@(Get-SpoSyncProcess).Count -eq 0)
}

# The pinned packages need Python 3.12 or newer and PyInstaller 6.22.3 supports
# Python before 3.16, so only 3.12 to 3.15 qualifies. The reported executable must
# exist (this rejects the Microsoft Store stub). Returns the full path of the real
# python.exe, because "py -3.13" is two words and the build takes one path.
# Python prints in the ANSI code page and PowerShell 5.1 reads native output in the OEM one,
# so a path with accents (C:\Users\José\...) would come back mangled. The probe prints
# ASCII only: the version, and the path as UTF-8 hex that is decoded here.
function Find-SpoSyncPython {
    $code = "import sys;print(str(sys.version_info[0])+'.'+str(sys.version_info[1])+'|'+sys.executable.encode('utf-8').hex())"
    $cands = @(
        @("py", "-3.15"), @("py", "-3.14"), @("py", "-3.13"), @("py", "-3.12"),
        @("py", "-3"), @("python")
    )
    foreach ($cand in $cands) {
        try {
            $exe  = $cand[0]
            $rest = @($cand | Select-Object -Skip 1)
            $out  = & $exe @rest -c $code 2>$null
            if ($LASTEXITCODE -ne 0) { continue }
            $parts = ((@($out) -join " ")).Trim().Split("|", 2)
            if ($parts.Count -ne 2) { continue }
            $h = $parts[1].Trim()
            if ($h -notmatch '^(?:[0-9a-fA-F]{2})+$') { continue }
            $path = [Text.Encoding]::UTF8.GetString([byte[]]($h -split '(..)' -ne '' | ForEach-Object { [Convert]::ToByte($_, 16) }))
            $v = [version]$parts[0]
            if ($v -ge [version]"3.12" -and $v -lt [version]"3.16" -and (Test-Path -LiteralPath $path)) {
                return @{ Path = $path; Version = $parts[0] }
            }
        } catch {}
    }
    return $null
}

# Returns @{ Path; Origin } or $null (status already set when it is a failure).
function Resolve-SpoSyncSource {
    # a. explicit local file
    if ($SpoSyncExe) {
        $p = $SpoSyncExe
        if (-not [System.IO.Path]::IsPathRooted($p)) {
            $p = Join-Path (Get-Location).ProviderPath $p
        }
        if (Test-Path -LiteralPath $p -PathType Leaf) {
            $full = (Resolve-Path -LiteralPath $p).ProviderPath
            return @{ Path = $full; Origin = "local file" }
        }
        Write-SpoSyncError "SpoSync executable not found: $SpoSyncExe"
        $script:SpoSyncStatus = "failed"
        return $null
    }

    # b. pinned release asset from this fork. The file is downloaded into a private
    #    temporary folder and compared with the pinned hash before it is copied or run.
    if ($SpoSyncTag -and $SpoSyncSha256) {
        # The pins are constants, but they go into a URL: refuse anything but a release tag.
        if ($SpoSyncTag -cnotmatch '^sposync-v[0-9]+\.[0-9]+\.[0-9]+\z') {
            Write-SpoSyncError "The release tag pinned in this installer is malformed. SpoSync was not installed."
            $script:SpoSyncStatus = "failed"
            return $null
        }
        if ($SpoSyncSha256 -cnotmatch '^[0-9a-fA-F]{64}\z') {
            Write-SpoSyncError "The SHA256 pinned in this installer is not a valid checksum. SpoSync was not installed."
            $script:SpoSyncStatus = "failed"
            return $null
        }
        $tmp  = New-SpoSyncTemp
        $file = Join-Path $tmp "sposync-win64.exe"
        $url  = "https://github.com/$SpoSyncRepo/releases/download/$SpoSyncTag/sposync-win64.exe"
        $step = Invoke-Step "Downloading SpoSync $SpoSyncTag" {
            $ProgressPreference = 'SilentlyContinue'
            try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072 } catch {}
            try {
                $r = Invoke-WebRequest -Uri $using:url -OutFile $using:file -UseBasicParsing -TimeoutSec 120 -MaximumRedirection 5 -PassThru
            } catch {
                $code = $null
                try { $code = [int]$_.Exception.Response.StatusCode } catch {}
                if ($code -eq 404) { throw "HTTP 404: release $using:SpoSyncTag or its sposync-win64.exe asset does not exist." }
                throw
            }
            # Redirects are followed (assets are served from another host), but only over HTTPS.
            $base  = $r.BaseResponse
            $final = if ($base.ResponseUri) { $base.ResponseUri } else { $base.RequestMessage.RequestUri }
            if ($final.Scheme -ne "https") { throw "The download was served over $($final.Scheme), not HTTPS." }
        }
        if (-not $step.Success) {
            Write-SpoSyncNote "URL: $url"
            $script:SpoSyncStatus = "failed"
            return $null
        }
        $actual = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLower()
        if ($actual -ne $SpoSyncSha256.ToLower()) {
            Write-SpoSyncError "Checksum mismatch. Expected $($SpoSyncSha256.ToLower()) but got $actual. SpoSync was not installed."
            Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
            $script:SpoSyncTemp = $null
            $script:SpoSyncStatus = "failed"
            return $null
        }
        return @{ Path = $file; Origin = "release $SpoSyncTag" }
    }

    # c. build from source
    $py = Find-SpoSyncPython
    $root = $null
    $inCheckout = $false
    if ($py) {
        if ($PSScriptRoot) {
            $candidate = Join-Path $PSScriptRoot "..\..\..\sposync\build-win.cmd"
            if (Test-Path -LiteralPath $candidate) {
                $root = Split-Path -Parent (Split-Path -Parent ([System.IO.Path]::GetFullPath($candidate)))
                $inCheckout = $true
            }
        }
        if (-not $root -and $SpoSyncSourceRef) {
            # The ref goes into a URL: refuse anything but a full commit SHA.
            if ($SpoSyncSourceRef -cnotmatch '^[0-9a-f]{40}\z') {
                Write-SpoSyncError "The source ref pinned in this installer is malformed. SpoSync was not installed."
                $script:SpoSyncStatus = "failed"
                return $null
            }
            $tmp = New-SpoSyncTemp
            $zip = Join-Path $tmp "source.zip"
            # Short extraction path: the build tree gets deep and old Windows APIs stop at 260 characters.
            $dst = Join-Path $tmp "s"
            $url = "https://github.com/$SpoSyncRepo/archive/$SpoSyncSourceRef.zip"
            $step = Invoke-Step "Downloading SpoSync source" {
                $ProgressPreference = 'SilentlyContinue'
                try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072 } catch {}
                Invoke-WebRequest -Uri $using:url -OutFile $using:zip -UseBasicParsing
                Expand-Archive -LiteralPath $using:zip -DestinationPath $using:dst -Force
            }
            if (-not $step.Success) {
                Write-SpoSyncNote "URL: $url"
                $script:SpoSyncStatus = "failed"
                return $null
            }
            $found = Get-ChildItem -LiteralPath $dst -Directory | Select-Object -First 1
            if ($found -and (Test-Path -LiteralPath (Join-Path $found.FullName "sposync\build-win.cmd"))) {
                # The archive folder is named after the repository and the commit; shorten it too.
                try {
                    Rename-Item -LiteralPath $found.FullName -NewName "r" -ErrorAction Stop
                    $root = Join-Path $dst "r"
                } catch {
                    $root = $found.FullName
                }
            }
        }
    }

    if ($py -and $root) {
        Write-Host ""
        if ($inCheckout) {
            $where = "into a virtual environment in this checkout (sposync\venv, kept for the next build)"
        } else {
            $where = "into a temporary folder that is removed afterwards"
        }
        $yes = Read-SpoSyncYesNo ("  Python " + $py.Version + " found. Build SpoSync from source now? It downloads about 150 MB of packages " + $where + " and takes a few minutes. [y/N]")
        if (-not $yes) {
            Write-SpoSyncNote "SpoSync build skipped."
            return $null
        }
        $buildCmd = Join-Path $root "sposync\build-win.cmd"
        $log      = Join-Path (New-SpoSyncTemp) "build.log"
        $oldPython = $env:PYTHON
        $env:PYTHON = $py.Path
        try {
            $step = Invoke-Step "Building SpoSync (a few minutes)" {
                $env:PYTHON = $using:py.Path
                # cmd writes the log itself: a PowerShell redirect would wrap every stderr line in an error record.
                $cmdLine = '/c ""' + $using:buildCmd + '" > "' + $using:log + '" 2>&1"'
                $proc = Start-Process -FilePath "cmd.exe" -ArgumentList $cmdLine -Wait -PassThru -WindowStyle Hidden
                if ($proc.ExitCode -ne 0) { throw "Build failed (exit code $($proc.ExitCode))." }
            }
        } finally {
            $env:PYTHON = $oldPython
        }
        $built = Join-Path $root "sposync\bin\sposync-win64.exe"
        if ($step.Success -and (Test-Path -LiteralPath $built)) {
            # A log kept by an earlier failed build is stale now.
            Remove-Item -LiteralPath (Join-Path $SpoSyncDir "build.log") -Force -ErrorAction SilentlyContinue
            return @{ Path = $built; Origin = "built from source" }
        }
        # The temporary folder goes away when this installer ends: keep the log of a failed build.
        if (Test-Path -LiteralPath $log) {
            $keptLog = Join-Path $SpoSyncDir "build.log"
            try {
                New-Item -ItemType Directory -Path $SpoSyncDir -Force | Out-Null
                Copy-Item -LiteralPath $log -Destination $keptLog -Force -ErrorAction Stop
                Write-SpoSyncNote "Build log kept at: $keptLog"
            } catch {
                Write-SpoSyncNote "Build log could not be kept: $log"
            }
            Get-Content -LiteralPath $log -Tail 8 | ForEach-Object { Write-SpoSyncNote $_ }
        }
        $script:SpoSyncStatus = "failed"
        return $null
    }

    # d. nothing usable
    Write-Host ""
    if ($py) {
        Write-Host ("  " + $RedAnsi + "!" + $Reset + "  SpoSync skipped: this installer has no prebuilt SpoSync to download and no SpoSync source is available.")
        Write-SpoSyncNote "Run the installer from a SpoTUI checkout (scripts\install\windows\install.ps1 -SpoSyncOnly), or see README > SpoSync."
    }
    else {
        Write-Host ("  " + $RedAnsi + "!" + $Reset + "  SpoSync skipped: this installer has no prebuilt SpoSync to download and Python 3.12 to 3.15 was not found.")
        Write-SpoSyncNote "Install Python from python.org and re-run with -SpoSyncOnly, or see README > SpoSync."
    }
    return $null
}

function Install-SpoSync {
    # 1. consent
    if ($SpoSyncChoice -eq "no") {
        $script:SpoSyncStatus = "skipped"
        return
    }
    if ($SpoSyncChoice -eq "ask") {
        # Do not ask about an optional extra after the main install failed.
        if ($runCli -and -not $ok) { $script:SpoSyncStatus = "skipped"; return }
        Write-Host ""
        Write-Host "$OrangeMid  SpoSync (optional) feeds SpoTUI's visualizer with live audio and mirrors lyrics in a terminal.$Reset"
        Write-Host "$OrangeMid  It starts with Windows, hidden in the tray, and only accepts connections from this computer.$Reset"
        if (-not (Read-SpoSyncYesNo "  Install SpoSync? [y/N]")) {
            Write-SpoSyncNote "SpoSync not installed."
            $script:SpoSyncStatus = "skipped"
            return
        }
    }

    Write-Host ""

    # 2. source
    $source = Resolve-SpoSyncSource
    if (-not $source) {
        if (-not $script:SpoSyncStatus) { $script:SpoSyncStatus = "skipped" }
        return
    }
    $srcPath = $source.Path
    $srcHash = (Get-FileHash -LiteralPath $srcPath -Algorithm SHA256).Hash.ToLower()
    Write-Host ("$GrayAnsi  SpoSync source: " + $source.Origin + "$Reset")
    Write-Host ("$GrayAnsi  SHA256: $srcHash$Reset")
    Write-Host ""

    # 3. copy next to the target, verify the copy and make sure it runs, all while
    #    the old helper keeps working. The name must end in .exe so it can be run.
    $staged = Join-Path $SpoSyncDir "sposync.new.exe"
    $step = Invoke-Step "Copying SpoSync" {
        $dir  = $using:SpoSyncDir
        $new  = $using:staged
        $src  = $using:srcPath
        $want = $using:srcHash
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Copy-Item -LiteralPath $src -Destination $new -Force
        $got = (Get-FileHash -LiteralPath $new -Algorithm SHA256).Hash.ToLower()
        if ($got -ne $want) {
            Remove-Item -LiteralPath $new -Force -ErrorAction SilentlyContinue
            throw "Copy verification failed (hash differs from the source)."
        }
    }
    if (-not $step.Success) {
        $script:SpoSyncStatus = "failed"
        return
    }
    # Read all of the output: cutting the pipe short kills the onefile launcher before it removes its temp folder.
    $stagedOk = $false
    try {
        $null = @(& $staged --version 2>$null)
        $stagedOk = ($LASTEXITCODE -eq 0)
    } catch {}
    if (-not $stagedOk) {
        Remove-Item -LiteralPath $staged -Force -ErrorAction SilentlyContinue
        Write-SpoSyncError "This file does not run on this system: $srcPath"
        $script:SpoSyncStatus = "failed"
        return
    }

    # 4. stop the old helper (main runspace: it starts and stops processes), then swap
    $hadOld = (Test-Path -LiteralPath $SpoSyncTarget)
    $wasRunning = (@(Get-SpoSyncProcess).Count -gt 0)
    if (-not (Stop-SpoSync $staged)) {
        Remove-Item -LiteralPath $staged -Force -ErrorAction SilentlyContinue
        Write-SpoSyncError "Could not stop the running SpoSync. Close it from the tray and re-run."
        $script:SpoSyncStatus = "failed"
        return
    }
    $step = Invoke-Step "Installing SpoSync" {
        Move-Item -LiteralPath $using:staged -Destination $using:SpoSyncTarget -Force -ErrorAction Stop
    }
    if (-not $step.Success) {
        Remove-Item -LiteralPath $staged -Force -ErrorAction SilentlyContinue
        if ($hadOld -and $wasRunning) {
            # Put the old helper back to work; it was stopped for nothing.
            try {
                Start-Process -FilePath $Conhost -ArgumentList ('"' + $SpoSyncTarget + '" --tray') -WindowStyle Hidden -WorkingDirectory $SpoSyncDir
                Write-SpoSyncNote "The previous SpoSync was started again."
            } catch {}
        }
        $script:SpoSyncStatus = "failed"
        return
    }

    # 5. autostart
    $step = Invoke-Step "Registering SpoSync autostart" {
        $key = $using:SpoSyncRunKey
        if (-not (Test-Path -LiteralPath $key)) { New-Item -Path $key | Out-Null }
        New-ItemProperty -Path $key -Name $using:SpoSyncRunName -Value $using:SpoSyncRunValue -PropertyType String -Force | Out-Null
    }
    if (-not $step.Success) {
        $script:SpoSyncStatus = "failed"
        return
    }
    try {
        $flag = (Get-ItemProperty -Path $SpoSyncApproved -Name $SpoSyncRunName -ErrorAction Stop).$SpoSyncRunName
        # Windows marks a startup entry disabled with an odd first byte (3, 7); 2 and 6 mean enabled.
        if ($flag -and (([int]$flag[0] -band 1) -eq 1)) {
            Write-SpoSyncNote "Note: SpoSync autostart is disabled in Task Manager > Startup apps. Enable it there to start SpoSync at sign-in."
        }
    } catch {}

    # 6. start now, exactly like the Run value but hidden. Its working directory is
    #    its own folder, so it never locks the folder the installer was started from.
    $started = $true
    try {
        Start-Process -FilePath $Conhost -ArgumentList ('"' + $SpoSyncTarget + '" --tray') -WindowStyle Hidden -WorkingDirectory $SpoSyncDir
    } catch {
        $started = $false
    }

    # 7. verify
    $owner = $null
    $mine  = $false
    $deadline = (Get-Date).AddSeconds(20)
    $settle   = (Get-Date).AddSeconds(6)
    while ($started -and (Get-Date) -lt $deadline) {
        $conn = Get-NetTCPConnection -LocalPort $SpoSyncPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($conn) {
            $owner = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
            $ownerPath = $null
            try { if ($owner) { $ownerPath = $owner.Path } } catch {}
            if ($ownerPath -and ($ownerPath -eq $SpoSyncTarget)) { $mine = $true; break }
            # Somebody else holds the port; the new helper exits right away, so stop waiting.
            if ((Get-Date) -gt $settle -and -not (Get-SpoSyncProcess)) { break }
        }
        Start-Sleep -Milliseconds 500
    }

    if ($mine) {
        $version = ""
        # Read all of the output: cutting the pipe short kills the onefile launcher before it removes its temp folder.
        try { $version = ((@(& $SpoSyncTarget --version 2>$null)) -join " ").Trim() } catch {}
        Write-Host ("  " + $GreenAnsi + $CheckMark + $Reset + "  SpoSync $version is running in the tray (localhost:$SpoSyncPort).")
        $script:SpoSyncStatus = "running"
    }
    elseif ($owner) {
        if ($owner.ProcessName -eq 'sposync') {
            # Not the installed exe (that is $mine): another user's SpoSync, or a copy from somewhere else.
            Write-Host ("  " + $RedAnsi + "!" + $Reset + "  Port $SpoSyncPort is held by another SpoSync (PID " + $owner.Id + "), another user's or a copy outside this install. SpoSync will start at the next sign-in once it is free.")
        }
        else {
            Write-Host ("  " + $RedAnsi + "!" + $Reset + "  Port $SpoSyncPort is used by " + $owner.ProcessName + " (PID " + $owner.Id + "). SpoSync will start at the next sign-in once it is free.")
        }
        $script:SpoSyncStatus = "notrunning"
    }
    else {
        Write-SpoSyncError "SpoSync did not start. See $SpoSyncDir\sposync.log"
        $script:SpoSyncStatus = "notrunning"
    }
}

try {
    if (-not $argConflict) { Install-SpoSync }
} catch {
    Write-SpoSyncError ("SpoSync step failed: " + $_.Exception.Message)
    $script:SpoSyncStatus = "failed"
} finally {
    if ($script:SpoSyncTemp -and (Test-Path -LiteralPath $script:SpoSyncTemp)) {
        Remove-Item -LiteralPath $script:SpoSyncTemp -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "$OrangeDark  =============================================================$Reset"
Write-Host ""

if ($runCli) {
    if ($ok) {
        Write-Host ("  " + $GreenAnsi + $CheckMark + "  SpoTUI $latestTag installed successfully." + $Reset)
        Write-Host ("  " + $GrayAnsi + "   Open a new terminal and run: spotui" + $Reset)
    }
    else {
        Write-Host ("  " + $RedAnsi + $CrossMark + "  Installation finished with errors. See above." + $Reset)
    }
}

if ($SpoSyncChoice -ne "no") {
    switch ($script:SpoSyncStatus) {
        "running"    { Write-Host ("  " + $GreenAnsi + $CheckMark + "  SpoSync: installed and running" + $Reset) }
        "notrunning" { Write-Host ("  " + $RedAnsi + "!" + "  SpoSync: installed, not running (see above)" + $Reset) }
        "failed"     { Write-Host ("  " + $RedAnsi + $CrossMark + "  SpoSync: failed (see above)" + $Reset) }
        "skipped"    { Write-Host ("  " + $GrayAnsi + "   SpoSync: skipped" + $Reset) }
    }
}

Write-Host ""