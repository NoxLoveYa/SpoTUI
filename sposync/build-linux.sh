#!/usr/bin/env bash
# Builds sposync/bin/sposync-linux-<arch> in a private venv (sposync/venv/linux-<arch>).
# Needs Python 3.12 to 3.15: the pinned numpy, pillow and websockets need 3.12 or newer,
# and PyInstaller 6.22.3 supports Python before 3.16.
# Set PYTHON to pick the interpreter; otherwise python3.15, python3.14, python3.13,
# python3.12 and python3 are tried in that order and the first one in range is used.
# Exit code 0 = built, 1 = failed. The last printed line is the SHA256.

set -euo pipefail

# Whatever makes the script stop (set -e, a signal, fail), the exit code is 1.
trap '[ "$?" -eq 0 ] || exit 1' EXIT

CDPATH='' cd -- "$(dirname "${BASH_SOURCE[0]}")/.."

fail() {
    printf 'build-linux: %s\n' "$1" >&2
    exit 1
}

python_ok() {
    "$1" -c 'import sys; sys.exit(0 if (3, 12) <= sys.version_info[:2] < (3, 16) else 1)' >/dev/null 2>&1
}

if [ -z "${PYTHON:-}" ]; then
    for cand in python3.15 python3.14 python3.13 python3.12 python3; do
        if command -v "$cand" >/dev/null 2>&1 && python_ok "$cand"; then
            PYTHON="$cand"
            break
        fi
    done
    PYTHON="${PYTHON:-python3}"
fi

case "$(uname -m)" in
    x86_64|amd64)  ARCH=amd64 ;;
    aarch64|arm64) ARCH=arm64 ;;
    *) fail "unsupported CPU architecture: $(uname -m)" ;;
esac

command -v "$PYTHON" >/dev/null 2>&1 || fail "$PYTHON not found; install python3 (3.12 to 3.15)"
python_ok "$PYTHON" || fail "Python 3.12 to 3.15 is required"
# Debian/Ubuntu split ensurepip into python3-venv, so importing it is the real test.
"$PYTHON" -c 'import venv, ensurepip' >/dev/null 2>&1 \
    || fail "the venv module is incomplete; install python3-venv (or python3.X-venv for the version used) on Debian/Ubuntu, or your distro's equivalent"

# Own sub-directory: sposync/venv may hold a Windows venv when the tree is shared.
VENV="sposync/venv/linux-$ARCH"
VPY="$VENV/bin/python"
NAME="sposync-linux-$ARCH"

# A missing, broken or out-of-range (not 3.12 to 3.15) venv is recreated.
if [ ! -x "$VPY" ] || ! python_ok "$VPY"; then
    "$PYTHON" -m venv --clear "$VENV"
fi

# Wheels only: no package may run a build script at install time.
"$VPY" -m pip install --disable-pip-version-check --only-binary=:all: -r sposync/requirements-build.txt

"$VPY" -m PyInstaller --noconfirm --clean --onefile --name "$NAME" \
    --specpath build --workpath build --distpath dist \
    --collect-all textual --collect-all rich --collect-all soundcard \
    --collect-all numpy --collect-all websockets --collect-all pystray --collect-all PIL \
    "$PWD/sposync/app.py"

mkdir -p sposync/bin
mv -f "dist/$NAME" "sposync/bin/$NAME"
chmod +x "sposync/bin/$NAME"

echo "built sposync/bin/$NAME"
sha256sum "sposync/bin/$NAME" | cut -d ' ' -f 1
