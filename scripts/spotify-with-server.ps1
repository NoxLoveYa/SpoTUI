# spotify-with-server.ps1 — launch Spotify with the SpoTUI video companion.
#
# Starts spotui-server.py (if not already up), opens Spotify, waits until
# every Spotify process exits, then stops the server it started. Nothing
# lingers afterward. Launch Spotify through this instead of the stock
# shortcut (a Desktop shortcut is provided) whenever you want video pins.
# Without the server, video pins gracefully fall back to thumbnails.

$serverScript = Join-Path $PSScriptRoot "spotui-server.py"
$pythonw = "C:\Users\Obnoxious\AppData\Local\Programs\Python\Python313\pythonw.exe"
$spotify = "$env:APPDATA\Spotify\Spotify.exe"

function Test-ServerUp {
    try {
        (Invoke-WebRequest -Uri "http://127.0.0.1:18443/health" -TimeoutSec 3 -UseBasicParsing).StatusCode -eq 200
    } catch { $false }
}

$mine = $null
if (-not (Test-ServerUp)) {
    if (-not (Test-Path -LiteralPath $pythonw)) { throw "pythonw.exe not found: $pythonw" }
    if (-not (Test-Path -LiteralPath $serverScript)) { throw "server script not found: $serverScript" }
    $mine = Start-Process -FilePath $pythonw -ArgumentList "`"$serverScript`"" -WindowStyle Hidden -PassThru
    for ($i = 0; $i -lt 20 -and -not (Test-ServerUp); $i++) { Start-Sleep -Milliseconds 500 }
}

if (-not (Test-Path -LiteralPath $spotify)) { throw "Spotify.exe not found: $spotify" }
Start-Process -FilePath $spotify

while (Get-Process -Name "Spotify" -ErrorAction SilentlyContinue) { Start-Sleep -Seconds 5 }

if ($mine -and -not $mine.HasExited) { Stop-Process -Id $mine.Id -Force }
