#!/usr/bin/env bash

set -u

ESC=$'\033'
RESET="${ESC}[0m"

BLOCK_FULL=$'\xe2\x96\x88'   # U+2588
BLOCK_LOWER=$'\xe2\x96\x84'  # U+2584
BLOCK_UPPER=$'\xe2\x96\x80'  # U+2580
BLOCK_LEFT=$'\xe2\x96\x8c'   # U+258C

rgb() {
    printf '%s[38;2;%d;%d;%dm' "$ESC" "$1" "$2" "$3"
}

ORANGE_LIGHT=$(rgb 255 140 66)
ORANGE_DARK=$(rgb 224 123 57)
ORANGE_MID=$(rgb 240 131 61)
GREEN_ANSI=$(rgb 140 255 140)
RED_ANSI=$(rgb 255 110 110)
GRAY_ANSI=$(rgb 130 130 130)

gradient_color() {
    local index=$1 total=$2
    local r1=255 g1=140 b1=66
    local r2=224 g2=123 b2=57
    local t_num=$index t_den=$((total - 1))
    if [ "$t_den" -le 0 ]; then t_den=1; t_num=0; fi
    local r=$(( r1 + (r2 - r1) * t_num / t_den ))
    local g=$(( g1 + (g2 - g1) * t_num / t_den ))
    local b=$(( b1 + (b2 - b1) * t_num / t_den ))
    rgb "$r" "$g" "$b"
}

ascii_art_line() {
    local line="$1"
    line="${line//A/$BLOCK_FULL}"
    line="${line//B/$BLOCK_LOWER}"
    line="${line//C/$BLOCK_UPPER}"
    line="${line//D/$BLOCK_LEFT}"
    printf '%s' "$line"
}

show_header() {
    clear
    local templates=(
        "   BAAAAAAAA    BAAAAAAAB  BAAAAAAAB      AAA    AAA    AB   BA  "
        "  AAA    AAA   AAA    AAA AAA    AAA CAAAAAAAAAB AAA    AAA AAA  "
        "  AAA    AC    AAA    AAA AAA    AAA    CAAACCAA AAA    AAA AAAD "
        "  AAA          AAA    AAA AAA    AAA     AAA   C AAA    AAA AAAD "
        "CAAAAAAAAAAA CAAAAAAAAAC  AAA    AAA     AAA     AAA    AAA AAAD "
        "         AAA   AAA        AAA    AAA     AAA     AAA    AAA AAA  "
        "   BA    AAA   AAA        AAA    AAA     AAA     AAA    AAA AAA  "
        " BAAAAAAAAC   BAAAAC       CAAAAAAC     BAAAAC   AAAAAAAAC  AC   "
    )
    local count=${#templates[@]}
    echo ""
    local i
    for ((i = 0; i < count; i++)); do
        local color
        color=$(gradient_color "$i" "$count")
        local line
        line=$(ascii_art_line "${templates[$i]}")
        printf '%s%s%s\n' "$color" "$line" "$RESET"
    done
    echo ""
    printf '%s                          Installer%s\n' "$ORANGE_MID" "$RESET"
    printf '%s  =============================================================%s\n' "$ORANGE_DARK" "$RESET"
    echo ""
}

SPINNER_CODES=(0x280B 0x2819 0x2839 0x2838 0x283C 0x2834 0x2826 0x2827 0x2807 0x280F)
SPINNER_FRAMES=()
for code in "${SPINNER_CODES[@]}"; do
    SPINNER_FRAMES+=("$(printf "\\U$(printf '%08x' "$code")")")
done
CHECK_MARK=$'\xe2\x9c\x93'  # U+2713
CROSS_MARK=$'\xe2\x9c\x95'  # U+2715
CR=$'\r'

STEP_OUTPUT=""
STEP_FILE=""

invoke_step() {
    local label="$1"; shift
    local out_file err_file
    out_file=$(mktemp)
    err_file=$(mktemp)

    ("$@") >"$out_file" 2>"$err_file" &
    local job_pid=$!

    local frame_index=0
    tput civis 2>/dev/null

    while kill -0 "$job_pid" 2>/dev/null; do
        local frame="${SPINNER_FRAMES[$((frame_index % ${#SPINNER_FRAMES[@]}))]}"
        local color
        color=$(gradient_color $((frame_index % 8)) 8)
        printf '%s  %s%s%s  %s' "$CR" "$color" "$frame" "$RESET" "$label"
        sleep 0.08
        frame_index=$((frame_index + 1))
    done

    wait "$job_pid"
    local exit_code=$?
    local failed=0
    if [ "$exit_code" -ne 0 ]; then failed=1; fi

    local pad
    pad=$(printf ' %.0s' {1..40})
    if [ "$failed" -eq 1 ]; then
        printf '%s  %s%s%s  %s%s\n' "$CR" "$RED_ANSI" "$CROSS_MARK" "$RESET" "$label" "$pad"
        if [ -s "$err_file" ]; then
            printf '      %s%s%s\n' "$RED_ANSI" "$(cat "$err_file")" "$RESET"
        fi
    else
        printf '%s  %s%s%s  %s%s\n' "$CR" "$GREEN_ANSI" "$CHECK_MARK" "$RESET" "$label" "$pad"
    fi

    tput cnorm 2>/dev/null

    STEP_OUTPUT=$(cat "$out_file")
    STEP_FILE="$out_file"
    rm -f "$err_file"
    return "$failed"
}

usage() {
    cat <<'EOF'
Usage: install.sh [options]

  --sposync            also install the optional SpoSync helper (no prompt)
  --no-sposync         do not install SpoSync and do not ask
  --sposync-only       install only SpoSync, skip the spotui CLI; exits 1 unless
                       SpoSync ends up installed (running or not running yet)
  --sposync-bin PATH   install this local SpoSync binary instead of building one
  -h, --help           show this help

--sposync and --sposync-only each contradict --no-sposync (exit 2).

Environment: SPOTUI_SPOSYNC=1|0 (same as --sposync / --no-sposync),
             SPOTUI_SPOSYNC_BIN=PATH (same as --sposync-bin).
Flags win over the environment.
EOF
}

# SPOSYNC_CHOICE: yes | no | ask
SPOSYNC_CHOICE="ask"
SPOSYNC_ONLY=0
SPOSYNC_NO_FLAG=0
SPOSYNC_YES_FLAG=0
SPOSYNC_BIN_ARG="${SPOTUI_SPOSYNC_BIN:-}"
case "${SPOTUI_SPOSYNC:-}" in
    1) SPOSYNC_CHOICE="yes" ;;
    0) SPOSYNC_CHOICE="no" ;;
esac

while [ "$#" -gt 0 ]; do
    case "$1" in
        --sposync)       SPOSYNC_CHOICE="yes"; SPOSYNC_YES_FLAG=1 ;;
        --no-sposync)    SPOSYNC_CHOICE="no"; SPOSYNC_NO_FLAG=1 ;;
        --sposync-only)  SPOSYNC_ONLY=1; SPOSYNC_CHOICE="yes" ;;
        --sposync-bin)
            if [ "$#" -lt 2 ] || [ -z "$2" ]; then
                echo "install.sh: --sposync-bin needs a path" >&2
                usage >&2
                exit 2
            fi
            SPOSYNC_BIN_ARG="$2"
            shift
            ;;
        -h|--help)       usage; exit 0 ;;
        *)
            echo "install.sh: unknown argument: $1" >&2
            usage >&2
            exit 2
            ;;
    esac
    shift
done

if [ "$SPOSYNC_ONLY" -eq 1 ] && [ "$SPOSYNC_NO_FLAG" -eq 1 ]; then
    echo "install.sh: --sposync-only contradicts --no-sposync" >&2
    usage >&2
    exit 2
fi
if [ "$SPOSYNC_YES_FLAG" -eq 1 ] && [ "$SPOSYNC_NO_FLAG" -eq 1 ]; then
    echo "install.sh: --sposync contradicts --no-sposync" >&2
    usage >&2
    exit 2
fi

show_header

REPO_OWNER="SkenSMasteR"
REPO_NAME="SpoTUI"
API_LATEST="https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest"

# With neither XDG_DATA_HOME nor HOME there is no place for the CLI (checked below,
# only when the CLI is installed; --sposync-only does not need it).
TARGET_DIR="${XDG_DATA_HOME:-${HOME:+$HOME/.local/share}}"
TARGET_DIR="${TARGET_DIR:+$TARGET_DIR/spotui}"
BIN_PATH="${TARGET_DIR}/spotui"
LAUNCHER_PATH="${TARGET_DIR}/spotui.sh"

get_target_asset_name() {
    local arch
    arch=$(uname -m)
    case "$arch" in
        aarch64|arm64) echo "spotui-linux-arm64" ;;
        x86_64|amd64)  echo "spotui-linux-amd64" ;;
        i386|i686)     echo "spotui-linux-386" ;;
        *)             echo "spotui-linux-amd64" ;;
    esac
}

get_asset_names() {
    printf '%s' "$RELEASE_JSON" | jq -r '.assets[].name'
}

arch_keywords() {
    local arch
    arch=$(uname -m)
    case "$arch" in
        aarch64|arm64) echo "arm64 aarch64" ;;
        x86_64|amd64)  echo "amd64 x86_64" ;;
        i386|i686)     echo "386 i686 i386" ;;
        *)             echo "" ;;
    esac
}

select_asset_name() {
    local preferred
    preferred=$(get_target_asset_name)
    local names
    names=$(get_asset_names)

    if printf '%s\n' "$names" | grep -qxF "$preferred"; then
        echo "$preferred"
        return 0
    fi

    local kw
    for kw in $(arch_keywords); do
        local match
        match=$(printf '%s\n' "$names" | grep -i 'linux' | grep -i "$kw" | head -n 1)
        if [ -n "$match" ]; then
            echo "$match"
            return 0
        fi
    done

    local linux_only
    linux_only=$(printf '%s\n' "$names" | grep -i 'linux')
    if [ "$(printf '%s\n' "$linux_only" | grep -c .)" -eq 1 ]; then
        echo "$linux_only"
        return 0
    fi

    return 1
}

need_cmd() {
    command -v "$1" >/dev/null 2>&1
}

# RUN_CLI=0 (--sposync-only) leaves OK=0, which makes every spotui CLI step below skip.
RUN_CLI=1
if [ "$SPOSYNC_ONLY" -eq 1 ]; then RUN_CLI=0; fi

if [ "$RUN_CLI" -eq 1 ]; then
    if [ -z "$TARGET_DIR" ]; then
        echo "  ${RED_ANSI}${CROSS_MARK}${RESET}  Neither XDG_DATA_HOME nor HOME is set, so there is no place to install spotui."
        exit 1
    fi
    if ! need_cmd curl; then
        echo "  ${RED_ANSI}${CROSS_MARK}${RESET}  This installer requires curl. Please install it and re-run."
        exit 1
    fi
    if ! need_cmd jq; then
        echo "  ${RED_ANSI}${CROSS_MARK}${RESET}  This installer requires jq. Please install it and re-run."
        exit 1
    fi
fi

OK="$RUN_CLI"
RELEASE_JSON=""
ASSET_NAME=""
ASSET_URL=""
ASSET_SIZE=""
ASSET_DIGEST=""
LATEST_TAG=""
RELEASE_BODY=""

if [ "$OK" -eq 1 ]; then
    if invoke_step "Looking up latest release" bash -c "curl -fsSL -H 'User-Agent: SpoTUI-Installer' '$API_LATEST'"; then
        RELEASE_JSON="$STEP_OUTPUT"
    else
        OK=0
    fi
    rm -f "$STEP_FILE"
fi

if [ "$OK" -eq 1 ]; then
    LATEST_TAG=$(printf '%s' "$RELEASE_JSON" | jq -r '.tag_name')
    RELEASE_BODY=$(printf '%s' "$RELEASE_JSON" | jq -r '.body // ""')
    ASSET_NAME=$(select_asset_name)

    if [ -z "$ASSET_NAME" ]; then
        echo ""
        echo "  ${RED_ANSI}${CROSS_MARK}${RESET}  No suitable Linux asset found in release ${LATEST_TAG}."
        echo "  ${GRAY_ANSI}   Assets published in this release:${RESET}"
        get_asset_names | sed 's/^/     - /'
        OK=0
    else
        ASSET_JSON=$(printf '%s' "$RELEASE_JSON" | jq -c --arg name "$ASSET_NAME" '.assets[] | select(.name == $name)' | head -n 1)
        ASSET_URL=$(printf '%s' "$ASSET_JSON" | jq -r '.browser_download_url')
        ASSET_SIZE=$(printf '%s' "$ASSET_JSON" | jq -r '.size')
        ASSET_DIGEST=$(printf '%s' "$ASSET_JSON" | jq -r '.digest // ""')
    fi
fi

if [ "$OK" -eq 1 ]; then
    size_mb=$(awk -v b="$ASSET_SIZE" 'BEGIN { printf "%.2f", b / 1048576 }')
    echo ""
    echo "${ORANGE_MID}  Latest version: ${LATEST_TAG}${RESET}"
    echo "${GRAY_ANSI}  Asset: ${ASSET_NAME}  (${size_mb} MB)${RESET}"
    echo ""
fi

get_expected_hash() {
    local digest="$1" name="$2" body="$3"
    if [[ "$digest" =~ ^sha256:([a-fA-F0-9]{64})$ ]]; then
        echo "${BASH_REMATCH[1],,}"
        return 0
    fi
    if [ -z "$body" ]; then
        return 1
    fi
    local escaped
    escaped=$(printf '%s' "$name" | sed 's/[.[\*^$/]/\\&/g')
    local match
    match=$(printf '%s' "$body" | grep -Pzo "(?s)${escaped}.{0,200}?\\b([a-fA-F0-9]{64})\\b" 2>/dev/null | grep -Pao '[a-fA-F0-9]{64}' | head -n 1)
    if [ -n "$match" ]; then
        echo "${match,,}"
        return 0
    fi
    return 1
}

DOWNLOAD_PATH=""

if [ "$OK" -eq 1 ]; then
    if invoke_step "Creating install directory" mkdir -p "$TARGET_DIR"; then
        :
    else
        OK=0
    fi
    rm -f "$STEP_FILE"
fi

if [ "$OK" -eq 1 ]; then
    DOWNLOAD_PATH="${TARGET_DIR}/${ASSET_NAME}"
    if invoke_step "Downloading ${ASSET_NAME}" curl -fsSL -o "$DOWNLOAD_PATH" "$ASSET_URL"; then
        :
    else
        OK=0
    fi
    rm -f "$STEP_FILE"
fi

if [ "$OK" -eq 1 ]; then
    EXPECTED_HASH=$(get_expected_hash "$ASSET_DIGEST" "$ASSET_NAME" "$RELEASE_BODY") || EXPECTED_HASH=""
    if [ -n "$EXPECTED_HASH" ]; then
        if invoke_step "Verifying SHA256 checksum" bash -c "
            actual=\$(sha256sum '$DOWNLOAD_PATH' | awk '{print \$1}')
            actual=\$(printf '%s' \"\$actual\" | tr '[:upper:]' '[:lower:]')
            if [ \"\$actual\" != '$EXPECTED_HASH' ]; then
                echo \"Checksum mismatch. Expected $EXPECTED_HASH but got \$actual. Aborting - file was not installed.\" >&2
                exit 1
            fi
        "; then
            echo "${GRAY_ANSI}  SHA256: ${EXPECTED_HASH}${RESET}"
            echo ""
        else
            OK=0
        fi
        rm -f "$STEP_FILE"
    else
        echo ""
        echo "  ${RED_ANSI}!${RESET}  No published checksum found for this asset in the release notes."
        echo "     ${GRAY_ANSI}You can verify it manually at:${RESET}"
        echo "     ${GRAY_ANSI}https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/tag/${LATEST_TAG}${RESET}"
        # Read from the terminal: stdin may be this very script (curl | bash). No terminal means No.
        printf '%s' "  Type Y to continue installing anyway, or anything else to cancel: "
        CONFIRM=""
        { read -r CONFIRM </dev/tty; } 2>/dev/null || { echo ""; echo "  ${GRAY_ANSI}No terminal to ask on: cancelled.${RESET}"; CONFIRM=""; }
        if [ "$CONFIRM" != "Y" ] && [ "$CONFIRM" != "y" ]; then
            OK=0
        fi
    fi
fi

if [ "$OK" -eq 1 ]; then
    if invoke_step "Installing spotui" bash -c "cp -f '$DOWNLOAD_PATH' '$BIN_PATH' && chmod +x '$BIN_PATH' && rm -f '$DOWNLOAD_PATH'"; then
        :
    else
        OK=0
    fi
    rm -f "$STEP_FILE"
fi

if [ "$OK" -eq 1 ]; then
    if invoke_step "Updating PATH" bash -c "
        for rc in \"\$HOME/.bashrc\" \"\$HOME/.profile\" \"\$HOME/.zshrc\"; do
            if [ -f \"\$rc\" ] && ! grep -qF '$TARGET_DIR' \"\$rc\" 2>/dev/null; then
                printf '\n# Added by SpoTUI installer\nexport PATH=\"\$PATH:$TARGET_DIR\"\n' >> \"\$rc\"
            fi
        done
    "; then
        :
    else
        OK=0
    fi
    rm -f "$STEP_FILE"
    export PATH="$PATH:$TARGET_DIR"
fi

if [ "$OK" -eq 1 ]; then
    if invoke_step "Creating launcher" bash -c "
        printf '#!/usr/bin/env bash\nexec \"$BIN_PATH\" \"\$@\"\n' > '$LAUNCHER_PATH'
        chmod +x '$LAUNCHER_PATH'
    "; then
        :
    else
        OK=0
    fi
    rm -f "$STEP_FILE"
fi

# ---------------------------------------------------------------------------
# SpoSync (optional helper: visualizer audio, terminal lyrics)
# ---------------------------------------------------------------------------

SPOSYNC_REPO="NoxLoveYa/SpoTUI"
SPOSYNC_TAG=""             # release tag holding sposync-linux-amd64; empty = none published
SPOSYNC_SHA256_AMD64=""    # lowercase hex of that asset; tag and hash must both be set to download
SPOSYNC_SOURCE_REF=""      # full commit SHA of a source archive; empty = only a local checkout can build

# XDG base directory: the variable when it is an absolute path (spec), else a
# path under $HOME. Prints nothing when there is neither (HOME unset).
xdg_dir() {
    case "$1" in
        /*) printf '%s' "$1" ;;
        *)  if [ -n "${HOME:-}" ]; then printf '%s/%s' "$HOME" "$2"; fi ;;
    esac
}

SPOSYNC_DATA_BASE="$(xdg_dir "${XDG_DATA_HOME:-}" ".local/share")"
SPOSYNC_STATE_BASE="$(xdg_dir "${XDG_STATE_HOME:-}" ".local/state")"
SPOSYNC_CONFIG_BASE="$(xdg_dir "${XDG_CONFIG_HOME:-}" ".config")"
SPOSYNC_PATHS_OK=0
SPOSYNC_DIR=""
SPOSYNC_BIN=""
SPOSYNC_STATE=""
SPOSYNC_AUTOSTART=""
if [ -n "$SPOSYNC_DATA_BASE" ] && [ -n "$SPOSYNC_STATE_BASE" ] && [ -n "$SPOSYNC_CONFIG_BASE" ]; then
    SPOSYNC_PATHS_OK=1
    SPOSYNC_DIR="$SPOSYNC_DATA_BASE/sposync"
    SPOSYNC_BIN="$SPOSYNC_DIR/sposync"
    SPOSYNC_STATE="$SPOSYNC_STATE_BASE/sposync"
    SPOSYNC_AUTOSTART="$SPOSYNC_CONFIG_BASE/autostart/sposync.desktop"
fi
SPOSYNC_PORT=8765
SPOSYNC_UID="$(id -u 2>/dev/null || echo "")"

# skipped | running | starting | stopped | failed
SPOSYNC_STATUS="skipped"
SPOSYNC_SRC=""
SPOSYNC_TMPS=()
NEW_TMP=""

sposync_new_tmpdir() {
    NEW_TMP=$(mktemp -d "${TMPDIR:-/tmp}/spotui-sposync-XXXXXX") || return 1
    SPOSYNC_TMPS+=("$NEW_TMP")
}

# Kills every descendant of the given PIDs, deepest first. Background steps
# ignore Ctrl+C, so without this a build or download outlives the installer.
sposync_kill_descendants() {
    local pid child
    need_cmd pgrep || return 0
    for pid in "$@"; do
        for child in $(pgrep -P "$pid" 2>/dev/null); do
            sposync_kill_descendants "$child"
            kill "$child" 2>/dev/null
        done
    done
}

sposync_cleanup() {
    local d
    tput cnorm 2>/dev/null
    # Stop this script's own child jobs before their temporary folders disappear.
    sposync_kill_descendants "$$"
    if [ "${#SPOSYNC_TMPS[@]}" -gt 0 ]; then
        for d in "${SPOSYNC_TMPS[@]}"; do
            if [ -n "$d" ]; then rm -rf -- "${d:?}"; fi
        done
    fi
}
trap sposync_cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

sposync_note() { echo "  ${GRAY_ANSI}   $1${RESET}"; }
sposync_fail() { echo "  ${RED_ANSI}${CROSS_MARK}${RESET}  $1"; }

sha256_of() { sha256sum "$1" | cut -d ' ' -f 1; }

sposync_arch() {
    case "$(uname -m)" in
        x86_64|amd64)  echo "amd64" ;;
        aarch64|arm64) echo "arm64" ;;
        *)             echo "" ;;
    esac
}

# Escape a literal path for an extended regex (pkill/pgrep -f).
sposync_regex() {
    printf '%s' "$1" | sed 's#[][\.*^$+?(){}|]#\\&#g'
}

# What the process tools can do here. pgrep must understand -u/-f (procps; BusyBox
# does not), ss must understand -H and -p. Checked once; without them the
# installer cannot see processes or sockets and says so instead of guessing.
SPOSYNC_HAVE_PGREP=0
if need_cmd pgrep && need_cmd pkill && [ -n "$SPOSYNC_UID" ]; then
    pgrep -u "$SPOSYNC_UID" -f -- '^spotui-sposync-probe-never-matches$' >/dev/null 2>&1
    if [ "$?" -le 1 ]; then SPOSYNC_HAVE_PGREP=1; fi
fi
SPOSYNC_HAVE_SS=0
if need_cmd ss && ss -Hltnp >/dev/null 2>&1; then SPOSYNC_HAVE_SS=1; fi

# True while a process of this user runs the installed binary: the full command
# line must start with its exact path, so nothing else can match.
sposync_running() {
    local re
    [ "$SPOSYNC_HAVE_PGREP" -eq 1 ] || return 1
    re="^$(sposync_regex "$SPOSYNC_BIN")( |\$)"
    pgrep -u "$SPOSYNC_UID" -f -- "$re" >/dev/null 2>&1
}

# True when anything listens on the port (needs ss).
sposync_port_listening() {
    [ "$SPOSYNC_HAVE_SS" -eq 1 ] || return 1
    [ -n "$(ss -Hltn "sport = :$SPOSYNC_PORT" 2>/dev/null)" ]
}

# True when a process running the installed binary is the one listening on the
# port: a listener of any other program does not count.
sposync_owns_port() {
    local pid
    [ "$SPOSYNC_HAVE_PGREP" -eq 1 ] && [ "$SPOSYNC_HAVE_SS" -eq 1 ] || return 1
    for pid in $(pgrep -u "$SPOSYNC_UID" -f -- "^$(sposync_regex "$SPOSYNC_BIN")( |\$)" 2>/dev/null); do
        if ss -Hltnp "sport = :$SPOSYNC_PORT" 2>/dev/null | grep -q "pid=$pid,"; then return 0; fi
    done
    return 1
}

# Ask the old helper to exit, then SIGTERM, then SIGKILL (installed path, own user only).
sposync_stop() {
    local re i
    if [ -x "$SPOSYNC_BIN" ]; then
        "$SPOSYNC_BIN" --quit >/dev/null 2>&1
    fi
    [ "$SPOSYNC_HAVE_PGREP" -eq 1 ] || return 0
    re="^$(sposync_regex "$SPOSYNC_BIN")( |\$)"
    sposync_running || return 0
    pkill -u "$SPOSYNC_UID" -f -- "$re" >/dev/null 2>&1
    for i in 1 2 3 4 5 6; do
        sposync_running || return 0
        sleep 0.5
    done
    pkill -KILL -u "$SPOSYNC_UID" -f -- "$re" >/dev/null 2>&1
    sleep 0.5
    return 0
}

# Prints the prompt, reads one answer from the terminal. No terminal, EOF or
# anything but y/yes (any of y, Y, yes, Yes, YES) means No.
sposync_ask() {
    local ans=""
    printf '%s' "$1"
    { read -r ans </dev/tty; } 2>/dev/null || { echo ""; return 1; }
    case "$ans" in
        y|Y|yes|Yes|YES) return 0 ;;
    esac
    return 1
}

# Sets SPOSYNC_SRC to the binary to install. Returns 1 (status already set,
# message printed) when there is nothing to install.
sposync_resolve_source() {
    local arch asset actual py pycmd script cand root built where
    SPOSYNC_SRC=""
    arch=$(sposync_arch)

    # a. explicit local binary: no fallback if it is missing
    if [ -n "$SPOSYNC_BIN_ARG" ]; then
        if [ ! -f "$SPOSYNC_BIN_ARG" ]; then
            sposync_fail "SpoSync binary not found: $SPOSYNC_BIN_ARG"
            SPOSYNC_STATUS="failed"
            return 1
        fi
        SPOSYNC_SRC="$SPOSYNC_BIN_ARG"
        sposync_note "Using local binary: $SPOSYNC_SRC"
        sposync_note "SHA256: $(sha256_of "$SPOSYNC_SRC")"
        return 0
    fi

    # b. release asset from this fork, pinned SHA256 (skipped while unpinned)
    if [ -n "$SPOSYNC_TAG" ] && [ -n "$SPOSYNC_SHA256_AMD64" ] && [ "$arch" = "amd64" ]; then
        if ! need_cmd curl; then
            sposync_fail "Downloading SpoSync requires curl. Please install it and re-run."
            SPOSYNC_STATUS="failed"
            return 1
        fi
        asset="sposync-linux-amd64"
        sposync_new_tmpdir || { sposync_fail "Could not create a temporary directory."; SPOSYNC_STATUS="failed"; return 1; }
        if ! invoke_step "Downloading SpoSync" curl -fsSL -o "$NEW_TMP/$asset" "https://github.com/${SPOSYNC_REPO}/releases/download/${SPOSYNC_TAG}/${asset}"; then
            rm -f "$STEP_FILE"
            SPOSYNC_STATUS="failed"
            return 1
        fi
        rm -f "$STEP_FILE"
        actual=$(sha256_of "$NEW_TMP/$asset")
        actual="${actual,,}"
        if [ "$actual" != "${SPOSYNC_SHA256_AMD64,,}" ]; then
            sposync_fail "Checksum mismatch. Expected ${SPOSYNC_SHA256_AMD64,,} but got $actual. SpoSync was not installed."
            SPOSYNC_STATUS="failed"
            return 1
        fi
        SPOSYNC_SRC="$NEW_TMP/$asset"
        sposync_note "SHA256: $actual"
        return 0
    fi

    # c. build from source in a private venv. The pinned packages and PyInstaller
    #    need Python 3.12 to 3.15.
    py=""
    pycmd=""
    for cand in python3.15 python3.14 python3.13 python3.12 python3; do
        need_cmd "$cand" || continue
        "$cand" -c 'import sys; sys.exit(0 if (3, 12) <= sys.version_info[:2] < (3, 16) else 1)' >/dev/null 2>&1 || continue
        "$cand" -c 'import venv, ensurepip' >/dev/null 2>&1 || continue
        pycmd=$(command -v "$cand")
        py=$("$cand" -c 'import sys; print("%d.%d" % sys.version_info[:2])')
        break
    done

    if [ -z "$py" ]; then
        echo ""
        echo "  ${GRAY_ANSI}SpoSync skipped: no prebuilt SpoSync is published yet and Python 3.12 to 3.15 (with venv) was not found.${RESET}"
        echo "  ${GRAY_ANSI}Install python3 and python3-venv (or python3.X-venv for the version used) and re-run with --sposync-only, or see README > SpoSync.${RESET}"
        return 1
    fi
    if [ -z "$arch" ]; then
        sposync_fail "SpoSync cannot be built for this CPU architecture ($(uname -m))."
        SPOSYNC_STATUS="failed"
        return 1
    fi

    root=""
    # Piped into bash, BASH_SOURCE[0] is empty or just "bash"; only a real install.sh counts.
    script="${BASH_SOURCE[0]:-}"
    case "$script" in
        */install.sh|install.sh) ;;
        *) script="" ;;
    esac
    if [ -n "$script" ] && [ -f "$script" ]; then
        cand=$(CDPATH= cd -- "$(dirname "$script")/../../.." 2>/dev/null && pwd) || cand=""
        if [ -n "$cand" ] && [ -f "$cand/sposync/build-linux.sh" ] && [ -f "$cand/sposync/app.py" ]; then
            root="$cand"
        fi
    fi
    if [ -z "$root" ] && [ -n "$SPOSYNC_SOURCE_REF" ] && need_cmd curl && need_cmd tar; then
        sposync_new_tmpdir || { sposync_fail "Could not create a temporary directory."; SPOSYNC_STATUS="failed"; return 1; }
        if ! invoke_step "Downloading SpoSync source" bash -c "set -o pipefail; curl -fsSL 'https://github.com/${SPOSYNC_REPO}/archive/${SPOSYNC_SOURCE_REF}.tar.gz' | tar -xz --strip-components=1 -C '$NEW_TMP'"; then
            rm -f "$STEP_FILE"
            SPOSYNC_STATUS="failed"
            return 1
        fi
        rm -f "$STEP_FILE"
        if [ -f "$NEW_TMP/sposync/build-linux.sh" ]; then root="$NEW_TMP"; fi
    fi

    if [ -z "$root" ]; then
        echo ""
        echo "  ${GRAY_ANSI}SpoSync skipped: no prebuilt SpoSync is published yet and this installer is not running from a SpoTUI checkout.${RESET}"
        echo "  ${GRAY_ANSI}Clone the repository and run scripts/install/linux/install.sh --sposync-only, or pass --sposync-bin <path>.${RESET}"
        echo "  ${GRAY_ANSI}See README > SpoSync.${RESET}"
        return 1
    fi

    echo ""
    if [ -n "$NEW_TMP" ] && [ "$root" = "$NEW_TMP" ]; then
        where="into a temporary folder that is removed afterwards"
    else
        where="into a virtual environment in this checkout (sposync/venv, kept for the next build)"
    fi
    if ! sposync_ask "  Python ${py} found. Build SpoSync from source now? It downloads about 150 MB of packages ${where} and takes a few minutes. [y/N] "; then
        echo "  ${GRAY_ANSI}SpoSync skipped: build not confirmed.${RESET}"
        return 1
    fi

    # PYTHON tells the build which interpreter passed the check above.
    if ! invoke_step "Building SpoSync" env PYTHON="$pycmd" bash -c 'out=$(bash "$1" 2>&1) || { printf "%s\n" "$out" | tail -n 20 >&2; exit 1; }; printf "%s\n" "$out" | tail -n 1' _ "$root/sposync/build-linux.sh"; then
        rm -f "$STEP_FILE"
        SPOSYNC_STATUS="failed"
        return 1
    fi
    rm -f "$STEP_FILE"
    built="$root/sposync/bin/sposync-linux-$arch"
    if [ ! -f "$built" ]; then
        sposync_fail "The build finished but $built is missing."
        SPOSYNC_STATUS="failed"
        return 1
    fi
    SPOSYNC_SRC="$built"
    sposync_note "SHA256: $(sha256_of "$SPOSYNC_SRC")"
    return 0
}

# Copy next to the target, compare hashes, and make sure it runs, all while
# the old helper keeps working.
sposync_stage() {
    local want got
    mkdir -p "$SPOSYNC_DIR" || return 1
    rm -f "$SPOSYNC_BIN.new"
    install -Dm755 "$SPOSYNC_SRC" "$SPOSYNC_BIN.new" || return 1
    want=$(sha256_of "$SPOSYNC_SRC")
    got=$(sha256_of "$SPOSYNC_BIN.new")
    if [ "$want" != "$got" ]; then
        rm -f "$SPOSYNC_BIN.new"
        echo "Copy does not match the source (checksum). Aborting." >&2
        return 1
    fi
    if ! "$SPOSYNC_BIN.new" --version >/dev/null 2>&1; then
        rm -f "$SPOSYNC_BIN.new"
        echo "This file does not run on this system: $SPOSYNC_SRC" >&2
        return 1
    fi
}

sposync_swap() {
    local was_running=0
    if [ -x "$SPOSYNC_BIN" ] && sposync_running; then was_running=1; fi
    sposync_stop
    if ! mv -f "$SPOSYNC_BIN.new" "$SPOSYNC_BIN"; then
        rm -f "$SPOSYNC_BIN.new"
        # The old binary is untouched; put the old helper back to work, it was stopped for nothing.
        if [ "$was_running" -eq 1 ] && [ -x "$SPOSYNC_BIN" ]; then
            sposync_start
            echo "The previous SpoSync was started again." >&2
        fi
        return 1
    fi
}

# The .desktop Exec line cannot carry these characters safely. Checked before
# anything is installed (sposync_main), so a refused path leaves nothing behind.
sposync_path_ok() {
    case "$SPOSYNC_BIN" in
        *[\"\\\`\$]*|*$'\n'*) return 1 ;;
    esac
    return 0
}

sposync_write_autostart() {
    local exec_path
    # A literal % is written as %% (desktop entry spec); uninstall.sh matches this exactly.
    exec_path="${SPOSYNC_BIN//%/%%}"
    mkdir -p "$(dirname "$SPOSYNC_AUTOSTART")" || return 1
    {
        printf '[Desktop Entry]\n'
        printf 'Type=Application\n'
        printf 'Name=SpoSync\n'
        printf 'Comment=SpoTUI helper (visualizer audio, terminal lyrics)\n'
        printf 'Exec="%s" --headless\n' "$exec_path"
        printf 'Terminal=false\n'
        printf 'NoDisplay=true\n'
        printf 'X-GNOME-Autostart-enabled=true\n'
    } > "$SPOSYNC_AUTOSTART.tmp" && mv -f "$SPOSYNC_AUTOSTART.tmp" "$SPOSYNC_AUTOSTART"
}

# Starts the helper detached, in its own session, with / as working directory
# so it never locks the folder the installer was started from.
sposync_start() {
    if need_cmd setsid && setsid -f true >/dev/null 2>&1; then
        (cd / && setsid -f "$SPOSYNC_BIN" --headless >/dev/null 2>&1 </dev/null)
    else
        # The helper is started inside a subshell that exits at once, so it is not this script's child.
        (cd / && nohup "$SPOSYNC_BIN" --headless >/dev/null 2>&1 </dev/null &)
    fi
}

sposync_log_lines() {
    if [ -f "$SPOSYNC_STATE/sposync.log" ]; then
        wc -l < "$SPOSYNC_STATE/sposync.log" | tr -d ' '
    else
        echo 0
    fi
}

sposync_log_path() { printf '%s' "$SPOSYNC_STATE/sposync.log"; }

# The helper's log lines written after the start. $1 = line count before the
# start. A count that dropped means the log rotated: read the new file from its start.
sposync_log_new() {
    local before="${1:-0}" cur
    [ -f "$(sposync_log_path)" ] || return 0
    cur=$(sposync_log_lines)
    if [ "$cur" -lt "$before" ]; then before=0; fi
    tail -n +"$((before + 1))" "$(sposync_log_path)" 2>/dev/null
}

# Prints the reason when the new log lines name a known exit cause; returns 1
# when they do not. $1 = log line count before the start.
sposync_log_cause() {
    local new
    new=$(sposync_log_new "${1:-0}")
    if printf '%s\n' "$new" | grep -q 'in use by another program'; then
        echo "SpoSync reports that port ${SPOSYNC_PORT} is used by another program. It will start at the next login once the port is free."
    elif printf '%s\n' "$new" | grep -q "held by another user's SpoSync"; then
        echo "SpoSync reports that port ${SPOSYNC_PORT} is held by another user's SpoSync. Only one signed-in user can run SpoSync (see README > SpoSync > Shared computers)."
    elif printf '%s\n' "$new" | grep -q 'does not answer'; then
        echo "SpoSync reports that port ${SPOSYNC_PORT} is busy and its holder does not answer. It will start at the next login once the port is free."
    elif printf '%s\n' "$new" | grep -q 'cannot be bound'; then
        echo "SpoSync reports that port ${SPOSYNC_PORT} cannot be bound (reserved or blocked by the system). Choose a port outside the reserved ranges or free it."
    else
        return 1
    fi
}

# Waits up to 60 s (about 40 s without pgrep or ss). Sets SPOSYNC_STATUS and prints the
# outcome. $1 = log line count before the start.
sposync_verify() {
    local i ver owner before new missing cause gone
    before="${1:-0}"

    if [ "$SPOSYNC_HAVE_PGREP" -eq 1 ] && [ "$SPOSYNC_HAVE_SS" -eq 1 ]; then
        gone=0
        for ((i = 0; i < 120; i++)); do
            if sposync_owns_port; then
                ver=$("$SPOSYNC_BIN" --version 2>/dev/null | head -n 1)
                echo "  ${GREEN_ANSI}${CHECK_MARK}${RESET}  SpoSync ${ver} is running in the background (localhost:${SPOSYNC_PORT})."
                SPOSYNC_STATUS="running"
                return 0
            fi
            # A helper that is gone after 2 s has exited (port held elsewhere, or a crash).
            if [ "$i" -ge 4 ] && ! sposync_running; then gone=1; break; fi
            sleep 0.5
        done
        # Alive after the wait, not listening: a slow start (large unpack, busy disk), not a failure.
        if [ "$gone" -eq 0 ] && sposync_running; then
            SPOSYNC_STATUS="starting"
            echo "  ${RED_ANSI}!${RESET}  SpoSync is still starting. Check later with: ss -ltnp 'sport = :${SPOSYNC_PORT}'"
            return 0
        fi
        SPOSYNC_STATUS="stopped"
        if sposync_port_listening; then
            owner=$(ss -Hltnp "sport = :$SPOSYNC_PORT" 2>/dev/null | grep -o 'users:((.*))' | head -n 1)
            if [ -n "$owner" ]; then
                echo "  ${RED_ANSI}!${RESET}  Port ${SPOSYNC_PORT} is used by another program: ${owner}. SpoSync will start at the next login once it is free."
            else
                echo "  ${RED_ANSI}!${RESET}  Port ${SPOSYNC_PORT} is used by another program. ss shows no owner, so it may belong to another user. SpoSync will start at the next login once it is free."
            fi
        elif cause=$(sposync_log_cause "$before"); then
            echo "  ${RED_ANSI}!${RESET}  ${cause}"
        else
            echo "  ${RED_ANSI}!${RESET}  SpoSync did not start. See $(sposync_log_path)"
        fi
        return 0
    fi

    # No usable pgrep or ss: take the helper's own word from its log, and say so.
    # 40 s: the helper retries a busy port for 10 s, and a one-file build needs time to unpack.
    if [ "$SPOSYNC_HAVE_PGREP" -ne 1 ]; then missing="pgrep"; else missing="ss"; fi
    for ((i = 0; i < 80; i++)); do
        if cause=$(sposync_log_cause "$before"); then
            SPOSYNC_STATUS="stopped"
            echo "  ${RED_ANSI}!${RESET}  ${cause}"
            return 0
        fi
        new=$(sposync_log_new "$before")
        if printf '%s\n' "$new" | grep -q 'listening on'; then
            ver=$("$SPOSYNC_BIN" --version 2>/dev/null | head -n 1)
            echo "  ${GREEN_ANSI}${CHECK_MARK}${RESET}  SpoSync ${ver} started and reports it is listening on localhost:${SPOSYNC_PORT}."
            sposync_note "Not double-checked: this system has no usable ${missing}."
            SPOSYNC_STATUS="running"
            return 0
        fi
        sleep 0.5
    done
    SPOSYNC_STATUS="stopped"
    echo "  ${RED_ANSI}!${RESET}  SpoSync did not report a start within 40 s. See $(sposync_log_path)"
    sposync_note "Could not check further: this system has no usable ${missing}."
    return 0
}

sposync_main() {
    local want=0 problem="" log_before=0

    if [ "$SPOSYNC_CHOICE" = "no" ]; then return 0; fi
    # Do not ask about an optional extra after the main install failed.
    if [ "$SPOSYNC_CHOICE" = "ask" ] && [ "$RUN_CLI" -eq 1 ] && [ "$OK" -ne 1 ]; then return 0; fi

    # Things that make SpoSync impossible: checked before asking and before anything is installed.
    if [ "$(uname -s)" != "Linux" ]; then
        problem="SpoSync is only supported on Linux here (this system: $(uname -s))."
    elif [ "$SPOSYNC_UID" = "0" ]; then
        problem="SpoSync is a per-user helper. Re-run the installer as your normal user, without sudo."
    elif [ "$SPOSYNC_PATHS_OK" -ne 1 ]; then
        problem="HOME is not set and no absolute XDG_DATA_HOME, XDG_STATE_HOME and XDG_CONFIG_HOME are set, so there is no place to install SpoSync."
    elif ! sposync_path_ok; then
        problem="The install path contains a character that cannot be written safely in a .desktop Exec line (quote, backslash, backtick, dollar sign or newline): $SPOSYNC_BIN"
    fi
    if [ -n "$problem" ]; then
        if [ "$SPOSYNC_CHOICE" = "yes" ]; then
            echo ""
            sposync_fail "$problem"
            SPOSYNC_STATUS="failed"
        else
            echo ""
            sposync_note "SpoSync not offered: $problem"
        fi
        return 0
    fi

    case "$SPOSYNC_CHOICE" in
        yes) want=1 ;;
        ask)
            echo ""
            echo "  SpoSync (optional) feeds SpoTUI's visualizer with live audio and mirrors lyrics in a terminal."
            echo "  It starts at login, runs in the background, and only accepts connections from this computer."
            if sposync_ask "  Install SpoSync? [y/N] "; then want=1; fi
            ;;
    esac
    if [ "$want" -ne 1 ]; then return 0; fi

    echo ""
    if ! need_cmd sha256sum || ! need_cmd install; then
        sposync_fail "SpoSync needs sha256sum and install (coreutils)."
        SPOSYNC_STATUS="failed"
        return 0
    fi

    sposync_resolve_source || return 0

    if invoke_step "Checking SpoSync binary" sposync_stage; then :; else SPOSYNC_STATUS="failed"; fi
    rm -f "$STEP_FILE"
    [ "$SPOSYNC_STATUS" = "failed" ] && return 0

    if invoke_step "Installing SpoSync" sposync_swap; then :; else SPOSYNC_STATUS="failed"; fi
    rm -f "$STEP_FILE"
    [ "$SPOSYNC_STATUS" = "failed" ] && return 0

    if invoke_step "Registering SpoSync autostart" sposync_write_autostart; then :; else SPOSYNC_STATUS="failed"; fi
    rm -f "$STEP_FILE"
    [ "$SPOSYNC_STATUS" = "failed" ] && return 0
    if [ -z "${XDG_CURRENT_DESKTOP:-}" ]; then
        echo "  ${GRAY_ANSI}   Your session may not run XDG autostart entries (e.g. i3/sway). Add: exec \"$SPOSYNC_BIN\" --headless${RESET}"
    fi

    log_before=$(sposync_log_lines)
    sposync_start
    sposync_verify "$log_before"
    return 0
}

sposync_main

echo ""
echo "${ORANGE_DARK}  =============================================================${RESET}"
echo ""

if [ "$RUN_CLI" -eq 1 ]; then
    if [ "$OK" -eq 1 ]; then
        echo "  ${GREEN_ANSI}${CHECK_MARK}  SpoTUI ${LATEST_TAG} installed successfully.${RESET}"
        echo "  ${GRAY_ANSI}   Open a new terminal and run: spotui${RESET}"
    else
        echo "  ${RED_ANSI}${CROSS_MARK}  Installation finished with errors. See above.${RESET}"
    fi
fi

if [ "$SPOSYNC_CHOICE" != "no" ]; then
    case "$SPOSYNC_STATUS" in
        running) echo "  ${GREEN_ANSI}${CHECK_MARK}  SpoSync: installed and running${RESET}" ;;
        starting) echo "  ${RED_ANSI}!${RESET}  SpoSync: installed, not running yet (see above)" ;;
        stopped) echo "  ${RED_ANSI}!${RESET}  SpoSync: installed, not running (see above)" ;;
        failed)  echo "  ${RED_ANSI}${CROSS_MARK}  SpoSync: failed${RESET}" ;;
        *)       echo "  ${GRAY_ANSI}   SpoSync: skipped${RESET}" ;;
    esac
fi

echo ""

if [ "$RUN_CLI" -eq 1 ] && [ "$OK" -ne 1 ]; then exit 1; fi
# --sposync-only: success means SpoSync is installed (running, still starting or not running); skipped and failed are not.
if [ "$SPOSYNC_ONLY" -eq 1 ]; then
    case "$SPOSYNC_STATUS" in
        running|starting|stopped) ;;
        *) exit 1 ;;
    esac
fi
exit 0