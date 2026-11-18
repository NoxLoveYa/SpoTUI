#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import errno
import functools
import hashlib
import http
import ipaddress
import json
import logging
import logging.handlers
import math
import os
import pathlib
import re
import signal
import socket
import subprocess
import sys
import threading
import time
import traceback

from rich.panel import Panel
from rich.text import Text
from textual.app import App, ComposeResult
from textual.containers import Horizontal, Vertical
from textual.widgets import Input, Static
from websockets.asyncio.client import connect
from websockets.asyncio.server import serve
from websockets.exceptions import ConnectionClosed

__version__ = "1.1.1"

# The theme runs inside Spotify's page, whose Origin is fixed. Never widen this.
THEME_ORIGINS = frozenset({"https://xpui.app.spotify.com"})
MAX_MESSAGE = 4 * 1024 * 1024
CONTROL_TIMEOUT = 2.0
# Windows needs about 2 s to refuse a loopback connect, so the connect budget is longer.
CONNECT_TIMEOUT = 5.0
CONTROL_MAX_BYTES = 4096
EXIT_OK, EXIT_NOT_RUNNING, EXIT_PORT_BUSY, EXIT_FATAL = 0, 1, 2, 3
LOG_MAX_BYTES = 256 * 1024
MAX_REJECTED_ORIGINS = 50
# One client that stops reading must not delay the others.
SEND_TIMEOUT = 1.0
SPECTRUM_SKIP_BUFFER = 64 * 1024
WRITE_LIMIT = (256 * 1024, 64 * 1024)  # (high, low): above the spectrum skip level
SLOW_DROP_SECONDS = 10.0
CLOSE_TIMEOUT = 2.0
# Bad-message logging: lines per connection, then silence.
MAX_BAD_LOGS = 5
# Per-connection noise (connected, disconnected, bad message, rejected origin) shares one budget for
# the whole relay: a client that reconnects in a loop must not roll the log file.
NOISE_LINES = 60
NOISE_WINDOW = 600.0
# Control "show" lines and stalled-client lines: one per this many seconds, the rest counted.
DROP_LOG_INTERVAL = 10.0
SHOW_LOG_INTERVAL = 10.0
# A "show" for a window that is already up re-raises it at most this often.
SHOW_DEBOUNCE = 1.0
# A refused bind may be a start-up race or a slow probe: retry this long before giving up.
BIND_RETRY_SECONDS = 10.0

# Limits for text and lists that come from the theme.
MAX_MS = 24 * 3600 * 1000
LIMIT_TITLE = 300
LIMIT_URI = 200
LIMIT_LYRIC = 500
LIMIT_QUERY = 200
LIMIT_TYPE = 40
LIMIT_CHARS = 16
MAX_PLAYLISTS = 2000
MAX_SONGS = 10000
MAX_RESULTS = 200
MAX_LYRIC_LINES = 5000

SHRUG = r"¯\_(ツ)_/¯"
SPIN = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"
DEFAULT = {
    "active": "#ff8c42",
    "inactive": "#777777",
    "near": "#b3b3b3",
    "accent": "#ff8c42",
    "panel_bg": "#000000",
    "panel_border": "#ff8c42",
    "panel_text": "#ff8c42",
    "bar_bg": "#000000",
    "bar_text": "#ff8c42",
    "visualizer": "#ff8c42",
}

BARS = 48
MAX_BARS = 256
DEFAULT_SMOOTH = 45
DEFAULT_NORM = "adaptive"
PEAK_DECAY = 0.99
RATE = 44100
CHUNK = 2048


def _smooth_alpha(value):
    v = max(1, min(100, int(value)))
    return 0.02 + ((100 - v) / 99) * 0.93


def _spectrum(samples, bars=BARS):
    import numpy as np
    x = np.asarray(samples, dtype=np.float32).reshape(-1)
    if x.size < CHUNK:
        return [0.0] * bars
    x = x[: x.size - x.size % CHUNK]
    x = x[-CHUNK:]
    mag = np.abs(np.fft.rfft(x * np.hanning(CHUNK)))
    freqs = np.fft.rfftfreq(CHUNK, 1.0 / RATE)
    out = np.interp(np.geomspace(40, 16000, bars), freqs, mag)
    return [float(v) for v in out]


def _normalize(raw, mode, peaks):
    if mode == "global":
        peak = max(raw) if raw else 0.0
        if peak < 1e-4:
            return [0.0] * len(raw), peaks
        return [min(1.0, (v / peak) ** 0.55) for v in raw], peaks
    for i, v in enumerate(raw):
        peaks[i] = max(v, peaks[i] * PEAK_DECAY)
    return [min(1.0, (v / peaks[i]) ** 0.55) if peaks[i] > 1e-6 else 0.0 for i, v in enumerate(raw)], peaks


def data_dir():
    if os.name == "nt":
        base = os.environ.get("LOCALAPPDATA") or os.path.join(os.path.expanduser("~"), "AppData", "Local")
        return pathlib.Path(base) / "SpoTUI" / "sposync"
    base = os.environ.get("XDG_STATE_HOME") or os.path.join(os.path.expanduser("~"), ".local", "state")
    return pathlib.Path(base) / "sposync"


def make_file_handler(path):
    # backslashreplace: a lone surrogate in a logged string must not raise inside the handler.
    handler = logging.handlers.RotatingFileHandler(
        path, maxBytes=LOG_MAX_BYTES, backupCount=1, encoding="utf-8", errors="backslashreplace"
    )
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    return handler


def setup_logging():
    """File log only: a hidden or autostarted helper has no console to read."""
    log = logging.getLogger("sposync")
    if log.handlers:
        return log
    log.setLevel(logging.INFO)
    log.propagate = False
    logging.raiseExceptions = False
    try:
        path = data_dir()
        path.mkdir(parents=True, exist_ok=True)
        handler = make_file_handler(path / "sposync.log")
    except Exception:
        handler = logging.NullHandler()
    log.addHandler(handler)
    # websockets logs through this child; keep only its warnings and errors.
    logging.getLogger("sposync.ws").setLevel(logging.WARNING)

    def excepthook(exc_type, exc, tb):
        if issubclass(exc_type, KeyboardInterrupt):
            sys.__excepthook__(exc_type, exc, tb)
            return
        log.critical("unhandled exception", exc_info=(exc_type, exc, tb))

    def thread_hook(args):
        excepthook(args.exc_type, args.exc_value, args.exc_traceback)

    sys.excepthook = excepthook
    threading.excepthook = thread_hook
    return log


class Capture:
    """Loopback audio capture. One long-lived worker parks on an Event, so
    nothing runs (and no audio device is held) until a client wants the bars."""

    def __init__(self, log):
        self.log = log
        self.retry_missing = 5.0
        self.retry_error = 2.0
        self._want = threading.Event()
        self._stop = threading.Event()
        self._thread = None
        self._lock = threading.Lock()

    @property
    def wanted(self):
        return self._want.is_set()

    def set_wanted(self, on):
        if on:
            with self._lock:
                if self._thread is None and not self._stop.is_set():
                    self._thread = threading.Thread(target=self._run, name="sposync-capture", daemon=True)
                    self._thread.start()
            self._want.set()
        else:
            self._want.clear()

    def stop(self):
        self._stop.set()
        self._want.set()

    @staticmethod
    def _loopback(sc):
        try:
            spk = sc.default_speaker()
            return sc.get_microphone(spk.name, include_loopback=True)
        except Exception:
            try:
                return next(m for m in sc.all_microphones(include_loopback=True) if getattr(m, "isloopback", False))
            except Exception:
                return None

    @staticmethod
    def _flatten():
        S.spectrum = [0.0] * S.bars
        S.peaks = [0.0] * S.bars

    def _run(self):
        try:
            import soundcard as sc
        except Exception as e:
            # ImportError, or OSError when the platform audio library is missing.
            self.log.warning("audio capture unavailable: %s", e)
            return
        missing = False
        last_error = None
        while not self._stop.is_set():
            self._want.wait()
            if self._stop.is_set():
                return
            mic = self._loopback(sc)
            if mic is None:
                if not missing:
                    self.log.warning("no loopback audio device")
                    missing = True
                self._stop.wait(self.retry_missing)
                continue
            missing = False
            started = False
            try:
                with mic.recorder(samplerate=RATE, channels=1, blocksize=CHUNK) as rec:
                    while self._want.is_set() and not self._stop.is_set():
                        data = rec.record(numframes=CHUNK)
                        if not started:
                            started = True
                            last_error = None
                            self.log.info("capture started")
                        bars = S.bars
                        raw = _spectrum(data, bars)
                        peaks = S.peaks if len(S.peaks) == bars else [0.0] * bars
                        nxt, peaks = _normalize(raw, S.norm, peaks)
                        S.peaks = peaks
                        prev = S.spectrum if len(S.spectrum) == bars else [0.0] * bars
                        alpha = _smooth_alpha(S.smooth)
                        S.spectrum = [p + (n - p) * alpha for p, n in zip(prev, nxt)]
            except Exception as e:
                message = f"{type(e).__name__}: {e}"
                if message != last_error:
                    self.log.warning("capture error: %s", message)
                    last_error = message
                if started:
                    self.log.info("capture stopped")
                self._flatten()
                self._stop.wait(self.retry_error)
                continue
            if started:
                self.log.info("capture stopped")
            self._flatten()


# C0 (but tab and newline), DEL and C1 controls; ESC starts every terminal escape sequence.
# Bidi embeddings/overrides/isolates can reorder what the user reads.
# Invisible and format characters only hide or misalign text (zero width, soft hyphen, BOM,
# interlinear annotations, tags). U+200D (emoji ZWJ sequences), U+200C (ZWNJ: Persian and several
# Indic scripts need it) and variation selectors stay. The tag characters go too: a subdivision
# flag (England, Scotland) then draws as a plain black flag.
# Lone surrogates cannot be encoded: one on its way to the console kills textual's writer thread.
_STRIP = re.compile(
    "["
    "\x00-\x08\x0b-\x1f\x7f-\x9f"
    "­؜᠎​‎‏"
    "‪-‮⁠-⁤⁦-⁩"
    "﻿￹-￻"
    "\U000e0000-\U000e007f"
    "\ud800-\udfff"
    "]"
)
_LINE_BREAKS = re.compile("[\t\n  ]")
_HEX = re.compile(r"#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})")


def clean(value, limit=LIMIT_TITLE, multiline=False):
    """Text from outside, made safe to store and draw: coerced to str, terminal
    control characters removed, capped. Single-line by default."""
    text = value if isinstance(value, str) else ("" if value is None else str(value))
    text = _STRIP.sub("", text[: limit * 4])
    if not multiline:
        text = _LINE_BREAKS.sub(" ", text)
    return text[:limit]


def num(value, lo, hi):
    """A finite int/float (never a bool) clamped to [lo, hi], else None."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    try:
        v = float(value)
    except OverflowError:
        return None
    if not math.isfinite(v):
        return None
    return max(lo, min(hi, v))


def hex_color(value):
    """#rgb or #rrggbb as '#rrggbb' (the form rich and textual both accept), else None."""
    if not isinstance(value, str):
        return None
    v = value.strip()
    if not _HEX.fullmatch(v):
        return None
    h = v[1:].lower()
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return "#" + h


def hx(value, fallback):
    return hex_color(value) or fallback


def fmt(ms):
    try:
        s = max(0, int(ms // 1000))
    except (TypeError, ValueError, OverflowError):
        s = 0
    return f"{s // 60:02d}:{s % 60:02d}"


def _windows_sid():
    import ctypes
    from ctypes import wintypes
    advapi32 = ctypes.WinDLL("advapi32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.GetCurrentProcess.restype = wintypes.HANDLE
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel32.LocalFree.argtypes = [ctypes.c_void_p]
    advapi32.OpenProcessToken.argtypes = [wintypes.HANDLE, wintypes.DWORD, ctypes.POINTER(wintypes.HANDLE)]
    advapi32.OpenProcessToken.restype = wintypes.BOOL
    advapi32.GetTokenInformation.argtypes = [
        wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD)
    ]
    advapi32.GetTokenInformation.restype = wintypes.BOOL
    advapi32.ConvertSidToStringSidW.argtypes = [ctypes.c_void_p, ctypes.POINTER(wintypes.LPWSTR)]
    advapi32.ConvertSidToStringSidW.restype = wintypes.BOOL
    token = wintypes.HANDLE()
    if not advapi32.OpenProcessToken(kernel32.GetCurrentProcess(), 0x0008, ctypes.byref(token)):  # TOKEN_QUERY
        raise OSError("OpenProcessToken")
    try:
        size = wintypes.DWORD(0)
        advapi32.GetTokenInformation(token, 1, None, 0, ctypes.byref(size))  # TokenUser
        buf = ctypes.create_string_buffer(size.value)
        if not advapi32.GetTokenInformation(token, 1, buf, size, ctypes.byref(size)):
            raise OSError("GetTokenInformation")
        sid = ctypes.c_void_p.from_buffer(buf).value  # TOKEN_USER starts with the SID pointer
        out = wintypes.LPWSTR()
        if not advapi32.ConvertSidToStringSidW(sid, ctypes.byref(out)):
            raise OSError("ConvertSidToStringSid")
        try:
            return out.value
        finally:
            kernel32.LocalFree(ctypes.cast(out, ctypes.c_void_p))
    finally:
        kernel32.CloseHandle(token)


@functools.lru_cache(maxsize=1)
def owner_id():
    """Who runs this helper: a short digest of the user identity, never the name.
    Two users signed in at once share loopback, so a helper must tell them apart."""
    ident = None
    try:
        if os.name == "nt":
            ident = _windows_sid()
        else:
            ident = f"uid:{os.getuid()}"
    except Exception:
        pass
    if not ident:
        ident = f"{os.environ.get('USERDOMAIN', '')}\\{os.environ.get('USERNAME') or os.environ.get('USER') or ''}"
    return hashlib.sha256(("sposync:" + ident).encode("utf-8", "replace")).hexdigest()[:16]


def _console_hwnd():
    try:
        import ctypes
        return ctypes.windll.kernel32.GetConsoleWindow()
    except Exception:
        return None


def _hide_console():
    hwnd = _console_hwnd()
    if not hwnd:
        return False
    try:
        import ctypes
        ctypes.windll.user32.ShowWindow(hwnd, 0)
        return True
    except Exception:
        return False


def _show_console():
    hwnd = _console_hwnd()
    if not hwnd or _console_is_pseudo():
        return False
    try:
        import ctypes
        ctypes.windll.user32.ShowWindow(hwnd, 5)
        ctypes.windll.user32.SetForegroundWindow(hwnd)
        return True
    except Exception:
        return False


def _console_is_pseudo():
    """True for the hidden pseudo window of a terminal host (Windows Terminal,
    VS Code): showing it would pop up an empty console window."""
    hwnd = _console_hwnd()
    if not hwnd:
        return False
    try:
        import ctypes
        buf = ctypes.create_unicode_buffer(64)
        ctypes.windll.user32.GetClassNameW(hwnd, buf, 64)
        return buf.value == "PseudoConsoleWindow"
    except Exception:
        return False


def _console_visible():
    hwnd = _console_hwnd()
    if not hwnd:
        return False
    try:
        import ctypes
        return bool(ctypes.windll.user32.IsWindowVisible(hwnd))
    except Exception:
        return False


def _disable_console_close():
    """Remove the console's close button so the X cannot kill the helper."""
    hwnd = _console_hwnd()
    if not hwnd:
        return False
    try:
        import ctypes
        user32 = ctypes.windll.user32
        user32.DeleteMenu(user32.GetSystemMenu(hwnd, False), 0xF060, 0)
        return True
    except Exception:
        return False


def tray_capable():
    # Under a terminal host (Windows Terminal, VS Code) the console window is a
    # hidden pseudo window: it cannot be hidden or raised, so there is no tray mode.
    if os.name != "nt" or not _console_hwnd() or _console_is_pseudo():
        return False
    try:
        import pystray  # noqa: F401
    except Exception:
        return False
    return True


def _hex_rgb(h):
    v = (h or "").lstrip("#")
    if len(v) == 3:
        v = "".join(c * 2 for c in v)
    try:
        return tuple(int(v[i:i + 2], 16) for i in (0, 2, 4))
    except Exception:
        return (255, 140, 66)


def _tray_image(color="#ff8c42"):
    from PIL import Image, ImageDraw
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([6, 6, 58, 58], radius=16, fill=_hex_rgb(color) + (255,))
    return img


class Tray:
    def __init__(self, app):
        self.app = app
        self.icon = None
        self.color = None
        self.title = "SpoSync"
        self.error = ""

    def set_title(self, text):
        self.title = text
        if self.icon is not None:
            try:
                self.icon.title = text
            except Exception:
                pass

    def start(self, color):
        if self.icon is not None:
            self.update(color)
            return True
        try:
            import pystray
        except Exception as e:
            self.error = f"pystray unavailable: {type(e).__name__}"
            return False
        try:
            menu = pystray.Menu(
                pystray.MenuItem("Show", self._on_show, default=True),
                pystray.MenuItem("Quit", self._on_quit),
            )
            self.color = color
            icon = pystray.Icon("sposync", _tray_image(color), self.title, menu)
            icon.run_detached()
            self.icon = icon
            self.error = ""
            return True
        except Exception as e:
            self.error = f"{type(e).__name__}: {e}"
            return False

    def update(self, color):
        self.color = color
        if self.icon is not None:
            try:
                self.icon.icon = _tray_image(color)
            except Exception:
                pass

    def stop(self):
        if self.icon is not None:
            try:
                self.icon.stop()
            except Exception:
                pass
            self.icon = None

    def _on_show(self, icon=None, item=None):
        self._to_app(self.app.restore_from_tray)

    def _on_quit(self, icon=None, item=None):
        self._to_app(self.app.tray_quit)

    def _to_app(self, fn):
        # Runs on the tray thread. call_from_thread blocks until the app's loop answers, so a click
        # while the app exits must not be sent: if the loop dies between the check and the call, the
        # call would wait for ever. A short-lived daemon thread takes that wait, never the tray's.
        if not self.app.ui_alive():
            return None

        def call():
            try:
                self.app.call_from_thread(fn)
            except (Exception, asyncio.CancelledError) as e:
                # The app stopped between the check and the call (RuntimeError), the loop cancelled the
                # call in the exit race (asyncio.CancelledError is a BaseException; the concurrent.futures
                # one is an Exception), or fn failed: none of it is worth a traceback from
                # threading.excepthook.
                self.app.slog.debug("tray call %s ended: %s", getattr(fn, "__name__", "callback"), type(e).__name__)

        worker = threading.Thread(target=call, name="sposync-tray-call", daemon=True)
        worker.start()
        return worker


class State:
    def __init__(self):
        self.title = ""
        self.artist = ""
        self.duration_ms = 0
        self.position_ms = 0.0
        self.is_playing = False
        self.last_update = time.time()
        self.connected = False
        self.lines = []
        self.synced = False
        self.instrumental = False
        self.error = ""
        self.loading = False
        self.spin = 0
        self.colors = dict(DEFAULT)
        self.mode = "lyrics"
        self.playlists = []
        self.songs = []
        self.playlist_i = 0
        self.song_i = 0
        self.pane = "playlist"
        self.search_q = ""
        self.search_results = []
        self.search_i = 0
        self.search_focus = "input"
        self.progress_style = "classic-block"
        self.progress_chars = {"fg": "█", "bg": "░"}
        self.bars = BARS
        self.smooth = DEFAULT_SMOOTH
        self.norm = DEFAULT_NORM
        self.peaks = [0.0] * self.bars
        self.spectrum = [0.0] * self.bars
        self.confirm_close = False
        self.confirm_sel = 0

    def pos(self):
        if not self.is_playing:
            return self.position_ms
        return self.position_ms + max(0.0, (time.time() - self.last_update) * 1000)

    def colors_of(self):
        c = self.colors
        return (
            hx(c["active"], DEFAULT["active"]),
            hx(c["inactive"], DEFAULT["inactive"]),
            hx(c["near"], DEFAULT["near"]),
            hx(c["accent"], DEFAULT["accent"]),
            hx(c["panel_text"], DEFAULT["panel_text"]),
        )


S = State()


class Client:
    __slots__ = ("ws", "role", "viz", "bad", "slow_since")

    def __init__(self, ws, role):
        self.ws = ws
        self.role = role
        self.viz = False
        self.bad = 0  # malformed messages seen on this connection
        self.slow_since = 0.0  # since when its write buffer stays above the spectrum limit


class UiHooks:
    """What the relay needs from a UI. The defaults are the headless behaviour."""

    def on_mode(self, mode):
        pass

    def on_theme_presence(self, connected):
        pass

    def on_update(self):
        pass

    def show(self):
        return False

    def request_exit(self):
        pass

    def ui_state(self):
        # "headless" | "tray" (hidden) | "shown" (tray mode, visible) | "window"
        return "headless"


class Relay:
    """UI-free websocket relay between the theme, the capture worker and an optional UI."""

    def __init__(self, host, port, log, hooks=None, capture=None, clock=None):
        self.host = host
        self.port = port
        self.log = log
        self.hooks = hooks or UiHooks()
        self.capture = capture or Capture(log)
        self.clients = set()
        self._server = None
        self._closed = asyncio.Event()
        self._viz_event = asyncio.Event()
        self._tasks = set()
        self._present = False
        self._rejected = set()
        self._hook_errors = {}
        self._ws_log = logging.getLogger(log.name + ".ws")
        self._clock = clock or time.monotonic
        self._noise_start = None
        self._noise_count = 0
        self._noise_dropped = 0
        self._noise_noticed = False
        self._first_connect_logged = False
        self._show_logged = None  # when the last "control action=show" line was written
        self._drop_logged = None  # when the last "client dropped" line was written
        self._drop_skipped = 0  # drops since that line
        self._show_at = None  # when the hook last re-raised the window
        self._show_ok = True

    def _noise_window(self, now):
        """Start a new budget window once the last one ended; say what it suppressed."""
        if self._noise_start is not None and now - self._noise_start >= NOISE_WINDOW:
            if self._noise_dropped:
                self.log.info("log noise: %s lines suppressed in the last %s s", self._noise_dropped, int(NOISE_WINDOW))
            self._noise_start = None
        if self._noise_start is None:
            self._noise_start, self._noise_count, self._noise_dropped = now, 0, 0
            self._noise_noticed = False

    def _noise(self, level, msg, *args, always=False):
        """Log a per-connection line against the relay-wide budget. Past the budget the lines are
        dropped, with one notice, until the window ends. `always` lines are never dropped."""
        now = self._clock()
        self._noise_window(now)
        if self._noise_count >= NOISE_LINES and not always:
            self._noise_dropped += 1
            if not self._noise_noticed:
                self._noise_noticed = True
                self.log.info("log noise suppressed for %s s", max(1, math.ceil(NOISE_WINDOW - (now - self._noise_start))))
            return
        self._noise_count += 1
        self.log.log(level, msg, *args)

    def _log_dropped(self, c, reason):
        """A stalled client is rare and worth a line, but a burst of them must not flood the log:
        outside the budget (so it cannot be starved by it), one line per DROP_LOG_INTERVAL with a count."""
        now = self._clock()
        if self._drop_logged is not None and now - self._drop_logged < DROP_LOG_INTERVAL:
            self._drop_skipped += 1
            return
        text = f" (and {self._drop_skipped} more since the last line)" if self._drop_skipped else ""
        self._drop_logged, self._drop_skipped = now, 0
        self.log.info("client dropped role=%s reason=%s%s", c.role, reason, text)

    async def start(self):
        self._server = await serve(
            self.handler,
            self.host,
            self.port,
            process_request=self._process_request,
            max_size=MAX_MESSAGE,
            logger=self._ws_log,
            write_limit=WRITE_LIMIT,
            close_timeout=CLOSE_TIMEOUT,
            # A half-open connection (no request, or a partial one) must not hold close() for the
            # default 10 s: the abort in close() only covers clients that finished the handshake.
            open_timeout=CONTROL_TIMEOUT,
        )
        self.port = self._server.sockets[0].getsockname()[1]
        self.log.info("listening on host=%s port=%s", self.host, self.port)

    async def run(self):
        if self._server is None:
            await self.start()
        pump = asyncio.ensure_future(self.spectrum_pump())
        try:
            await self._closed.wait()
        finally:
            pump.cancel()
            await self.close()

    async def close(self):
        self._closed.set()
        # First and synchronous: textual cancels the relay worker without waiting for it, so a
        # close that is cut short while it waits for the clients must not leave the audio device open.
        self.capture.stop()
        server, self._server = self._server, None
        if server is not None:
            server.close()
            try:
                await asyncio.wait_for(server.wait_closed(), CLOSE_TIMEOUT + 1.0)
            except asyncio.TimeoutError:
                # A client that never answers the closing handshake must not hold the exit.
                for c in list(self.clients):
                    self._abort(c)
                await server.wait_closed()

    def _call(self, fn, *args, default=None):
        try:
            return fn(*args)
        except Exception as e:
            # Name and class only: the message may carry data from the theme.
            name = getattr(fn, "__name__", "hook")
            n = self._hook_errors.get(name, 0) + 1
            self._hook_errors[name] = n
            if n == 1:
                self.log.warning(
                    "ui hook %s failed: %s\n%s", name, type(e).__name__, "".join(traceback.format_tb(e.__traceback__))
                )
            elif n <= MAX_BAD_LOGS:
                self.log.warning("ui hook %s failed: %s", name, type(e).__name__)
            return default

    def _ui_visible(self):
        return self._call(self.hooks.ui_state, default="headless") in ("shown", "window")

    @staticmethod
    def _buffered(c):
        try:
            return c.ws.transport.get_write_buffer_size()
        except Exception:
            return 0

    @staticmethod
    def _abort(c):
        try:
            c.ws.transport.abort()
        except Exception:
            pass

    def _drop(self, c, reason):
        """Forget a client that cannot keep up, and cut its connection."""
        if c in self.clients:
            self.clients.discard(c)
            self._log_dropped(c, reason)
        self._abort(c)
        self._recompute()

    async def _send_one(self, c, payload, spectrum):
        if spectrum:
            # Never queue spectrum frames for a client that is behind: skip them.
            if self._buffered(c) > SPECTRUM_SKIP_BUFFER:
                now = time.monotonic()
                if not c.slow_since:
                    c.slow_since = now
                elif now - c.slow_since > SLOW_DROP_SECONDS:
                    self._drop(c, "stalled")
                return
            c.slow_since = 0.0
        try:
            await asyncio.wait_for(c.ws.send(payload), SEND_TIMEOUT)
        except asyncio.TimeoutError:
            self._drop(c, "send timeout")
        except ConnectionClosed:
            self._drop(c, "closed")
        except Exception as e:
            self._drop(c, f"send failed: {type(e).__name__}")

    async def broadcast(self, obj, *, viz_only=False):
        targets = [c for c in list(self.clients) if c.role == "theme" and (c.viz or not viz_only)]
        if not targets:
            return
        payload = json.dumps(obj)
        spectrum = obj.get("type") == "spectrum"
        await asyncio.gather(*[self._send_one(c, payload, spectrum) for c in targets])

    def send_soon(self, obj):
        """Queue a broadcast without waiting for it (UI code must never block on a client)."""
        if self._closed.is_set():
            return None  # a late UI call during the exit: nobody is left to hear it
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return None
        task = loop.create_task(self.broadcast(obj))
        self._tasks.add(task)
        task.add_done_callback(self._task_done)
        return task

    def _task_done(self, task):
        self._tasks.discard(task)
        if not task.cancelled() and task.exception() is not None:
            self.log.warning("broadcast failed: %s", type(task.exception()).__name__)

    def ui_visible_changed(self):
        self.send_soon({"type": "status", "ui": self._ui_visible()})

    async def spectrum_pump(self):
        while True:
            await self._viz_event.wait()
            await self.broadcast({"type": "spectrum", "bars": S.spectrum}, viz_only=True)
            await asyncio.sleep(0.033)

    def _recompute(self):
        S.connected = bool(self.clients)
        wanted = any(c.viz for c in self.clients)
        self.capture.set_wanted(wanted)
        if wanted:
            self._viz_event.set()
        else:
            self._viz_event.clear()
        if S.connected != self._present:
            self._present = S.connected
            self._call(self.hooks.on_theme_presence, S.connected)

    def _note_rejected(self, origin):
        if origin in self._rejected or len(self._rejected) >= MAX_REJECTED_ORIGINS:
            return
        self._rejected.add(origin)
        shown = "".join(ch if ch.isprintable() else "?" for ch in origin)[:200]
        # Outside the noise budget: a page that spams bad messages must not hide the next hostile
        # origin. MAX_REJECTED_ORIGINS bounds these lines.
        self.log.warning("rejected origin %s", shown)

    def _process_request(self, connection, request):
        try:
            origin = request.headers.get("Origin")
        except LookupError:
            origin = ""  # repeated Origin header
        if origin is None or origin in THEME_ORIGINS:
            return None
        self._note_rejected(origin)
        return connection.respond(http.HTTPStatus.FORBIDDEN, "Forbidden\n")

    async def handler(self, ws):
        try:
            origin = ws.request.headers.get("Origin")
        except Exception:
            origin = ""
        try:
            if origin is None:
                await self._control(ws)
            elif origin in THEME_ORIGINS:
                await self._theme(ws, origin)
            else:
                await ws.close(1008)
        except ConnectionClosed:
            pass

    async def _control(self, ws):
        """Origin-less local clients: one ping/show/quit message, one reply, closed."""
        try:
            raw = await asyncio.wait_for(ws.recv(), CONTROL_TIMEOUT)
        except asyncio.TimeoutError:
            await ws.close(1008)
            return
        if len(raw) > CONTROL_MAX_BYTES:
            await ws.close(1009)
            return
        try:
            data = json.loads(raw)
        except (ValueError, RecursionError):  # RecursionError: a deeply nested array
            data = None
        action = data.get("action") if isinstance(data, dict) and data.get("type") == "control" else None
        if action not in ("ping", "show", "quit"):
            await ws.close(1008)
            return
        ok = True
        if action == "show":
            now = self._clock()
            self._noise_window(now)
            if self._show_logged is None or now - self._show_logged >= SHOW_LOG_INTERVAL:
                self._show_logged = now
                self.log.info("control action=show")
            else:
                self._noise_dropped += 1
            # A window that is already up is not raised again within SHOW_DEBOUNCE: in tray mode each
            # raise steals the focus.
            if self._show_at is not None and now - self._show_at < SHOW_DEBOUNCE and self._ui_visible():
                ok = self._show_ok
            else:
                self._show_at = now
                ok = self._show_ok = bool(self._call(self.hooks.show, default=False))
        elif action == "quit":
            self.log.info("control action=quit")
            asyncio.get_running_loop().call_later(0.2, self._call, self.hooks.request_exit)
        reply = {
            "type": "control",
            "app": "sposync",
            "version": __version__,
            "ok": ok,
            "ui": self._call(self.hooks.ui_state, default="headless"),
            "owner": owner_id(),
        }
        await ws.send(json.dumps(reply))
        await ws.close()

    async def _theme(self, ws, origin):
        c = Client(ws, "theme")
        self.clients.add(c)
        # The first connection after the start is always logged: other tools look for this line.
        first, self._first_connect_logged = not self._first_connect_logged, True
        self._noise(logging.INFO, "client connected role=theme origin=%s", origin, always=first)
        self._recompute()
        try:
            await ws.send(json.dumps({"type": "status", "ui": self._ui_visible()}))
            async for message in ws:
                try:
                    data = json.loads(message)
                except (ValueError, RecursionError) as e:  # RecursionError: a deeply nested array
                    self._bad_message(c, None, e)
                    continue
                if not isinstance(data, dict):
                    continue
                try:
                    self._apply(c, data)
                except Exception as e:
                    self._bad_message(c, data, e)
        finally:
            self.clients.discard(c)
            self._noise(logging.INFO, "client disconnected role=theme")
            self._recompute()

    def _bad_message(self, c, data, e):
        """One value-free line per bad message, a handful per connection, then silence."""
        c.bad += 1
        if c.bad > MAX_BAD_LOGS:
            if c.bad == MAX_BAD_LOGS + 1:
                self._noise(logging.WARNING, "further bad messages from this client are not logged")
            return
        kind = data.get("type") if isinstance(data, dict) else None
        kind = kind if kind in KINDS else "other"
        self._noise(logging.WARNING, "bad message type=%s error=%s", kind, type(e).__name__)
        if c.bad == 1:
            # Frames only: the exception text and the locals could hold the payload.
            self._noise(logging.WARNING, "bad message call stack:\n%s", "".join(traceback.format_tb(e.__traceback__, limit=-8)))

    def _apply(self, c, data):
        kind = data.get("type")
        if kind == "playlists":
            items = _items(data.get("playlists"), MAX_PLAYLISTS, _playlist)
            if items is None:
                return
            S.playlists = items
            S.playlist_i = min(S.playlist_i, max(0, len(S.playlists) - 1))
            self._call(self.hooks.on_mode, "playlist")
            return
        if kind == "songs":
            items = _items(data.get("songs"), MAX_SONGS, _song)
            if items is None:
                return
            S.songs = items
            S.song_i = 0
            return
        if kind == "search":
            query = _text(data.get("query"), LIMIT_QUERY)
            results = _items(data.get("results"), MAX_RESULTS, _result)
            if query is None and results is None:
                return
            if query:
                S.search_q = query
            if results is not None:
                S.search_results = results
                S.search_i = 0
            self._call(self.hooks.on_mode, "search")
            return
        if kind != "update":
            return
        title = _text(data.get("title"), LIMIT_TITLE)
        if title is not None:
            S.title = title
        artist = _text(data.get("artist"), LIMIT_TITLE)
        if artist is not None:
            S.artist = artist
        for key, attr in (("duration_ms", "duration_ms"), ("position_ms", "position_ms")):
            raw = data.get(key)
            value = 0 if raw is None and key in data else num(raw, 0, MAX_MS)
            if value is not None:
                setattr(S, attr, value)
        if isinstance(data.get("is_playing"), bool):
            S.is_playing = data["is_playing"]
        S.last_update = time.time()
        if isinstance(data.get("visualizer"), bool):
            c.viz = data["visualizer"]
        bars = num(data.get("visualizer_bars"), 1, MAX_BARS)
        if bars is not None:
            bars = int(bars)
            if bars != S.bars:
                S.bars = bars
                S.peaks = [0.0] * bars
                S.spectrum = [0.0] * bars
        smooth = num(data.get("visualizer_smoothing"), 1, 100)
        if smooth is not None:
            S.smooth = int(smooth)
        norm = data.get("visualizer_mode")
        if isinstance(norm, str) and norm in ("global", "adaptive") and norm != S.norm:
            S.norm = norm
            S.peaks = [0.0] * S.bars
        chars = data.get("progress_chars")
        if isinstance(chars, dict):
            fg = _text(chars.get("fg"), LIMIT_CHARS)
            bg = _text(chars.get("bg"), LIMIT_CHARS)
            if fg:
                S.progress_chars = {"fg": fg, "bg": bg if bg is not None else S.progress_chars.get("bg", "")}
                style = _text(data.get("progress_style"), LIMIT_TYPE)
                if style:
                    S.progress_style = style
        colors = data.get("colors")
        if isinstance(colors, dict):
            for k in DEFAULT:
                v = hex_color(colors.get(k))
                if v:
                    S.colors[k] = v
        lyrics = data.get("lyrics")
        if isinstance(lyrics, dict):
            # A missing (or null) field means "none"; a field of the wrong type keeps the old value.
            lines = _items(lyrics.get("lines"), MAX_LYRIC_LINES, _lyric_line)
            if lines is None and lyrics.get("lines") is None:
                lines = []
            if lines is not None:
                S.lines = lines
            for key in ("synced", "instrumental", "loading"):
                value = lyrics.get(key)
                value = False if value is None else value
                if isinstance(value, bool):
                    setattr(S, key, value)
            error = _text(lyrics.get("error"), LIMIT_TITLE)
            if error is None and lyrics.get("error") is None:
                error = ""
            if error is not None:
                S.error = error
            if S.instrumental or S.error:
                S.lines = []
                S.loading = False
        self._recompute()
        self._call(self.hooks.on_update)


KINDS = ("update", "playlists", "songs", "search")


def _text(value, limit):
    """A cleaned single-line string, or None when the value is not a string."""
    return clean(value, limit) if isinstance(value, str) else None


def _items(value, cap, build):
    """A list of dicts run through `build`, capped; None when not a list. Other items are dropped."""
    if not isinstance(value, list):
        return None
    out = []
    for item in value:
        if len(out) >= cap:
            break
        if isinstance(item, dict):
            out.append(build(item))
    return out


def _playlist(item):
    return {"name": _text(item.get("name"), LIMIT_TITLE) or "", "uri": _text(item.get("uri"), LIMIT_URI) or ""}


def _song(item):
    return {
        "name": _text(item.get("name"), LIMIT_TITLE) or "",
        "artist": _text(item.get("artist"), LIMIT_TITLE) or "",
        "uri": _text(item.get("uri"), LIMIT_URI) or "",
    }


def _result(item):
    return {
        "type": _text(item.get("type"), LIMIT_TYPE) or "",
        "name": _text(item.get("name"), LIMIT_TITLE) or "",
        "uri": _text(item.get("uri"), LIMIT_URI) or "",
    }


def _lyric_line(item):
    line = {"text": _text(item.get("text"), LIMIT_LYRIC) or ""}
    start = num(item.get("startTime"), -1, MAX_MS)
    if start is not None:
        line["startTime"] = start
    return line


async def probe(host, port, action="ping", timeout=None):
    """Ask whatever listens on host:port to identify itself.

    Returns (state, reply). The state is one of:
      "none"        nothing listens
      "sposync"     a SpoSync relay of this user (a reply without "owner" counts: older helpers)
      "other-user"  a SpoSync relay of another signed-in user; no action is sent to it
      "foreign"     anything else that answers
      "timeout"     something accepted the connection but did not answer in time
    """
    timeout = CONTROL_TIMEOUT if timeout is None else timeout
    # Windows takes about 2 s to refuse a loopback connect, so try every
    # address of the host at once instead of one after the other.
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(host, port, type=socket.SOCK_STREAM)
        addrs = list(dict.fromkeys(i[4][0] for i in infos)) or [host]
    except OSError:
        addrs = [host]
    results = await asyncio.gather(*[_probe_one(a, port, "ping", timeout) for a in addrs])
    for wanted in ("sposync", "other-user", "foreign", "timeout"):
        for state, reply, addr in results:
            if state != wanted:
                continue
            if state == "sposync" and action != "ping":
                # Send the real action once, to the address that answered, only to this user's helper.
                state, reply, _ = await _probe_one(addr, port, action, timeout)
            return state, reply
    return "none", None


async def _probe_one(addr, port, action, timeout):
    netloc = f"[{addr}]" if ":" in addr else addr
    try:
        async with connect(
            f"ws://{netloc}:{port}", open_timeout=max(timeout, CONNECT_TIMEOUT), max_size=65536, close_timeout=timeout
        ) as ws:
            await ws.send(json.dumps({"type": "control", "action": action}))
            reply = json.loads(await asyncio.wait_for(ws.recv(), timeout))
    except (asyncio.TimeoutError, TimeoutError):
        # The connect or the reply took too long: busy, a stalled logon, or not a relay at all.
        return "timeout", None, addr
    except OSError:
        return "none", None, addr
    except Exception:
        return "foreign", None, addr
    if isinstance(reply, dict) and reply.get("app") == "sposync":
        owner = reply.get("owner")
        if owner is not None and owner != owner_id():
            return "other-user", reply, addr
        return "sposync", reply, addr
    return "foreign", None, addr


def port_in_use(host, port):
    """Does something already hold host:port? A local bind test: no connect, no waiting."""
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM, flags=socket.AI_PASSIVE)
    except OSError:
        return False
    for family, kind, proto, _, addr in infos:
        s = None
        try:
            s = socket.socket(family, kind, proto)
            if os.name != "nt":
                s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)  # as asyncio does; on Windows it would allow stealing
            s.bind(addr)
        except OSError as e:
            if e.errno == errno.EADDRINUSE or getattr(e, "winerror", None) in (10048, 10013):
                return True
        finally:
            if s is not None:
                s.close()
    return False


def _not_local(e):
    """A bind that failed because no address of the host belongs to this computer. asyncio skips
    each address that answers EADDRNOTAVAIL (WinError 10049) and, when none is left, raises a
    bare OSError without an errno. Anything else (in use, reserved) names its own errno."""
    return e.errno is None or e.errno == errno.EADDRNOTAVAIL or getattr(e, "winerror", None) == 10049


async def claim_port(host, port, log, bind, action="ping"):
    """Get the port before anything is probed: call `bind` (a coroutine function that raises
    OSError while the port is held) and only when it fails ask the holder who it is.

    Returns (None, None, None) once bound, else (exit_code, state, reply):
    a helper of this user -> EXIT_OK (with `action` forwarded to it); another
    user's helper or a foreign program -> EXIT_PORT_BUSY. A holder that is gone or
    does not answer is retried for BIND_RETRY_SECONDS, then EXIT_PORT_BUSY: as
    "timeout" when something accepted the connection, as "unbindable" when nothing
    listens (a port the system reserves, such as an excluded range on Windows).
    A host that does not resolve is EXIT_FATAL at once, state "unresolvable"; so is a host
    that resolves to no address of this computer, state "not-local": neither is probed."""
    deadline = time.monotonic() + BIND_RETRY_SECONDS
    while True:
        try:
            await bind()
            return None, None, None
        except socket.gaierror:
            log.error("cannot resolve host %s", host)
            return EXIT_FATAL, "unresolvable", None
        except OSError as e:
            if _not_local(e):
                log.error("host %s is not a local address", host)
                return EXIT_FATAL, "not-local", None
            log.info("port %s not available (errno %s); asking the holder", port, e.errno)
        state, reply = await probe(host, port, action)
        if state == "sposync":
            log.info("already running")
            return EXIT_OK, state, reply
        if state == "other-user":
            log.error("port %s held by another user's SpoSync", port)
            return EXIT_PORT_BUSY, state, reply
        if state == "foreign":
            log.error("port %s in use by another program", port)
            return EXIT_PORT_BUSY, state, None
        if time.monotonic() >= deadline:
            if state == "none":
                log.error("port %s cannot be bound (reserved or blocked by the system)", port)
                return EXIT_PORT_BUSY, "unbindable", None
            log.error("port %s is busy and its holder does not answer", port)
            return EXIT_PORT_BUSY, state, None
        await asyncio.sleep(0.2 if state == "none" else 1.0)


def refusal_text(state, host, port):
    """What to tell the user when claim_port did not bind (any state but "sposync")."""
    if state == "unresolvable":
        return f"cannot resolve host {host}"
    if state == "not-local":
        return f"host {host} is not a local address"
    if state == "unbindable":
        text = f"port {port} cannot be bound (reserved or blocked by the system)"
        if os.name == "nt":
            text += (
                "\ncheck the reserved ranges:"
                "\n  netsh int ipv4 show excludedportrange protocol=tcp"
                "\n  netsh int ipv6 show excludedportrange protocol=tcp"
            )
        return text
    if state == "other-user":
        return f"port {port} is held by another user's SpoSync"
    if state == "timeout":
        return f"port {port} is busy and does not answer"
    return f"port {port} is in use by another program"


def already_running_lines(reply):
    """The lines for a second instance that found this user's helper (and asked it to show itself)."""
    lines = ["SpoSync is already running"]
    if reply.get("ok"):
        lines.append("brought its window to front")
    elif reply.get("ui") == "window":
        lines.append("its window is open in another terminal")
    else:
        lines.append('running in the background; use "sposync --replace" to open the TUI here')
    return lines


async def wait_port_free(host, port, timeout):
    deadline = time.monotonic() + timeout
    while True:
        state, _ = await probe(host, port)
        if state == "none":
            return True
        if time.monotonic() >= deadline:
            return False
        await asyncio.sleep(0.25)


def quit_running(host, port, log=None):
    async def go():
        state, _ = await probe(host, port, "quit")
        if state == "none":
            return EXIT_NOT_RUNNING
        if state == "other-user":
            if log is not None:
                log.error("port %s held by another user's SpoSync; not touching it", port)
            say(f"port {port} is held by another user's SpoSync")
            return EXIT_PORT_BUSY
        if state in ("foreign", "timeout"):
            return EXIT_PORT_BUSY
        return EXIT_OK if await wait_port_free(host, port, 10.0) else EXIT_PORT_BUSY

    return asyncio.run(go())


async def run_headless(host, port, log):
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()

    class Hooks(UiHooks):
        def request_exit(self):
            stop.set()

    relay = Relay(host, port, log, Hooks())
    code, state, _ = await claim_port(host, port, log, relay.start)
    if code is not None:
        if state != "sposync":
            say(refusal_text(state, host, port))
        return code
    saved = {}
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop.set)
        except (NotImplementedError, RuntimeError, ValueError):
            try:
                saved[sig] = signal.signal(sig, lambda *_: loop.call_soon_threadsafe(stop.set))
            except (ValueError, OSError):
                pass
    runner = asyncio.ensure_future(relay.run())
    waiter = asyncio.ensure_future(stop.wait())
    try:
        await asyncio.wait({runner, waiter}, return_when=asyncio.FIRST_COMPLETED)
    finally:
        waiter.cancel()
        await relay.close()
        await asyncio.gather(runner, return_exceptions=True)
        for sig, old in saved.items():
            try:
                signal.signal(sig, old)
            except (ValueError, OSError, TypeError):
                pass
    if runner.done() and not runner.cancelled() and runner.exception():
        raise runner.exception()
    log.info("stopped")
    return EXIT_OK


def slice_rows(items, selected, height):
    if not items:
        return 0, []
    h = max(1, height)
    start = max(0, min(selected - h // 2, max(0, len(items) - h)))
    return start, items[start:start + h]


def paint_list(items, selected, height, width, border, text, inactive, label, highlight):
    inner_h = max(1, (height or 12) - 2)
    inner_w = max(1, (width or 40) - 4)
    start, view = slice_rows(items, selected, inner_h)
    t = Text()
    if not view:
        t.append(" ", style=inactive)
    else:
        for i, item in enumerate(view):
            idx = start + i
            line = (item or "")[:inner_w].ljust(inner_w)
            if highlight and idx == selected:
                t.append(line + "\n", style=f"bold #000000 on {text}")
            else:
                t.append(line + "\n", style="#dddddd")
    return Panel(t, title=Text(label, style=text), border_style=border, padding=(0, 1))


class Header(Static):
    def render(self):
        c = S.colors
        t = Text()
        if not S.connected:
            t.append("waiting for SpoTUI", style=hx(c["inactive"], DEFAULT["inactive"]))
            return t
        t.append(S.title or "Nothing playing", style=f"bold {hx(c['accent'], DEFAULT['accent'])}")
        if S.artist:
            t.append(f" - {S.artist}", style=hx(c["panel_text"], DEFAULT["panel_text"]))
        icon = "▶" if S.is_playing else "⏸"
        t.append(f"\n{icon}  {fmt(S.pos())} / {fmt(S.duration_ms)}", style=hx(c["near"], DEFAULT["near"]))
        return t


class Lyrics(Static):
    DEFAULT_CSS = """
    Lyrics {
        width: 1fr;
        height: 1fr;
    }
    """

    def render(self):
        active, inactive, near, _, _ = S.colors_of()
        lines = S.lines
        size = self.app.size if self.app else self.size
        h = max(1, self.size.height or size.height or 12)
        w = max(1, self.size.width or size.width - 6)
        rows = []
        if S.loading:
            rows = [(SPIN[S.spin % len(SPIN)], f"bold {active}")]
        elif not lines:
            rows = [(SHRUG, f"bold {active}")]
        elif not S.synced or lines[0].get("startTime", -1) < 0:
            rows = [(line.get("text") or "", inactive) for line in lines[:h]]
        else:
            pos = S.pos()
            idx = -1
            for i, line in enumerate(lines):
                if (line.get("startTime") or 0) <= pos:
                    idx = i
                else:
                    break
            ctx = max(1, (h - 1) // 2)
            start = max(0, idx - ctx)
            end = min(len(lines), max(idx, 0) + ctx + 1)
            if idx < 0:
                start, end = 0, min(len(lines), h)
            for i in range(start, end):
                dist = abs(i - idx) if idx >= 0 else 99
                style = f"bold {active}" if dist == 0 else near if dist == 1 else inactive
                rows.append((lines[i].get("text") or "", style))
        t = Text()
        pad = max(0, (h - len(rows)) // 2)
        for _ in range(pad):
            t.append(" " * w + "\n")
        for i, (text, style) in enumerate(rows):
            t.append(text[:w].center(w), style=style)
            if i < len(rows) - 1 or pad + len(rows) < h:
                t.append("\n")
        rest = h - pad - len(rows)
        for i in range(max(0, rest)):
            t.append(" " * w)
            if i < rest - 1:
                t.append("\n")
        return t


class PlaylistCol(Static):
    def render(self):
        _, inactive, _, _, text = S.colors_of()
        border = hx(S.colors["panel_border"], DEFAULT["panel_border"])
        names = [p.get("name") or "" for p in S.playlists]
        return paint_list(names, S.playlist_i, self.size.height, self.size.width, border, text, inactive, "Playlists", S.pane == "playlist")


class SongCol(Static):
    def render(self):
        _, inactive, _, _, text = S.colors_of()
        border = hx(S.colors["panel_border"], DEFAULT["panel_border"])
        names = [((s.get("name") or "") + (" - " + s["artist"] if s.get("artist") else "")) for s in S.songs]
        return paint_list(names, S.song_i, self.size.height, self.size.width, border, text, inactive, "Songs", S.pane == "song")


class SearchList(Static):
    def render(self):
        _, inactive, _, accent, text = S.colors_of()
        border = hx(S.colors["panel_border"], DEFAULT["panel_border"])
        inner_h = max(1, (self.size.height or 12) - 4)
        inner_w = max(1, (self.size.width or 40) - 6)
        start, view = slice_rows(S.search_results, S.search_i, inner_h)
        body = Text()
        q = S.search_q or ""
        caret = "█" if S.search_focus == "input" else ""
        body.append("> ", style=text)
        shown = (q + caret) if q or caret else "type to search..."
        body.append(shown[: max(1, inner_w - 2)] + "\n\n", style=text if q or caret else inactive)
        if not view:
            body.append("No results" if q else "", style=inactive)
        else:
            for i, item in enumerate(view):
                idx = start + i
                kind = (item.get("type") or "").replace("Track", "TRACK").upper()[:10].ljust(10)
                name = (item.get("name") or "")[: max(1, inner_w - 12)]
                line = f"{kind} {name}".ljust(inner_w)
                if idx == S.search_i:
                    body.append(line + "\n", style=f"bold #000000 on {accent}")
                else:
                    row = Text()
                    row.append(kind + " ", style=text)
                    row.append(name.ljust(max(1, inner_w - 11)) + "\n", style="#dddddd")
                    body.append(row)
        return Panel(body, border_style=border, padding=(1, 1))


def render_progress(progress, width, chars):
    """Exactly `width` cells: the fill, then the rest. Characters come from the
    theme, so they are cleaned and short, and cycled to the needed length."""
    width = max(0, int(width))
    if not isinstance(progress, (int, float)) or not math.isfinite(progress):
        progress = 0.0
    filled = min(width, max(0, round(width * progress)))
    empty = width - filled
    fg = clean(chars.get("fg"), LIMIT_CHARS) or "█"
    bg = clean(chars.get("bg"), LIMIT_CHARS) or "░"
    if len(fg) == 1:
        head = fg * filled
    else:
        head = "".join(fg[min(len(fg) - 1, int(i / max(1, filled) * len(fg)))] for i in range(filled))
    return head + (bg * (empty // len(bg) + 1))[:empty]


class Bar(Static):
    def render(self):
        c = S.colors
        fg = hx(c["active"], DEFAULT["active"])
        bg = hx(c["inactive"], DEFAULT["inactive"])
        w = max(10, (self.size.width or 40) - 4)
        dur = S.duration_ms or 1
        bar = render_progress(S.pos() / dur, w, S.progress_chars or {"fg": "█", "bg": "░"})
        filled = min(w, max(0, round(w * (S.pos() / dur))))
        t = Text(justify="center")
        t.append(bar[:filled], style=fg)
        t.append(bar[filled:], style=bg)
        return t


class ClosePrompt(Static):
    OPTIONS = ["Cancel", "Close", "Hide to tray"]

    def render(self):
        _, inactive, _, accent, text = S.colors_of()
        t = Text(justify="center")
        t.append("Close SpoSync?   ", style=text)
        options = getattr(self.app, "close_options", self.OPTIONS)
        for i, opt in enumerate(options):
            if i == S.confirm_sel:
                t.append(f" {opt} ", style=f"bold #000000 on {accent}")
            else:
                t.append(f" {opt} ", style=inactive)
            if i < len(options) - 1:
                t.append("  ", style=inactive)
        return t


class SpotuiApp(App):
    CSS = """
    Screen { layout: vertical; }
    #wrap { width: 1fr; height: 1fr; padding: 1 2; }
    #header { width: 1fr; height: auto; text-align: left; content-align: left top; }
    #lyrics { width: 1fr; height: 1fr; content-align: center middle; text-align: center; }
    #playlist { width: 1fr; height: 1fr; layout: horizontal; }
    #plist { width: 1fr; height: 1fr; margin-right: 1; }
    #slist { width: 1fr; height: 1fr; }
    #search { width: 1fr; height: 1fr; }
    #bar { width: 1fr; height: 1; content-align: center middle; }
    #closeprompt { width: 1fr; height: 1; display: none; content-align: center middle; text-align: center; }
    Input { dock: bottom; width: 1fr; }
    """
    BINDINGS = [("escape", "leave", "back")]

    def __init__(self, host, port, mode="window", log=None):
        super().__init__()
        self.host = host
        self.port = port
        self.run_mode = mode  # "window" | "tray"
        self.slog = log or logging.getLogger("sposync")
        self.search_timer = None
        self.tick_timer = None
        self.ui_hidden = False
        self.respawn_headless = False
        self.crashed = False
        # textual's own _closing/_closed belong to its message pump: keep these names apart.
        self._exiting = False  # set before the first exit step; the widget tree may be gone from then on
        self._ui_ready = False  # set when on_mount has the widgets in place
        self.tray = Tray(self)
        self.relay = Relay(host, port, self.slog, AppHooks(self))
        # Per instance: the class list is only the default and is never written to.
        self.close_options = [*ClosePrompt.OPTIONS[:2], "Hide to tray" if tray_capable() else "Run in background"]

    def compose(self) -> ComposeResult:
        with Vertical(id="wrap"):
            yield Header(id="header", expand=True)
            yield Lyrics(id="lyrics", expand=True)
            with Horizontal(id="playlist"):
                yield PlaylistCol(id="plist", expand=True)
                yield SongCol(id="slist", expand=True)
            yield SearchList(id="search", expand=True)
            yield Bar(id="bar", expand=True)
            yield ClosePrompt(id="closeprompt")
        yield Input(placeholder="type help for a list of commands")

    def on_mount(self):
        self.theme_bg = ""
        self.query_one("#playlist").display = False
        self.query_one("#search").display = False
        self._ui_ready = True
        self.tick_timer = self.set_interval(0.1, self.tick)
        self.run_worker(self._run_relay, exclusive=True)

    def on_unmount(self):
        self.begin_exit()

    def ui_alive(self):
        """Is the widget tree there? Timers, relay hooks and tray callbacks run outside the
        key handlers, so they ask first: before on_mount ends, once an exit began, and while
        textual tears the screen down (is_running is already False then) it is not."""
        return self._ui_ready and not self._exiting and self.is_running

    def begin_exit(self):
        """First step of every exit: no timer may fire into the widgets that are going away."""
        self._exiting = True
        for timer in (self.tick_timer, self.search_timer):
            if timer is not None:
                timer.stop()
        self.search_timer = None

    def close_app(self, return_code=0, message=None):
        """Every exit goes through here. The first one wins: a later call must not reset the code."""
        first = not self._exiting
        self.begin_exit()
        if first:
            self.exit(return_code=return_code, message=message)

    def _handle_exception(self, error):
        # Textual catches errors raised while drawing or in handlers and exits
        # with code 1, which the file log would never show. Log the stack
        # (frames only: the message may carry data from the theme) and exit
        # with EXIT_FATAL: 1 means "--quit found nothing".
        self.begin_exit()  # a broken tree must not be drawn into again every 100 ms
        if not self.crashed:
            self.slog.critical(
                "textual crashed: %s\n%s", type(error).__name__, "".join(traceback.format_tb(error.__traceback__))
            )
        else:
            self.slog.critical("textual crashed again: %s", type(error).__name__)
        self.crashed = True
        super()._handle_exception(error)
        self._return_code = EXIT_FATAL

    async def _run_relay(self):
        # A window that loses the start-up race asks the winner to show itself, as `_main` does.
        action = "show" if self.run_mode == "window" else "ping"
        code, state, reply = await claim_port(self.host, self.port, self.slog, self.relay.start, action)
        if code is not None:
            # Textual prints the message once the screen is gone.
            if state == "sposync":
                lines = already_running_lines(reply) if self.run_mode == "window" else []
            else:
                lines = [refusal_text(state, self.host, self.port)]
            self.close_app(return_code=code, message=Text("\n".join(lines)) if lines else None)
            return
        try:
            if self.run_mode == "tray":
                _disable_console_close()
                self.hide_to_tray()
            await self.relay.run()
        except asyncio.CancelledError:
            raise
        except Exception:
            self.slog.critical("relay failed", exc_info=True)
            self.close_app(return_code=EXIT_FATAL)

    def ui_state(self):
        if self.ui_hidden:
            return "tray"
        return "shown" if self.run_mode == "tray" else "window"

    def set_mode(self, mode):
        S.mode = mode
        if not self.ui_alive():
            return  # a relay hook after the exit began (or before the widgets exist)
        self.query_one("#lyrics").display = mode == "lyrics"
        self.query_one("#playlist").display = mode == "playlist"
        self.query_one("#search").display = mode == "search"
        inp = self.query_one(Input)
        if mode == "lyrics":
            inp.placeholder = "type help for a list of commands"
            inp.focus()
        else:
            inp.blur()

    def action_leave(self):
        if S.confirm_close:
            return
        if S.mode != "lyrics":
            self.set_mode("lyrics")

    def action_quit(self):
        if not S.confirm_close:
            self.open_confirm()

    def open_confirm(self):
        if self._exiting:
            return
        S.confirm_close = True
        S.confirm_sel = 0
        self.query_one(Input).blur()
        prompt = self.query_one(ClosePrompt)
        prompt.display = True
        prompt.refresh()

    def resolve_confirm(self, idx):
        if self._exiting:
            return  # a second Enter while the first choice is already closing the app
        S.confirm_close = False
        self.query_one(ClosePrompt).display = False
        if idx == 1:
            self.close_app()
            return
        if idx == 2:
            if tray_capable():
                self.hide_to_tray()
            else:
                self.respawn_headless = True
                self.close_app()
            return
        if S.mode == "lyrics":
            self.query_one(Input).focus()

    TRAY_RETRY_DELAYS = (2, 4, 8, 16, 30)

    def hide_to_tray(self):
        if self._exiting or not _console_hwnd():
            return
        started = self.tray.start(hx(S.colors["accent"], DEFAULT["accent"]))
        if not started:
            self.slog.warning("tray icon failed to start: %s", self.tray.error)
            if self.run_mode != "tray":
                return  # the user asked to hide a visible window: keep it, there is no way back
            # Tray mode: the helper still hides (the Show control reveals it) and the icon is retried.
            self._retry_tray(0)
        if not _hide_console():
            return
        self.ui_hidden = True
        if self.tick_timer is not None:
            self.tick_timer.pause()
        self.relay.ui_visible_changed()

    def _retry_tray(self, attempt):
        if self._exiting:
            return
        if attempt >= len(self.TRAY_RETRY_DELAYS):
            self.slog.warning("tray icon unavailable after %s retries; giving up", attempt)
            return
        self.set_timer(self.TRAY_RETRY_DELAYS[attempt], lambda: self._tray_retry_now(attempt + 1))

    def _tray_retry_now(self, attempt):
        if self._exiting or self.tray.icon is not None:
            return  # an icon started after the exit would outlive the app
        if self.tray.start(hx(S.colors["accent"], DEFAULT["accent"])):
            self.slog.info("tray icon started on retry %s", attempt)
            return
        self.slog.warning("tray icon retry %s failed: %s", attempt, self.tray.error)
        self._retry_tray(attempt)

    def restore_from_tray(self):
        if self._exiting:
            return False
        # In tray mode the icon stays for the life of the helper.
        if self.run_mode != "tray":
            self.tray.stop()
        shown = _show_console()
        self.ui_hidden = False
        if self.tick_timer is not None:
            self.tick_timer.resume()
        self.relay.ui_visible_changed()
        if S.mode == "lyrics" and self.ui_alive():
            self.query_one(Input).focus()
        return shown

    def sync_tray(self):
        accent = hx(S.colors["accent"], DEFAULT["accent"])
        if self.tray.icon is not None and accent != self.tray.color:
            self.tray.update(accent)

    def tray_quit(self):
        self.close_app()
        self.tray.stop()

    def paint_bg(self, bg):
        if not self.ui_alive():
            return
        for node in (self.screen, self.query_one("#wrap"), self.query_one(Header), self.query_one(Lyrics), self.query_one("#playlist"), self.query_one("#plist"), self.query_one("#slist"), self.query_one("#search"), self.query_one(Bar), self.query_one(ClosePrompt), self.query_one(Input)):
            node.styles.background = bg

    def tick(self):
        if not self.ui_alive():
            return  # the widget tree is not there (yet, or any more); a real render bug still raises
        bg = hx(S.colors["panel_bg"], DEFAULT["panel_bg"])
        border = hx(S.colors["panel_border"], DEFAULT["panel_border"])
        text = hx(S.colors["bar_text"], DEFAULT["bar_text"])
        self.sync_tray()
        self.paint_bg(bg)
        inp = self.query_one(Input)
        wrap = self.query_one("#wrap")
        inp.styles.border = ("solid", border)
        inp.styles.color = text
        wrap.styles.border = ("solid", border)
        if bg != self.theme_bg:
            self.theme_bg = bg
            self.refresh(repaint=True, layout=True)
        if S.loading:
            S.spin += 1
        self.query_one(Header).refresh()
        self.query_one(Lyrics).refresh()
        self.query_one(PlaylistCol).refresh()
        self.query_one(SongCol).refresh()
        self.query_one(SearchList).refresh()
        self.query_one(Bar).refresh()
        if S.confirm_close:
            self.query_one(ClosePrompt).refresh()

    def ws_send(self, obj):
        # Fire and forget: a slow theme client must never freeze the UI.
        self.relay.send_soon(obj)

    def schedule_search(self):
        if self.search_timer is not None:
            self.search_timer.stop()
        self.search_timer = self.set_timer(0.35, self.flush_search)

    def flush_search(self):
        self.search_timer = None
        if S.mode != "search":
            return
        self.ws_send({"type": "command", "cmd": "search " + S.search_q})

    async def on_input_submitted(self, event: Input.Submitted):
        cmd = event.value.strip()
        event.input.value = ""
        if not cmd:
            return
        low = cmd.lower()
        if low in {"q", "quit", "exit"}:
            self.open_confirm()
            return
        parts = cmd.split(None, 1)
        name = parts[0].lower()
        arg = parts[1] if len(parts) > 1 else ""
        if name in {"playlist", "list"}:
            S.playlists = []
            S.songs = []
            S.playlist_i = 0
            S.song_i = 0
            S.pane = "playlist"
            self.set_mode("playlist")
            self.ws_send({"type": "command", "cmd": cmd})
            return
        if name == "search":
            S.search_q = clean(arg, LIMIT_QUERY)
            S.search_results = []
            S.search_i = 0
            S.search_focus = "input"
            self.set_mode("search")
            if arg:
                self.ws_send({"type": "command", "cmd": cmd})
            return
        self.ws_send({"type": "command", "cmd": cmd})

    async def on_key(self, event):
        if self._exiting:
            return
        if S.confirm_close:
            key = event.key
            event.prevent_default()
            event.stop()
            if key == "escape":
                self.resolve_confirm(0)
            elif key in {"left", "shift+tab"}:
                S.confirm_sel = (S.confirm_sel - 1) % len(self.close_options)
                self.query_one(ClosePrompt).refresh()
            elif key in {"right", "tab"}:
                S.confirm_sel = (S.confirm_sel + 1) % len(self.close_options)
                self.query_one(ClosePrompt).refresh()
            elif key == "enter":
                self.resolve_confirm(S.confirm_sel)
            elif key in {"1", "2", "3"}:
                self.resolve_confirm(int(key) - 1)
            return
        if S.mode == "lyrics":
            return
        key = event.key
        if key == "escape":
            event.prevent_default()
            event.stop()
            self.set_mode("lyrics")
            return
        if S.mode == "playlist":
            if key in {"up", "down"}:
                event.prevent_default()
                event.stop()
                if S.pane == "playlist" and S.playlists:
                    S.playlist_i = (S.playlist_i + (-1 if key == "up" else 1)) % len(S.playlists)
                    S.song_i = 0
                    uri = S.playlists[S.playlist_i].get("uri")
                    if uri:
                        self.ws_send({"type": "get_songs", "uri": uri})
                elif S.pane == "song" and S.songs:
                    S.song_i = (S.song_i + (-1 if key == "up" else 1)) % len(S.songs)
                return
            if key == "left":
                event.prevent_default()
                event.stop()
                S.pane = "playlist"
                return
            if key == "right":
                event.prevent_default()
                event.stop()
                S.pane = "song"
                return
            if key == "enter":
                event.prevent_default()
                event.stop()
                if S.pane == "playlist" and S.playlists:
                    self.ws_send({"type": "play", "uri": S.playlists[S.playlist_i].get("uri")})
                    self.set_mode("lyrics")
                elif S.pane == "song" and S.songs and S.playlists:
                    self.ws_send({
                        "type": "play",
                        "uri": S.songs[S.song_i].get("uri"),
                        "context": S.playlists[S.playlist_i].get("uri"),
                    })
                    self.set_mode("lyrics")
                return
        if S.mode == "search":
            if key in {"up", "down"}:
                event.prevent_default()
                event.stop()
                if S.search_focus == "input" and key == "down" and S.search_results:
                    S.search_focus = "results"
                    S.search_i = 0
                elif S.search_focus == "results" and S.search_results:
                    if key == "up" and S.search_i <= 0:
                        S.search_focus = "input"
                    else:
                        S.search_i = (S.search_i + (-1 if key == "up" else 1)) % len(S.search_results)
                return
            if key == "enter":
                event.prevent_default()
                event.stop()
                if S.search_focus == "input":
                    if self.search_timer is not None:
                        self.search_timer.stop()
                        self.search_timer = None
                    self.ws_send({"type": "command", "cmd": "search " + S.search_q})
                elif S.search_results:
                    self.ws_send({"type": "play", "uri": S.search_results[S.search_i].get("uri")})
                    self.set_mode("lyrics")
                return
            if S.search_focus == "input":
                if key == "backspace":
                    event.prevent_default()
                    event.stop()
                    S.search_q = S.search_q[:-1]
                    self.schedule_search()
                    return
                if len(key) == 1:
                    event.prevent_default()
                    event.stop()
                    # Through clean(): a lone surrogate from the console input must not reach the screen.
                    S.search_q += clean(key, 1)
                    self.schedule_search()
                    return


class AppHooks(UiHooks):
    """Adapter between the relay and the textual app (App has its own on_* names)."""

    def __init__(self, app):
        self.app = app

    def on_mode(self, mode):
        self.app.set_mode(mode)

    def on_theme_presence(self, connected):
        self.app.tray.set_title("SpoSync - connected to Spotify" if connected else "SpoSync - waiting for Spotify")

    def on_update(self):
        if self.app.ui_hidden:
            self.app.sync_tray()

    def show(self):
        return self.app.restore_from_tray()

    def request_exit(self):
        self.app.close_app()

    def ui_state(self):
        return self.app.ui_state()


def say(text):
    try:
        print(text)
    except Exception:
        pass


def warn_if_not_loopback(host, log):
    try:
        addrs = {info[4][0] for info in socket.getaddrinfo(host, None)}
        if any(not ipaddress.ip_address(a.split("%")[0]).is_loopback for a in addrs):
            log.warning("host %s is not a loopback address; anything on the network can reach the relay", host)
    except Exception:
        pass


def self_cmd():
    if getattr(sys, "frozen", False):
        return [sys.executable]
    return [sys.executable, os.path.abspath(__file__)]


def respawn_headless(host, port, log):
    if not asyncio.run(wait_port_free(host, port, 3.0)):
        log.warning("port %s still busy; not starting the background helper", port)
        return
    kwargs = {}
    if os.name == "nt":
        kwargs["creationflags"] = 0x00000008 | 0x00000200 | 0x08000000  # DETACHED | NEW_GROUP | NO_WINDOW
    else:
        kwargs["start_new_session"] = True
    subprocess.Popen(
        self_cmd() + ["--headless", "--host", host, "--port", str(port)],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        close_fds=True,
        **kwargs,
    )
    log.info("started background helper")


def parse_args(argv=None):
    p = argparse.ArgumentParser(prog="sposync")
    p.add_argument("--host", default="localhost")
    p.add_argument("--port", type=int, default=8765)
    p.add_argument("--tray", action="store_true", help="start hidden in the system tray (Windows)")
    p.add_argument("--headless", action="store_true", help="run the relay with no window and no tray")
    p.add_argument("--quit", action="store_true", help="ask the running SpoSync to exit")
    p.add_argument("--replace", action="store_true", help="quit the running SpoSync, then start")
    p.add_argument("--version", action="store_true", help="print the version and exit")
    return p.parse_args(argv)


def _main(args, log):
    host, port = args.host, args.port
    mode = "window"
    if args.headless:
        mode = "headless"
    elif args.tray:
        if tray_capable():
            mode = "tray"
        else:
            # No tray here, or the console is a terminal host's pseudo window that cannot be hidden.
            log.info("tray not available here; running headless")
            mode = "headless"
    warn_if_not_loopback(host, log)

    if args.quit:
        code = quit_running(host, port, log)
        log.info("quit requested host=%s port=%s result=%s", host, port, code)
        return code
    log.info("sposync %s starting mode=%s host=%s port=%s pid=%s", __version__, mode, host, port, os.getpid())
    if args.replace:
        code = quit_running(host, port, log)
        if code not in (EXIT_OK, EXIT_NOT_RUNNING):
            log.error("could not replace the running instance (code %s)", code)
            say(f"could not stop what is listening on port {port}")
            return code

    if mode == "headless":
        return asyncio.run(run_headless(host, port, log))

    # Bind first: a free port costs one local bind test, not a probe. Only a held port is asked who holds it.
    async def free_port():
        socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)  # a host that does not resolve raises gaierror
        if port_in_use(host, port):
            raise OSError(errno.EADDRINUSE, "port in use")

    code, state, reply = asyncio.run(claim_port(host, port, log, free_port, "show" if mode == "window" else "ping"))
    if code is not None:
        if state == "sposync":
            if mode == "window":
                for line in already_running_lines(reply):
                    say(line)
        else:
            say(refusal_text(state, host, port))
        return code

    if mode == "window" and os.name == "nt" and _console_hwnd() and not _console_is_pseudo() and not _console_visible():
        # The release build hides its console at startup; an Explorer launch needs it back.
        _show_console()
    app = SpotuiApp(host, port, mode, log)
    try:
        app.run()
    finally:
        app.tray.stop()
    code = app.return_code or EXIT_OK
    if app.crashed or code == 1:
        code = EXIT_FATAL  # 1 is reserved for "--quit found nothing"
    if app.respawn_headless:
        respawn_headless(host, port, log)
    log.info("exited code=%s", code)
    return code


def main(argv=None):
    args = parse_args(argv)
    if args.version:
        print(__version__)
        return 0
    log = setup_logging()
    try:
        return _main(args, log)
    except KeyboardInterrupt:
        return EXIT_OK
    except Exception:
        log.critical("fatal error", exc_info=True)
        return EXIT_FATAL


if __name__ == "__main__":
    sys.exit(main())
