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
    printf '%s                          Uninstaller%s\n' "$ORANGE_MID" "$RESET"
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

SPOSYNC_ONLY=0
for arg in "$@"; do
    case "$arg" in
        --sposync-only) SPOSYNC_ONLY=1 ;;
        -h|--help)
            echo "Usage: uninstall.sh [--sposync-only]"
            echo ""
            echo "  --sposync-only   remove only the SpoSync helper, keep the spotui CLI"
            echo ""
            echo "SpoSync (autostart entry, files, log, running helper) is always removed."
            exit 0
            ;;
        *)
            echo "uninstall.sh: unknown argument: $arg" >&2
            echo "Usage: uninstall.sh [--sposync-only]" >&2
            exit 2
            ;;
    esac
done

show_header

# With neither XDG_DATA_HOME nor HOME there is nothing to look for (CLI part is skipped).
XDG_HOME="${XDG_DATA_HOME:-${HOME:+$HOME/.local/share}}"
TARGET_DIRS=()
if [ -n "$XDG_HOME" ]; then TARGET_DIRS=("${XDG_HOME}/spotui" "${XDG_HOME}/spotui-cli"); fi

clean_user_path() {
    local rc tmp pat
    [ -n "${HOME:-}" ] || return 0
    for rc in "$HOME/.bashrc" "$HOME/.profile" "$HOME/.zshrc"; do
        [ -f "$rc" ] || continue
        tmp=$(mktemp)
        cp "$rc" "$tmp"
        for pat in '# Added by SpoTUI installer' "${TARGET_DIRS[@]}"; do
            grep -vF -- "$pat" "$tmp" > "$tmp.tmp" 2>/dev/null || true
            mv "$tmp.tmp" "$tmp"
        done
        mv "$tmp" "$rc"
        rm -f "$tmp.tmp"
    done
}

filter_path() {
    local path_str="$1"
    local keep="" entry dir
    while IFS= read -r entry; do
        [ -z "$entry" ] && continue
        entry="${entry%/}"
        for dir in "${TARGET_DIRS[@]}"; do
            if [ "$entry" = "${dir%/}" ]; then
                continue 2
            fi
        done
        keep="${keep:+$keep:}$entry"
    done <<< "$(printf '%s' "$path_str" | tr ':' '\n')"
    printf '%s' "$keep"
}

OK=1

if [ "$SPOSYNC_ONLY" -eq 0 ] && [ "${#TARGET_DIRS[@]}" -eq 0 ]; then
    echo "  ${GRAY_ANSI}   Neither XDG_DATA_HOME nor HOME is set: the spotui CLI part is skipped.${RESET}"
fi

if [ "$SPOSYNC_ONLY" -eq 0 ] && [ "${#TARGET_DIRS[@]}" -gt 0 ]; then
    for dir in "${TARGET_DIRS[@]}"; do
        if invoke_step "Removing $dir" bash -c "rm -rf -- '$dir'"; then
            :
        else
            OK=0
        fi
        rm -f "$STEP_FILE"
    done

    if invoke_step "Cleaning user PATH" clean_user_path; then
        :
    else
        OK=0
    fi
    rm -f "$STEP_FILE"

    PATH=$(filter_path "$PATH")
fi

# ---------------------------------------------------------------------------
# SpoSync: always removed (it is not part of the CLI directories above)
# ---------------------------------------------------------------------------

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

need_cmd() {
    command -v "$1" >/dev/null 2>&1
}

# Escape a literal path for an extended regex (pkill/pgrep -f).
sposync_regex() {
    printf '%s' "$1" | sed 's#[][\.*^$+?(){}|]#\\&#g'
}

# pgrep must understand -u/-f (procps; BusyBox does not). Checked once.
SPOSYNC_HAVE_PGREP=0
if need_cmd pgrep && need_cmd pkill && [ -n "$SPOSYNC_UID" ]; then
    pgrep -u "$SPOSYNC_UID" -f -- '^spotui-sposync-probe-never-matches$' >/dev/null 2>&1
    if [ "$?" -le 1 ]; then SPOSYNC_HAVE_PGREP=1; fi
fi

# True while a process of this user runs the installed binary: the full command
# line must start with its exact path, so nothing else can match.
sposync_running() {
    local re
    [ "$SPOSYNC_HAVE_PGREP" -eq 1 ] || return 1
    re="^$(sposync_regex "$SPOSYNC_BIN")( |\$)"
    pgrep -u "$SPOSYNC_UID" -f -- "$re" >/dev/null 2>&1
}

# Ask the helper to exit, then SIGTERM, then SIGKILL (installed path, own user only).
stop_sposync() {
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

# Remove the autostart entry only if it is ours: it must hold exactly the Exec
# line the installer writes (a literal % is stored as %%).
remove_sposync_autostart() {
    [ -e "$SPOSYNC_AUTOSTART" ] || [ -L "$SPOSYNC_AUTOSTART" ] || return 0
    if grep -qxF -- "Exec=\"${SPOSYNC_BIN//%/%%}\" --headless" "$SPOSYNC_AUTOSTART" 2>/dev/null; then
        rm -f -- "$SPOSYNC_AUTOSTART"
    else
        echo "Left $SPOSYNC_AUTOSTART in place: it does not start $SPOSYNC_BIN." >&2
        return 1
    fi
}

remove_sposync_files() {
    rm -rf -- "${SPOSYNC_DIR:?}" "${SPOSYNC_STATE:?}"
}

# Leftovers of an interrupted SpoSync install: only folders the installer
# creates (mktemp spotui-sposync-XXXXXX, six characters), owned by this user.
remove_sposync_tmp() {
    local base p
    for base in "${TMPDIR:-/tmp}" /tmp; do
        [ -d "$base" ] || continue
        while IFS= read -r p; do
            [ -n "$p" ] && rm -rf -- "${p:?}"
        done < <(find "$base" -maxdepth 1 -type d -name 'spotui-sposync-??????' -user "$SPOSYNC_UID" 2>/dev/null)
    done
    return 0
}

SPOSYNC_LEFT=""
if [ "$SPOSYNC_PATHS_OK" -ne 1 ]; then
    echo "  ${GRAY_ANSI}   SpoSync: HOME is not set and no absolute XDG_*_HOME is set, so there is nothing to look for.${RESET}"
else
    if [ "$SPOSYNC_UID" = "0" ]; then
        if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
            echo "  ${RED_ANSI}!${RESET}  Running under sudo: this removes root's SpoSync only (HOME=${HOME:-unset}). Run it as ${SUDO_USER} without sudo; a running helper of ${SUDO_USER} is not stopped."
        else
            echo "  ${RED_ANSI}!${RESET}  Running as root: this removes root's SpoSync only (HOME=${HOME:-unset}). Run it as the user that installed SpoSync."
        fi
    fi
    if [ "$SPOSYNC_HAVE_PGREP" -ne 1 ]; then
        echo "  ${GRAY_ANSI}   pgrep/pkill are missing or too limited here: a helper that ignores --quit is not stopped.${RESET}"
    fi

    if invoke_step "Stopping SpoSync" stop_sposync; then
        :
    else
        OK=0
    fi
    rm -f "$STEP_FILE"

    if invoke_step "Removing SpoSync autostart entry" remove_sposync_autostart; then
        :
    else
        OK=0
    fi
    rm -f "$STEP_FILE"

    if invoke_step "Removing SpoSync files" remove_sposync_files; then
        :
    else
        OK=0
    fi
    rm -f "$STEP_FILE"

    if invoke_step "Removing SpoSync temporary files" remove_sposync_tmp; then
        :
    else
        OK=0
    fi
    rm -f "$STEP_FILE"

    # ss must understand -H (no header line); without it nothing is claimed about the port.
    if need_cmd ss && ss -Hltn >/dev/null 2>&1 && [ -n "$(ss -Hltn "sport = :$SPOSYNC_PORT" 2>/dev/null)" ]; then
        SPOSYNC_LEFT=$(ss -Hltnp "sport = :$SPOSYNC_PORT" 2>/dev/null | grep -o 'users:((.*))' | head -n 1)
        SPOSYNC_LEFT="${SPOSYNC_LEFT:-another program}"
    fi
fi

echo ""
echo "${ORANGE_DARK}  =============================================================${RESET}"
echo ""

if [ -n "$SPOSYNC_LEFT" ]; then
    echo "  ${RED_ANSI}!${RESET}  Port ${SPOSYNC_PORT} is still in use by ${SPOSYNC_LEFT}."
fi

if [ "$OK" -eq 1 ]; then
    if [ "$SPOSYNC_ONLY" -eq 1 ]; then
        echo "  ${GREEN_ANSI}${CHECK_MARK}  SpoSync has been removed.${RESET}"
    else
        echo "  ${GREEN_ANSI}${CHECK_MARK}  SpoTUI has been uninstalled.${RESET}"
        echo "  ${GRAY_ANSI}   Restart your terminal for PATH changes to take full effect.${RESET}"
    fi
else
    echo "  ${RED_ANSI}${CROSS_MARK}  Uninstall finished with errors. See above.${RESET}"
fi

echo ""

if [ "$OK" -ne 1 ]; then exit 1; fi
exit 0
