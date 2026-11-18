<#
.SYNOPSIS
    Pins a published SpoSync release in the two installers.

.DESCRIPTION
    Rewrites only the pin constants of scripts\install\windows\install.ps1
    ($SpoSyncTag, $SpoSyncSha256, $SpoSyncSourceRef) and
    scripts\install\linux\install.sh (SPOSYNC_TAG, SPOSYNC_SHA256_AMD64,
    SPOSYNC_SHA256_ARM64, SPOSYNC_SOURCE_REF). The hashes come from the release's
    SHA256SUMS, the source ref from the tagged commit. Each constant must match
    exactly once, or nothing is written. Line endings and everything else in both
    files stay as they are. It prints the lines it changed; review them with
    git diff, then commit.

    Before it writes anything it checks, with the GitHub CLI (gh, logged in):
      - the local tag points at the same commit as the tag on GitHub;
      - the SHA256 of each downloaded binary equals its line in SHA256SUMS;
      - SHA256SUMS and each binary have a build provenance attestation made by the
        build-sposync.yml workflow of the repository, for this tag
        (gh attestation verify).
    Any failure refuses the pin and leaves both installers untouched.

    Without gh (or not logged in) it refuses, unless -SkipAttestation is given: then
    it prints warnings and trusts SHA256SUMS as downloaded over HTTPS.

    -SumsFile and -Commit are for tests and offline use. Either one switches all
    remote checks off.

.PARAMETER Tag
    The release tag, for example sposync-v1.2.3.

.PARAMETER Repo
    The repository that holds the release. Default: NoxLoveYa/SpoTUI.

.PARAMETER SumsFile
    Read SHA256SUMS from this file instead of downloading it from the release.
    No remote check is made.

.PARAMETER Commit
    Use this 40-character lowercase commit SHA instead of asking git for the commit the
    tag points to. No remote check is made.

.PARAMETER SkipAttestation
    Do not verify the provenance of SHA256SUMS and the binaries (use it when gh is
    unavailable). Prints a warning.

.PARAMETER WindowsInstaller
    Path of install.ps1. Default: the one in this repository.

.PARAMETER LinuxInstaller
    Path of install.sh. Default: the one in this repository.

.EXAMPLE
    .\scripts\release\pin-sposync.ps1 -Tag sposync-v1.2.3
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Tag,
    [string]$Repo = "NoxLoveYa/SpoTUI",
    [string]$SumsFile,
    [string]$Commit,
    [switch]$SkipAttestation,
    [string]$WindowsInstaller,
    [string]$LinuxInstaller
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

# Latin-1 maps every byte to one char and back, so the files are rewritten byte for byte.
$Latin1 = [System.Text.Encoding]::GetEncoding(28591)

# Case-sensitive tables: a hashtable (@{}) would treat SPOSYNC-WIN64.EXE as sposync-win64.exe.
# The three binaries must be in SHA256SUMS; the requirements files are allowed (and not needed here).
$Assets = New-Object 'System.Collections.Generic.Dictionary[string,string]' ([StringComparer]::Ordinal)
$Assets["sposync-win64.exe"]   = "win64"
$Assets["sposync-linux-amd64"] = "amd64"
$Assets["sposync-linux-arm64"] = "arm64"
$Extras = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::Ordinal)
foreach ($n in @("sposync-win64-requirements.txt", "sposync-linux-amd64-requirements.txt", "sposync-linux-arm64-requirements.txt")) {
    [void]$Extras.Add($n)
}

$TagPattern    = '^sposync-v[0-9]+\.[0-9]+\.[0-9]+\z'
$RepoPattern   = '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+\z'
$CommitPattern = '^[0-9a-f]{40}\z'
$HashPattern   = '^[0-9a-f]{64}\z'

# Runs gh without letting its stderr become a terminating error (Windows PowerShell 5.1 does that
# under Stop). Returns Code and Text (stdout and stderr together).
function Invoke-Gh([string[]]$GhArgs) {
    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $out = & gh @GhArgs 2>&1 | ForEach-Object { "$_" }
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $old
    }
    return [pscustomobject]@{ Code = $code; Text = ((@($out) -join "`n").Trim()) }
}

# ready | notloggedin | missing
function Get-GhState {
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { return "missing" }
    $r = Invoke-Gh @("auth", "status")
    if ($r.Code -ne 0) { return "notloggedin" }
    return "ready"
}

# Parses SHA256SUMS: asset name -> lowercase hash. Only the three binaries and the requirements
# files may be listed; every binary must be there exactly once.
function Get-Hashes([string]$text) {
    $found = New-Object 'System.Collections.Generic.Dictionary[string,string]' ([StringComparer]::Ordinal)
    foreach ($line in ($text -split "`r?`n")) {
        if (-not $line.Trim()) { continue }
        if ($line -cnotmatch '^([0-9a-fA-F]{64}) [ *]([!-~]+)\z') { throw "SHA256SUMS has a line that is not 'hash  name': $line" }
        $name = $Matches[2]
        $hash = $Matches[1].ToLowerInvariant()
        if ($hash -cnotmatch $HashPattern) { throw "SHA256SUMS has a hash that is not 64 lowercase hex characters: $line" }
        if (-not ($Assets.ContainsKey($name) -or $Extras.Contains($name))) { throw "SHA256SUMS lists a file this script does not know: $name" }
        if ($found.ContainsKey($name)) { throw "SHA256SUMS lists $name twice." }
        $found[$name] = $hash
    }
    foreach ($name in $Assets.Keys) {
        if (-not $found.ContainsKey($name)) { throw "SHA256SUMS has no line for $name." }
    }
    return $found
}

# Replaces the quoted value after the captured prefix. Exactly one match, or it throws.
function Set-Pin([string]$text, [string]$pattern, [string]$value, [string]$what) {
    $count = [regex]::Matches($text, $pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline).Count
    if ($count -ne 1) { throw "$what`: expected exactly one match of $pattern, found $count." }
    $eval = { param($m) $m.Groups[1].Value + '"' + $value + '"' }.GetNewClosure()
    return [regex]::Replace($text, $pattern, [System.Text.RegularExpressions.MatchEvaluator]$eval, [System.Text.RegularExpressions.RegexOptions]::Multiline)
}

function Count-Char([string]$text, [char]$c) {
    return ($text.ToCharArray() | Where-Object { $_ -eq $c } | Measure-Object).Count
}

function Show-Changes([string]$label, [string]$old, [string]$new) {
    $a = $old -split "`n"
    $b = $new -split "`n"
    Write-Host "--- $label"
    for ($i = 0; $i -lt $a.Count; $i++) {
        if ($a[$i] -ne $b[$i]) {
            Write-Host ("  line {0}:" -f ($i + 1))
            Write-Host ("  - " + $a[$i].TrimEnd("`r"))
            Write-Host ("  + " + $b[$i].TrimEnd("`r"))
        }
    }
}

$work = $null
try {
    if ($Tag -cnotmatch $TagPattern) { throw "Tag must look like sposync-vX.Y.Z, got '$Tag'." }
    if ($Repo -cnotmatch $RepoPattern) { throw "Repo must look like owner/name, got '$Repo'." }

    $repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    if (-not $WindowsInstaller) { $WindowsInstaller = Join-Path $repoRoot "scripts\install\windows\install.ps1" }
    if (-not $LinuxInstaller)   { $LinuxInstaller   = Join-Path $repoRoot "scripts\install\linux\install.sh" }
    foreach ($f in @($WindowsInstaller, $LinuxInstaller)) {
        if (-not (Test-Path -LiteralPath $f -PathType Leaf)) { throw "Installer not found: $f" }
    }

    # -SumsFile / -Commit are the offline test inputs: they switch every remote check off.
    $offline = [bool]($SumsFile -or $Commit)
    $ghState = "missing"
    if ($offline) {
        Write-Host "pin-sposync: -SumsFile/-Commit given, so no remote checks are made."
    }
    else {
        $ghState = Get-GhState
        if ($ghState -ne "ready") {
            $why = if ($ghState -eq "missing") { "gh (GitHub CLI) was not found" } else { "gh is not logged in (gh auth login)" }
            Write-Warning "$why. The remote check was skipped: the local tag was NOT compared with the tag on GitHub."
            if (-not $SkipAttestation) {
                throw "Cannot verify the release without gh. Install gh and log in, or pass -SkipAttestation to trust SHA256SUMS as downloaded."
            }
        }
        if ($SkipAttestation) {
            Write-Warning "-SkipAttestation: the provenance of SHA256SUMS and the binaries is NOT verified."
        }
    }

    # The commit the tag points to, from git; refused when GitHub says something else.
    if ($Commit) {
        if ($Commit -cnotmatch $CommitPattern) { throw "Commit must be 40 lowercase hex characters." }
    }
    else {
        # Windows PowerShell 5.1 turns native stderr into a terminating error under Stop.
        $ErrorActionPreference = "Continue"
        $out = & git -C $repoRoot rev-list -n 1 $Tag 2>&1
        $gitExit = $LASTEXITCODE
        $ErrorActionPreference = "Stop"
        if ($gitExit -ne 0) { throw "git does not know the tag $Tag here. Fetch it first: git fetch origin tag $Tag" }
        $Commit = ([string](@($out)[0])).Trim()
        if ($Commit -cnotmatch $CommitPattern) { throw "git rev-list printed '$Commit', not a commit SHA." }
    }
    if (-not $offline -and $ghState -eq "ready") {
        $r = Invoke-Gh @("api", "repos/$Repo/commits/refs/tags/$Tag", "--jq", ".sha")
        if ($r.Code -ne 0) { throw "gh api could not read the tag $Tag in ${Repo}: $($r.Text)" }
        $remote = $r.Text.Trim()
        if ($remote -cnotmatch $CommitPattern) { throw "GitHub returned '$remote' for the tag, not a commit SHA." }
        if ($remote -cne $Commit) { throw "local tag $Tag is $Commit, GitHub says $remote. Fetch tags first." }
        Write-Host "pin-sposync: the tag points at $Commit on GitHub too."
    }

    # SHA256SUMS: a file, or downloaded (with gh, into a private temp dir, together with the binaries).
    $sumsText = $null
    if ($SumsFile) {
        if (-not (Test-Path -LiteralPath $SumsFile -PathType Leaf)) { throw "SumsFile not found: $SumsFile" }
        $sumsText = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $SumsFile).ProviderPath)
    }
    else {
        $work = Join-Path ([System.IO.Path]::GetTempPath()) ("pin-sposync-" + [guid]::NewGuid())
        New-Item -ItemType Directory -Path $work | Out-Null
        $sumsPath = Join-Path $work "SHA256SUMS"
        if ($ghState -eq "ready") {
            $ghArgs = @("release", "download", $Tag, "-R", $Repo, "-D", $work, "--clobber", "-p", "SHA256SUMS")
            if (-not $SkipAttestation) {
                foreach ($name in $Assets.Keys) { $ghArgs += @("-p", $name) }
            }
            $r = Invoke-Gh $ghArgs
            if ($r.Code -ne 0) { throw "gh release download failed for $Tag in $Repo (exit code $($r.Code)). Is the release published? $($r.Text)" }
        }
        else {
            try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072 } catch {}
            Invoke-WebRequest -Uri "https://github.com/$Repo/releases/download/$Tag/SHA256SUMS" -OutFile $sumsPath -UseBasicParsing
        }
        $sumsText = [System.IO.File]::ReadAllText($sumsPath)
    }
    $hashes = Get-Hashes $sumsText

    # Provenance, before anything is written: each binary matches its line in SHA256SUMS, and
    # SHA256SUMS and the binaries are attested by this repository's workflow for this tag.
    if (-not $offline -and $ghState -eq "ready" -and -not $SkipAttestation) {
        foreach ($name in $Assets.Keys) {
            $file = Join-Path $work $name
            if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "The release has no $name." }
            $actual = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
            if ($actual -cne $hashes[$name]) { throw "$name`: SHA256 is $actual, SHA256SUMS says $($hashes[$name])." }
        }
        $files = @($sumsPath) + @($Assets.Keys | ForEach-Object { Join-Path $work $_ })
        foreach ($file in $files) {
            $r = Invoke-Gh @("attestation", "verify", $file, "-R", $Repo,
                "--signer-workflow", "$Repo/.github/workflows/build-sposync.yml",
                "--source-ref", "refs/tags/$Tag")
            if ($r.Code -ne 0) { throw "No valid attestation for $(Split-Path -Leaf $file): $($r.Text)" }
            Write-Host "pin-sposync: attested: $(Split-Path -Leaf $file)"
        }
    }

    $winPath = (Resolve-Path -LiteralPath $WindowsInstaller).ProviderPath
    $shPath  = (Resolve-Path -LiteralPath $LinuxInstaller).ProviderPath
    $winOld  = $Latin1.GetString([System.IO.File]::ReadAllBytes($winPath))
    $shOld   = $Latin1.GetString([System.IO.File]::ReadAllBytes($shPath))

    $q = '"[^"\r\n]*"'
    $win = $winOld
    $win = Set-Pin $win ('^(\$SpoSyncTag\s*=\s*)' + $q)       $Tag                           'install.ps1 $SpoSyncTag'
    $win = Set-Pin $win ('^(\$SpoSyncSha256\s*=\s*)' + $q)    $hashes["sposync-win64.exe"]   'install.ps1 $SpoSyncSha256'
    $win = Set-Pin $win ('^(\$SpoSyncSourceRef\s*=\s*)' + $q) $Commit                        'install.ps1 $SpoSyncSourceRef'

    $sh = $shOld
    $sh = Set-Pin $sh ('^(SPOSYNC_TAG=)' + $q)          $Tag                             'install.sh SPOSYNC_TAG'
    $sh = Set-Pin $sh ('^(SPOSYNC_SHA256_AMD64=)' + $q) $hashes["sposync-linux-amd64"]   'install.sh SPOSYNC_SHA256_AMD64'
    $sh = Set-Pin $sh ('^(SPOSYNC_SHA256_ARM64=)' + $q) $hashes["sposync-linux-arm64"]   'install.sh SPOSYNC_SHA256_ARM64'
    $sh = Set-Pin $sh ('^(SPOSYNC_SOURCE_REF=)' + $q)   $Commit                          'install.sh SPOSYNC_SOURCE_REF'

    # Line endings must not move: install.sh stays LF only, install.ps1 keeps what it had.
    if ($sh.Contains("`r")) { throw "install.sh would contain a CR byte; refusing to write." }
    foreach ($c in @([char]13, [char]10)) {
        if ((Count-Char $win $c) -ne (Count-Char $winOld $c)) { throw "install.ps1 line endings would change; refusing to write." }
    }

    [System.IO.File]::WriteAllBytes($winPath, $Latin1.GetBytes($win))
    [System.IO.File]::WriteAllBytes($shPath, $Latin1.GetBytes($sh))

    Show-Changes $winPath $winOld $win
    Show-Changes $shPath $shOld $sh
    Write-Host ""
    Write-Host "Pinned $Tag at $Commit."
    Write-Host "Review with: git diff -- scripts/install"
}
catch {
    Write-Host ("pin-sposync: " + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
finally {
    if ($work -and (Test-Path -LiteralPath $work)) {
        Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
    }
}
