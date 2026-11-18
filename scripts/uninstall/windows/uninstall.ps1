param(
    [switch]$SpoSyncOnly
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
public static class SpoTUIUninstallerNative {
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
        $handle = [SpoTUIUninstallerNative]::GetStdHandle(-11)
        $mode = 0
        [SpoTUIUninstallerNative]::GetConsoleMode($handle, [ref]$mode) | Out-Null
        [SpoTUIUninstallerNative]::SetConsoleMode($handle, $mode -bor 0x0004) | Out-Null
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
    Write-Host "$OrangeMid                         Uninstaller$Reset"
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

    $jobError = $null
    try {
        Receive-Job -Job $job -ErrorAction Stop | Out-Null
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
        } elseif ($job.ChildJobs[0].Error.Count -gt 0) {
            Write-Host ("      " + $RedAnsi + ($job.ChildJobs[0].Error[0]) + $Reset)
        }
    }
    else {
        Write-Host ($CR + "  " + $GreenAnsi + $CheckMark + $Reset + "  " + $Label + $pad)
    }

    try { [Console]::CursorVisible = $true } catch {}
    return -not $failed
}

Show-Header

$targetDirs = @("$env:APPDATA\spotui", "$env:APPDATA\spotui-cli")

$ok = $true
$runCli = -not $SpoSyncOnly

if ($runCli) {
    foreach ($dir in $targetDirs) {
        $ok = (Invoke-Step ("Removing " + $dir) {
            if (Test-Path $using:dir) {
                Remove-Item -Path $using:dir -Recurse -Force
            }
        }) -and $ok
    }

    $ok = (Invoke-Step "Cleaning user PATH" {
        $dirsToRemove = $using:targetDirs | ForEach-Object { $_.TrimEnd('\') }
        $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
        $entries = $userPath -split ';' |
            ForEach-Object { $_.Trim() } |
            Where-Object { $_ -and ($dirsToRemove -notcontains $_.TrimEnd('\')) }
        $userPath = $entries -join ';'
        [Environment]::SetEnvironmentVariable("Path", $userPath, "User")
    }) -and $ok

    $env:Path = ($env:Path -split ';' |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_ -and ($targetDirs -notcontains $_.TrimEnd('\')) }) -join ';'
}

# ---------------------------------------------------------------------------
# SpoSync: always removed (stop, autostart, files, leftovers)
# ---------------------------------------------------------------------------

$SpoSyncPort     = 8765
$SpoTUIDataDir   = Join-Path $env:LOCALAPPDATA "SpoTUI"
$SpoSyncDir      = Join-Path $SpoTUIDataDir "sposync"
$SpoSyncTarget   = Join-Path $SpoSyncDir "sposync.exe"
$SpoSyncRunKey   = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$SpoSyncApproved = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"
$SpoSyncRunName  = "SpoSync"

function Write-SpoSyncWarn($text) {
    Write-Host ("  " + $RedAnsi + "!" + $Reset + "  " + $text)
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
function Stop-SpoSync {
    if (Test-Path -LiteralPath $SpoSyncTarget) {
        try { & $SpoSyncTarget --quit *> $null } catch {}
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

# 1. stop (main runspace: it starts and stops processes)
$wasRunning = (@(Get-SpoSyncProcess).Count -gt 0)
if ($wasRunning -or (Test-Path -LiteralPath $SpoSyncTarget)) {
    if (Stop-SpoSync) {
        Write-Host ("  " + $GreenAnsi + $CheckMark + $Reset + "  Stopping SpoSync")
    }
    else {
        Write-Host ("  " + $RedAnsi + $CrossMark + $Reset + "  Stopping SpoSync")
        Write-SpoSyncWarn "A SpoSync process is still running from $SpoSyncTarget."
        $ok = $false
    }
}

# 2. autostart entries
$runData = $null
try { $runData = (Get-ItemProperty -Path $SpoSyncRunKey -Name $SpoSyncRunName -ErrorAction Stop).$SpoSyncRunName } catch {}
$ownRunValue = $false
if ($null -ne $runData) {
    if (("" + $runData).ToLower().Contains("\spotui\sposync\sposync.exe")) {
        $ownRunValue = $true
        $ok = (Invoke-Step "Removing SpoSync autostart" {
            Remove-ItemProperty -Path $using:SpoSyncRunKey -Name $using:SpoSyncRunName -ErrorAction Stop
        }) -and $ok
    }
    else {
        Write-SpoSyncWarn ("A Run entry named SpoSync exists but does not point to SpoTUI's SpoSync. Left it alone: " + $runData)
    }
}
if ($ownRunValue -or ($null -eq $runData)) {
    $ok = (Invoke-Step "Clearing SpoSync startup-approval flag" {
        if ($null -ne (Get-ItemProperty -Path $using:SpoSyncApproved -Name $using:SpoSyncRunName -ErrorAction SilentlyContinue)) {
            Remove-ItemProperty -Path $using:SpoSyncApproved -Name $using:SpoSyncRunName -ErrorAction Stop
        }
    }) -and $ok
}

# 3. files
$ok = (Invoke-Step ("Removing " + $SpoSyncDir) {
    if (Test-Path -LiteralPath $using:SpoSyncDir) {
        Remove-Item -LiteralPath $using:SpoSyncDir -Recurse -Force -ErrorAction Stop
    }
    $parent = $using:SpoTUIDataDir
    if ((Test-Path -LiteralPath $parent) -and -not (Get-ChildItem -LiteralPath $parent -Force | Select-Object -First 1)) {
        Remove-Item -LiteralPath $parent -Force -ErrorAction Stop
    }
}) -and $ok

# 4. leftovers from installer runs: only folders named exactly like the ones the
#    installer creates (spotui-sposync-<guid>); anything else with that prefix is not ours.
$ok = (Invoke-Step "Removing SpoSync temporary files" {
    # Deletes a tree without entering a junction or symlink (Windows PowerShell 5.1
    # Remove-Item -Recurse can follow them into other folders): a link is removed itself.
    function Remove-SpoSyncTree([string]$Path) {
        $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            if ($item.PSIsContainer) { [IO.Directory]::Delete($item.FullName) } else { [IO.File]::Delete($item.FullName) }
            return
        }
        if ($item.Attributes -band [IO.FileAttributes]::ReadOnly) {
            [IO.File]::SetAttributes($item.FullName, [IO.FileAttributes]::Normal)
        }
        if ($item.PSIsContainer) {
            foreach ($child in @(Get-ChildItem -LiteralPath $item.FullName -Force)) {
                Remove-SpoSyncTree $child.FullName
            }
            [IO.Directory]::Delete($item.FullName)
        }
        else {
            [IO.File]::Delete($item.FullName)
        }
    }
    Get-ChildItem -LiteralPath $env:TEMP -Directory -Filter "spotui-sposync-*" -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^spotui-sposync-[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' } |
        ForEach-Object { Remove-SpoSyncTree $_.FullName }
}) -and $ok

# 5. is the port free?
$conn = Get-NetTCPConnection -LocalPort $SpoSyncPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($conn) {
    $owner = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
    $ownerName = "another program"
    if ($owner) { $ownerName = $owner.ProcessName }
    Write-SpoSyncWarn ("Port $SpoSyncPort is still in use by $ownerName (PID " + $conn.OwningProcess + "). It is not part of SpoSync's installed files.")
}

Write-Host ""
Write-Host "$OrangeDark  =============================================================$Reset"
Write-Host ""

if ($ok) {
    if ($runCli) {
        Write-Host ("  " + $GreenAnsi + $CheckMark + "  SpoTUI has been uninstalled." + $Reset)
        Write-Host ("  " + $GrayAnsi + "   Restart your terminal for PATH changes to take full effect." + $Reset)
    }
    else {
        Write-Host ("  " + $GreenAnsi + $CheckMark + "  SpoSync has been uninstalled." + $Reset)
    }
}
else {
    Write-Host ("  " + $RedAnsi + $CrossMark + "  Uninstall finished with errors. See above." + $Reset)
}

Write-Host ""