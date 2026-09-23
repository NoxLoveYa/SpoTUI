# spotui-cache.ps1 — local helper for SpoTUI animated Pinterest posters.
#
# Spotify's client cannot download or convert video itself (no filesystem,
# no ffmpeg, Pinterest blocks cross-origin reads), so this script does the
# heavy lifting OUTSIDE Spotify:
#
#   Sync : fetch a board's video pins, convert missing ones to .webm with
#          ffmpeg, and stage them where Spotify serves them same-origin.
#          Prints the exact `tui -posters add` lines (with board tags).
#   Prune: delete cached spotui-*.webm files whose pins are no longer on
#          the given board(s) — the file side of `tui -pin-clear`.
#
# Usage:
#   .\spotui-cache.ps1 -BoardUrl https://fr.pinterest.com/noxloveya/posters/
#   .\spotui-cache.ps1 -BoardUrl <url1>,<url2> -Prune
#
# Requires: PowerShell 5.1+, ffmpeg (via -Ffmpeg or on PATH).

param(
    [Parameter(Mandatory = $true)]
    [string[]]$BoardUrl,
    [switch]$Prune,
    [string]$Ffmpeg = "",
    [string]$LiveDir = "$env:APPDATA\Spotify\Apps\xpui\videos",
    [string]$MirrorDir = "$env:APPDATA\spicetify\Extracted\Themed\xpui\videos"
)

$ErrorActionPreference = "Stop"

function Resolve-Ffmpeg {
    param([string]$Hint)
    if ($Hint -and (Test-Path -LiteralPath $Hint)) { return $Hint }
    $cmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $bundled = Get-ChildItem "$env:LOCALAPPDATA\Programs\Python\Python3*\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($bundled) { return $bundled.FullName }
    throw "ffmpeg not found. Install it or pass -Ffmpeg <path>."
}

function Parse-BoardRef {
    param([string]$Url)
    $m = [regex]::Match($Url, "pinterest\.[a-z.]+/([^/?#]+)/([^/?#]+)", "IgnoreCase")
    if (-not $m.Success) { throw "Not a Pinterest board URL: $Url" }
    return @{ User = $m.Groups[1].Value; Slug = $m.Groups[2].Value }
}

function Get-BoardPins {
    param([string]$User, [string]$Slug)
    $u = "https://widgets.pinterest.com/v3/pidgets/boards/$([uri]::EscapeDataString($User))/$([uri]::EscapeDataString($Slug))/pins/"
    return (Invoke-RestMethod -Uri $u -TimeoutSec 30).data.pins
}

function Get-PinsInfo {
    param([string[]]$Ids)
    $csv = ($Ids | ForEach-Object { [uri]::EscapeDataString($_) }) -join ","
    $u = "https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=$csv"
    $d = (Invoke-RestMethod -Uri $u -TimeoutSec 30).data
    if ($d -is [array]) { return $d }
    return $d.pins
}

function Get-PinVideoUrl {
    param($Pin)
    $pages = @()
    if ($Pin.story_pin_data -and $Pin.story_pin_data.pages) { $pages = $Pin.story_pin_data.pages }
    foreach ($pg in $pages) {
        $list = $null
        if ($pg.video -and $pg.video.video_list) { $list = $pg.video.video_list }
        if (-not $list) { continue }
        $mp4 = $list.PSObject.Properties | Where-Object { $_.Value.url -match "\.mp4($|[?#])" } | Select-Object -First 1
        if ($mp4) { return $mp4.Value.url }
        $hls = $list.PSObject.Properties | Where-Object { $_.Value.url -match "\.m3u8($|[?#])" } | Select-Object -First 1
        if ($hls) { return $hls.Value.url }
    }
    return $null
}

$ffmpegBin = Resolve-Ffmpeg $Ffmpeg
foreach ($d in @($LiveDir, $MirrorDir)) {
    if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}

if ($Prune) {
    $keep = @{}
    foreach ($b in $BoardUrl) {
        $ref = Parse-BoardRef $b
        Write-Output ("keep scope: {0}/{1}" -f $ref.User, $ref.Slug)
        foreach ($p in (Get-BoardPins $ref.User $ref.Slug)) { $keep[[string]$p.id] = $true }
    }
    $removed = 0
    foreach ($d in @($LiveDir, $MirrorDir)) {
        foreach ($f in (Get-ChildItem -LiteralPath $d -Filter "spotui-*.webm" -ErrorAction SilentlyContinue)) {
            $m = [regex]::Match($f.BaseName, "^spotui-(\d+)$")
            if ($m.Success -and -not $keep.ContainsKey($m.Groups[1].Value)) {
                Remove-Item -LiteralPath $f.FullName -Force
                Write-Output ("pruned: {0}" -f $f.FullName)
                $removed++
            }
        }
    }
    Write-Output ("done: pruned {0} file(s), kept {1} pin(s)." -f $removed, $keep.Count)
    return
}

foreach ($b in $BoardUrl) {
    $ref = Parse-BoardRef $b
    $label = "{0}/{1}" -f $ref.User, $ref.Slug
    $pins = @(Get-BoardPins $ref.User $ref.Slug)
    Write-Output ("board {0}: {1} pin(s)" -f $label, $pins.Count)
    $cands = @($pins | Where-Object { $_.is_video -or ($_.story_pin_data -and $_.story_pin_data.id) })
    if (-not $cands.Count) { Write-Output "no video pins."; continue }
    $ids = @($cands | ForEach-Object { [string]$_.id } | Select-Object -Unique | Select-Object -First 50)
    $infos = @(Get-PinsInfo $ids)
    $done = 0; $skipped = 0
    foreach ($pin in $infos) {
        $vid = Get-PinVideoUrl $pin
        if (-not $vid) { continue }
        $name = "spotui-{0}.webm" -f $pin.id
        $live = Join-Path $LiveDir $name
        if (Test-Path -LiteralPath $live) { $skipped++; continue }
        Write-Output ("converting pin {0} ..." -f $pin.id)
        & $ffmpegBin -y -hide_banner -loglevel error -i $vid -c:v libvpx-vp9 -b:v 0 -crf 30 -row-mt 1 -an $live
        if ($?) {
            Copy-Item -LiteralPath $live -Destination (Join-Path $MirrorDir $name) -Force
            $done++
        }
    }
    Write-Output ("board {0}: converted {1}, already cached {2}." -f $label, $done, $skipped)
    Write-Output "paste in SpoTUI (board-tagged so -pin-clear removes them):"
    foreach ($pin in $infos) {
        if (-not (Get-PinVideoUrl $pin)) { continue }
        Write-Output ("tui -posters add https://xpui.app.spotify.com/videos/spotui-{0}.webm {1}" -f $pin.id, $label)
    }
}
