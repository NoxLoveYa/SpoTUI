import asyncio
import base64
import concurrent.futures
import contextlib
import errno
import hashlib
import io
import json
import logging
import math
import os
import re
import socket
import sys
import threading
import time
import types
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import app  # noqa: E402
from rich.console import Console  # noqa: E402
from websockets.asyncio.client import connect  # noqa: E402
from websockets.asyncio.server import serve  # noqa: E402
from websockets.exceptions import ConnectionClosed, InvalidStatus  # noqa: E402

THEME = "https://xpui.app.spotify.com"
EVIL = "https://evil.example"


class ListHandler(logging.Handler):
    def __init__(self):
        super().__init__()
        self.lines = []

    def emit(self, record):
        self.lines.append(record.getMessage())


def make_log():
    log = logging.getLogger("test_relay")
    log.setLevel(logging.INFO)
    log.propagate = False
    for h in list(log.handlers):
        log.removeHandler(h)
    handler = ListHandler()
    log.addHandler(handler)
    return log, handler


class StubCapture:
    def __init__(self):
        self.calls = []
        self.stops = 0

    def set_wanted(self, on):
        self.calls.append(bool(on))

    def stop(self):
        self.stops += 1


class RecordingHooks(app.UiHooks):
    def __init__(self, state="headless"):
        self.state = state
        self.exited = threading.Event()
        self.modes = []

    def on_mode(self, mode):
        self.modes.append(mode)

    def request_exit(self):
        self.exited.set()

    def ui_state(self):
        return self.state


def free_port():
    """A port nobody listens on right now. Only for tests that need a CLOSED port: it is
    closed and then reused, so anything that can bind port 0 itself should do that instead."""
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def listening_port(lines):
    """The port a relay started on port 0 reports in its log, or None before it is up."""
    for line in lines:
        m = re.match(r"listening on host=\S+ port=(\d+)", line)
        if m:
            return int(m.group(1))
    return None


async def until(cond, timeout=3.0):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if cond():
            return True
        await asyncio.sleep(0.01)
    return cond()


async def recv_json(ws, timeout=2.0):
    return json.loads(await asyncio.wait_for(ws.recv(), timeout))


async def recv_type(ws, kind, timeout=2.0):
    end = time.monotonic() + timeout
    while True:
        msg = await recv_json(ws, max(0.01, end - time.monotonic()))
        if msg.get("type") == kind:
            return msg


class RelayHarness(unittest.IsolatedAsyncioTestCase):
    hooks_state = "headless"

    async def asyncSetUp(self):
        self._saved_state = app.S
        app.S = app.State()
        self.log, self.log_lines = make_log()
        self.capture = StubCapture()
        self.hooks = RecordingHooks(self.hooks_state)
        self.relay = app.Relay("127.0.0.1", 0, self.log, self.hooks, self.capture)
        await self.relay.start()
        self.runner = asyncio.ensure_future(self.relay.run())
        self.url = f"ws://127.0.0.1:{self.relay.port}"

    async def asyncTearDown(self):
        await self.relay.close()
        await asyncio.wait_for(self.runner, 3)
        app.S = self._saved_state

    def theme(self):
        return connect(self.url, origin=THEME)

    def control(self):
        return connect(self.url)


class RelayCase(RelayHarness):
    # 1
    async def test_foreign_origin_gets_403(self):
        with self.assertRaises(InvalidStatus) as cm:
            async with connect(self.url, origin=EVIL):
                pass
        self.assertEqual(cm.exception.response.status_code, 403)
        self.assertTrue(any(EVIL in line for line in self.log_lines.lines))

    # 2
    async def test_theme_origin_and_no_origin_open(self):
        async with self.theme() as ws:
            await recv_type(ws, "status")
        async with self.control() as ws:
            await ws.send(json.dumps({"type": "control", "action": "ping"}))
            self.assertEqual((await recv_json(ws))["type"], "control")

    # 3
    async def test_control_ping_identifies_sposync(self):
        async with self.control() as ws:
            await ws.send(json.dumps({"type": "control", "action": "ping"}))
            reply = await recv_json(ws)
            with self.assertRaises(ConnectionClosed):
                await asyncio.wait_for(ws.recv(), 2)
        self.assertEqual(reply["app"], "sposync")
        self.assertEqual(reply["version"], app.__version__)
        self.assertTrue(reply["ok"])
        self.assertEqual(reply["ui"], "headless")
        self.assertEqual(reply["owner"], app.owner_id())
        state, found = await app.probe("127.0.0.1", self.relay.port)
        self.assertEqual(state, "sposync")
        self.assertEqual(found["version"], app.__version__)

    # 4
    async def test_control_client_cannot_update_or_start_capture(self):
        async with self.control() as ws:
            await ws.send(json.dumps({"type": "update", "visualizer": True, "title": "forged"}))
            with self.assertRaises(ConnectionClosed):
                await asyncio.wait_for(ws.recv(), 2)
        await asyncio.sleep(0.05)
        self.assertNotIn(True, self.capture.calls)
        self.assertFalse(app.S.connected)
        self.assertEqual(app.S.title, "")

    async def test_control_bad_message_is_closed_without_reply(self):
        async with self.control() as ws:
            await ws.send("not json")
            with self.assertRaises(ConnectionClosed):
                await asyncio.wait_for(ws.recv(), 2)
        async with self.control() as ws:
            await ws.send(json.dumps({"type": "control", "action": "rm -rf"}))
            with self.assertRaises(ConnectionClosed):
                await asyncio.wait_for(ws.recv(), 2)

    # 5
    async def test_capture_follows_theme_visualizer_flag(self):
        async with self.theme() as ws:
            await ws.send(json.dumps({"type": "update", "title": "t", "visualizer": True}))
            self.assertTrue(await until(lambda: self.capture.calls[-1:] == [True]))
            self.assertTrue(app.S.connected)
            await ws.send(json.dumps({"type": "update", "visualizer": False}))
            self.assertTrue(await until(lambda: self.capture.calls[-1:] == [False]))
            await ws.send(json.dumps({"type": "update", "visualizer": True}))
            self.assertTrue(await until(lambda: self.capture.calls[-1:] == [True]))
        self.assertTrue(await until(lambda: self.capture.calls[-1:] == [False]))
        self.assertFalse(app.S.connected)

    # 6
    async def test_spectrum_goes_only_to_visualizer_theme_clients(self):
        # max_queue=None: the viz client is not read after the first spectrum, and a full
        # queue would stall its close handshake.
        async with connect(self.url, origin=THEME, max_queue=None) as viz, self.theme() as plain, self.control() as ctl:
            await recv_type(viz, "status")
            await recv_type(plain, "status")
            await viz.send(json.dumps({"type": "update", "visualizer": True}))
            await plain.send(json.dumps({"type": "update", "visualizer": False}))
            msg = await recv_type(viz, "spectrum")
            self.assertEqual(len(msg["bars"]), app.S.bars)
            await asyncio.sleep(0.2)
            for ws in (plain, ctl):
                with self.assertRaises(asyncio.TimeoutError):
                    await asyncio.wait_for(ws.recv(), 0.2)
            # TUI commands reach theme clients, never control clients.
            await self.relay.broadcast({"type": "command", "cmd": "next"})
            self.assertEqual((await recv_type(plain, "command"))["cmd"], "next")
            with self.assertRaises(asyncio.TimeoutError):
                await asyncio.wait_for(ctl.recv(), 0.2)

    # 7
    async def test_theme_gets_status_on_connect(self):
        async with self.theme() as ws:
            self.assertEqual(await recv_json(ws), {"type": "status", "ui": False})

    async def test_ui_visible_changed_sends_status(self):
        async with self.theme() as ws:
            await recv_type(ws, "status")
            self.hooks.state = "shown"
            self.relay.ui_visible_changed()
            self.assertEqual(await recv_json(ws), {"type": "status", "ui": True})

    # 10
    async def test_control_quit_requests_exit(self):
        async with self.control() as ws:
            await ws.send(json.dumps({"type": "control", "action": "quit"}))
            self.assertTrue((await recv_json(ws))["ok"])
        self.assertTrue(await until(self.hooks.exited.is_set, 2))

    async def test_close_stops_the_capture_first_and_later_broadcasts_are_dropped(self):
        async with self.theme() as ws:
            await recv_type(ws, "status")
            closing = asyncio.ensure_future(self.relay.close())
            await asyncio.sleep(0)  # the first step only: textual may cancel the close after it
            self.assertEqual(self.capture.stops, 1)
            self.assertIsNone(self.relay.send_soon({"type": "status", "ui": True}))
            self.assertEqual(self.relay._tasks, set())
            await closing


class ProbeCase(unittest.IsolatedAsyncioTestCase):
    # 8
    async def test_probe_plain_tcp_listener_is_foreign(self):
        server = await asyncio.start_server(lambda r, w: w.close(), "127.0.0.1", 0)
        try:
            port = server.sockets[0].getsockname()[1]
            state, reply = await app.probe("127.0.0.1", port)
        finally:
            server.close()
            await server.wait_closed()
        self.assertEqual((state, reply), ("foreign", None))

    # 9
    async def test_probe_nothing_listening_is_none(self):
        state, reply = await app.probe("127.0.0.1", free_port())
        self.assertEqual((state, reply), ("none", None))


class TrayCallCase(unittest.TestCase):
    """The tray thread hands a click to a daemon thread: nothing that thread meets may reach
    threading.excepthook, which logs it as a CRITICAL traceback."""

    def run_click(self, error=None, fn=None):
        log, lines = make_log()
        log.setLevel(logging.DEBUG)

        def call_from_thread(callback):
            if error is not None:
                raise error
            return callback()

        fake = types.SimpleNamespace(ui_alive=lambda: True, call_from_thread=call_from_thread, slog=log)
        escaped = []
        with mock.patch.object(threading, "excepthook", escaped.append):
            worker = app.Tray(fake)._to_app(fn or (lambda: None))
            worker.join(3)
        self.assertFalse(worker.is_alive())
        return escaped, lines.lines

    def test_a_cancelled_call_in_the_exit_race_is_not_an_uncaught_exception(self):
        for error in (asyncio.CancelledError(), concurrent.futures.CancelledError(), RuntimeError("App is not running")):
            escaped, lines = self.run_click(error)
            self.assertEqual(escaped, [], type(error).__name__)
            self.assertTrue(any(line.startswith("tray call") for line in lines), lines)

    def test_a_callback_that_raises_is_logged_by_class_only_and_not_uncaught(self):
        def boom():
            raise ValueError("secret title")

        escaped, lines = self.run_click(fn=boom)
        self.assertEqual(escaped, [])
        self.assertEqual(lines, ["tray call boom ended: ValueError"])


class CaptureCase(unittest.TestCase):
    def setUp(self):
        self._saved_state = app.S
        app.S = app.State()
        self.log, self.log_lines = make_log()

    def tearDown(self):
        app.S = self._saved_state

    def run_worker(self, cap):
        t = threading.Thread(target=cap._run, daemon=True)
        t.start()
        return t

    # 11
    def test_missing_device_is_logged_once_and_does_not_raise(self):
        stub = types.ModuleType("soundcard")

        def no_speaker():
            raise RuntimeError("no device")

        stub.default_speaker = no_speaker
        stub.all_microphones = lambda include_loopback=True: []
        cap = app.Capture(self.log)
        cap.retry_missing = 0.02
        with mock.patch.dict(sys.modules, {"soundcard": stub}):
            t = self.run_worker(cap)
            cap._want.set()
            time.sleep(0.3)
            cap.stop()
            t.join(2)
        self.assertFalse(t.is_alive())
        self.assertEqual(self.log_lines.lines.count("no loopback audio device"), 1)

    def test_capture_starts_and_stops_with_wanted(self):
        import numpy as np

        class Rec:
            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

            def record(self, numframes):
                time.sleep(0.005)
                return np.ones(numframes, dtype=np.float32)

        stub = types.ModuleType("soundcard")
        stub.default_speaker = lambda: types.SimpleNamespace(name="spk")
        stub.get_microphone = lambda name, include_loopback=True: types.SimpleNamespace(
            recorder=lambda **kw: Rec()
        )
        cap = app.Capture(self.log)
        with mock.patch.dict(sys.modules, {"soundcard": stub}):
            self.assertEqual(self.log_lines.lines, [])
            cap.set_wanted(True)
            self.assertTrue(cap.wanted)
            deadline = time.monotonic() + 3
            while "capture started" not in self.log_lines.lines and time.monotonic() < deadline:
                time.sleep(0.01)
            self.assertIn("capture started", self.log_lines.lines)
            self.assertTrue(any(v > 0 for v in app.S.spectrum))
            cap.set_wanted(False)
            deadline = time.monotonic() + 3
            while "capture stopped" not in self.log_lines.lines and time.monotonic() < deadline:
                time.sleep(0.01)
            self.assertIn("capture stopped", self.log_lines.lines)
            cap.stop()
            cap._thread.join(2)
        self.assertEqual(app.S.spectrum, [0.0] * app.S.bars)


# ---------------------------------------------------------------- helpers


def plain(renderable, width=100):
    """What a terminal would show, without styles: any escape left in it is a leak."""
    buf = io.StringIO()
    Console(file=buf, width=width, color_system=None, force_terminal=False, legacy_windows=False).print(renderable)
    return buf.getvalue()


def ws_frame(text):
    """A masked client text frame."""
    data = text.encode()
    mask = os.urandom(4)
    n = len(data)
    if n < 126:
        head = bytes([0x81, 0x80 | n])
    else:
        head = bytes([0x81, 0x80 | 126]) + n.to_bytes(2, "big")
    return head + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data))


async def raw_theme_client(port, rcvbuf=1024, origin=THEME):
    """A theme-origin client that completes the handshake and then never reads."""
    loop = asyncio.get_running_loop()
    sock = socket.socket()
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, rcvbuf)
    sock.setblocking(False)
    await loop.sock_connect(sock, ("127.0.0.1", port))
    key = base64.b64encode(os.urandom(16)).decode()
    request = (
        f"GET / HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\nOrigin: {origin}\r\n\r\n"
    )
    await loop.sock_sendall(sock, request.encode())
    head = b""
    while b"\r\n\r\n" not in head:
        head += await asyncio.wait_for(loop.sock_recv(sock, 1), 2)
    assert head.startswith(b"HTTP/1.1 101"), head
    return sock


async def send_raw(sock, obj):
    await asyncio.get_running_loop().sock_sendall(sock, ws_frame(json.dumps(obj)))


class FakeRelayServer:
    """A stand-in for another SpoSync: answers pings and records every action it is sent."""

    def __init__(self, reply):
        self.reply = reply
        self.actions = []
        self.server = None

    async def _handler(self, ws):
        try:
            data = json.loads(await ws.recv())
            self.actions.append(data.get("action"))
            await ws.send(json.dumps(self.reply))
        except Exception:
            pass

    async def __aenter__(self):
        self.server = await serve(self._handler, "127.0.0.1", 0)
        self.port = self.server.sockets[0].getsockname()[1]
        return self

    async def __aexit__(self, *exc):
        self.server.close()
        await self.server.wait_closed()


def sposync_reply(owner="absent"):
    reply = {"type": "control", "app": "sposync", "version": "1.1.0", "ok": True, "ui": "headless"}
    if owner != "absent":
        reply["owner"] = owner
    return reply


# ---------------------------------------------------------------- H2: text from outside

DIRTY = "a\x1b]52;c;AAAA\x07b\x1b[2Jc\x1b]0;pwn\x07\x9b31md‮E⁦F\x00\x7f\x85"


class CleanCase(unittest.TestCase):
    def test_escape_osc_c1_bidi_and_nul_removed(self):
        out = app.clean(DIRTY, 500)
        for ch in ("\x1b", "\x07", "\x00", "\x7f", "\x9b", "\x85", "‮", "⁦"):
            self.assertNotIn(ch, out)
        self.assertTrue(out.startswith("a") and "b" in out and "c" in out and "d" in out)

    def test_lone_surrogates_are_removed(self):
        self.assertEqual(app.clean("a\ud800b"), "ab")
        self.assertEqual(app.clean("\udfff\ud83d x \ude00"), " x ")
        # A high and a low half in two fields never join: each field is cleaned on its own.
        self.assertEqual((app.clean("a\ud83d"), app.clean("\ude00b")), ("a", "b"))
        for text in (app.clean("\ud800" * 50 + "ok", 20), app.clean("x\ud800" * 5000, 200)):
            text.encode("utf-8")
            self.assertNotRegex(text, "[\ud800-\udfff]")
        # Real astral characters are not surrogates in a str: they stay.
        self.assertEqual(app.clean("a\U0001f600b"), "a\U0001f600b")

    def test_invisible_format_characters_are_removed_but_emoji_joiners_stay(self):
        hidden = "­؜᠎​‎‏⁠⁡⁢⁣⁤﻿￹￺￻\U000e0000\U000e0067\U000e007f"
        self.assertEqual(app.clean("a" + hidden + "b"), "ab")
        family = "\U0001f468‍\U0001f469‍\U0001f467"
        self.assertEqual(app.clean(family), family)
        self.assertEqual(app.clean("❤️"), "❤️")  # variation selector

    def test_zero_width_non_joiner_stays_for_persian_and_indic_text(self):
        persian = "می‌خواهم"  # mi-khaham
        self.assertEqual(app.clean(persian), persian)
        self.assertIn("‌", app.clean("a‌b"))
        self.assertEqual(app.clean("a​‌b\U000e0067\U000e007fc"), "a‌bc")  # the ZWSP and the tags go

    def test_caps_and_coercion(self):
        self.assertEqual(len(app.clean("x" * 10000, 300)), 300)
        self.assertEqual(app.clean(None), "")
        self.assertEqual(app.clean(12), "12")
        self.assertEqual(app.clean(True), "True")
        self.assertEqual(app.clean(b"ab"), "b'ab'")
        self.assertEqual(app.clean("abc", 2), "ab")

    def test_single_line_by_default(self):
        self.assertEqual(app.clean("a\tb\nc\r\nd e"), "a b c d e")
        self.assertEqual(app.clean("a\nb", multiline=True), "a\nb")
        self.assertNotIn("\r", app.clean("a\r\nb", multiline=True))

    def test_hx_accepts_only_3_or_6_hex_digits(self):
        d = "#fallback"
        self.assertEqual(app.hx("#ff8c42", d), "#ff8c42")
        self.assertEqual(app.hx("#ABC", d), "#aabbcc")
        for bad in ("#ff8c4g", "#]x[/", "#ff8c", "#ff8c42ff", "ff8c42", "", None, 5, {}, "red"):
            self.assertEqual(app.hx(bad, d), d, bad)

    def test_fmt_survives_garbage(self):
        for bad in (float("nan"), float("inf"), None, "x", -5):
            self.assertEqual(app.fmt(bad), "00:00")
        self.assertEqual(app.fmt(61000), "01:01")

    def test_render_progress_is_bounded(self):
        chars = {"fg": "x" * 3_000_000, "bg": "y" * 3_000_000}
        out = app.render_progress(0.5, 40, chars)
        self.assertEqual(len(out), 40)
        self.assertEqual(len(app.render_progress(float("nan"), 40, {"fg": "#", "bg": "ab"})), 40)
        self.assertEqual(len(app.render_progress(2, 40, {"fg": "ab", "bg": ""})), 40)
        self.assertNotIn("\x1b", app.render_progress(0.5, 40, {"fg": "\x1b[2J", "bg": "\x1b]52;c;x\x07"}))


# ---------------------------------------------------------------- M1: type checks

GOOD = {
    "type": "update",
    "title": "Song",
    "artist": "Band",
    "duration_ms": 200000,
    "position_ms": 1000,
    "is_playing": True,
    "visualizer": False,
    "visualizer_bars": 32,
    "visualizer_smoothing": 50,
    "visualizer_mode": "global",
    "colors": {"accent": "#112233", "active": "#abc"},
    "progress_style": "dots",
    "progress_chars": {"fg": "#", "bg": "."},
    "lyrics": {
        "lines": [{"text": "a", "startTime": 0}, {"text": "b", "startTime": 1000}],
        "synced": True,
        "instrumental": False,
        "error": "",
        "loading": False,
    },
}

BAD_UPDATES = [
    {"title": {}}, {"title": 5}, {"title": None}, {"title": ["x"]}, {"artist": {"a": 1}}, {"artist": 1.5},
    {"duration_ms": "x"}, {"duration_ms": True}, {"duration_ms": float("nan")}, {"duration_ms": float("inf")},
    {"duration_ms": 10**400}, {"duration_ms": [1]}, {"position_ms": float("nan")}, {"position_ms": -float("inf")},
    {"position_ms": "5"}, {"position_ms": {}}, {"position_ms": False},
    {"is_playing": "yes"}, {"is_playing": 1}, {"is_playing": None}, {"visualizer": 1}, {"visualizer": "true"},
    {"visualizer_bars": float("nan")}, {"visualizer_bars": "x"}, {"visualizer_bars": True}, {"visualizer_bars": {}},
    {"visualizer_smoothing": "x"}, {"visualizer_smoothing": float("inf")}, {"visualizer_smoothing": False},
    {"visualizer_mode": "weird"}, {"visualizer_mode": {}}, {"visualizer_mode": ["global"]},
    {"colors": "x"}, {"colors": []}, {"colors": {"accent": "#]x[/"}}, {"colors": {"accent": "#ff8c4g"}},
    {"colors": {"accent": 5, "active": {}, "near": None, "panel_bg": "red", "bar_text": "#12345"}},
    {"colors": {"unknown": "#ffffff"}},
    {"progress_chars": "x"}, {"progress_chars": {"fg": 5}}, {"progress_chars": {"fg": ""}},
    {"progress_chars": {"fg": {}, "bg": []}}, {"progress_chars": {"bg": "x"}}, {"progress_style": {}},
    {"lyrics": "x"}, {"lyrics": []}, {"lyrics": 5},
]


def snapshot(client):
    s = app.S
    return (
        s.title, s.artist, s.duration_ms, s.position_ms, s.is_playing, s.bars, s.smooth, s.norm,
        dict(s.colors), dict(s.progress_chars), s.progress_style, list(s.lines), s.synced,
        s.instrumental, s.error, s.loading, client.viz, list(s.playlists), list(s.songs),
        list(s.search_results), s.search_q,
    )


SANE_FORBIDDEN = (
    "[\x00-\x1f\x7f-\x9f­؜᠎​‌‎‏‪-‮⁠-⁤⁦-⁩"
    "﻿￹-￻\U000e0000-\U000e007f\ud800-\udfff]"
)


def assert_sane(tc):
    s = app.S
    tc.assertIsInstance(s.title, str)
    tc.assertLessEqual(len(s.title), app.LIMIT_TITLE)
    tc.assertLessEqual(len(s.artist), app.LIMIT_TITLE)
    for v in (s.duration_ms, s.position_ms):
        tc.assertTrue(math.isfinite(v) and 0 <= v <= app.MAX_MS, v)
    tc.assertIsInstance(s.is_playing, bool)
    tc.assertTrue(1 <= s.bars <= app.MAX_BARS and len(s.spectrum) == s.bars and len(s.peaks) == s.bars)
    tc.assertTrue(1 <= s.smooth <= 100)
    tc.assertIn(s.norm, ("global", "adaptive"))
    for k in app.DEFAULT:
        tc.assertRegex(s.colors[k], r"^#[0-9a-f]{6}$")
    for k in ("fg", "bg"):
        tc.assertLessEqual(len(s.progress_chars[k]), app.LIMIT_CHARS)
    tc.assertLessEqual(len(s.progress_style), app.LIMIT_TYPE)
    tc.assertLessEqual(len(s.playlists), app.MAX_PLAYLISTS)
    tc.assertLessEqual(len(s.songs), app.MAX_SONGS)
    tc.assertLessEqual(len(s.search_results), app.MAX_RESULTS)
    tc.assertLessEqual(len(s.lines), app.MAX_LYRIC_LINES)
    tc.assertLessEqual(len(s.search_q), app.LIMIT_QUERY)
    tc.assertTrue(all(isinstance(x, dict) for x in s.playlists + s.songs + s.search_results + s.lines))
    tc.assertTrue(all(isinstance(x["text"], str) for x in s.lines))
    texts = [s.title, s.artist, s.error, s.search_q, s.progress_style] + list(s.progress_chars.values())
    for item in s.playlists + s.songs + s.search_results + s.lines:
        texts += [v for v in item.values() if isinstance(v, str)]
    for text in texts:
        tc.assertNotRegex(text, SANE_FORBIDDEN)


class ApplyCase(unittest.TestCase):
    def setUp(self):
        self._saved_state = app.S
        app.S = app.State()
        self.log, self.log_lines = make_log()
        self.hooks = RecordingHooks()
        self.relay = app.Relay("127.0.0.1", 0, self.log, self.hooks, StubCapture())
        self.client = app.Client(None, "theme")

    def tearDown(self):
        app.S = self._saved_state

    def apply(self, msg):
        self.relay._apply(self.client, dict(msg))

    def test_good_message_is_applied(self):
        self.apply(GOOD)
        s = app.S
        self.assertEqual((s.title, s.artist, s.duration_ms, s.position_ms), ("Song", "Band", 200000, 1000))
        self.assertEqual((s.bars, s.smooth, s.norm, s.progress_style), (32, 50, "global", "dots"))
        self.assertEqual(s.colors["accent"], "#112233")
        self.assertEqual(s.colors["active"], "#aabbcc")
        self.assertEqual(s.progress_chars, {"fg": "#", "bg": "."})
        self.assertEqual([x["text"] for x in s.lines], ["a", "b"])
        self.assertTrue(s.synced and s.is_playing)
        assert_sane(self)

    def test_wrong_types_are_ignored_and_keep_the_previous_value(self):
        self.apply(GOOD)
        before = snapshot(self.client)
        for bad in BAD_UPDATES:
            with self.subTest(bad=repr(bad)[:80]):
                self.apply({"type": "update", **bad})
                self.assertEqual(snapshot(self.client), before)
                assert_sane(self)
        self.assertEqual(self.log_lines.lines, [])

    def test_lists_of_the_wrong_type_keep_the_previous_lists(self):
        self.apply({"type": "playlists", "playlists": [{"name": "P", "uri": "u"}]})
        self.apply({"type": "songs", "songs": [{"name": "S", "artist": "A", "uri": "s"}]})
        self.apply({"type": "search", "query": "q", "results": [{"type": "Track", "name": "R", "uri": "r"}]})
        before = snapshot(self.client)
        for msg in (
            {"type": "playlists", "playlists": "abc"}, {"type": "playlists", "playlists": {"a": 1}},
            {"type": "playlists", "playlists": None}, {"type": "playlists"},
            {"type": "songs", "songs": "abc"}, {"type": "songs", "songs": 5}, {"type": "songs"},
            {"type": "search", "query": {}, "results": "x"}, {"type": "search", "query": 5, "results": None},
            {"type": "search"}, {"type": "nonsense"}, {"type": {}}, {},
        ):
            with self.subTest(msg=repr(msg)):
                self.apply(msg)
                self.assertEqual(snapshot(self.client), before)

    def test_lyrics_subfields_are_typed_one_by_one(self):
        self.apply(GOOD)
        self.apply({"type": "update", "lyrics": {"lines": "x", "synced": "yes", "error": {}, "loading": 1}})
        self.assertEqual([x["text"] for x in app.S.lines], ["a", "b"])
        self.assertTrue(app.S.synced)
        self.apply({"type": "update", "lyrics": {"lines": [1, None, "s", [], {"text": {}, "startTime": "x"}, {"text": "ok", "startTime": float("nan")}]}})
        self.assertEqual(app.S.lines, [{"text": ""}, {"text": "ok"}])
        self.apply({"type": "update", "lyrics": {"instrumental": True}})
        self.assertEqual((app.S.lines, app.S.instrumental), ([], True))
        self.apply({"type": "update", "lyrics": {"error": "nope\x1b[2J"}})
        self.assertEqual(app.S.error, "nope[2J")
        assert_sane(self)

    def test_numbers_are_clamped(self):
        self.apply({"type": "update", "position_ms": -5, "duration_ms": 1e30, "visualizer_bars": 10**6,
                    "visualizer_smoothing": -3})
        s = app.S
        self.assertEqual((s.position_ms, s.duration_ms, s.bars, s.smooth), (0, app.MAX_MS, app.MAX_BARS, 1))
        self.apply({"type": "update", "duration_ms": None, "position_ms": None})
        self.assertEqual((s.position_ms, s.duration_ms), (0, 0))
        assert_sane(self)

    def test_huge_and_oversized_input_is_capped(self):
        big = "x" * 3_000_000
        self.apply({
            "type": "update", "title": big, "artist": big, "progress_style": big,
            "progress_chars": {"fg": big, "bg": big},
            "lyrics": {"lines": [{"text": big, "startTime": 1}] * 9000, "error": ""},
        })
        s = app.S
        self.assertEqual((len(s.title), len(s.artist)), (300, 300))
        self.assertEqual((len(s.progress_chars["fg"]), len(s.progress_chars["bg"])), (16, 16))
        self.assertEqual(len(s.progress_style), 40)
        self.assertEqual(len(s.lines), 5000)
        self.assertEqual(len(s.lines[0]["text"]), 500)
        self.apply({"type": "playlists", "playlists": [{"name": big}] * 3000 + [1, None, "x"]})
        self.apply({"type": "songs", "songs": [{"name": big, "artist": big}] * 12000})
        self.apply({"type": "search", "query": big, "results": [{"name": big, "type": big}] * 500})
        self.assertEqual((len(s.playlists), len(s.songs), len(s.search_results)), (2000, 10000, 200))
        self.assertEqual((len(s.search_q), len(s.search_results[0]["type"])), (200, 40))
        assert_sane(self)

    def test_non_dict_items_are_dropped_and_text_cleaned(self):
        self.apply({"type": "playlists", "playlists": [1, "x", None, [], {"name": "A\x1b]0;x\x07", "uri": 5}, {"name": {}}]})
        self.assertEqual(app.S.playlists, [{"name": "A]0;x", "uri": ""}, {"name": "", "uri": ""}])
        self.apply({"type": "search", "query": "q\x1b[31m\n", "results": [{"type": "Tra\x1bck", "name": "n‮"}]})
        self.assertEqual(app.S.search_q, "q[31m ")
        self.assertEqual(app.S.search_results, [{"type": "Track", "name": "n", "uri": ""}])
        assert_sane(self)

    def test_selection_stays_inside_shrunk_lists(self):
        self.apply({"type": "playlists", "playlists": [{"name": str(i)} for i in range(10)]})
        app.S.playlist_i = 9
        self.apply({"type": "playlists", "playlists": [{"name": "only"}]})
        self.assertEqual(app.S.playlist_i, 0)


class WireCase(RelayHarness):
    """The same input over a real connection: it must not close it, and must not reach the log."""

    async def test_nan_and_infinity_literals_over_the_wire(self):
        async with self.theme() as ws:
            await recv_type(ws, "status")
            await ws.send('{"type":"update","title":"ok","position_ms":NaN,"duration_ms":Infinity,"visualizer_bars":-Infinity}')
            await ws.send('{"type":"update","position_ms":1e999,"colors":{"accent":"#]x[/"}}')
            self.assertTrue(await until(lambda: app.S.title == "ok"))
            await asyncio.sleep(0.1)
            self.assertEqual((app.S.position_ms, app.S.duration_ms), (0, 0))
            await ws.send(json.dumps({"type": "update", "title": "still alive"}))
            self.assertTrue(await until(lambda: app.S.title == "still alive"))
        assert_sane(self)

    async def test_every_hostile_update_leaves_the_connection_and_the_log_clean(self):
        secret = "SECRET-PAYLOAD-VALUE"
        async with self.theme() as ws:
            await recv_type(ws, "status")
            for bad in BAD_UPDATES + [{"title": secret, "colors": {"accent": secret}, "position_ms": secret}]:
                await ws.send(json.dumps({"type": "update", **bad}))
            await ws.send(json.dumps({"type": "playlists", "playlists": secret}))
            await ws.send(json.dumps({"type": "update", "title": "end"}))
            self.assertTrue(await until(lambda: app.S.title == "end"))
        self.assertFalse([line for line in self.log_lines.lines if "SECRET" in line or "end" == line])
        assert_sane(self)


class BadMessageLogCase(RelayHarness):
    async def test_malformed_messages_log_a_bounded_number_of_value_free_lines(self):
        def boom(c, data):
            raise KeyError("SEC" + "RET-FROM-EXCEPTION " + str(data.get("title")))

        self.relay._apply = boom
        async with self.theme() as ws:
            await recv_type(ws, "status")
            for _ in range(300):
                await ws.send(json.dumps({"type": "update", "title": "SECRET-TITLE"}))
            await ws.send(json.dumps({"type": "other", "title": "SECRET-TITLE"}))
            await asyncio.sleep(0.5)
        bad = [line for line in self.log_lines.lines if "bad message" in line or "further bad" in line]
        self.assertTrue(0 < len(bad) <= app.MAX_BAD_LOGS + 3, len(bad))
        self.assertEqual(sum("call stack" in line for line in bad), 1)
        self.assertTrue(any("type=update error=KeyError" in line for line in bad))
        for line in self.log_lines.lines:
            self.assertNotIn("SECRET", line)
        self.assertEqual(sum("bad message type" in line for line in bad), app.MAX_BAD_LOGS)


class RenderCase(unittest.IsolatedAsyncioTestCase):
    """The widgets draw the hostile state without raising and without markup or escapes."""

    async def asyncSetUp(self):
        self._saved_state = app.S
        app.S = app.State()
        self.log, self.log_lines = make_log()

    async def asyncTearDown(self):
        app.S = self._saved_state

    def make_app(self):
        return app.SpotuiApp("127.0.0.1", 0, "window", self.log)

    async def feed(self, tui, *msgs):
        client = app.Client(None, "theme")
        for m in msgs:
            tui.relay._apply(client, m)
        app.S.connected = True

    def renders(self, tui):
        return {w.__name__: plain(tui.query_one(w).render()) for w in
                (app.Header, app.Lyrics, app.PlaylistCol, app.SongCol, app.SearchList, app.Bar, app.ClosePrompt)}

    async def test_hostile_state_renders_and_titles_are_inert_text(self):
        tui = self.make_app()
        async with tui.run_test(size=(100, 30)) as pilot:
            await pilot.pause()
            await self.feed(
                tui,
                GOOD,
                {"type": "update", "title": "[bold red]x[/] [link=http://evil]y[/link] :smile:",
                 "artist": "\x1b]52;c;AAAA\x07\x1b[2J\x1b]0;pwn\x07",
                 "lyrics": {"lines": [{"text": "[red]line[/]\x1b[31m", "startTime": 0}, {"text": "\x1b]52;c;x\x07"}],
                            "synced": False}},
                {"type": "playlists", "playlists": [{"name": "[b]pl[/b]\x1b[1m"}]},
                {"type": "songs", "songs": [{"name": "[b]so[/b]", "artist": "\x1b[1m"}]},
                {"type": "search", "query": "[i]q[/i]\x1b[2J", "results": [{"type": "[x]\x1b", "name": "[u]r[/u]\x1b]0;x\x07"}]},
                {"type": "update", "progress_chars": {"fg": "[a\x1b", "bg": "]b"}},
            )
            for mode in ("lyrics", "playlist", "search"):
                tui.set_mode(mode)
                await pilot.pause(0.3)
                for name, out in self.renders(tui).items():
                    self.assertNotIn("\x1b", out, name)
                    self.assertNotIn("\x07", out, name)
            tui.set_mode("lyrics")
            header = plain(tui.query_one(app.Header).render())
            self.assertIn("[bold red]x[/] [link=http://evil]y[/link] :smile:", header)
            self.assertNotIn("\x1b", header)
            lyrics = plain(tui.query_one(app.Lyrics).render())
            self.assertIn("[red]line[/]", lyrics)
            tui.set_mode("playlist")
            self.assertIn("[b]pl[/b]", plain(tui.query_one(app.PlaylistCol).render()))
            self.assertIn("[b]so[/b]", plain(tui.query_one(app.SongCol).render()))
            tui.set_mode("search")
            self.assertIn("[u]r[/u]", plain(tui.query_one(app.SearchList).render()))
            self.assertIn("[i]q[/i]", plain(tui.query_one(app.SearchList).render()))
        self.assertIsNone(tui._exception)
        self.assertFalse(tui.crashed)

    async def test_state_that_used_to_crash_the_ui_is_harmless_now(self):
        tui = self.make_app()
        big = "x" * 3_000_000
        async with tui.run_test(size=(100, 30)) as pilot:
            await pilot.pause()
            await self.feed(
                tui,
                {"type": "playlists", "playlists": "abc"},
                {"type": "update", "title": {}, "position_ms": float("nan"), "duration_ms": float("inf"),
                 "colors": {"accent": "#]x[/", "active": "#ff8c4g", "panel_bg": "#]x[/", "panel_border": "x",
                            "bar_text": "[/]"},
                 "progress_chars": {"fg": big, "bg": big}, "lyrics": "x"},
                {"type": "update", "lyrics": {"lines": [{"text": "a", "startTime": "late"}], "synced": True}},
            )
            await pilot.pause(0.5)  # several 100 ms ticks
            for mode in ("lyrics", "playlist", "search"):
                tui.set_mode(mode)
                await pilot.pause(0.2)
                self.renders(tui)
            bar = tui.query_one(app.Bar)
            self.assertEqual(len(plain(bar.render(), width=2000).strip()), max(10, bar.size.width - 4))
        self.assertIsNone(tui._exception)
        self.assertFalse(tui.crashed)

    async def test_a_crash_is_logged_and_exits_with_the_fatal_code(self):
        tui = self.make_app()

        def broken(self):
            raise RuntimeError("SEC" + "RET")

        with mock.patch.object(app.Header, "render", broken), contextlib.redirect_stderr(io.StringIO()), \
                contextlib.redirect_stdout(io.StringIO()):
            try:
                async with tui.run_test(size=(100, 30)) as pilot:
                    await pilot.pause(0.5)
            except RuntimeError:
                pass
        self.assertTrue(tui.crashed)
        self.assertEqual(tui.return_code, app.EXIT_FATAL)
        crash = [line for line in self.log_lines.lines if line.startswith("textual crashed: RuntimeError")]
        self.assertEqual(len(crash), 1)
        self.assertNotIn("SECRET", crash[0])
        self.assertIn("broken", crash[0])


class ExitRaceCase(unittest.IsolatedAsyncioTestCase):
    """The 100 ms tick and the relay hooks run outside the key handlers: when they fire while the
    widget tree is not there (before it is composed, or while textual tears it down) it must be a
    no-op, not a 'textual crashed' that turns a normal quit into exit code 3."""

    async def asyncSetUp(self):
        self._saved_state = app.S
        app.S = app.State()
        self.log, self.log_lines = make_log()

    async def asyncTearDown(self):
        app.S = self._saved_state

    def make_app(self, mode="window", port=0):
        return app.SpotuiApp("127.0.0.1", port, mode, self.log)

    def crash_lines(self):
        return [line for line in self.log_lines.lines if line.startswith("textual crashed")]

    def assert_clean_exit(self, tui, code=0):
        self.assertIsNone(tui._exception)
        self.assertFalse(tui.crashed)
        self.assertEqual(self.crash_lines(), [])
        self.assertEqual(tui.return_code, code)

    def poke(self, tui):
        """Every callback a timer, the relay or the tray thread can run on the app."""
        client = app.Client(None, "theme")
        tui.tick()
        tui.paint_bg("#000000")
        tui.sync_tray()
        tui.set_mode("search")
        tui.set_mode("lyrics")
        tui.open_confirm()
        tui.resolve_confirm(0)
        tui.flush_search()
        tui.relay._apply(client, {"type": "playlists", "playlists": [{"name": "a", "uri": "b"}]})
        tui.relay._apply(client, {"type": "update", "title": "t", "colors": {"panel_bg": "#102030"}})
        self.assertFalse(tui.restore_from_tray())
        tui.hide_to_tray()
        tui._tray_retry_now(1)

    async def test_tick_before_the_widgets_exist_is_a_no_op(self):
        tui = self.make_app()
        self.assertFalse(tui.ui_alive())
        tui.tick()
        tui.set_mode("search")
        tui.paint_bg("#000000")
        self.assertEqual(app.S.mode, "search")

    async def test_tick_while_textual_removes_the_widgets_is_a_no_op(self):
        # Exactly what failed 1 run in 6: the screen is shut down (no exit() called) and the
        # timer fires after the widgets are gone.
        tui = self.make_app()
        seen = {}
        close_all = app.SpotuiApp._close_all

        async def close_all_then_tick(self):
            await close_all(self)
            seen["alive"] = self.ui_alive()
            # Control: without the guard this tick is the NoMatches of the report.
            with mock.patch.object(app.SpotuiApp, "ui_alive", return_value=True):
                try:
                    self.tick()
                except Exception as e:
                    seen["unguarded"] = type(e).__name__
            seen["errors"] = []
            try:
                self.tick()
            except Exception as e:
                seen["errors"].append(e)

        with mock.patch.object(app.SpotuiApp, "_close_all", close_all_then_tick):
            async with tui.run_test(size=(100, 30)) as pilot:
                await pilot.pause(0.3)
        self.assertFalse(seen["alive"])
        self.assertIn(seen.get("unguarded"), ("NoMatches", "ScreenStackError"))
        self.assertEqual(seen["errors"], [])
        self.assertIsNone(tui._exception)
        self.assertEqual(self.crash_lines(), [])

    async def test_every_callback_is_a_no_op_once_the_app_is_gone(self):
        tui = self.make_app()
        async with tui.run_test(size=(100, 30)) as pilot:
            await pilot.pause(0.3)
            self.assertTrue(tui.ui_alive())
        self.assertTrue(tui._exiting)  # on_unmount
        self.assertFalse(tui.ui_alive())
        self.poke(tui)
        self.assertIsNone(tui.relay.send_soon({"type": "status", "ui": True}))
        with mock.patch.object(tui, "call_from_thread") as call:
            tui.tray._on_show()
            tui.tray._on_quit()
        call.assert_not_called()
        self.assertIsNone(tui._exception)

    async def test_tray_callbacks_reach_the_app_while_it_is_up(self):
        tui = self.make_app()
        async with tui.run_test(size=(100, 30)) as pilot:
            await pilot.pause(0.1)
            with mock.patch.object(tui, "call_from_thread") as call:
                # The tray thread hands each click to a daemon thread: it never waits on the app's loop.
                workers = [tui.tray._to_app(tui.restore_from_tray), tui.tray._to_app(tui.tray_quit)]
                for w in workers:
                    self.assertTrue(w.daemon)
                    w.join(3)
            self.assertCountEqual([c.args[0] for c in call.call_args_list], [tui.restore_from_tray, tui.tray_quit])
            with mock.patch.object(tui, "call_from_thread", side_effect=RuntimeError("App is not running")):
                tui.tray._to_app(tui.restore_from_tray).join(3)  # the app stopped between the check and the call

    async def test_exit_stops_the_tick_first_and_the_first_exit_code_wins(self):
        tui = self.make_app()
        async with tui.run_test(size=(100, 30)) as pilot:
            await pilot.pause(0.3)
            tui.search_timer = tui.set_timer(60, tui.flush_search)
            tui.close_app()
            self.assertTrue(tui._exiting)
            self.assertIsNone(tui.search_timer)
            tui.close_app(return_code=app.EXIT_FATAL)  # late: must not replace the code
            self.assertTrue(await until(lambda: not tui.is_running, 5))
            self.poke(tui)
        self.assert_clean_exit(tui)

    async def test_control_quit_through_the_relay_exits_zero(self):
        tui = self.make_app()
        async with tui.run_test(size=(100, 30)) as pilot:
            self.assertTrue(await until(lambda: tui.relay._server is not None, 5))
            async with connect(f"ws://127.0.0.1:{tui.relay.port}") as ws:
                await ws.send(json.dumps({"type": "control", "action": "quit"}))
                self.assertTrue((await recv_json(ws))["ok"])
            self.assertTrue(await until(lambda: not tui.is_running, 5))
        self.assert_clean_exit(tui)
        self.assertFalse(tui.respawn_headless)

    async def test_close_prompt_close_exits_zero(self):
        tui = self.make_app()
        async with tui.run_test(size=(100, 30)) as pilot:
            await pilot.pause(0.3)
            tui.open_confirm()
            self.assertTrue(app.S.confirm_close)
            tui.resolve_confirm(1)
            tui.resolve_confirm(1)  # a second Enter on the way out
            self.assertTrue(await until(lambda: not tui.is_running, 5))
        self.assert_clean_exit(tui)

    async def test_close_prompt_run_in_background_exits_zero_and_asks_for_the_respawn(self):
        tui = self.make_app()
        with mock.patch.object(app, "tray_capable", return_value=False):
            async with tui.run_test(size=(100, 30)) as pilot:
                await pilot.pause(0.3)
                tui.open_confirm()
                tui.resolve_confirm(2)
                self.assertTrue(await until(lambda: not tui.is_running, 5))
        self.assert_clean_exit(tui)
        self.assertTrue(tui.respawn_headless)

    async def test_tray_quit_exits_zero(self):
        tui = self.make_app()
        async with tui.run_test(size=(100, 30)) as pilot:
            await pilot.pause(0.3)
            tui.tray_quit()
            self.assertTrue(await until(lambda: not tui.is_running, 5))
        self.assert_clean_exit(tui)

    async def test_busy_port_exits_with_the_busy_code_not_the_fatal_one(self):
        holder = await asyncio.start_server(lambda r, w: w.close(), "127.0.0.1", 0)
        try:
            port = holder.sockets[0].getsockname()[1]
            tui = self.make_app(port=port)
            with contextlib.redirect_stderr(io.StringIO()), contextlib.redirect_stdout(io.StringIO()):
                async with tui.run_test(size=(100, 30)) as pilot:
                    self.assertTrue(await until(lambda: not tui.is_running, 10))
        finally:
            holder.close()
            await holder.wait_closed()
        self.assert_clean_exit(tui, app.EXIT_PORT_BUSY)

    async def test_relay_failure_exits_fatal_without_a_crash_line(self):
        tui = self.make_app()

        async def bound(*args, **kwargs):
            return None, None, None

        async def boom():
            raise RuntimeError("relay down")

        with mock.patch.object(app, "claim_port", bound), mock.patch.object(tui.relay, "run", boom), \
                contextlib.redirect_stderr(io.StringIO()), contextlib.redirect_stdout(io.StringIO()):
            async with tui.run_test(size=(100, 30)) as pilot:
                self.assertTrue(await until(lambda: not tui.is_running, 5))
        self.assertIsNone(tui._exception)
        self.assertEqual(tui.return_code, app.EXIT_FATAL)
        self.assertEqual(self.crash_lines(), [])
        self.assertTrue(any(line == "relay failed" for line in self.log_lines.lines))

    async def test_a_real_render_bug_still_crashes_and_stops_the_tick(self):
        tui = self.make_app()
        with mock.patch.object(app.Header, "render", side_effect=RuntimeError("bug")), \
                contextlib.redirect_stderr(io.StringIO()), contextlib.redirect_stdout(io.StringIO()):
            try:
                async with tui.run_test(size=(100, 30)) as pilot:
                    await pilot.pause(0.5)
            except RuntimeError:
                pass
        self.assertTrue(tui.crashed)
        self.assertTrue(tui._exiting)
        self.assertEqual(tui.return_code, app.EXIT_FATAL)
        self.assertEqual(len([line for line in self.crash_lines() if line.startswith("textual crashed: RuntimeError")]), 1)


# ---------------------------------------------------------------- M2: a client that stops reading


class StalledClientCase(RelayHarness):
    def setUp(self):
        super().setUp()
        self.socks = []

    async def asyncTearDown(self):
        for s in self.socks:
            s.close()
        await super().asyncTearDown()

    async def stalled(self, **kw):
        sock = await raw_theme_client(self.relay.port, **kw)
        self.socks.append(sock)
        return sock

    async def test_a_stalled_client_neither_delays_the_others_nor_stays(self):
        async with connect(self.url, origin=THEME, max_queue=None, max_size=None) as good:
            await recv_type(good, "status")
            await good.send(json.dumps({"type": "update", "visualizer": True}))
            stalled = await self.stalled()
            await send_raw(stalled, {"type": "update", "visualizer": True})
            self.assertTrue(await until(lambda: len(self.relay.clients) == 2))
            await recv_type(good, "spectrum")
            # The kernel absorbs the first megabytes; keep sending until the stalled client's buffer is full.
            for _ in range(10):
                started = time.monotonic()
                await self.relay.broadcast({"type": "command", "cmd": "x" * 8_000_000})
                self.assertLess(time.monotonic() - started, app.SEND_TIMEOUT + 3.0)  # not the 10 s a stuck send would take
                if len(self.relay.clients) == 1:
                    break
            self.assertEqual(len(self.relay.clients), 1)
            self.assertTrue(any("client dropped" in line and "send timeout" in line for line in self.log_lines.lines))
            self.assertEqual(len(await recv_type(good, "command", 5)), 2)
            # Spectrum keeps flowing to the client that reads.
            for _ in range(3):
                await recv_type(good, "spectrum")
        self.assertTrue(await until(lambda: not self.relay.clients))

    async def test_spectrum_skips_a_client_that_is_behind_and_drops_it_after_a_while(self):
        aborted = []

        class Transport:
            def get_write_buffer_size(self):
                return 10 * app.SPECTRUM_SKIP_BUFFER

            def abort(self):
                aborted.append(True)

        class Ws:
            transport = Transport()

            async def send(self, payload):
                raise AssertionError("a lagging client must not be sent spectrum")

        c = app.Client(Ws(), "theme")
        self.relay.clients.add(c)
        await self.relay.broadcast({"type": "spectrum", "bars": [0.0]}, viz_only=False)
        self.assertIn(c, self.relay.clients)
        self.assertTrue(c.slow_since)
        c.slow_since -= app.SLOW_DROP_SECONDS + 1
        await self.relay.broadcast({"type": "spectrum", "bars": [0.0]})
        self.assertNotIn(c, self.relay.clients)
        self.assertEqual(aborted, [True])

    async def test_other_failures_drop_only_that_client(self):
        class Ws:
            transport = None

            def __init__(self, exc):
                self.exc = exc

            async def send(self, payload):
                raise self.exc

        a = app.Client(Ws(RuntimeError("x")), "theme")
        b = app.Client(Ws(ConnectionClosed(None, None)), "theme")
        self.relay.clients.update({a, b})
        async with self.theme() as ok:
            await recv_type(ok, "status")
            await self.relay.broadcast({"type": "command", "cmd": "next"})
            self.assertEqual((await recv_type(ok, "command"))["cmd"], "next")
        self.assertNotIn(a, self.relay.clients)
        self.assertNotIn(b, self.relay.clients)

    async def test_quit_works_while_a_client_is_stalled(self):
        stalled = await self.stalled()
        await send_raw(stalled, {"type": "update", "visualizer": True})
        self.assertTrue(await until(lambda: len(self.relay.clients) == 1))
        pending = self.relay.send_soon({"type": "command", "cmd": "x" * 24_000_000})
        await asyncio.sleep(0.1)
        async with self.control() as ws:
            await ws.send(json.dumps({"type": "control", "action": "quit"}))
            self.assertTrue((await recv_json(ws))["ok"])
        self.assertTrue(await until(self.hooks.exited.is_set, 2))
        started = time.monotonic()
        await asyncio.wait_for(self.relay.close(), 15)
        self.assertLess(time.monotonic() - started, 10)
        await asyncio.gather(pending, return_exceptions=True)

    async def test_headless_quit_with_a_connected_idle_client(self):
        captures = []

        def stub_capture(log):  # never the real loopback audio device
            captures.append(StubCapture())
            return captures[-1]

        with mock.patch.object(app, "Capture", stub_capture):
            known = len(self.log_lines.lines)  # the harness relay logged its own port already
            task = asyncio.ensure_future(app.run_headless("127.0.0.1", 0, self.log))
            self.assertTrue(await until(lambda: listening_port(self.log_lines.lines[known:]), 5))
            port = listening_port(self.log_lines.lines[known:])
            sock = await raw_theme_client(port)
            self.socks.append(sock)
            await send_raw(sock, {"type": "update", "visualizer": True})
            self.assertTrue(await until(lambda: captures and captures[0].calls[-1:] == [True]))
            started = time.monotonic()
            code = await asyncio.to_thread(app.quit_running, "127.0.0.1", port)
            self.assertEqual(code, app.EXIT_OK)
            self.assertEqual(await asyncio.wait_for(task, 15), app.EXIT_OK)
            self.assertLess(time.monotonic() - started, 20)
            self.assertGreaterEqual(captures[0].stops, 1)


# ---------------------------------------------------------------- M3: two users, one port


class OwnerCase(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.log, self.log_lines = make_log()
        patcher = mock.patch.object(app, "say")  # the CLI messages are not the test output
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_owner_is_a_short_digest_of_the_identity_not_the_name(self):
        # A fixed identity, so the result does not depend on who runs the test.
        if os.name == "nt":
            ident = "S-1-5-21-1111111111-2222222222-3333333333-1001"
            source = mock.patch.object(app, "_windows_sid", return_value=ident)
        else:
            ident = "uid:4242"
            source = mock.patch.object(os, "getuid", return_value=4242, create=True)
        app.owner_id.cache_clear()
        self.addCleanup(app.owner_id.cache_clear)
        with source:
            owner = app.owner_id()
        self.assertRegex(owner, r"^[0-9a-f]{16}$")
        self.assertEqual(owner, hashlib.sha256(("sposync:" + ident).encode("utf-8")).hexdigest()[:16])
        self.assertNotIn(ident, owner)

    def test_owner_falls_back_to_the_environment_and_still_hides_the_name(self):
        app.owner_id.cache_clear()
        self.addCleanup(app.owner_id.cache_clear)
        env = {"USERDOMAIN": "CORPDOMAIN", "USERNAME": "alice-the-tester", "USER": "alice-the-tester"}
        with mock.patch.object(app, "_windows_sid", side_effect=OSError("no token")), \
                mock.patch.object(os, "getuid", side_effect=OSError("no uid"), create=True), \
                mock.patch.dict(os.environ, env):
            owner = app.owner_id()
        self.assertEqual(owner, hashlib.sha256(b"sposync:CORPDOMAIN\\alice-the-tester").hexdigest()[:16])

    async def test_same_other_and_missing_owner(self):
        for owner, expected, actions in (
            (app.owner_id(), "sposync", ["ping", "quit"]),
            ("0" * 16, "other-user", ["ping"]),
            ("absent", "sposync", ["ping", "quit"]),  # helper 1.1.0 has no owner field
            (None, "sposync", ["ping", "quit"]),
            (123, "other-user", ["ping"]),
        ):
            with self.subTest(owner=owner):
                async with FakeRelayServer(sposync_reply(owner)) as fake:
                    state, reply = await app.probe("127.0.0.1", fake.port, "quit")
                    self.assertEqual(state, expected)
                    self.assertEqual(fake.actions, actions)
                    self.assertEqual(reply is not None, True)

    async def test_the_real_relay_answers_with_its_owner(self):
        relay = app.Relay("127.0.0.1", 0, self.log, RecordingHooks(), StubCapture())
        await relay.start()
        try:
            state, reply = await app.probe("127.0.0.1", relay.port)
            self.assertEqual((state, reply["owner"]), ("sposync", app.owner_id()))
        finally:
            await relay.close()

    async def test_quit_replace_and_show_never_reach_another_users_helper(self):
        async with FakeRelayServer(sposync_reply("0" * 16)) as fake:
            for argv in (["--quit"], ["--replace"], ["--headless"], []):
                with self.subTest(argv=argv):
                    args = app.parse_args(argv + ["--host", "127.0.0.1", "--port", str(fake.port)])
                    with mock.patch.object(app, "BIND_RETRY_SECONDS", 1.0):
                        code = await asyncio.to_thread(app._main, args, self.log)
                    self.assertEqual(code, app.EXIT_PORT_BUSY)
            self.assertEqual(set(fake.actions), {"ping"})
        self.assertTrue(any("another user's SpoSync" in line for line in self.log_lines.lines))

    async def test_same_user_show_is_forwarded_and_exits_ok(self):
        async with FakeRelayServer(sposync_reply(app.owner_id())) as fake:
            args = app.parse_args(["--host", "127.0.0.1", "--port", str(fake.port)])
            code = await asyncio.to_thread(app._main, args, self.log)
            self.assertEqual(code, app.EXIT_OK)
            self.assertEqual(fake.actions, ["ping", "show"])


# ---------------------------------------------------------------- L4: bind first


class StartupCase(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.log, self.log_lines = make_log()
        self._saved = (app.CONTROL_TIMEOUT, app.CONNECT_TIMEOUT, app.BIND_RETRY_SECONDS)

    def tearDown(self):
        app.CONTROL_TIMEOUT, app.CONNECT_TIMEOUT, app.BIND_RETRY_SECONDS = self._saved

    def test_port_in_use_is_a_local_bind_test(self):
        self.assertFalse(app.port_in_use("127.0.0.1", free_port()))
        with socket.socket() as s:
            s.bind(("127.0.0.1", 0))
            s.listen()
            self.assertTrue(app.port_in_use("127.0.0.1", s.getsockname()[1]))

    async def test_a_free_port_is_bound_without_any_probe(self):
        with mock.patch.object(app, "probe", side_effect=AssertionError("probe before bind")):
            task = asyncio.ensure_future(app.run_headless("127.0.0.1", 0, self.log))
            self.assertTrue(await until(lambda: listening_port(self.log_lines.lines), 5))
            port = listening_port(self.log_lines.lines)
            async with connect(f"ws://127.0.0.1:{port}") as ws:
                await ws.send(json.dumps({"type": "control", "action": "quit"}))
                await recv_json(ws)
            self.assertEqual(await asyncio.wait_for(task, 5), app.EXIT_OK)

    async def test_second_instance_exits_ok_and_the_first_keeps_the_port(self):
        first = asyncio.ensure_future(app.run_headless("127.0.0.1", 0, self.log))
        port = None
        try:
            self.assertTrue(await until(lambda: listening_port(self.log_lines.lines), 5))
            port = listening_port(self.log_lines.lines)
            self.assertEqual(await asyncio.wait_for(app.run_headless("127.0.0.1", port, self.log), 10), app.EXIT_OK)
            self.assertFalse(first.done())
            state, reply = await app.probe("127.0.0.1", port)
            self.assertEqual(state, "sposync")
            self.assertTrue(any(line == "already running" for line in self.log_lines.lines))
        finally:
            if port is not None:
                await asyncio.to_thread(app.quit_running, "127.0.0.1", port)
            self.assertEqual(await asyncio.wait_for(first, 15), app.EXIT_OK)

    async def test_foreign_listener_is_exit_2(self):
        server = await asyncio.start_server(lambda r, w: w.close(), "127.0.0.1", 0)
        try:
            port = server.sockets[0].getsockname()[1]
            self.assertEqual(await app.run_headless("127.0.0.1", port, self.log), app.EXIT_PORT_BUSY)
        finally:
            server.close()
            await server.wait_closed()

    async def test_a_listener_that_never_answers_is_retried_then_exit_2(self):
        app.CONTROL_TIMEOUT = app.CONNECT_TIMEOUT = 0.3
        app.BIND_RETRY_SECONDS = 1.0
        held = []
        server = await asyncio.start_server(lambda r, w: held.append(w), "127.0.0.1", 0)
        try:
            port = server.sockets[0].getsockname()[1]
            started = time.monotonic()
            self.assertEqual(await app.run_headless("127.0.0.1", port, self.log), app.EXIT_PORT_BUSY)
            self.assertLess(time.monotonic() - started, 15)
            self.assertTrue(any("does not answer" in line for line in self.log_lines.lines))
        finally:
            for w in held:
                w.close()
            server.close()
            await server.wait_closed()

    async def test_a_port_freed_during_the_retry_is_taken(self):
        app.CONTROL_TIMEOUT = app.CONNECT_TIMEOUT = 0.3
        app.BIND_RETRY_SECONDS = 8.0
        held = []
        server = await asyncio.start_server(lambda r, w: held.append(w), "127.0.0.1", 0)
        port = server.sockets[0].getsockname()[1]
        task = asyncio.ensure_future(app.run_headless("127.0.0.1", port, self.log))
        await asyncio.sleep(0.8)
        self.assertFalse(task.done())
        for w in held:
            w.close()
        server.close()
        await server.wait_closed()
        self.assertTrue(await until(lambda: any(line.startswith("listening on") for line in self.log_lines.lines), 6))
        # Windows needs about 2 s to refuse a connect: the short probe budget only suits the silent listener.
        app.CONTROL_TIMEOUT, app.CONNECT_TIMEOUT, _ = self._saved
        await asyncio.to_thread(app.quit_running, "127.0.0.1", port)
        self.assertEqual(await asyncio.wait_for(task, 8), app.EXIT_OK)


# ---------------------------------------------------------------- Origin table


class OriginTableCase(RelayHarness):
    async def test_origin_variants_are_all_403(self):
        variants = [
            [("Origin", "null")],
            [("Origin", "")],
            [("Origin", THEME + "/")],
            [("Origin", THEME.upper())],
            [("Origin", THEME.replace("xpui", "XPUI"))],
            [("Origin", THEME + ":443")],
            [("Origin", "http://xpui.app.spotify.com")],
            [("Origin", THEME + ", " + THEME)],
            [("Origin", THEME + "," + EVIL)],
            [("Origin", EVIL + "," + THEME)],
            [("Origin", " " + THEME + " x")],
            [("Origin", THEME), ("Origin", THEME)],
            [("Origin", THEME), ("Origin", EVIL)],
            [("Origin", "https://xpui.app.spotify.com.evil.example")],
            [("Origin", "https://evilxpui.app.spotify.com")],
        ]
        for headers in variants:
            with self.subTest(headers=headers):
                with self.assertRaises(InvalidStatus) as cm:
                    async with connect(self.url, additional_headers=headers):
                        pass
                self.assertEqual(cm.exception.response.status_code, 403)
        self.assertFalse(app.S.connected)
        self.assertEqual(self.capture.calls, [])


# ---------------------------------------------------------------- L1, L2


class TrayCase(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self._saved_state = app.S
        app.S = app.State()
        self.log, self.log_lines = make_log()

    async def asyncTearDown(self):
        app.S = self._saved_state

    def test_no_tray_under_a_pseudo_console(self):
        stub = types.ModuleType("pystray")
        with mock.patch.dict(sys.modules, {"pystray": stub}), mock.patch.object(app, "_console_hwnd", return_value=1):
            with mock.patch.object(app, "_console_is_pseudo", return_value=True):
                self.assertFalse(app.tray_capable())
            if os.name == "nt":
                with mock.patch.object(app, "_console_is_pseudo", return_value=False):
                    self.assertTrue(app.tray_capable())

    async def test_tray_mode_hides_even_when_the_icon_fails_and_retries_it(self):
        tui = app.SpotuiApp("127.0.0.1", 0, "tray", self.log)
        attempts = []

        def start(color):
            attempts.append(color)
            ok = len(attempts) >= 3
            if ok:
                tui.tray.icon = object()
            else:
                tui.tray.error = "shell not ready"
            return ok

        with mock.patch.object(app, "_console_hwnd", return_value=1), \
                mock.patch.object(app, "_hide_console", return_value=True), \
                mock.patch.object(app, "_disable_console_close", return_value=True), \
                mock.patch.object(app.SpotuiApp, "TRAY_RETRY_DELAYS", (0.05, 0.05, 0.05, 0.05, 0.05)), \
                mock.patch.object(tui.tray, "start", side_effect=start):
            async with tui.run_test(size=(80, 24)) as pilot:
                self.assertTrue(await until(lambda: tui.ui_hidden, 3))
                self.assertEqual(tui.ui_state(), "tray")
                self.assertTrue(await until(lambda: len(attempts) >= 3, 3))
                await pilot.pause(0.3)
                self.assertEqual(len(attempts), 3)  # stops once the icon is up
        self.assertTrue(any("tray icon failed to start: shell not ready" in line for line in self.log_lines.lines))
        self.assertTrue(any("started on retry" in line for line in self.log_lines.lines))

    async def test_window_mode_keeps_the_window_when_the_tray_fails(self):
        tui = app.SpotuiApp("127.0.0.1", 0, "window", self.log)
        with mock.patch.object(app, "_console_hwnd", return_value=1), \
                mock.patch.object(app, "_hide_console", return_value=True) as hide, \
                mock.patch.object(tui.tray, "start", return_value=False):
            async with tui.run_test(size=(80, 24)) as pilot:
                await pilot.pause()
                tui.hide_to_tray()
                self.assertFalse(tui.ui_hidden)
                hide.assert_not_called()
        self.assertEqual(tui.ui_state(), "window")


# ---------------------------------------------------------------- hostile input, half-open sockets, log budget


class LevelHandler(logging.Handler):
    def __init__(self):
        super().__init__()
        self.levels = []

    def emit(self, record):
        self.levels.append(record.levelno)


class HostileInputCase(RelayHarness):
    def watch_websockets_log(self):
        handler = LevelHandler()
        logger = logging.getLogger(self.log.name + ".ws")
        logger.addHandler(handler)
        self.addCleanup(logger.removeHandler, handler)
        return handler

    async def test_deeply_nested_json_is_a_bad_message_not_a_dead_connection(self):
        ws_errors = self.watch_websockets_log()
        async with self.theme() as ws:
            await recv_type(ws, "status")
            for _ in range(3):
                await ws.send("[" * 5000)
                await ws.send('{"a":' * 5000)
            await ws.send(json.dumps({"type": "update", "title": "still alive"}))
            self.assertTrue(await until(lambda: app.S.title == "still alive"))
            self.assertEqual(self.relay.clients and next(iter(self.relay.clients)).bad, 6)
        self.assertTrue(any("bad message type=other error=RecursionError" in line for line in self.log_lines.lines))
        self.assertFalse([lvl for lvl in ws_errors.levels if lvl >= logging.ERROR])

    async def test_deeply_nested_control_message_is_closed_and_the_relay_keeps_answering(self):
        ws_errors = self.watch_websockets_log()
        async with self.control() as ws:
            await ws.send("[" * 5000)
            with self.assertRaises(ConnectionClosed):
                await asyncio.wait_for(ws.recv(), 2)
        state, reply = await app.probe("127.0.0.1", self.relay.port)
        self.assertEqual(state, "sposync")
        self.assertFalse([lvl for lvl in ws_errors.levels if lvl >= logging.ERROR])

    async def test_a_probe_reply_nested_too_deep_is_foreign(self):
        async def handler(ws):
            await ws.recv()
            await ws.send("[" * 5000)

        server = await serve(handler, "127.0.0.1", 0)
        try:
            state, reply = await app.probe("127.0.0.1", server.sockets[0].getsockname()[1])
        finally:
            server.close()
            await server.wait_closed()
        self.assertEqual((state, reply), ("foreign", None))

    async def test_lone_surrogates_over_the_wire_never_reach_the_state(self):
        async with self.theme() as ws:
            await recv_type(ws, "status")
            await ws.send(json.dumps({
                "type": "update", "title": "t\ud800itle", "artist": "\udfff\ud800",
                "lyrics": {"lines": [{"text": "li\ud83dne"}], "error": "e\ude00"},
                "progress_chars": {"fg": "\ud800#", "bg": "."},
            }))
            await ws.send(json.dumps({"type": "playlists", "playlists": [{"name": "pl\ud800", "uri": "\ud800"}]}))
            await ws.send(json.dumps({"type": "search", "query": "q\ud800", "results": [{"name": "r\ud800", "type": "\ud800"}]}))
            await ws.send(json.dumps({"type": "update", "title": "end"}))
            self.assertTrue(await until(lambda: app.S.title == "end"))
            await ws.send(json.dumps({"type": "update", "title": "t\ud800itle"}))
            self.assertTrue(await until(lambda: app.S.title == "title"))
        assert_sane(self)
        for text in (app.S.title, app.S.artist, app.S.playlists[0]["name"], app.S.search_q, app.S.search_results[0]["name"]):
            text.encode("utf-8")

    async def test_half_open_connections_do_not_hold_close(self):
        port = self.relay.port
        silent = socket.create_connection(("127.0.0.1", port))
        partial = socket.create_connection(("127.0.0.1", port))
        self.addCleanup(silent.close)
        self.addCleanup(partial.close)
        partial.sendall(b"GET / HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\n")
        await asyncio.sleep(0.3)
        started = time.monotonic()
        await asyncio.wait_for(self.relay.close(), 8)
        # About CONTROL_TIMEOUT; websockets' own default would hold it for 10 s.
        self.assertLess(time.monotonic() - started, app.CONTROL_TIMEOUT + app.CLOSE_TIMEOUT + 1.5)


class FakeClock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


class NoiseBudgetCase(RelayHarness):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        self.clock = FakeClock()
        self.relay._clock = self.clock

    def count(self, text):
        return sum(text in line for line in self.log_lines.lines)

    async def connect_once(self):
        async with self.theme() as ws:
            await recv_type(ws, "status")
        self.assertTrue(await until(lambda: not self.relay.clients))

    async def test_a_reconnect_loop_cannot_flood_the_log(self):
        for _ in range(app.NOISE_LINES):  # 2 lines per connection: far more than the budget
            await self.connect_once()
        noise = self.count("client connected") + self.count("client disconnected")
        self.assertLessEqual(noise, app.NOISE_LINES)
        self.assertEqual(self.count("log noise suppressed for"), 1)
        self.assertIn(f"log noise suppressed for {int(app.NOISE_WINDOW)} s", self.log_lines.lines)
        # The lifecycle lines are not noise.
        async with self.control() as ws:
            await ws.send(json.dumps({"type": "control", "action": "quit"}))
            await recv_json(ws)
        self.assertEqual(self.count("control action=quit"), 1)
        # After the window the budget is back, and the notice may come again.
        before = self.count("client connected")
        self.clock.now += app.NOISE_WINDOW + 1
        await self.connect_once()
        self.assertEqual(self.count("client connected"), before + 1)

    async def test_the_budget_is_shared_by_bad_messages_across_connections(self):
        def boom(c, data):
            raise KeyError("x")

        self.relay._apply = boom
        for _ in range(30):
            async with self.theme() as ws:
                await recv_type(ws, "status")
                for _ in range(app.MAX_BAD_LOGS + 3):
                    await ws.send(json.dumps({"type": "update"}))
                await ws.send(json.dumps({"type": "update"}))
            self.assertTrue(await until(lambda: not self.relay.clients))
        lines = [line for line in self.log_lines.lines
                 if line.startswith(("bad message", "further bad", "client ", "log noise"))]
        self.assertLessEqual(len(lines), app.NOISE_LINES + 1 + 1)  # the notice, and the first connect
        self.assertEqual(self.count("log noise suppressed for"), 1)

    def exhaust(self):
        for _ in range(app.NOISE_LINES * 2):
            self.relay._noise(logging.INFO, "filler")
        self.assertEqual(self.count("filler"), app.NOISE_LINES)

    async def test_a_new_hostile_origin_is_logged_after_the_budget_is_gone(self):
        self.exhaust()
        for n in range(3):
            with self.assertRaises(InvalidStatus):
                async with connect(self.url, origin=f"https://evil-{n}.example"):
                    pass
        for n in range(3):
            self.assertEqual(self.count(f"rejected origin https://evil-{n}.example"), 1)

    async def test_a_page_spamming_bad_messages_cannot_hide_the_next_hostile_origin(self):
        def boom(c, data):
            raise KeyError("x")

        self.relay._apply = boom
        for _ in range(20):
            async with self.theme() as ws:
                await recv_type(ws, "status")
                for _ in range(app.MAX_BAD_LOGS + 1):
                    await ws.send("{bad")
            self.assertTrue(await until(lambda: not self.relay.clients))
        self.assertEqual(self.count("log noise suppressed for"), 1)
        with self.assertRaises(InvalidStatus):
            async with connect(self.url, origin="https://late.example"):
                pass
        self.assertEqual(self.count("rejected origin https://late.example"), 1)

    async def test_rejected_origins_keep_their_own_cap(self):
        for n in range(app.MAX_REJECTED_ORIGINS + 5):
            self.relay._note_rejected(f"https://h{n}.example")
        self.assertEqual(self.count("rejected origin "), app.MAX_REJECTED_ORIGINS)

    async def test_the_end_of_a_suppression_window_says_how_much_was_dropped(self):
        self.exhaust()
        self.clock.now += app.NOISE_WINDOW + 1
        self.relay._noise(logging.INFO, "after")
        self.assertIn(f"log noise: {app.NOISE_LINES} lines suppressed in the last {int(app.NOISE_WINDOW)} s", self.log_lines.lines)
        self.assertEqual(self.count("after"), 1)
        self.clock.now += app.NOISE_WINDOW + 1
        self.relay._noise(logging.INFO, "again")
        self.assertEqual(self.count("lines suppressed in the last"), 1)  # a window that dropped nothing is silent

    def stalled_client(self):
        aborted = []
        transport = types.SimpleNamespace(abort=lambda: aborted.append(True), get_write_buffer_size=lambda: 0)
        c = app.Client(types.SimpleNamespace(transport=transport), "theme")
        self.relay.clients.add(c)
        return c

    async def test_client_dropped_is_outside_the_budget_and_once_per_interval_with_a_count(self):
        self.exhaust()
        for _ in range(5):
            self.relay._drop(self.stalled_client(), "stalled")
        self.assertEqual(self.count("client dropped"), 1)
        self.clock.now += app.DROP_LOG_INTERVAL - 1
        self.relay._drop(self.stalled_client(), "stalled")
        self.assertEqual(self.count("client dropped"), 1)
        self.clock.now += 2
        self.relay._drop(self.stalled_client(), "stalled")
        self.assertEqual(self.count("client dropped"), 2)
        self.assertIn("client dropped role=theme reason=stalled (and 5 more since the last line)", self.log_lines.lines)
        self.assertEqual(self.relay.clients, set())

    async def test_control_show_is_logged_once_per_interval_and_the_rest_counted(self):
        self.hooks.state = "tray"  # hidden: every show reaches the hook
        calls = []
        self.hooks.show = lambda: calls.append(1) or True
        for _ in range(300):
            async with self.control() as ws:
                await ws.send(json.dumps({"type": "control", "action": "show"}))
                self.assertTrue((await recv_json(ws))["ok"])
        self.assertEqual(self.count("control action=show"), 1)
        self.assertEqual(len(calls), 300)
        self.assertEqual(self.relay._noise_dropped, 299)
        self.clock.now += app.SHOW_LOG_INTERVAL + 1
        async with self.control() as ws:
            await ws.send(json.dumps({"type": "control", "action": "show"}))
            await recv_json(ws)
        self.assertEqual(self.count("control action=show"), 2)

    async def test_control_quit_is_always_logged(self):
        self.exhaust()
        for _ in range(3):
            async with self.control() as ws:
                await ws.send(json.dumps({"type": "control", "action": "quit"}))
                self.assertTrue((await recv_json(ws))["ok"])
        self.assertEqual(self.count("control action=quit"), 3)

    async def test_show_does_not_raise_a_window_that_is_up_more_than_once_a_second(self):
        self.hooks.state = "shown"
        calls = []
        self.hooks.show = lambda: calls.append(self.clock.now) or True
        for _ in range(20):
            async with self.control() as ws:
                await ws.send(json.dumps({"type": "control", "action": "show"}))
                self.assertTrue((await recv_json(ws))["ok"])
        self.assertEqual(len(calls), 1)
        self.clock.now += app.SHOW_DEBOUNCE + 0.1
        async with self.control() as ws:
            await ws.send(json.dumps({"type": "control", "action": "show"}))
            self.assertTrue((await recv_json(ws))["ok"])
        self.assertEqual(len(calls), 2)

    async def test_the_first_connection_after_the_start_is_always_logged(self):
        for _ in range(app.NOISE_LINES * 2):
            self.relay._noise(logging.INFO, "filler")
        self.assertEqual(self.count("filler"), app.NOISE_LINES)
        await self.connect_once()
        self.assertEqual(self.count("client connected role=theme origin=" + THEME), 1)
        await self.connect_once()  # the budget is gone: this one is not
        self.assertEqual(self.count("client connected role=theme origin=" + THEME), 1)


# ---------------------------------------------------------------- unbindable port, unresolvable host, start-up race


class PortFailureCase(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.log, self.log_lines = make_log()
        self._retry = app.BIND_RETRY_SECONDS
        app.BIND_RETRY_SECONDS = 0.3
        self.addCleanup(setattr, app, "BIND_RETRY_SECONDS", self._retry)

    async def test_a_port_nobody_listens_on_but_nobody_can_bind_is_reported_as_reserved(self):
        probes = []

        async def reserved():
            raise OSError(errno.EACCES, "An attempt was made to access a socket in a way forbidden", None, 10013)

        async def nobody(host, port, action="ping", timeout=None):
            probes.append(action)
            return "none", None

        with mock.patch.object(app, "probe", nobody):
            result = await app.claim_port("127.0.0.1", 8765, self.log, reserved)
        self.assertEqual(result, (app.EXIT_PORT_BUSY, "unbindable", None))
        self.assertGreaterEqual(len(probes), 1)
        self.assertIn("port 8765 cannot be bound (reserved or blocked by the system)", self.log_lines.lines)
        self.assertFalse(any("in use by another program" in line for line in self.log_lines.lines))
        text = app.refusal_text("unbindable", "127.0.0.1", 8765)
        self.assertIn("port 8765 cannot be bound (reserved or blocked by the system)", text)
        for family in ("ipv4", "ipv6"):
            self.assertEqual(f"netsh int {family} show excludedportrange protocol=tcp" in text, os.name == "nt")

    async def test_a_host_that_is_not_local_is_fatal_at_once_and_never_probed(self):
        probes = []

        async def probe_stub(host, port, action="ping", timeout=None):
            probes.append(host)
            return "none", None

        async def nowhere():
            # What asyncio raises when every address of the host answers EADDRNOTAVAIL.
            raise OSError("could not bind on any address out of [('10.255.255.1', 8765)]")

        async def not_assigned():
            raise OSError(errno.EADDRNOTAVAIL, "address not available", None, 10049)

        for bind in (nowhere, not_assigned):
            started = time.monotonic()
            with mock.patch.object(app, "probe", probe_stub):
                result = await app.claim_port("10.255.255.1", 8765, self.log, bind)
            self.assertEqual(result, (app.EXIT_FATAL, "not-local", None))
            self.assertLess(time.monotonic() - started, 0.25)
        self.assertEqual(probes, [])
        self.assertIn("host 10.255.255.1 is not a local address", self.log_lines.lines)
        self.assertEqual(app.refusal_text("not-local", "10.255.255.1", 8765), "host 10.255.255.1 is not a local address")

    async def test_a_busy_local_port_is_not_mistaken_for_a_foreign_host(self):
        async def busy():
            raise OSError(errno.EADDRINUSE, "in use")

        async def foreign(host, port, action="ping", timeout=None):
            return "foreign", None

        with mock.patch.object(app, "probe", foreign):
            code, state, _ = await app.claim_port("127.0.0.1", 8765, self.log, busy)
        self.assertEqual((code, state), (app.EXIT_PORT_BUSY, "foreign"))

    async def test_run_headless_prints_the_not_local_reason(self):
        with mock.patch.object(app, "say") as say, \
                mock.patch.object(app.Relay, "start", side_effect=OSError("could not bind on any address out of []")):
            code = await app.run_headless("10.255.255.1", 8765, self.log)
        self.assertEqual(code, app.EXIT_FATAL)
        say.assert_called_once_with("host 10.255.255.1 is not a local address")

    async def test_a_holder_that_answers_is_still_busy_not_reserved(self):
        async def busy():
            raise OSError(errno.EADDRINUSE, "in use")

        for answer, state in ((("foreign", None), "foreign"), (("other-user", {}), "other-user")):
            async def probe_stub(host, port, action="ping", timeout=None, answer=answer):
                return answer

            with mock.patch.object(app, "probe", probe_stub):
                code, got, _ = await app.claim_port("127.0.0.1", 8765, self.log, busy)
            self.assertEqual((code, got), (app.EXIT_PORT_BUSY, state))

    async def test_a_silent_holder_is_busy_and_unanswering_not_reserved(self):
        async def busy():
            raise OSError(errno.EADDRINUSE, "in use")

        async def silent(host, port, action="ping", timeout=None):
            return "timeout", None

        with mock.patch.object(app, "probe", silent):
            code, state, _ = await app.claim_port("127.0.0.1", 8765, self.log, busy)
        self.assertEqual((code, state), (app.EXIT_PORT_BUSY, "timeout"))

    async def test_an_unresolvable_host_is_fatal_at_once(self):
        async def nowhere():
            raise socket.gaierror(11001, "getaddrinfo failed")

        with mock.patch.object(app, "probe", side_effect=AssertionError("no probe for a host that does not resolve")):
            started = time.monotonic()
            result = await app.claim_port("no.such.host", 8765, self.log, nowhere)
        self.assertEqual(result, (app.EXIT_FATAL, "unresolvable", None))
        self.assertLess(time.monotonic() - started, 0.25)  # no retry loop
        self.assertIn("cannot resolve host no.such.host", self.log_lines.lines)
        self.assertEqual(app.refusal_text("unresolvable", "no.such.host", 8765), "cannot resolve host no.such.host")

    async def test_run_headless_prints_the_reason(self):
        with mock.patch.object(app, "say") as say, \
                mock.patch("socket.getaddrinfo", side_effect=socket.gaierror(11001, "getaddrinfo failed")):
            code = await app.run_headless("no.such.host", 8765, self.log)
        self.assertEqual(code, app.EXIT_FATAL)
        say.assert_called_once_with("cannot resolve host no.such.host")


class StartupRaceCase(unittest.IsolatedAsyncioTestCase):
    """Two instances started together: the one that loses the bind asks the winner to show itself."""

    async def asyncSetUp(self):
        self._saved_state = app.S
        app.S = app.State()
        self.log, self.log_lines = make_log()

    async def asyncTearDown(self):
        app.S = self._saved_state

    async def loser(self, mode):
        async with FakeRelayServer(sposync_reply(app.owner_id())) as fake:
            tui = app.SpotuiApp("127.0.0.1", fake.port, mode, self.log)
            with mock.patch.object(tui, "close_app", wraps=tui.close_app) as close, \
                    contextlib.redirect_stderr(io.StringIO()), contextlib.redirect_stdout(io.StringIO()):
                async with tui.run_test(size=(100, 30)):
                    self.assertTrue(await until(lambda: not tui.is_running, 10))
        return fake.actions, close, tui

    async def test_a_window_that_loses_the_race_raises_the_running_one_and_says_so(self):
        actions, close, tui = await self.loser("window")
        self.assertEqual(actions, ["ping", "show"])
        self.assertEqual(tui.return_code, app.EXIT_OK)
        close.assert_called_once()
        message = close.call_args.kwargs["message"].plain
        self.assertIn("SpoSync is already running", message)
        self.assertIn("brought its window to front", message)

    async def test_a_tray_instance_that_loses_the_race_only_pings_and_stays_quiet(self):
        actions, close, tui = await self.loser("tray")
        self.assertEqual(actions, ["ping"])
        self.assertEqual(tui.return_code, app.EXIT_OK)
        self.assertIsNone(close.call_args.kwargs.get("message"))


class LogHandlerCase(unittest.TestCase):
    def test_a_lone_surrogate_in_a_logged_string_is_written_escaped_not_raised(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "t.log")
            handler = app.make_file_handler(path)
            logger = logging.getLogger("test_relay.file")
            logger.propagate = False
            logger.setLevel(logging.INFO)
            logger.addHandler(handler)
            saved, logging.raiseExceptions = logging.raiseExceptions, True  # a failed emit would print, not pass silently
            try:
                logger.info("title=%s end", "a\ud800b")
                logger.info("second line")
            finally:
                logging.raiseExceptions = saved
                logger.removeHandler(handler)
                handler.close()
            with open(path, encoding="utf-8") as f:
                text = f.read()
        self.assertIn("title=a\\ud800b end", text)
        self.assertIn("second line", text)


if __name__ == "__main__":
    unittest.main()
