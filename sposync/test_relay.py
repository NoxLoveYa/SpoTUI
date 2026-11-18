import asyncio
import base64
import concurrent.futures
import contextlib
import errno
import hashlib
import io
import ipaddress
import json
import logging
import math
import os
import re
import socket
import struct
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
        self.peer_checks = []

    def on_mode(self, mode):
        self.modes.append(mode)

    def on_peer_check(self, on):
        self.peer_checks.append(on)

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
            # The log line comes before the first block is read and analysed: wait for the spectrum.
            deadline = time.monotonic() + 3
            while not any(v > 0 for v in app.S.spectrum) and time.monotonic() < deadline:
                time.sleep(0.01)
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

    # What the JSON decoder does with a deep message depends on the CPython build: its C recursion budget
    # is 3000 levels on Windows and 10000 elsewhere (3.12), so 5000 levels are refused on one and
    # decoded (or rejected as unterminated) on the other. The helper must not care which: a deep message
    # is either counted as a bad message or ignored as a harmless non-dict, and nothing else happens.
    OLD_DEPTH = 5000
    DEEP = 100_000  # past every decoder's budget
    DECODER_ERRORS = ("RecursionError", "JSONDecodeError", "MemoryError")

    def deep_messages(self):
        for n in (self.OLD_DEPTH, self.DEEP):
            yield "[" * n  # never closed
            yield "[" * n + "]" * n
            yield '{"a":' * n  # never closed
            yield '{"a":' * n + "1" + "}" * n
            yield '{"type":"update","title":' + "[" * n + "]" * n + "}"

    async def test_deeply_nested_json_is_a_bad_message_not_a_dead_connection(self):
        ws_errors = self.watch_websockets_log()
        sent = 0
        async with self.theme() as ws:
            await recv_type(ws, "status")
            for round_ in range(2):
                for message in self.deep_messages():
                    await ws.send(message)
                    sent += 1
                await ws.send(json.dumps({"type": "update", "title": f"still alive {round_}"}))
                self.assertTrue(await until(lambda: app.S.title == f"still alive {round_}", 10))
            c = next(iter(self.relay.clients))
            # The decoder refused some of them and took the others: the count is only bounded. An
            # unterminated message is invalid for every decoder, so those (2 per round) were counted.
            self.assertLessEqual(c.bad, sent)
            self.assertGreaterEqual(c.bad, 2 * 2)
        state, reply = await app.probe("127.0.0.1", self.relay.port)  # the server still answers a control ping
        self.assertEqual(state, "sposync")
        bad = [line for line in self.log_lines.lines if line.startswith("bad message type=")]
        self.assertTrue(bad)
        self.assertLessEqual(len(bad), app.MAX_BAD_LOGS)
        for line in bad:
            m = re.fullmatch(r"bad message type=other error=(\w+)", line)
            self.assertTrue(m and m.group(1) in self.DECODER_ERRORS, line)
        self.assertFalse([lvl for lvl in ws_errors.levels if lvl >= logging.ERROR])

    async def test_a_deep_value_that_decodes_is_dropped_by_every_field(self):
        # Wherever the decoder takes it, a nested value in a field is no string, number or list of dicts.
        depth = 2000  # under the 3000 of the narrowest decoder
        nested = "[" * depth + "]" * depth
        async with self.theme() as ws:
            await recv_type(ws, "status")
            for kind in ("update", "playlists", "songs", "search"):
                await ws.send('{"type":"%s","title":%s,"artist":%s,"playlists":%s,"songs":%s,"results":%s,"query":%s,'
                              '"lyrics":{"lines":%s,"error":%s},"colors":%s,"progress_chars":%s}'
                              % ((kind,) + (nested,) * 10))
            await ws.send(json.dumps({"type": "update", "title": "end"}))
            self.assertTrue(await until(lambda: app.S.title == "end", 10))
            self.assertEqual(next(iter(self.relay.clients)).bad, 0)
        assert_sane(self)

    async def test_deeply_nested_control_message_is_closed_and_the_relay_keeps_answering(self):
        ws_errors = self.watch_websockets_log()
        # A control message over CONTROL_MAX_BYTES is closed before it is decoded: the first two depths
        # fit under it (they reach the decoder), the others do not.
        for n in (700, 2000, self.OLD_DEPTH, self.DEEP):
            for message in ("[" * n, "[" * n + "]" * n, '{"a":' * n):
                with self.subTest(depth=n, closed=message.endswith("]")):
                    async with self.control() as ws:
                        await ws.send(message)
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


# ---------------------------------------------------------------- the peer's user

IS_WIN = sys.platform == "win32"
CAN_LOOKUP = IS_WIN or sys.platform.startswith("linux")


def loopback_pair(family, host):
    """A connected TCP pair on loopback: (client, accepted server side). Skips when the family is unavailable."""
    srv = socket.socket(family)
    cli = socket.socket(family)
    try:
        srv.bind((host, 0))
        srv.listen(1)
        cli.connect(srv.getsockname())
        conn, _ = srv.accept()
    except OSError as e:
        cli.close()
        raise unittest.SkipTest(f"no {host} loopback: {e}")
    finally:
        srv.close()
    return cli, conn


@unittest.skipUnless(CAN_LOOKUP, "no peer lookup on this platform")
class PeerLookupRealCase(unittest.TestCase):
    """The real connection table, for connections this test process makes itself."""

    def expect_own(self, family, host):
        cli, conn = loopback_pair(family, host)
        self.addCleanup(cli.close)
        self.addCleanup(conn.close)
        verdict, pid = app.lookup_peer(conn.getpeername(), conn.getsockname())
        self.assertEqual(verdict, app.PEER_SAME)
        self.assertEqual(pid, os.getpid() if IS_WIN else None)
        return cli, conn

    def test_a_connection_of_this_process_is_ours_over_ipv4(self):
        self.expect_own(socket.AF_INET, "127.0.0.1")

    def test_a_connection_of_this_process_is_ours_over_ipv6(self):
        self.expect_own(socket.AF_INET6, "::1")

    def test_an_ipv4_peer_seen_through_a_dual_stack_socket_is_looked_up_as_ipv4(self):
        cli, conn = loopback_pair(socket.AF_INET, "127.0.0.1")
        self.addCleanup(cli.close)
        self.addCleanup(conn.close)
        (_, peer_port), (_, local_port) = conn.getpeername(), conn.getsockname()
        verdict, _ = app.lookup_peer(("::ffff:127.0.0.1", peer_port, 0, 0), ("::ffff:127.0.0.1", local_port, 0, 0))
        self.assertEqual(verdict, app.PEER_SAME)

    def test_a_connection_that_is_not_in_the_table_is_not_found(self):
        cli, conn = loopback_pair(socket.AF_INET, "127.0.0.1")
        self.addCleanup(cli.close)
        self.addCleanup(conn.close)
        self.assertEqual(app.lookup_peer(("127.0.0.1", 1), conn.getsockname()), (app.PEER_NOTFOUND, None))
        # Right peer, wrong listening port: that is somebody else's connection.
        self.assertEqual(app.lookup_peer(conn.getpeername(), ("127.0.0.1", 1)), (app.PEER_NOTFOUND, None))

    # Only the ADDRESS differs from the real connection (the ports are right): each address
    # comparison alone must turn the row down.
    def expect_address_matters(self, family, host, other):
        cli, conn = loopback_pair(family, host)
        self.addCleanup(cli.close)
        self.addCleanup(conn.close)
        peer, local = conn.getpeername()[:2], conn.getsockname()[:2]
        self.assertEqual(app.lookup_peer(peer, local)[0], app.PEER_SAME)  # the control
        self.assertEqual(app.lookup_peer((other, peer[1]), local), (app.PEER_NOTFOUND, None))  # peer address
        self.assertEqual(app.lookup_peer(peer, (other, local[1])), (app.PEER_NOTFOUND, None))  # our address

    def test_a_peer_or_listener_on_another_ipv4_address_with_the_same_ports_is_not_found(self):
        self.expect_address_matters(socket.AF_INET, "127.0.0.1", "127.0.0.2")

    def test_a_peer_or_listener_on_another_ipv6_address_with_the_same_ports_is_not_found(self):
        self.expect_address_matters(socket.AF_INET6, "::1", "::2")

    def test_a_name_that_is_not_an_inet_socket_name_raises(self):
        for bad in (None, "path", ("only",), ("not an ip", 5)):
            with self.assertRaises(ValueError):
                app.lookup_peer(bad, ("127.0.0.1", 5))

    def test_an_unsupported_platform_raises_peer_unsupported(self):
        with mock.patch.object(sys, "platform", "darwin"), self.assertRaises(app.PeerUnsupported):
            app.lookup_peer(("127.0.0.1", 1), ("127.0.0.1", 2))


@unittest.skipUnless(IS_WIN, "Windows only")
class PeerWindowsCase(unittest.TestCase):
    def test_row_sizes_are_those_of_the_mib_owner_module_rows(self):
        # The SDK layouts, with the compiler's natural alignment (LARGE_INTEGER on 8 bytes).
        import ctypes
        from ctypes import wintypes

        class Row4(ctypes.Structure):  # MIB_TCPROW_OWNER_MODULE
            _fields_ = [("dwState", wintypes.DWORD), ("dwLocalAddr", wintypes.DWORD), ("dwLocalPort", wintypes.DWORD),
                        ("dwRemoteAddr", wintypes.DWORD), ("dwRemotePort", wintypes.DWORD), ("dwOwningPid", wintypes.DWORD),
                        ("liCreateTimestamp", ctypes.c_int64), ("OwningModuleInfo", ctypes.c_uint64 * 16)]

        class Row6(ctypes.Structure):  # MIB_TCP6ROW_OWNER_MODULE
            _fields_ = [("ucLocalAddr", ctypes.c_ubyte * 16), ("dwLocalScopeId", wintypes.DWORD),
                        ("dwLocalPort", wintypes.DWORD), ("ucRemoteAddr", ctypes.c_ubyte * 16),
                        ("dwRemoteScopeId", wintypes.DWORD), ("dwRemotePort", wintypes.DWORD),
                        ("dwState", wintypes.DWORD), ("dwOwningPid", wintypes.DWORD),
                        ("liCreateTimestamp", ctypes.c_int64), ("OwningModuleInfo", ctypes.c_uint64 * 16)]

        class Table4(ctypes.Structure):
            _fields_ = [("dwNumEntries", wintypes.DWORD), ("table", Row4 * 1)]

        class Table6(ctypes.Structure):
            _fields_ = [("dwNumEntries", wintypes.DWORD), ("table", Row6 * 1)]

        self.assertEqual((ctypes.sizeof(Row4), ctypes.sizeof(Row6)), (160, 192))
        self.assertEqual((app._WIN_ROW_SIZE[app._WIN_AF_INET], app._WIN_ROW_SIZE[app._WIN_AF_INET6]), (160, 192))
        self.assertEqual(Table4.table.offset, app._WIN_TABLE_HEADER)
        self.assertEqual(Table6.table.offset, app._WIN_TABLE_HEADER)
        for fam, row in ((app._WIN_AF_INET, Row4), (app._WIN_AF_INET6, Row6)):
            self.assertEqual(row.dwOwningPid.offset, app._WIN_PID_OFFSET[fam])
            self.assertEqual(row.liCreateTimestamp.offset, app._WIN_TIME_OFFSET[fam])

    def real_table_finds_own_connection(self, family, host):
        cli, conn = loopback_pair(family, host)
        self.addCleanup(cli.close)
        self.addCleanup(conn.close)
        peer, local = app._endpoint(conn.getpeername()), app._endpoint(conn.getsockname())
        fam = app._WIN_AF_INET if family == socket.AF_INET else app._WIN_AF_INET6
        buf = app._windows_tcp_table(app._win_api(), fam)
        found = app._scan_windows_table(buf, fam, peer, local)
        self.assertEqual([pid for pid, _ in found], [os.getpid()])
        created = found[0][1]
        self.assertGreater(created, 0)  # the table does give a socket creation time
        now = int((time.time() + 11644473600) * 10_000_000)  # FILETIME of now
        self.assertLess(abs(now - created), 60 * 10_000_000)
        # The two sockets of the pair are two rows: the other one is the server side (peer and local swapped).
        back = app._scan_windows_table(buf, fam, local, peer)
        self.assertEqual([pid for pid, _ in back], [os.getpid()])

    def test_the_real_ipv4_table_has_the_documented_layout(self):
        self.real_table_finds_own_connection(socket.AF_INET, "127.0.0.1")

    def test_the_real_ipv6_table_has_the_documented_layout(self):
        self.real_table_finds_own_connection(socket.AF_INET6, "::1")

    def test_ports_come_out_of_network_byte_order(self):
        self.assertEqual(app._win_port(socket.htons(8765)), 8765)
        self.assertEqual(app._win_port(socket.htons(54321)), 54321)
        self.assertEqual(app._win_port(0xFFFF0000 | socket.htons(80)), 80)  # only the low 16 bits count

    # What a process of another account looks like depends on who runs the test: an unelevated user is
    # denied at OpenProcess (denied), an elevated administrator opens it but is denied its token
    # (notoken), and one that can read the token sees a foreign SID (other). Never "same".
    NOT_OURS = (app.PEER_DENIED, app.PEER_OTHER, app.PEER_NOTOKEN, app.PEER_GONE)

    @staticmethod
    def system_processes():
        """[(pid, exe name)] of the processes that only ever run as SYSTEM, from a toolhelp snapshot
        (no process is opened)."""
        import ctypes
        from ctypes import wintypes

        class ProcessEntry(ctypes.Structure):  # PROCESSENTRY32W
            _fields_ = [("dwSize", wintypes.DWORD), ("cntUsage", wintypes.DWORD), ("th32ProcessID", wintypes.DWORD),
                        ("th32DefaultHeapID", ctypes.c_size_t), ("th32ModuleID", wintypes.DWORD),
                        ("cntThreads", wintypes.DWORD), ("th32ParentProcessID", wintypes.DWORD),
                        ("pcPriClassBase", ctypes.c_long), ("dwFlags", wintypes.DWORD), ("szExeFile", ctypes.c_wchar * 260)]

        k32 = ctypes.WinDLL("kernel32", use_last_error=True)
        k32.CreateToolhelp32Snapshot.argtypes = [wintypes.DWORD, wintypes.DWORD]
        k32.CreateToolhelp32Snapshot.restype = wintypes.HANDLE
        k32.Process32FirstW.argtypes = k32.Process32NextW.argtypes = [wintypes.HANDLE, ctypes.POINTER(ProcessEntry)]
        k32.Process32FirstW.restype = k32.Process32NextW.restype = wintypes.BOOL
        k32.CloseHandle.argtypes = [wintypes.HANDLE]
        snap = k32.CreateToolhelp32Snapshot(0x2, 0)  # TH32CS_SNAPPROCESS
        if snap in (None, wintypes.HANDLE(-1).value):
            return []
        # Not svchost.exe: its per-user service instances run as the signed-in user.
        names = {"smss.exe", "csrss.exe", "wininit.exe", "services.exe", "lsass.exe", "spoolsv.exe"}
        found = []
        try:
            entry = ProcessEntry()
            entry.dwSize = ctypes.sizeof(entry)
            ok = k32.Process32FirstW(snap, ctypes.byref(entry))
            while ok:
                if entry.szExeFile.lower() in names and entry.th32ProcessID not in (0, os.getpid()):
                    found.append((entry.th32ProcessID, entry.szExeFile))
                ok = k32.Process32NextW(snap, ctypes.byref(entry))
        finally:
            k32.CloseHandle(snap)
        return found

    def test_another_accounts_process_is_never_ours(self):
        api = app._win_api()
        own = app._windows_sid()
        # pid 4 is System, a process of the SYSTEM account, whoever runs the test.
        verdict = app._windows_pid_verdict(api, 4, own)
        self.assertIn(verdict, self.NOT_OURS)
        self.assertNotEqual(verdict, app.PEER_SAME)
        # Our own is ours, so "never same" above is not a verdict that is always given.
        self.assertEqual(app._windows_pid_verdict(api, os.getpid(), own), app.PEER_SAME)

    def test_system_processes_are_never_ours_unless_the_test_runs_as_system(self):
        own = app._windows_sid()
        if own == "S-1-5-18":
            self.skipTest("this test process runs as SYSTEM")
        api = app._win_api()
        procs = self.system_processes()
        if not procs:
            self.skipTest("no service process is listed")
        verdicts = {}
        for pid, name in procs[:25]:
            try:
                verdict = app._windows_pid_verdict(api, pid, own)
            except OSError:
                continue  # the lookup itself failed: the gate refuses that too (peer-unknown)
            verdicts.setdefault(verdict, []).append(name)
        for verdict, names in verdicts.items():
            self.assertIn(verdict, self.NOT_OURS, names)
        self.assertNotIn(app.PEER_SAME, verdicts)

    def test_a_process_that_is_gone_is_gone_not_ours_and_not_foreign(self):
        api = app._win_api()
        self.assertEqual(app._windows_pid_verdict(api, 0x7FFFFFF0, app._windows_sid()), app.PEER_GONE)

    def test_our_own_pid_is_ours(self):
        api = app._win_api()
        self.assertEqual(app._windows_pid_verdict(api, os.getpid(), app._windows_sid()), app.PEER_SAME)
        self.assertEqual(app._windows_pid_verdict(api, os.getpid(), "S-1-5-21-0-0-0-1"), app.PEER_OTHER)

    def test_lookups_do_not_leak_handles(self):
        import ctypes
        from ctypes import wintypes
        k32 = ctypes.WinDLL("kernel32", use_last_error=True)
        k32.GetCurrentProcess.restype = wintypes.HANDLE
        k32.GetProcessHandleCount.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]

        def handles():
            n = wintypes.DWORD()
            self.assertTrue(k32.GetProcessHandleCount(k32.GetCurrentProcess(), ctypes.byref(n)))
            return n.value

        cli, conn = loopback_pair(socket.AF_INET, "127.0.0.1")
        self.addCleanup(cli.close)
        self.addCleanup(conn.close)
        app.lookup_peer(conn.getpeername(), conn.getsockname())  # first call: lazy loads
        before = handles()
        for _ in range(300):
            app.lookup_peer(conn.getpeername(), conn.getsockname())
        api = app._win_api()
        for _ in range(100):
            app._windows_pid_verdict(api, 4, "x")  # the denied path too
        self.assertLess(handles() - before, 5)

    def test_the_table_buffer_grows_until_it_fits(self):
        sizes = [100, 5000, None]
        calls = []

        class FakeIp:
            def GetExtendedTcpTable(self, buf, size_ref, order, family, table_class, reserved):
                calls.append((None if buf is None else len(buf), size_ref._obj.value, family, table_class))
                want = sizes[len(calls) - 1]
                if want is None:
                    return 0
                size_ref._obj.value = want  # the table grew between two calls
                return 122

        api = types.SimpleNamespace(iphlpapi=FakeIp())
        buf = app._windows_tcp_table(api, app._WIN_AF_INET6)
        self.assertEqual([c[0] is None for c in calls], [True, False, False])
        self.assertGreaterEqual(len(buf), 5000)
        self.assertEqual({(c[2], c[3]) for c in calls}, {(23, 8)})  # AF_INET6, TCP_TABLE_OWNER_MODULE_CONNECTIONS
        self.assertIsInstance(buf, bytearray)

    def test_any_other_table_error_raises(self):
        class FakeIp:
            def GetExtendedTcpTable(self, *args):
                return 87

        with self.assertRaises(OSError):
            app._windows_tcp_table(types.SimpleNamespace(iphlpapi=FakeIp()), app._WIN_AF_INET)


# Literal /proc/net text, as a little-endian host prints it. Ports: 0x2223 = 8739 (the helper),
# 0xD431.. = 54321.. (clients). 127.0.0.1 is 0100007F, ::1 is 00000000000000000000000001000000 and
# the IPv4-mapped 127.0.0.1 is 0000000000000000FFFF00000100007F.
PROC_TCP = """\
  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 0100007F:2223 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 11111 1 0000000000000000 100 0 0 10 0
   1: 0100007F:2223 0100007F:D431 01 00000000:00000000 00:00000000 00000000  1000        0 12345 1 0000000000000000 20 4 30 10 -1
   2: 0100007F:D431 0100007F:2223 01 00000000:00000000 00:00000000 00000000  1000        0 12346 1 0000000000000000 20 4 30 10 -1
   3: 0100007F:D432 0100007F:2223 01 00000000:00000000 00:00000000 00000000     0        0 12347 1 0000000000000000 20 4 30 10 -1
   4: 0100007F:D433 0100007F:1F90 01 00000000:00000000 00:00000000 00000000  2000        0 12348 1 0000000000000000 20 4 30 10 -1
   garbage line that is not a socket
   5: 0100007F:D434 0100007F:2223 01 00000000:00000000 00:00000000 00000000
"""
PROC_TCP6 = """\
  sl  local_address                         remote_address                        st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 00000000000000000000000001000000:D437 00000000000000000000000001000000:2223 01 00000000:00000000 00:00000000 00000000  1000        0 22221 1 0000000000000000 20 4 30 10 -1
   1: 00000000000000000000000001000000:D438 00000000000000000000000001000000:2223 01 00000000:00000000 00:00000000 00000000  1001        0 22222 1 0000000000000000 20 4 30 10 -1
   2: 0000000000000000FFFF00000100007F:D439 0000000000000000FFFF00000100007F:2223 01 00000000:00000000 00:00000000 00000000  1000        0 22223 1 0000000000000000 20 4 30 10 -1
   3: 0000000000000000FFFF00000100007F:D43A 0000000000000000FFFF00000100007F:2223 01 00000000:00000000 00:00000000 00000000  1001        0 22224 1 0000000000000000 20 4 30 10 -1
"""


@unittest.skipIf(sys.byteorder != "little", "the samples are little-endian")
class PeerLinuxParserCase(unittest.TestCase):
    UID = 1000

    def lookup(self, peer, local, tcp=PROC_TCP, tcp6=PROC_TCP6, uid=UID):
        def read(name):
            text = {"tcp": tcp, "tcp6": tcp6}[name]
            if text is None:
                raise FileNotFoundError(name)
            return text

        return app._linux_peer(app._endpoint(peer), app._endpoint(local), read=read, uid=uid)

    def test_rows_are_parsed_and_garbage_is_skipped(self):
        rows = app.parse_proc_net(PROC_TCP)
        self.assertEqual(len(rows), 5)  # the header, the garbage line and the line without a uid are not rows
        lip, lport, rip, rport, uid = rows[1]
        self.assertEqual((str(lip), lport, str(rip), rport, uid), ("127.0.0.1", 8739, "127.0.0.1", 54321, 1000))
        rows6 = app.parse_proc_net(PROC_TCP6)
        self.assertEqual([str(r[0]) for r in rows6], ["::1", "::1", "127.0.0.1", "127.0.0.1"])  # mapped ones come out as IPv4

    def test_our_own_ipv4_peer_is_ours(self):
        self.assertEqual(self.lookup(("127.0.0.1", 54321), ("127.0.0.1", 8739)), (app.PEER_SAME, None))

    def test_a_peer_with_another_uid_is_another_user(self):
        self.assertEqual(self.lookup(("127.0.0.1", 54322), ("127.0.0.1", 8739)), (app.PEER_OTHER, None))

    def test_the_uid_is_compared_with_ours_not_with_the_listener(self):
        # The same row from a process that runs as uid 0 (root) is not the user's.
        self.assertEqual(self.lookup(("127.0.0.1", 54321), ("127.0.0.1", 8739), uid=0)[0], app.PEER_OTHER)

    def test_a_peer_that_is_not_in_the_table_is_not_found(self):
        self.assertEqual(self.lookup(("127.0.0.1", 59999), ("127.0.0.1", 8739)), (app.PEER_NOTFOUND, None))
        # Same client port, but a connection to another service: not ours to judge.
        self.assertEqual(self.lookup(("127.0.0.1", 54323), ("127.0.0.1", 8739)), (app.PEER_NOTFOUND, None))

    def test_ipv6_loopback(self):
        self.assertEqual(self.lookup(("::1", 54327, 0, 0), ("::1", 8739, 0, 0)), (app.PEER_SAME, None))
        self.assertEqual(self.lookup(("::1", 54328, 0, 0), ("::1", 8739, 0, 0)), (app.PEER_OTHER, None))

    def test_ipv4_mapped_rows_match_a_mapped_or_a_plain_peer(self):
        for peer, local in (
            (("::ffff:127.0.0.1", 54329, 0, 0), ("::ffff:127.0.0.1", 8739, 0, 0)),
            (("127.0.0.1", 54329), ("127.0.0.1", 8739)),
        ):
            self.assertEqual(self.lookup(peer, local), (app.PEER_SAME, None))
        self.assertEqual(self.lookup(("127.0.0.1", 54330), ("127.0.0.1", 8739))[0], app.PEER_OTHER)

    def test_a_missing_tcp6_file_is_fine_a_missing_tcp_file_too_but_not_both(self):
        self.assertEqual(self.lookup(("127.0.0.1", 54321), ("127.0.0.1", 8739), tcp6=None)[0], app.PEER_SAME)
        self.assertEqual(self.lookup(("::1", 54327, 0, 0), ("::1", 8739, 0, 0), tcp=None)[0], app.PEER_SAME)
        with self.assertRaises(OSError):
            self.lookup(("127.0.0.1", 54321), ("127.0.0.1", 8739), tcp=None, tcp6=None)

    def test_a_row_for_the_peer_of_another_user_in_either_table_wins_over_ours(self):
        # The same connection in tcp and in tcp6 (a mapped row), with two owners (it should not
        # happen): one foreign owner is enough.
        mapped = (
            "   9: 0000000000000000FFFF00000100007F:D431 0000000000000000FFFF00000100007F:2223 01 "
            "00000000:00000000 00:00000000 00000000  0 0 1 1 0\n"
        )
        self.assertEqual(self.lookup(("127.0.0.1", 54321), ("127.0.0.1", 8739), tcp6=PROC_TCP6 + mapped)[0], app.PEER_OTHER)

    def test_the_first_row_of_a_table_is_the_connection(self):
        dup = PROC_TCP + "   9: 0100007F:D431 0100007F:2223 01 00000000:00000000 00:00000000 00000000  0 0 1 1 0\n"
        self.assertEqual(self.lookup(("127.0.0.1", 54321), ("127.0.0.1", 8739), tcp=dup)[0], app.PEER_SAME)

    # Only the ADDRESS differs from a row in the table (the ports are the same): each address
    # comparison alone must be enough to turn the row down.
    def test_a_peer_on_another_address_with_the_same_ports_is_not_the_row(self):
        text = (
            "  sl  local_address rem_address   st\n"
            "   0: 0200007F:D431 0100007F:2223 01 00000000:00000000 00:00000000 00000000  0        0 1 1 0000000000000000 20 4 30 10 -1\n"
        )
        self.assertEqual(self.lookup(("127.0.0.1", 54321), ("127.0.0.1", 8739), tcp=text, tcp6=None), (app.PEER_NOTFOUND, None))
        self.assertEqual(self.lookup(("127.0.0.2", 54321), ("127.0.0.1", 8739), tcp=text, tcp6=None)[0], app.PEER_OTHER)

    def test_a_row_for_another_remote_address_with_the_same_ports_is_not_the_row(self):
        text = (
            "  sl  local_address rem_address   st\n"
            "   0: 0100007F:D431 0200007F:2223 01 00000000:00000000 00:00000000 00000000  0        0 1 1 0000000000000000 20 4 30 10 -1\n"
        )
        self.assertEqual(self.lookup(("127.0.0.1", 54321), ("127.0.0.1", 8739), tcp=text, tcp6=None), (app.PEER_NOTFOUND, None))
        self.assertEqual(self.lookup(("127.0.0.1", 54321), ("127.0.0.2", 8739), tcp=text, tcp6=None)[0], app.PEER_OTHER)

    def test_the_same_address_check_holds_for_ipv6_too(self):
        # ::2 is 00000000000000000000000002000000
        text = (
            "  sl  local_address remote_address st\n"
            "   0: 00000000000000000000000002000000:D437 00000000000000000000000001000000:2223 01 "
            "00000000:00000000 00:00000000 00000000  0 0 1 1 0000000000000000 20 4 30 10 -1\n"
        )
        self.assertEqual(self.lookup(("::1", 54327, 0, 0), ("::1", 8739, 0, 0), tcp=None, tcp6=text), (app.PEER_NOTFOUND, None))
        self.assertEqual(self.lookup(("::2", 54327, 0, 0), ("::1", 8739, 0, 0), tcp=None, tcp6=text)[0], app.PEER_OTHER)

    def test_lines_without_the_ports_are_skipped_before_they_are_parsed(self):
        # A line that cannot parse but does not carry the ports costs nothing and breaks nothing.
        head, _, rows = PROC_TCP.partition("\n")
        text = head + "\n   7: not-a-row\n   8: 0100007F:D431\n" + rows
        with mock.patch.object(app, "_proc_row", wraps=app._proc_row) as parsed:
            self.assertEqual(self.lookup(("127.0.0.1", 54321), ("127.0.0.1", 8739), tcp=text, tcp6=None)[0], app.PEER_SAME)
        # Only the two lines that carry both ports are parsed (the listener's row does not); the search
        # stops at the matching one.
        self.assertEqual(parsed.call_count, 2)


class StubLookup:
    """Stands in for lookup_peer: returns the given results in turn (the last one repeats), raises exceptions."""

    def __init__(self, *results):
        self.results = list(results)
        self.calls = []

    def __call__(self, peer, local):
        self.calls.append((peer, local))
        result = self.results.pop(0) if len(self.results) > 1 else self.results[0]
        if isinstance(result, BaseException):
            raise result
        return result


OTHER = (app.PEER_OTHER, 4242)
SAME = (app.PEER_SAME, 1)
NOTFOUND = (app.PEER_NOTFOUND, None)


class PeerGateCase(unittest.IsolatedAsyncioTestCase):
    """Who is allowed to use the helper: only the user it runs as, decided before any role is given."""

    async def asyncSetUp(self):
        self._saved_state = app.S
        app.S = app.State()
        self.log, self.log_lines = make_log()
        self.capture = StubCapture()
        self.hooks = RecordingHooks()
        self.sleeps = []
        self.relays = []

    async def asyncTearDown(self):
        for relay, runner in self.relays:
            await relay.close()
            await asyncio.wait_for(runner, 3)
        app.S = self._saved_state

    async def start(self, lookup, strict=True, peer_check=True, clock=None, host="127.0.0.1"):
        async def sleep(delay):
            self.sleeps.append(delay)

        relay = app.Relay(host, 0, self.log, self.hooks, self.capture, clock=clock, peer_check=peer_check,
                          peer_lookup=lookup, peer_strict=strict, peer_sleep=sleep)
        await relay.start()
        self.relays.append((relay, asyncio.ensure_future(relay.run())))
        self.relay = relay
        self.url = f"ws://{host}:{relay.port}"
        return relay

    async def refused(self, origin=THEME, status=403):
        kw = {"origin": origin} if origin else {}
        with self.assertRaises(InvalidStatus) as cm:
            async with connect(self.url, **kw):
                pass
        response = cm.exception.response
        self.assertEqual(response.status_code, status)
        self.assertEqual(response.body, b"Forbidden\n")
        return response.headers.get(app.PEER_HEADER)

    def count(self, text):
        return sum(text in line for line in self.log_lines.lines)

    # -- another user

    async def test_another_users_theme_and_control_clients_get_403_other_user_and_no_role(self):
        await self.start(StubLookup(OTHER))
        self.assertEqual(await self.refused(THEME), "other-user")
        self.assertEqual(await self.refused(None), "other-user")
        await asyncio.sleep(0.05)
        self.assertEqual(self.relay.clients, set())
        self.assertFalse(app.S.connected)
        self.assertEqual(self.capture.calls, [])  # the capture never ran for them
        self.assertEqual(self.hooks.modes, [])
        self.assertFalse(self.hooks.exited.is_set())
        self.assertEqual(self.count("client connected"), 0)
        self.assertEqual(self.count("rejected peer user=other pid=4242"), 2)

    async def test_the_refusal_is_a_bare_403_on_the_wire_and_carries_the_header(self):
        await self.start(StubLookup(OTHER))
        reader, writer = await asyncio.open_connection("127.0.0.1", self.relay.port)
        try:
            writer.write(
                f"GET / HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                f"Origin: {THEME}\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n".encode()
            )
            await writer.drain()
            raw = await asyncio.wait_for(reader.read(65536), 3)
        finally:
            writer.close()
        head, _, body = raw.partition(b"\r\n\r\n")
        self.assertTrue(head.startswith(b"HTTP/1.1 403 "), head)
        self.assertIn(b"X-SpoSync: other-user", head)
        self.assertNotIn(b"101", head.split(b"\r\n")[0])
        self.assertEqual(body, b"Forbidden\n")

    async def test_the_origin_is_checked_before_the_peer_and_a_hostile_one_costs_no_lookup(self):
        lookup = StubLookup(OTHER)
        await self.start(lookup)
        self.assertIsNone(await self.refused(EVIL))  # plain 403: no X-SpoSync header ...
        self.assertEqual(lookup.calls, [])  # ... and the connection table was never read
        self.assertEqual(self.count("rejected origin"), 1)
        self.assertEqual(self.count("rejected peer"), 0)

    async def test_only_a_missing_or_the_theme_origin_reaches_the_peer_check(self):
        lookup = StubLookup(SAME)
        await self.start(lookup)
        async with connect(self.url) as ws:  # no Origin: a control client
            await ws.send(json.dumps({"type": "control", "action": "ping"}))
            await recv_json(ws)
        self.assertEqual(len(lookup.calls), 1)
        async with self.theme_client() as ws:
            await recv_type(ws, "status")
        self.assertEqual(len(lookup.calls), 2)
        for origin in (EVIL, "null", "https://xpui.app.spotify.com.evil.example"):
            await self.refused(origin)
        self.assertEqual(len(lookup.calls), 2)  # none of the hostile ones was looked up

    async def test_a_refused_peer_with_the_theme_origin_is_refused_by_the_peer_check(self):
        await self.start(StubLookup(OTHER))
        self.assertEqual(await self.refused(THEME), "other-user")
        self.assertEqual(self.count("rejected origin"), 0)
        self.assertEqual(self.count("rejected peer user=other"), 1)

    async def test_a_process_that_cannot_be_opened_is_refused_like_another_user(self):
        await self.start(StubLookup((app.PEER_DENIED, 77)))
        self.assertEqual(await self.refused(), "other-user")
        self.assertEqual(self.count("rejected peer user=other pid=77"), 1)
        self.assertEqual(self.sleeps, [])  # no retry: this is an answer, not a missing row

    async def test_the_clients_of_the_user_are_not_disturbed_by_a_refused_one(self):
        await self.start(StubLookup(SAME, OTHER))
        async with connect(self.url, origin=THEME) as good:
            await recv_type(good, "status")
            await good.send(json.dumps({"type": "update", "title": "mine", "visualizer": True}))
            self.assertTrue(await until(lambda: self.capture.calls[-1:] == [True]))
            calls = list(self.capture.calls)
            self.assertEqual(await self.refused(THEME), "other-user")
            self.assertEqual(await self.refused(None), "other-user")
            self.assertEqual(len(self.relay.clients), 1)
            self.assertEqual(app.S.title, "mine")
            self.assertEqual(self.capture.calls, calls)  # the refused ones did not touch the capture
            await self.relay.broadcast({"type": "command", "cmd": "next"})
            self.assertEqual((await recv_type(good, "command"))["cmd"], "next")

    async def test_a_refusal_never_names_the_user(self):
        await self.start(StubLookup(OTHER, (app.PEER_DENIED, 5), NOTFOUND))
        for _ in range(3):
            await self.refused()
        text = "\n".join(self.log_lines.lines)
        self.assertNotRegex(text, r"S-1-5|uid|user=(?!other)|USERNAME")
        self.assertEqual(self.count("rejected peer"), 3)

    async def test_a_mismatch_is_refused_even_where_a_failed_lookup_is_let_through(self):
        await self.start(StubLookup(OTHER), strict=False)
        self.assertEqual(await self.refused(), "other-user")
        self.assertEqual(self.count("peer check unavailable"), 0)

    async def test_an_unknown_pid_is_logged_as_a_question_mark(self):
        await self.start(StubLookup((app.PEER_OTHER, None)), strict=False)
        await self.refused()
        self.assertIn("rejected peer user=other pid=?", self.log_lines.lines)

    # -- the connection is not in the table

    async def test_a_missing_row_is_looked_up_again_three_times_30_ms_apart_then_refused_as_unknown(self):
        lookup = StubLookup(NOTFOUND)
        await self.start(lookup)
        self.assertEqual(await self.refused(), "peer-unknown")
        self.assertEqual(len(lookup.calls), 1 + app.PEER_RETRIES)
        self.assertEqual(self.sleeps, [0.03] * 3)
        self.assertEqual(self.log_lines.lines.count("rejected peer unknown (connection not found)"), 1)
        self.assertEqual(self.count("user=other"), 0)
        self.assertEqual(self.relay.clients, set())
        self.assertEqual(self.capture.calls, [])

    async def test_a_row_that_shows_up_on_a_retry_lets_the_client_in(self):
        lookup = StubLookup(NOTFOUND, NOTFOUND, SAME)
        await self.start(lookup)
        async with self.theme_client() as ws:
            await recv_type(ws, "status")
        self.assertEqual(len(lookup.calls), 3)
        self.assertEqual(self.sleeps, [0.03, 0.03])
        self.assertEqual(self.count("rejected peer"), 0)

    async def test_a_row_that_shows_up_as_another_user_on_a_retry_is_refused_as_another_user(self):
        await self.start(StubLookup(NOTFOUND, OTHER))
        self.assertEqual(await self.refused(), "other-user")
        self.assertEqual(self.sleeps, [0.03])

    def theme_client(self):
        return connect(self.url, origin=THEME)

    # -- the lookup fails

    async def test_a_failed_lookup_is_refused_as_unknown_on_windows_style_platforms(self):
        lookup = StubLookup(OSError("secret detail"))
        await self.start(lookup)
        self.assertEqual(await self.refused(), "peer-unknown")
        self.assertEqual(len(lookup.calls), 1)  # an error is not retried
        self.assertEqual(self.sleeps, [])
        self.assertIn("rejected peer unknown (lookup error)", self.log_lines.lines)
        self.assertIn("peer lookup failed: OSError", self.log_lines.lines)
        self.assertNotIn("secret", "\n".join(self.log_lines.lines))

    async def test_a_failed_lookup_is_let_through_with_one_warning_where_not_strict(self):
        await self.start(StubLookup(OSError("x")), strict=False)
        for _ in range(3):
            async with self.theme_client() as ws:
                await recv_type(ws, "status")
        self.assertEqual(self.count("peer check unavailable"), 1)
        self.assertEqual(self.count("rejected peer"), 0)

    async def test_a_row_that_never_shows_up_is_let_through_with_one_warning_where_not_strict(self):
        lookup = StubLookup(NOTFOUND)
        await self.start(lookup, strict=False)
        for _ in range(2):
            async with self.theme_client() as ws:
                await recv_type(ws, "status")
            async with connect(self.url) as ws:
                await ws.send(json.dumps({"type": "control", "action": "ping"}))
                self.assertEqual((await recv_json(ws))["app"], "sposync")
        self.assertEqual(len(lookup.calls), 4 * (1 + app.PEER_RETRIES))
        self.assertEqual(self.count("peer check unavailable"), 1)

    async def test_an_unsupported_platform_is_let_through_with_one_warning(self):
        await self.start(StubLookup(app.PeerUnsupported("sunos5")), strict=False)
        for _ in range(2):
            async with self.theme_client() as ws:
                await recv_type(ws, "status")
        self.assertEqual(self.count("peer check unavailable"), 1)
        self.assertEqual(self.count("rejected peer"), 0)

    # -- the log

    async def test_rejection_lines_are_capped_per_process_then_counted_every_ten_minutes(self):
        clock = FakeClock()
        await self.start(StubLookup(OTHER), clock=clock)
        for _ in range(app.MAX_PEER_LOGS + 3):
            await self.refused()
        self.assertEqual(self.count("rejected peer user=other"), app.MAX_PEER_LOGS)
        self.assertEqual(self.count("more in the last"), 0)
        clock.now += app.PEER_LOG_INTERVAL - 1
        await self.refused()
        self.assertEqual(self.count("more in the last"), 0)
        clock.now += 1
        await self.refused()
        self.assertIn("rejected peer: 5 more in the last 10 min", self.log_lines.lines)
        for _ in range(3):
            await self.refused()
        self.assertEqual(self.count("more in the last"), 1)  # counted, not logged each time
        clock.now += app.PEER_LOG_INTERVAL
        await self.refused()
        self.assertIn("rejected peer: 4 more in the last 10 min", self.log_lines.lines)
        self.assertEqual(self.count("rejected peer user=other"), app.MAX_PEER_LOGS)

    async def test_unknown_rejections_share_the_cap_and_live_outside_the_noise_budget(self):
        await self.start(StubLookup(NOTFOUND))
        for _ in range(app.NOISE_LINES + 5):  # the noise budget is spent first ...
            self.relay._noise(logging.INFO, "filler")
        await self.refused()
        self.assertIn("rejected peer unknown (connection not found)", self.log_lines.lines)  # ... and the line still comes

    # -- the escape hatch and the real thing

    async def test_no_peer_check_skips_the_lookup_and_says_so_at_start(self):
        lookup = StubLookup(AssertionError("must not be called"))
        await self.start(lookup, peer_check=False)
        self.assertIn("peer check disabled by --no-peer-check", self.log_lines.lines)
        async with self.theme_client() as ws:
            await recv_type(ws, "status")
        async with connect(self.url) as ws:
            await ws.send(json.dumps({"type": "control", "action": "ping"}))
            self.assertTrue((await recv_json(ws))["ok"])
        self.assertEqual(lookup.calls, [])
        # The origin allowlist still applies.
        with self.assertRaises(InvalidStatus) as cm:
            async with connect(self.url, origin=EVIL):
                pass
        self.assertIsNone(cm.exception.response.headers.get(app.PEER_HEADER))

    async def test_the_check_is_on_by_default_and_silent_about_it(self):
        relay = app.Relay("127.0.0.1", 0, self.log, self.hooks, self.capture)
        self.assertTrue(relay._peer_check)
        await relay.start()
        await relay.close()
        self.assertEqual(self.count("--no-peer-check"), 0)

    @unittest.skipUnless(CAN_LOOKUP, "no peer lookup on this platform")
    async def test_clients_of_this_user_pass_the_real_check_over_ipv4_and_ipv6(self):
        for host in ("127.0.0.1", "::1"):
            try:
                await self.start(None, host=host)
            except OSError:
                self.assertEqual(host, "::1")  # no IPv6 loopback on this machine
                continue
            url = f"ws://[{host}]:{self.relay.port}" if ":" in host else self.url
            async with connect(url, origin=THEME) as ws:
                self.assertEqual(await recv_json(ws), {"type": "status", "ui": False})
            async with connect(url) as ws:
                await ws.send(json.dumps({"type": "control", "action": "ping"}))
                reply = await recv_json(ws)
                self.assertEqual((reply["app"], reply["owner"]), ("sposync", app.owner_id()))
            with self.assertRaises(InvalidStatus) as cm:  # a hostile page of the same user: still 403 by origin
                async with connect(url, origin=EVIL):
                    pass
            self.assertEqual(cm.exception.response.status_code, 403)
            self.assertIsNone(cm.exception.response.headers.get(app.PEER_HEADER))
        self.assertEqual(self.count("rejected peer"), 0)
        self.assertEqual(self.count("peer check unavailable"), 0)


class PeerProbeCase(unittest.IsolatedAsyncioTestCase):
    """What a second helper (or --quit) makes of a refusal at the handshake."""

    async def asyncSetUp(self):
        self._saved_state = app.S
        app.S = app.State()
        self.log, self.log_lines = make_log()
        self.reached = []
        self.servers = []

    async def asyncTearDown(self):
        for server in self.servers:
            server.close()
            await server.wait_closed()
        app.S = self._saved_state

    async def refusing(self, header, status=403):
        async def handler(ws):
            self.reached.append(1)

        def process_request(connection, request):
            response = connection.respond(status, "Forbidden\n")
            if header is not None:
                response.headers[app.PEER_HEADER] = header
            return response

        server = await serve(handler, "127.0.0.1", 0, process_request=process_request)
        self.servers.append(server)
        return server.sockets[0].getsockname()[1]

    async def test_a_403_with_other_user_is_another_users_sposync(self):
        port = await self.refusing("other-user")
        self.assertEqual(await app.probe("127.0.0.1", port), ("other-user", None))
        self.assertEqual(await app.probe("127.0.0.1", port, "quit"), ("other-user", None))
        self.assertEqual(self.reached, [])

    async def test_a_403_with_peer_unknown_is_a_sposync_that_could_not_verify_us(self):
        port = await self.refusing("peer-unknown")
        self.assertEqual(await app.probe("127.0.0.1", port), ("unverified", None))
        self.assertEqual(await app.probe("127.0.0.1", port, "quit"), ("unverified", None))
        self.assertEqual(self.reached, [])  # no action is ever sent to it

    async def test_plain_403_and_other_statuses_are_foreign(self):
        for header, status in (("peer-unknown", 401), (None, 403), ("other-user", 401), ("other-user", 500), ("x", 403)):
            port = await self.refusing(header, status)
            self.assertEqual(await app.probe("127.0.0.1", port), ("foreign", None), (header, status))

    async def test_quit_never_reaches_another_users_helper_and_exits_busy(self):
        port = await self.refusing("other-user")
        code = await asyncio.to_thread(app.quit_running, "127.0.0.1", port, self.log)
        self.assertEqual(code, app.EXIT_PORT_BUSY)
        self.assertEqual(self.reached, [])
        self.assertIn(f"port {port} held by another user's SpoSync; not touching it", self.log_lines.lines)

    async def test_a_second_helper_logs_and_exits_2_when_the_port_is_another_users(self):
        port = await self.refusing("other-user")

        async def bind():
            raise OSError(errno.EADDRINUSE, "in use")

        code, state, reply = await app.claim_port("127.0.0.1", port, self.log, bind, "show")
        self.assertEqual((code, state, reply), (app.EXIT_PORT_BUSY, "other-user", None))
        self.assertIn(f"port {port} held by another user's SpoSync", self.log_lines.lines)
        self.assertEqual(app.refusal_text(state, "127.0.0.1", port), f"port {port} is held by another user's SpoSync")
        self.assertEqual(self.reached, [])

    async def test_a_peer_unknown_refusal_is_a_helper_that_could_not_verify_us_for_a_second_helper_and_for_quit(self):
        port = await self.refusing("peer-unknown")
        text = f"port {port} is held by a SpoSync that could not verify this program (see its log; --no-peer-check)"

        async def bind():
            raise OSError(errno.EADDRINUSE, "in use")

        code, state, reply = await app.claim_port("127.0.0.1", port, self.log, bind)
        self.assertEqual((code, state, reply), (app.EXIT_PORT_BUSY, "unverified", None))
        self.assertIn(text, self.log_lines.lines)
        self.assertEqual(app.refusal_text(state, "127.0.0.1", port), text)
        self.assertNotIn("in use by another program", app.refusal_text(state, "127.0.0.1", port))
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = await asyncio.to_thread(app.quit_running, "127.0.0.1", port, self.log)
        self.assertEqual(code, app.EXIT_PORT_BUSY)
        self.assertEqual(out.getvalue().strip(), text)
        self.assertEqual(self.log_lines.lines.count(text), 2)  # logged by both
        self.assertEqual(self.reached, [])

    async def test_a_foreign_403_is_still_in_use_by_another_program(self):
        port = await self.refusing(None)

        async def bind():
            raise OSError(errno.EADDRINUSE, "in use")

        code, state, _ = await app.claim_port("127.0.0.1", port, self.log, bind)
        self.assertEqual((code, state), (app.EXIT_PORT_BUSY, "foreign"))
        self.assertEqual(app.refusal_text(state, "127.0.0.1", port), f"port {port} is in use by another program")

    async def test_the_reply_owner_path_for_older_helpers_still_works(self):
        async with FakeRelayServer(sposync_reply("someone-else")) as fake:
            state, _ = await app.probe("127.0.0.1", fake.port, "quit")
            self.assertEqual((state, fake.actions), ("other-user", ["ping"]))
        async with FakeRelayServer(sposync_reply(app.owner_id())) as fake:
            state, _ = await app.probe("127.0.0.1", fake.port)
            self.assertEqual(state, "sposync")

    async def test_a_real_relay_that_sees_another_user_is_probed_as_other_user_and_keeps_running(self):
        hooks = RecordingHooks()
        relay = app.Relay("127.0.0.1", 0, self.log, hooks, StubCapture(), peer_lookup=StubLookup(OTHER), peer_strict=True)
        await relay.start()
        runner = asyncio.ensure_future(relay.run())
        try:
            self.assertEqual(await app.probe("127.0.0.1", relay.port, "quit"), ("other-user", None))
            self.assertEqual(await asyncio.to_thread(app.quit_running, "127.0.0.1", relay.port, self.log), app.EXIT_PORT_BUSY)
            await asyncio.sleep(0.4)  # a quit would call the exit hook after 0.2 s
            self.assertFalse(hooks.exited.is_set())
            self.assertNotIn("control action=quit", self.log_lines.lines)
        finally:
            await relay.close()
            await asyncio.wait_for(runner, 3)


class PeerFlagCase(unittest.TestCase):
    def test_the_flag_defaults_to_off_and_is_in_help(self):
        self.assertFalse(app.parse_args([]).no_peer_check)
        self.assertTrue(app.parse_args(["--no-peer-check"]).no_peer_check)
        out = io.StringIO()
        with contextlib.redirect_stdout(out), self.assertRaises(SystemExit):
            app.parse_args(["--help"])
        self.assertIn("--no-peer-check", out.getvalue())

    def test_the_background_helper_keeps_the_flag(self):
        log, _ = make_log()
        for peer_check, expected in ((True, False), (False, True)):
            with mock.patch.object(app, "wait_port_free", mock.AsyncMock(return_value=True)), \
                    mock.patch.object(app.subprocess, "Popen") as popen:
                app.respawn_headless("127.0.0.1", 18999, log, peer_check)
            self.assertEqual("--no-peer-check" in popen.call_args.args[0], expected)
            self.assertIn("--headless", popen.call_args.args[0])

    def test_the_ui_and_headless_runners_hand_the_flag_to_the_relay(self):
        self.assertFalse(app.SpotuiApp("127.0.0.1", 0, "window", make_log()[0], peer_check=False).relay._peer_check)
        self.assertTrue(app.SpotuiApp("127.0.0.1", 0, "window", make_log()[0]).relay._peer_check)

    def test_the_version_is_1_2_0(self):
        self.assertEqual(app.__version__, "1.2.0")


# ---------------------------------------------------------------- peer check: scanner, classification, load, self-test

def _ip(text):
    return ipaddress.ip_address(text).packed


def row4(laddr, lport, raddr, rport, pid, ts=0, state=5, lhi=0, rhi=0, modinfo=b""):
    """One MIB_TCPROW_OWNER_MODULE (160 bytes). lhi/rhi: what sits in the upper 16 bits of the port DWORDs."""
    return (
        struct.pack("<I", state) + _ip(laddr) + struct.pack("<I", socket.htons(lport) | (lhi << 16))
        + _ip(raddr) + struct.pack("<I", socket.htons(rport) | (rhi << 16)) + struct.pack("<I", pid)
        + struct.pack("<q", ts) + modinfo.ljust(128, b"\0")
    )


def row6(laddr, lport, raddr, rport, pid, ts=0, state=5, lscope=0, rscope=0, lhi=0, rhi=0, modinfo=b""):
    """One MIB_TCP6ROW_OWNER_MODULE (192 bytes)."""
    return (
        _ip(laddr) + struct.pack("<I", lscope) + struct.pack("<I", socket.htons(lport) | (lhi << 16))
        + _ip(raddr) + struct.pack("<I", rscope) + struct.pack("<I", socket.htons(rport) | (rhi << 16))
        + struct.pack("<II", state, pid) + struct.pack("<q", ts) + modinfo.ljust(128, b"\0")
    )


def table_of(rows, count=None):
    return struct.pack("<II", len(rows) if count is None else count, 0) + b"".join(rows)


class ScanWindowsTableCase(unittest.TestCase):
    """The table search on synthetic buffers: no OS needed."""
    PEER, LOCAL = 50000, 8765

    def scan4(self, buf, peer="127.0.0.1", local="127.0.0.1"):
        return app._scan_windows_table(
            buf, app._WIN_AF_INET, app._endpoint((peer, self.PEER)), app._endpoint((local, self.LOCAL)))

    def scan6(self, buf, peer="::1", local="::1", scope=0):
        return app._scan_windows_table(
            buf, app._WIN_AF_INET6, app._endpoint((peer, self.PEER, 0, scope)), app._endpoint((local, self.LOCAL, 0, 0)))

    def decoys4(self):
        a, b = "127.0.0.1", "127.0.0.1"
        return [
            row4(a, self.LOCAL, "0.0.0.0", 0, 11, state=2),  # the listening row
            row4(a, self.PEER, b, self.LOCAL, 0, state=11),  # TIME_WAIT: pid 0
            row4("127.0.0.2", self.PEER, b, self.LOCAL, 12),  # the same port on another address
            row4(a, self.PEER, "127.0.0.2", self.LOCAL, 13),  # the same ports, another remote address
            row4(a, self.PEER, b, 9999, 14),  # the same local port, another remote port
            row4(a, self.LOCAL, b, self.PEER, 15),  # the server's side of the same connection
            row4("10.0.0.5", 443, "10.0.0.9", self.PEER, 16),
        ]

    def test_a_row_is_found_first_in_the_middle_and_last(self):
        target = row4("127.0.0.1", self.PEER, "127.0.0.1", self.LOCAL, 1234, ts=777)
        decoys = self.decoys4()
        for at in (0, 3, len(decoys)):
            rows = decoys[:at] + [target] + decoys[at:]
            self.assertEqual(self.scan4(table_of(rows)), [(1234, 777)], at)

    def test_only_the_decoys_find_nothing(self):
        self.assertEqual(self.scan4(table_of(self.decoys4())), [])

    def test_garbage_in_the_upper_port_bits_is_ignored(self):
        target = row4("127.0.0.1", self.PEER, "127.0.0.1", self.LOCAL, 1234, ts=5, lhi=0xBEEF, rhi=0xDEAD)
        self.assertEqual(self.scan4(table_of(self.decoys4() + [target])), [(1234, 5)])
        self.assertEqual(app._win_port(0xBEEF0000 | socket.htons(self.PEER)), self.PEER)

    def test_two_rows_of_one_connection_are_both_returned_once(self):
        t1 = row4("127.0.0.1", self.PEER, "127.0.0.1", self.LOCAL, 1, ts=1)
        t2 = row4("127.0.0.1", self.PEER, "127.0.0.1", self.LOCAL, 2, ts=2)
        self.assertEqual(self.scan4(table_of([t1, t2, t1])), [(1, 1), (2, 2)])

    def test_bytes_that_look_like_a_row_inside_another_field_are_not_a_row(self):
        fake = _ip("127.0.0.1") + self.PEER.to_bytes(2, "big") + b"\0\0" + _ip("127.0.0.1") + self.LOCAL.to_bytes(2, "big") + b"\0\0"
        rows = [row4("10.0.0.1", 1, "10.0.0.2", 2, 99, modinfo=fake)]
        self.assertEqual(self.scan4(table_of(rows)), [])

    def test_an_empty_or_tiny_table_is_empty(self):
        for buf in (table_of([]), b"", b"\x01", bytearray(8), struct.pack("<II", 0, 0), struct.pack("<I", 5)):
            self.assertEqual(self.scan4(buf), [], buf)
            self.assertEqual(self.scan6(buf), [], buf)

    def test_a_buffer_shorter_than_its_count_is_read_as_far_as_it_goes(self):
        decoys = self.decoys4()[:2]
        target = row4("127.0.0.1", self.PEER, "127.0.0.1", self.LOCAL, 7, ts=3)
        full = table_of(decoys + [target], count=50)  # the header claims 50 rows
        self.assertEqual(self.scan4(full), [(7, 3)])
        self.assertEqual(self.scan4(full[:-1]), [])  # the last row is cut: it is not read
        self.assertEqual(self.scan4(full[:-100]), [])

    def test_rows_beyond_the_count_are_not_read(self):
        target = row4("127.0.0.1", self.PEER, "127.0.0.1", self.LOCAL, 7)
        self.assertEqual(self.scan4(table_of(self.decoys4() + [target], count=len(self.decoys4()))), [])

    def test_a_table_may_be_bytes_or_a_bytearray(self):
        buf = table_of([row4("127.0.0.1", self.PEER, "127.0.0.1", self.LOCAL, 7)])
        self.assertEqual(self.scan4(bytearray(buf)), [(7, 0)])
        self.assertEqual(self.scan4(bytes(buf)), [(7, 0)])

    def test_a_timestamp_of_zero_is_returned_as_zero(self):
        self.assertEqual(self.scan4(table_of([row4("127.0.0.1", self.PEER, "127.0.0.1", self.LOCAL, 7)])), [(7, 0)])

    # -- IPv6

    def decoys6(self):
        a = "::1"
        return [
            row6(a, self.LOCAL, "::", 0, 11, state=2),
            row6(a, self.PEER, a, self.LOCAL, 0, state=11),
            row6("::2", self.PEER, a, self.LOCAL, 12),
            row6(a, self.PEER, "::2", self.LOCAL, 13),
            row6(a, self.PEER, a, 9999, 14),
            row6(a, self.LOCAL, a, self.PEER, 15),
            row6("fe80::1", 443, "fe80::2", self.PEER, 16),
        ]

    def test_ipv6_rows_are_found_first_in_the_middle_and_last(self):
        target = row6("::1", self.PEER, "::1", self.LOCAL, 1234, ts=777)
        decoys = self.decoys6()
        for at in (0, 3, len(decoys)):
            self.assertEqual(self.scan6(table_of(decoys[:at] + [target] + decoys[at:])), [(1234, 777)], at)
        self.assertEqual(self.scan6(table_of(decoys)), [])

    def test_ipv6_garbage_in_the_upper_port_bits_is_ignored(self):
        target = row6("::1", self.PEER, "::1", self.LOCAL, 1234, ts=5, lhi=0xBEEF, rhi=0xDEAD)
        self.assertEqual(self.scan6(table_of(self.decoys6() + [target])), [(1234, 5)])

    def test_the_scope_id_of_a_link_local_peer_must_match_when_there_is_one(self):
        target = row6("fe80::1", self.PEER, "fe80::2", self.LOCAL, 9, lscope=4)
        buf = table_of([target])
        self.assertEqual(self.scan6(buf, "fe80::1", "fe80::2", scope=4), [(9, 0)])
        self.assertEqual(self.scan6(buf, "fe80::1", "fe80::2", scope=7), [])
        self.assertEqual(self.scan6(buf, "fe80::1", "fe80::2", scope=0), [(9, 0)])  # no scope known: not compared

    def test_ipv6_rows_in_a_truncated_buffer(self):
        target = row6("::1", self.PEER, "::1", self.LOCAL, 1234)
        full = table_of(self.decoys6()[:1] + [target], count=9)
        self.assertEqual(self.scan6(full), [(1234, 0)])
        self.assertEqual(self.scan6(full[:-1]), [])


# A fake of the two Win32 modules _windows_pid_verdict calls.
class _FakeKernel:
    def __init__(self, handle):
        self.handle, self.closed, self.opened = handle, [], []

    def OpenProcess(self, access, inherit, pid):
        self.opened.append((access, inherit, pid))
        return self.handle

    def CloseHandle(self, handle):
        self.closed.append(handle)
        return 1


class _FakeAdvapi:
    def __init__(self, ok):
        self.ok, self.calls = ok, []

    def OpenProcessToken(self, process, access, ref):
        self.calls.append((process, access))
        return 1 if self.ok else 0


@unittest.skipUnless(IS_WIN, "Windows only")
class PeerClassifyCase(unittest.TestCase):
    """Which Windows errors say "another user" and which only say "cannot tell"."""

    def verdict(self, handle=1, open_err=0, token_ok=False, token_err=0, sid="S-1", own="S-1", created=0, started=0):
        kernel, advapi = _FakeKernel(handle), _FakeAdvapi(token_ok)
        api = types.SimpleNamespace(kernel32=kernel, advapi32=advapi)
        errors = iter([open_err] if not handle else [token_err])
        with mock.patch("ctypes.get_last_error", side_effect=lambda: next(errors)), \
                mock.patch.object(app, "_token_sid", return_value=sid), \
                mock.patch.object(app, "_process_created", return_value=started):
            try:
                result = app._windows_pid_verdict(api, 4321, own, created)
            except OSError as e:
                result = e
        return result, kernel, advapi

    def test_a_process_that_cannot_be_opened_is_another_users(self):
        verdict, kernel, advapi = self.verdict(handle=0, open_err=5)
        self.assertEqual(verdict, app.PEER_DENIED)
        self.assertEqual((advapi.calls, kernel.closed), ([], []))
        self.assertEqual(kernel.opened, [(0x1000, False, 4321)])

    def test_a_process_whose_token_cannot_be_opened_is_not_proof_of_another_user(self):
        verdict, kernel, advapi = self.verdict(token_ok=False, token_err=5)
        self.assertEqual(verdict, app.PEER_NOTOKEN)
        self.assertNotIn(verdict, (app.PEER_OTHER, app.PEER_DENIED))
        self.assertEqual(kernel.closed, [1])  # the process handle is closed
        self.assertEqual(advapi.calls, [(1, 0x0008)])

    def test_a_process_that_is_gone_is_gone(self):
        verdict, kernel, _ = self.verdict(handle=0, open_err=87)
        self.assertEqual(verdict, app.PEER_GONE)

    def test_any_other_error_is_an_error(self):
        for kwargs in ({"handle": 0, "open_err": 1}, {"token_ok": False, "token_err": 6}):
            verdict, kernel, _ = self.verdict(**kwargs)
            self.assertIsInstance(verdict, OSError, kwargs)
            if kwargs.get("handle") != 0:
                self.assertEqual(kernel.closed, [1])

    def test_a_readable_token_decides(self):
        self.assertEqual(self.verdict(token_ok=True, sid="S-1", own="S-1")[0], app.PEER_SAME)
        self.assertEqual(self.verdict(token_ok=True, sid="S-9", own="S-1")[0], app.PEER_OTHER)

    def test_aggregation_puts_anything_unprovable_before_same_and_foreign_before_that(self):
        for verdicts, expected in (
            ([app.PEER_SAME, app.PEER_NOTOKEN], app.PEER_NOTOKEN),
            ([app.PEER_SAME, app.PEER_GONE], app.PEER_GONE),
            ([app.PEER_NOTOKEN, app.PEER_OTHER], app.PEER_OTHER),
            ([app.PEER_GONE, app.PEER_DENIED], app.PEER_DENIED),
            ([app.PEER_SAME, app.PEER_SAME], app.PEER_SAME),
        ):
            owners = [(10 + i, 0) for i in range(len(verdicts))]
            with mock.patch.object(app, "_scan_windows_table", return_value=owners), \
                    mock.patch.object(app, "_windows_tcp_table", return_value=bytearray()), \
                    mock.patch.object(app, "_own_sid", return_value="S-1"), \
                    mock.patch.object(app, "_windows_pid_verdict", side_effect=verdicts):
                got = app._windows_peer(app._endpoint(("127.0.0.1", 1)), app._endpoint(("127.0.0.1", 2)))
            self.assertEqual(got[0], expected, verdicts)


@unittest.skipUnless(IS_WIN, "Windows only")
class PeerPidReuseCase(unittest.TestCase):
    """The table says when a socket was made: a process that started later is not its owner."""

    def setUp(self):
        cli, self.conn = loopback_pair(socket.AF_INET, "127.0.0.1")
        self.addCleanup(cli.close)
        self.addCleanup(self.conn.close)
        self.peer, self.local = self.conn.getpeername(), self.conn.getsockname()
        buf = app._windows_tcp_table(app._win_api(), app._WIN_AF_INET)
        found = app._scan_windows_table(buf, app._WIN_AF_INET, app._endpoint(self.peer), app._endpoint(self.local))
        self.assertEqual(len(found), 1)
        self.pid, self.ts = found[0]
        self.api, self.own = app._win_api(), app._windows_sid()

    def verdict(self, started):
        with mock.patch.object(app, "_process_created", return_value=started) as created, \
                mock.patch.object(app, "_CLOCK", FakeClockWatch(0.0)):
            return app._windows_pid_verdict(self.api, os.getpid(), self.own, self.ts), created

    def test_a_process_created_after_its_socket_is_a_reused_pid(self):
        for later in (2_000_000, 5 * 10_000_000, 59 * 10_000_000):  # 0.2 s, 5 s, 59 s
            self.assertEqual(self.verdict(self.ts + later)[0], app.PEER_GONE, later)

    def test_a_process_created_before_or_about_when_its_socket_was_is_the_owner(self):
        for delta in (-3600 * 10_000_000, -1, 0, 100_000, 400_000):  # up to 0.04 s after: the tolerance (0.05 s)
            self.assertEqual(self.verdict(self.ts + delta)[0], app.PEER_SAME, delta)

    def test_a_timestamp_of_zero_falls_back_to_no_time_check(self):
        with mock.patch.object(app, "_process_created", side_effect=AssertionError("not asked")) as created:
            self.assertEqual(app._windows_pid_verdict(self.api, os.getpid(), self.own, 0), app.PEER_SAME)
        created.assert_not_called()

    def test_end_to_end_the_lookup_refuses_a_reused_pid_and_accepts_the_real_one(self):
        self.assertEqual(app.lookup_peer(self.peer, self.local), (app.PEER_SAME, os.getpid()))
        with mock.patch.object(app, "_process_created", return_value=self.ts + 30 * 10_000_000), \
                mock.patch.object(app, "_CLOCK", FakeClockWatch(0.0)):
            self.assertEqual(app.lookup_peer(self.peer, self.local), (app.PEER_GONE, os.getpid()))
        owners = [(os.getpid(), 0)]
        with mock.patch.object(app, "_scan_windows_table", return_value=owners), \
                mock.patch.object(app, "_process_created", side_effect=AssertionError("not asked")):
            self.assertEqual(app.lookup_peer(self.peer, self.local), (app.PEER_SAME, os.getpid()))

    def test_our_own_process_started_before_every_socket_it_makes(self):
        api = app._win_api()
        import ctypes
        handle = api.kernel32.OpenProcess(0x1000, False, os.getpid())
        self.addCleanup(api.kernel32.CloseHandle, handle)
        self.assertLess(app._process_created(api, handle), self.ts)

    def test_end_to_end_a_clock_that_was_set_back_before_the_start_is_noted_and_the_user_decides(self):
        notes = []
        with mock.patch.object(app, "_process_created", return_value=self.ts + 3600 * 10_000_000), \
                mock.patch.object(app, "_CLOCK", FakeClockWatch(0.0)):
            got = app.lookup_peer(self.peer, self.local, note=lambda *a: notes.append(a))
        self.assertEqual(got, (app.PEER_SAME, os.getpid()))
        self.assertEqual(len(notes), 1)
        self.assertEqual(notes[0][0], os.getpid())
        self.assertAlmostEqual(notes[0][2], 3600.0, places=3)


class FakeClockWatch:
    """Stands in for app._CLOCK: the wall clock was stepped back by `drift` seconds since the start."""

    def __init__(self, drift):
        self._drift = drift
        self.largest = max(0.0, drift)

    def drift(self):
        return max(0.0, self._drift)


class ClockWatchCase(unittest.TestCase):
    def test_a_backward_step_is_seen_a_forward_step_and_ticking_are_not(self):
        wall, mono = [1000.0], [50.0]
        with mock.patch.object(app.time, "time", lambda: wall[0]), mock.patch.object(app.time, "monotonic", lambda: mono[0]):
            watch = app._ClockWatch()
            wall[0] += 10
            mono[0] += 10  # both clocks tick
            self.assertEqual((watch.drift(), watch.largest), (0.0, 0.0))
            wall[0] += 100  # set forward
            self.assertEqual((watch.drift(), watch.largest), (0.0, 0.0))
            wall[0] -= 130  # set back: 30 s behind where it started
            self.assertAlmostEqual(watch.drift(), 30.0)
            wall[0] -= 20
            self.assertAlmostEqual(watch.drift(), 50.0)
            wall[0] += 70  # corrected: the largest step stays recorded
            self.assertEqual(watch.drift(), 0.0)
            self.assertAlmostEqual(watch.largest, 50.0)


@unittest.skipUnless(IS_WIN, "Windows only")
class PeerClockCase(unittest.TestCase):
    """The start-time check: 0.05 s of tolerance, widened by a clock set back since the start; a huge
    'negative age' is a clock artefact (accepted on the user's SID, noted), a small one a reused pid."""

    TS = 1_000_000_000_000_000

    def verdict(self, late, drift=0.0, notes=None, sid="S-1"):
        """The verdict of a process that started `late` seconds after its socket was made."""
        kernel, advapi = _FakeKernel(1), _FakeAdvapi(True)
        api = types.SimpleNamespace(kernel32=kernel, advapi32=advapi)
        started = self.TS + round(late * 10_000_000)
        note = None if notes is None else (lambda *a: notes.append(a))
        with mock.patch.object(app, "_token_sid", return_value=sid), \
                mock.patch.object(app, "_process_created", return_value=started), \
                mock.patch.object(app, "_CLOCK", FakeClockWatch(drift)):
            result = app._windows_pid_verdict(api, 4321, "S-1", self.TS, note)
        self.assertEqual(kernel.closed[-1], 1)  # the process handle is closed last, on every path
        return result

    def test_the_tolerance_is_fifty_milliseconds(self):
        self.assertEqual(app._WIN_PID_REUSE_TOLERANCE, 0.05)
        for late, expected in ((-5.0, app.PEER_SAME), (0.0, app.PEER_SAME), (0.01, app.PEER_SAME), (0.04, app.PEER_SAME),
                               (0.06, app.PEER_GONE), (0.2, app.PEER_GONE), (1.0, app.PEER_GONE)):
            with self.subTest(late=late):
                self.assertEqual(self.verdict(late), expected)

    def test_a_forward_step_changes_nothing(self):
        # a forward step reads as a negative drift: the allowance is never below zero
        self.assertEqual(self.verdict(0.2, drift=-30.0), app.PEER_GONE)
        self.assertEqual(self.verdict(0.01, drift=-30.0), app.PEER_SAME)

    def test_a_clock_set_back_after_the_start_widens_the_tolerance_by_the_step(self):
        for late, drift, expected in ((4.0, 5.0, app.PEER_SAME), (5.04, 5.0, app.PEER_SAME), (5.2, 5.0, app.PEER_GONE),
                                      (0.2, 0.0, app.PEER_GONE), (30.0, 40.0, app.PEER_SAME), (45.0, 40.0, app.PEER_GONE)):
            with self.subTest(late=late, drift=drift):
                notes = []
                self.assertEqual(self.verdict(late, drift, notes), expected)
                self.assertEqual(notes, [])  # inside the allowance, or a race: nothing to note

    def test_a_process_far_younger_than_its_socket_is_a_clock_artefact_judged_by_its_user_and_noted_once(self):
        for late in (60.5, 3600.0, 86400.0):
            with self.subTest(late=late):
                notes = []
                self.assertEqual(self.verdict(late, notes=notes), app.PEER_SAME)
                self.assertEqual(len(notes), 1)
                self.assertEqual(notes[0][:2], (4321, self.TS + round(late * 10_000_000)))
                self.assertAlmostEqual(notes[0][2], late, places=3)
                self.assertEqual(self.verdict(late, notes=[], sid="S-9"), app.PEER_OTHER)  # not for another user

    def test_between_the_tolerance_and_a_minute_it_is_still_a_reused_pid(self):
        for late in (5.0, 30.0, 59.0, 60.0):
            with self.subTest(late=late):
                notes = []
                self.assertEqual(self.verdict(late, notes=notes), app.PEER_GONE)
                self.assertEqual(notes, [])

    def test_a_missing_note_callback_is_fine(self):
        self.assertEqual(self.verdict(3600.0), app.PEER_SAME)


class ClockNoteLogCase(unittest.TestCase):
    def test_the_note_is_logged_once_per_process_and_the_default_lookup_carries_it(self):
        log, lines = make_log()
        relay = app.Relay("127.0.0.1", 0, log, RecordingHooks(), StubCapture(), peer_check=False)
        relay._peer_clock_note(7, 111, 3600.4)
        relay._peer_clock_note(7, 111, 3600.4)
        relay._peer_clock_note(8, 222, 90.9)
        relay._peer_clock_note(7, 333, 61.0)  # the same pid, started again
        self.assertEqual(lines.lines, [
            "peer time check skipped: clock changed (3600 s)",
            "peer time check skipped: clock changed (90 s)",
            "peer time check skipped: clock changed (61 s)",
        ])
        self.assertEqual(relay._peer_lookup.func, app.lookup_peer)
        self.assertEqual(relay._peer_lookup.keywords, {"note": relay._peer_clock_note})
        stub = StubLookup(SAME)
        self.assertIs(app.Relay("127.0.0.1", 0, log, peer_lookup=stub)._peer_lookup, stub)  # a stub is called as it is


class FakeConn:
    """A websockets ServerConnection as far as the peer gate looks at it."""

    def __init__(self, port=50000, closing=False):
        self.remote_address = ("127.0.0.1", port)
        self.local_address = ("127.0.0.1", 8765)
        self.closing = closing
        self.transport = types.SimpleNamespace(is_closing=lambda: self.closing)

    def respond(self, status, text):
        return types.SimpleNamespace(status=status, headers={}, body=text)


class FakeRequest:
    def __init__(self, origin=None):
        self.headers = {} if origin is None else {"Origin": origin}


class PeerLoadCase(unittest.IsolatedAsyncioTestCase):
    """Lookups are bounded: four at a time, a waiter that cannot get a slot is refused, a dead
    connection is not looked up, and the retry pauses are the event loop's."""

    async def asyncSetUp(self):
        self._saved_state = app.S
        app.S = app.State()
        self.log, self.log_lines = make_log()
        self.release = threading.Event()
        self.addCleanup(self.release.set)

    async def asyncTearDown(self):
        app.S = self._saved_state

    def relay(self, lookup, strict=True, sleep=None, clock=None):
        return app.Relay("127.0.0.1", 0, self.log, RecordingHooks(), StubCapture(), clock=clock, peer_lookup=lookup,
                         peer_strict=strict, peer_sleep=sleep)

    def slow_lookup(self):
        state = types.SimpleNamespace(inflight=0, peak=0, calls=0, lock=threading.Lock())

        def lookup(peer, local):
            with state.lock:
                state.inflight += 1
                state.calls += 1
                state.peak = max(state.peak, state.inflight)
            self.release.wait(10)
            with state.lock:
                state.inflight -= 1
            return SAME

        return lookup, state

    async def test_at_most_four_lookups_run_at_once_and_the_waiters_past_the_limit_are_refused_as_busy(self):
        lookup, state = self.slow_lookup()
        relay = self.relay(lookup)
        with mock.patch.object(app, "PEER_BUSY_SECONDS", 0.3):
            tasks = [asyncio.ensure_future(relay._peer_gate(FakeConn(50000 + i))) for i in range(20)]
            await asyncio.sleep(0.15)
            self.assertEqual((state.inflight, state.peak), (app.PEER_SLOTS, 4))  # four started, sixteen wait
            self.assertFalse(any(t.done() for t in tasks))
            await asyncio.sleep(0.4)  # past the limit
            done = [t.result() for t in tasks if t.done()]
            self.assertEqual(done, [("peer-unknown", None, "busy")] * 16)
            self.release.set()
            rest = await asyncio.wait_for(asyncio.gather(*[t for t in tasks if not t.done()]), 3)
        self.assertEqual(rest, [None] * 4)
        self.assertEqual((state.peak, state.calls), (4, 4))  # nobody else ever got to look

    async def test_a_busy_refusal_is_logged_with_its_reason_and_refuses_even_where_a_failed_lookup_is_let_through(self):
        lookup, state = self.slow_lookup()
        relay = self.relay(lookup, strict=False)
        with mock.patch.object(app, "PEER_BUSY_SECONDS", 0.1):
            blockers = [asyncio.ensure_future(relay._peer_gate(FakeConn(50000 + i))) for i in range(4)]
            await asyncio.sleep(0.05)
            response = await relay._process_request(FakeConn(51000), FakeRequest())
            self.release.set()
            await asyncio.gather(*blockers)
        self.assertEqual(response.headers[app.PEER_HEADER], "peer-unknown")
        self.assertIn("rejected peer unknown (busy)", self.log_lines.lines)
        self.assertEqual(sum("peer check unavailable" in line for line in self.log_lines.lines), 0)

    async def test_a_waiter_that_gets_a_slot_in_time_is_looked_up(self):
        lookup, state = self.slow_lookup()
        relay = self.relay(lookup)
        tasks = [asyncio.ensure_future(relay._peer_gate(FakeConn(50000 + i))) for i in range(6)]
        await asyncio.sleep(0.1)
        self.assertEqual(state.inflight, 4)
        self.release.set()
        self.assertEqual(await asyncio.wait_for(asyncio.gather(*tasks), 3), [None] * 6)
        self.assertEqual(state.peak, 4)

    async def test_a_connection_that_went_away_is_not_looked_up(self):
        lookup = StubLookup(SAME)
        relay = self.relay(lookup)
        self.assertEqual(await relay._peer_gate(FakeConn(closing=True)), ("peer-unknown", None, "closed"))
        self.assertEqual(lookup.calls, [])
        response = await relay._process_request(FakeConn(closing=True), FakeRequest())
        self.assertEqual(response.headers[app.PEER_HEADER], "peer-unknown")
        self.assertEqual(self.log_lines.lines, [])  # not even a line: nobody is there

    async def test_a_connection_that_goes_away_while_the_table_lags_stops_the_retries(self):
        conn = FakeConn()
        lookup = StubLookup(NOTFOUND)

        async def sleep(delay):
            conn.closing = True

        relay = self.relay(lookup, sleep=sleep)
        self.assertEqual(await relay._peer_gate(conn), ("peer-unknown", None, "closed"))
        self.assertEqual(len(lookup.calls), 1)

    async def test_the_retry_pauses_are_event_loop_sleeps_between_lookups_never_inside_a_lookup(self):
        events = []
        threads = set()
        main = threading.get_ident()

        def lookup(peer, local):
            events.append("lookup")
            threads.add(threading.get_ident())
            return NOTFOUND

        async def sleep(delay):
            events.append(("sleep", delay, relay._peer_slots._value))

        relay = self.relay(lookup, sleep=sleep)
        self.assertEqual(await relay._peer_gate(FakeConn()), ("peer-unknown", None, "connection not found"))
        pause = ("sleep", app.PEER_RETRY_DELAY, app.PEER_SLOTS)  # the slot is free while it sleeps
        self.assertEqual(events, ["lookup", pause] * app.PEER_RETRIES + ["lookup"])
        self.assertNotIn(main, threads)  # the lookups ran in the executor, the pauses did not
        self.assertEqual(relay._peer_slots._value, app.PEER_SLOTS)

    async def test_a_slot_is_given_back_when_a_lookup_fails(self):
        relay = self.relay(StubLookup(OSError("x")))
        for _ in range(app.PEER_SLOTS + 2):
            self.assertEqual(await relay._peer_gate(FakeConn()), ("peer-unknown", None, "lookup error"))
        self.assertEqual(relay._peer_slots._value, app.PEER_SLOTS)

    async def test_the_accept_queue_is_larger_than_the_default_of_100(self):
        captured = {}
        real = app.serve

        async def spy(*args, **kwargs):
            captured.update(kwargs)
            return await real(*args, **kwargs)

        relay = app.Relay("127.0.0.1", 0, self.log, RecordingHooks(), StubCapture(), peer_check=False)
        with mock.patch.object(app, "serve", spy):
            await relay.start()
        await relay.close()
        self.assertEqual(captured["backlog"], app.LISTEN_BACKLOG)
        self.assertGreater(app.LISTEN_BACKLOG, 100)

    async def test_the_time_a_waiter_waits_is_the_one_in_the_brief(self):
        self.assertEqual((app.PEER_SLOTS, app.PEER_BUSY_SECONDS), (4, 1.5))
        self.assertEqual(app.SELFTEST_TIMEOUT, 3.0)


class PeerReasonLogCase(unittest.IsolatedAsyncioTestCase):
    """The refusal lines name a reason; the hint comes once; a token that cannot be read is not 'another user'."""

    async def asyncSetUp(self):
        self._saved_state = app.S
        app.S = app.State()
        self.log, self.log_lines = make_log()

    async def asyncTearDown(self):
        app.S = self._saved_state

    def relay(self, lookup, clock=None):
        async def sleep(delay):
            pass

        return app.Relay("127.0.0.1", 0, self.log, RecordingHooks(), StubCapture(), clock=clock, peer_lookup=lookup,
                         peer_strict=True, peer_sleep=sleep)

    def by_port(self, results):
        def lookup(peer, local):
            result = results[peer[1]]
            if isinstance(result, BaseException):
                raise result
            return result

        return lookup

    async def refuse(self, relay, port):
        response = await relay._process_request(FakeConn(port), FakeRequest())
        return response.headers[app.PEER_HEADER]

    def count(self, text):
        return sum(text in line for line in self.log_lines.lines)

    async def test_each_reason_is_logged_and_the_hint_exactly_once(self):
        relay = self.relay(self.by_port({
            1: NOTFOUND, 2: OSError("secret"), 3: (app.PEER_GONE, 5), 4: (app.PEER_NOTOKEN, 5),
        }))
        for port in (1, 1, 2, 3, 4, 3, 4):
            self.assertEqual(await self.refuse(relay, port), "peer-unknown")
        lines = self.log_lines.lines
        for reason in ("connection not found", "lookup error", "process gone", "token denied"):
            self.assertIn(f"rejected peer unknown ({reason})", lines)
        self.assertEqual(self.count(app.PEER_HINT), 1)
        self.assertEqual(app.PEER_HINT, "if Spotify cannot connect, start SpoSync with --no-peer-check")
        self.assertEqual(self.count("user=other"), 0)  # an unreadable token never says "other user"
        self.assertNotIn("secret", "\n".join(lines))
        self.assertLess(lines.index("rejected peer unknown (connection not found)"), lines.index(app.PEER_HINT))

    async def test_a_token_that_cannot_be_read_is_refused_as_unknown_not_as_another_user(self):
        relay = self.relay(self.by_port({1: (app.PEER_NOTOKEN, 77), 2: (app.PEER_DENIED, 78)}))
        self.assertEqual(await self.refuse(relay, 1), "peer-unknown")
        self.assertEqual(await self.refuse(relay, 2), "other-user")  # a process that cannot be opened stays foreign
        self.assertIn("rejected peer unknown (token denied)", self.log_lines.lines)
        self.assertIn("rejected peer user=other pid=78", self.log_lines.lines)
        self.assertNotIn("pid=77", "\n".join(self.log_lines.lines))

    async def test_the_pid_reuse_and_token_verdicts_are_answers_not_missing_rows(self):
        slept = []

        async def sleep(delay):
            slept.append(delay)

        for verdict in (app.PEER_GONE, app.PEER_NOTOKEN):
            lookup = StubLookup((verdict, 5))
            relay = app.Relay("127.0.0.1", 0, self.log, RecordingHooks(), StubCapture(), peer_lookup=lookup,
                              peer_strict=True, peer_sleep=sleep)
            await self.refuse(relay, 1)
            self.assertEqual(len(lookup.calls), 1)
        self.assertEqual(slept, [])

    async def test_a_new_reason_is_logged_even_after_the_cap_but_a_known_one_is_counted(self):
        clock = FakeClock()
        relay = self.relay(self.by_port({1: OTHER, 2: NOTFOUND, 3: NOTFOUND, 4: (app.PEER_GONE, 5)}), clock=clock)
        for _ in range(app.MAX_PEER_LOGS):
            await self.refuse(relay, 1)
        self.assertEqual(self.count("rejected peer user=other"), app.MAX_PEER_LOGS)
        await self.refuse(relay, 2)
        self.assertEqual(self.count("rejected peer unknown (connection not found)"), 1)
        self.assertEqual(self.count(app.PEER_HINT), 1)
        await self.refuse(relay, 3)  # the same reason again: counted, not logged
        self.assertEqual(self.count("rejected peer unknown (connection not found)"), 1)
        await self.refuse(relay, 4)
        self.assertEqual(self.count("rejected peer unknown (process gone)"), 1)
        clock.now += app.PEER_LOG_INTERVAL
        await self.refuse(relay, 3)
        self.assertEqual(self.count("more in the last 10 min"), 1)
        self.assertEqual(self.count(app.PEER_HINT), 1)

    async def test_a_flood_of_busy_refusals_never_prints_the_hint_but_the_next_other_reason_does(self):
        relay = self.relay(self.by_port({1: NOTFOUND}))
        relay._peer_slots = asyncio.Semaphore(0)  # every lookup waits for a slot that never comes
        with mock.patch.object(app, "PEER_BUSY_SECONDS", 0.01):
            for _ in range(3):
                self.assertEqual(await self.refuse(relay, 1), "peer-unknown")
        self.assertEqual(self.count("rejected peer unknown (busy)"), 3)
        self.assertEqual(self.count(app.PEER_HINT), 0)
        relay._peer_slots = asyncio.Semaphore(app.PEER_SLOTS)
        self.assertEqual(await self.refuse(relay, 1), "peer-unknown")
        self.assertEqual(self.count("rejected peer unknown (connection not found)"), 1)
        self.assertEqual(self.count(app.PEER_HINT), 1)

    async def test_a_user_mismatch_alone_never_prints_the_hint(self):
        relay = self.relay(self.by_port({1: OTHER}))
        for _ in range(3):
            self.assertEqual(await self.refuse(relay, 1), "other-user")
        self.assertEqual(self.count(app.PEER_HINT), 0)


class PeerSelfTestCase(unittest.IsolatedAsyncioTestCase):
    """The start-up self-test: connect to ourselves and ask the lookup who that is."""

    async def asyncSetUp(self):
        self._saved_state = app.S
        app.S = app.State()
        self.log, self.log_lines = make_log()
        self.relays = []
        self.release = threading.Event()
        self.addCleanup(self.release.set)
        self.delays = []  # the pauses the self-test asked for between its attempts
        self.hold_retries = None  # an asyncio.Event: the pause lasts until it is set

    async def asyncTearDown(self):
        self.release.set()
        if self.hold_retries is not None:
            self.hold_retries.set()
        for relay, runner in self.relays:
            await relay.close()
            await asyncio.wait_for(runner, 3)
        app.S = self._saved_state

    def make(self, lookup=None, peer_check=True, selftest=True, timeout=None, hooks=None):
        async def sleep(delay):
            pass

        async def retry_sleep(delay):
            self.delays.append(delay)
            if self.hold_retries is not None:
                await self.hold_retries.wait()
            await asyncio.sleep(0)

        relay = app.Relay("127.0.0.1", 0, self.log, hooks or RecordingHooks(), StubCapture(), peer_check=peer_check,
                          peer_lookup=lookup, peer_strict=True, peer_sleep=sleep, peer_selftest=selftest)
        relay._selftest_sleep = retry_sleep
        if timeout is not None:
            relay._selftest_timeout = timeout
        return relay

    async def start(self, **kw):
        relay = self.make(**kw)
        await relay.start()
        self.relays.append((relay, asyncio.ensure_future(relay.run())))
        self.url = f"ws://127.0.0.1:{relay.port}"
        return relay

    async def settled(self, relay):
        await asyncio.wait_for(asyncio.shield(relay._selftest_task), 5)

    def count(self, text):
        return sum(text in line for line in self.log_lines.lines)

    async def theme_status(self):
        async with connect(self.url, origin=THEME) as ws:
            return await recv_type(ws, "status")

    async def control_ping(self):
        async with connect(self.url) as ws:
            await ws.send(json.dumps({"type": "control", "action": "ping"}))
            return await recv_json(ws)

    @unittest.skipUnless(CAN_LOOKUP, "no peer lookup on this platform")
    async def test_the_real_lookup_passes_on_this_machine_and_the_check_stays_on(self):
        relay = await self.start(lookup=None)
        await self.settled(relay)
        self.assertTrue(relay._peer_check)
        self.assertEqual(self.count("peer check on"), 1)
        self.assertEqual(self.count("self-test"), 0)
        lines = self.log_lines.lines
        self.assertLess(next(i for i, s in enumerate(lines) if s.startswith("listening on")), lines.index("peer check on"))
        self.assertEqual((await self.theme_status())["type"], "status")
        self.assertEqual((await self.control_ping())["app"], "sposync")
        self.assertEqual(self.count("rejected peer"), 0)

    async def test_a_passing_self_test_leaves_the_check_on_for_real_clients(self):
        def lookup(peer, local):
            return SAME_OWN if local[1] != relay.port else OTHER

        SAME_OWN = (app.PEER_SAME, os.getpid())
        relay = await self.start(lookup=lookup)
        await self.settled(relay)
        self.assertIn("peer check on", self.log_lines.lines)
        with self.assertRaises(InvalidStatus) as cm:
            async with connect(self.url, origin=THEME):
                pass
        self.assertEqual(cm.exception.response.headers.get(app.PEER_HEADER), "other-user")

    async def test_a_broken_machinery_logs_one_warning_and_switches_the_check_off_visibly(self):
        # The lookup works but does not recognise our own connection.
        cases = (
            (StubLookup(OTHER), "other", []),
            (StubLookup((app.PEER_DENIED, 4)), "other", []),
            (StubLookup((app.PEER_SAME, 99999999)), "wrong pid", []),
            (StubLookup((app.PEER_GONE, 1)), "process gone", []),
            (StubLookup((app.PEER_NOTOKEN, 1)), "token denied", []),
            (StubLookup(app.PeerUnsupported("sunos5")), "unsupported platform", []),
            (StubLookup(NOTFOUND), "connection not found", [2.0, 4.0]),  # the third attempt in a row is a verdict
        )
        for lookup, label, delays in cases:
            with self.subTest(label=label):
                self.log_lines.lines.clear()
                self.delays.clear()
                hooks = RecordingHooks()
                relay = self.make(lookup=lookup, hooks=hooks)
                await relay.start()
                self.relays.append((relay, asyncio.ensure_future(relay.run())))
                self.url = f"ws://127.0.0.1:{relay.port}"
                await self.settled(relay)
                warning = f"peer check self-test failed ({label}); peer check off for this run"
                self.assertEqual([s for s in self.log_lines.lines if "self-test" in s and "retrying" not in s], [warning])
                self.assertNotIn("peer check on", self.log_lines.lines)
                self.assertFalse(relay._peer_check)
                self.assertEqual(hooks.peer_checks, [False])  # the UI is told: the tray title says so
                self.assertEqual(self.delays, delays)
                calls = len(lookup.calls)
                # A same-user client (the lookup would say otherwise) is accepted, and nobody asks the lookup again.
                self.assertEqual((await self.theme_status())["type"], "status")
                self.assertEqual((await self.control_ping())["app"], "sposync")
                self.assertEqual(len(lookup.calls), calls)
                self.assertEqual(self.count("rejected peer"), 0)

    async def test_missing_connection_is_a_verdict_only_three_attempts_in_a_row(self):
        results = [NOTFOUND] * 4 + [OSError("x")] + [NOTFOUND] * 100  # missing, then a load failure, then missing again
        outcomes = []
        real = app.Relay._selftest_outcome

        def record(res):
            outcomes.append(real(res))
            return outcomes[-1]

        relay = self.make(lookup=StubLookup(*results))
        with mock.patch.object(app.Relay, "_selftest_outcome", staticmethod(record)):
            await relay.start()
            self.relays.append((relay, asyncio.ensure_future(relay.run())))
            await self.settled(relay)
        kinds = [o for o, _ in outcomes]
        # The load failure in the second attempt restarts the count: the verdict comes with the fifth attempt.
        self.assertEqual(kinds, ["missing", "inconclusive", "missing", "missing", "missing"])
        self.assertFalse(relay._peer_check)
        self.assertEqual(self.delays, [2.0, 4.0, 8.0, 16.0])
        self.assertIn("peer check self-test failed (connection not found); peer check off for this run", self.log_lines.lines)

    async def _inconclusive(self, relay, why, hooks=None):
        """A self-test that stays inconclusive on every attempt: what it says and does."""
        self.assertTrue(relay._peer_check)
        self.assertEqual(self.delays, [2.0, 4.0, 8.0, 16.0])  # ~30 s of retries
        self.assertEqual([s for s in self.log_lines.lines if "self-test" in s], [
            f"peer check self-test inconclusive ({why}); retrying",
            f"peer check self-test inconclusive after retries ({why}); peer check stays on",
        ])
        self.assertNotIn("peer check on", self.log_lines.lines)
        self.assertEqual(self.count("peer check self-test failed"), 0)
        if hooks is not None:
            self.assertEqual(hooks.peer_checks, [])  # nothing to tell the UI

    async def test_a_self_test_that_could_not_be_made_leaves_the_check_on_and_retries_in_the_background(self):
        real_pair = app._loopback_pair
        foreign_made = []

        def foreign_pair(family, host):
            pair = real_pair(family, host)
            if pair is None:
                return None
            cli, conn = pair

            class Other:  # a client that is not the one the listener accepted
                getsockname = staticmethod(lambda: ("127.0.0.1", 1))
                close = staticmethod(cli.close)

            foreign_made.append(cli)
            return Other(), conn

        async def closed_peer(*args, **kwargs):
            return app.PeerResult("closed", None, None, None)

        cases = (
            ("OSError", {"lookup": StubLookup(OSError("secret"))}, None),
            ("ValueError", {"lookup": StubLookup(ValueError("x"))}, None),
            ("timeout", {"lookup": None, "timeout": 0.05}, None),
            ("no loopback", {"lookup": StubLookup(SAME)}, lambda f, h: None),
            ("foreign connection", {"lookup": StubLookup(SAME)}, foreign_pair),
            ("busy", {"lookup": StubLookup(SAME)}, "busy"),
            ("closed", {"lookup": StubLookup(SAME)}, "closed"),
        )
        for why, kw, patch in cases:
            with self.subTest(why=why):
                self.log_lines.lines.clear()
                self.delays.clear()
                self.release.clear()
                hooks = RecordingHooks()
                lookup = kw["lookup"]
                if why == "timeout":
                    def lookup(peer, local):
                        self.release.wait(10)
                        return (app.PEER_SAME, os.getpid())
                relay = self.make(lookup=lookup, timeout=kw.get("timeout"), hooks=hooks)
                with contextlib.ExitStack() as stack:
                    if callable(patch):
                        stack.enter_context(mock.patch.object(app, "_loopback_pair", patch))
                    elif patch == "busy":
                        relay._peer_slots = asyncio.Semaphore(0)
                        stack.enter_context(mock.patch.object(app, "PEER_BUSY_SECONDS", 0.01))
                    elif patch == "closed":
                        relay._peer_resolve = closed_peer
                    await relay.start()
                    self.relays.append((relay, asyncio.ensure_future(relay.run())))
                    self.url = f"ws://127.0.0.1:{relay.port}"
                    await self.settled(relay)
                await self._inconclusive(relay, why, hooks)
                self.release.set()
                self.assertNotIn("secret", "\n".join(self.log_lines.lines))
        for sock in foreign_made:
            self.assertEqual(sock.fileno(), -1)  # the real ends were closed too

    async def test_while_inconclusive_the_gate_stays_strict_and_nobody_waits_for_a_retry(self):
        self.hold_retries = asyncio.Event()
        relay = await self.start(lookup=StubLookup(OSError("x")))
        await asyncio.wait_for(relay._selftest_first.wait(), 5)  # the first attempt is over, a retry pauses
        self.assertFalse(relay._selftest_task.done())
        self.assertTrue(relay._peer_check)
        start = time.monotonic()
        with self.assertRaises(InvalidStatus) as cm:
            async with connect(self.url, origin=THEME):
                pass
        self.assertLess(time.monotonic() - start, 1.0)
        self.assertEqual(cm.exception.response.headers.get(app.PEER_HEADER), "peer-unknown")
        self.assertIn("rejected peer unknown (lookup error)", self.log_lines.lines)
        self.assertEqual(self.delays, [2.0])  # still waiting for its first retry
        self.hold_retries.set()
        await self.settled(relay)
        self.assertTrue(relay._peer_check)

    async def test_a_retry_that_passes_ends_with_the_check_on_and_one_inconclusive_line(self):
        own = (app.PEER_SAME, os.getpid())
        lookup = StubLookup(OSError("x"), own)  # the first lookup fails, every later one answers
        relay = await self.start(lookup=lookup)
        await self.settled(relay)
        self.assertTrue(relay._peer_check)
        self.assertEqual(self.delays, [2.0])
        self.assertEqual([s for s in self.log_lines.lines if "self-test" in s or s == "peer check on"], [
            "peer check self-test inconclusive (OSError); retrying", "peer check on"])

    async def test_a_hung_first_attempt_holds_a_client_for_the_wait_only_then_the_lookup_is_strict(self):
        self.assertEqual(app.SELFTEST_WAIT, 1.5)
        self.assertLess(app.SELFTEST_WAIT, app.CONTROL_TIMEOUT)  # below websockets' open_timeout
        def lookup(peer, local):
            if local[1] != relay.port:
                self.release.wait(10)  # the self-test's own lookups hang
                return (app.PEER_SAME, os.getpid())
            return OTHER

        relay = await self.start(lookup=lookup)
        relay._selftest_wait = 0.3
        start = time.monotonic()
        with self.assertRaises(InvalidStatus) as cm:
            async with connect(self.url, origin=THEME):
                pass
        took = time.monotonic() - start
        self.assertGreaterEqual(took, 0.25)
        self.assertLess(took, 1.2)
        self.assertEqual(cm.exception.response.headers.get(app.PEER_HEADER), "other-user")  # looked up, not waved through
        self.assertFalse(relay._selftest_first.is_set())  # the first attempt is still hanging
        self.assertTrue(relay._peer_check)
        self.assertNotIn("peer check on", self.log_lines.lines)
        self.release.set()

    async def test_a_hung_self_test_times_out_inconclusive_and_the_check_stays_on(self):
        def lookup(peer, local):
            if local[1] != relay.port:
                self.release.wait(10)  # the self-test's own lookups hang
            return OTHER

        relay = await self.start(lookup=lookup, timeout=0.2)
        relay._selftest_wait = 0.1
        with self.assertRaises(InvalidStatus):
            async with connect(self.url, origin=THEME):  # after the wait: looked up like any other
                pass
        await self.settled(relay)
        await self._inconclusive(relay, "timeout")
        self.release.set()

    async def test_the_tray_title_says_when_the_check_is_off(self):
        tray = app.Tray(types.SimpleNamespace())
        self.assertEqual(tray.title, "SpoSync")
        tray.set_title("SpoSync - connected to Spotify")
        tray.icon = types.SimpleNamespace(title=None)
        tray.set_peer_check(False)
        self.assertEqual(tray.title, "SpoSync - connected to Spotify – peer check off")
        self.assertEqual(tray.icon.title, tray.title)
        tray.set_title("SpoSync - waiting for Spotify")  # the presence text changes, the note stays
        self.assertEqual(tray.icon.title, "SpoSync - waiting for Spotify – peer check off")
        tray.set_peer_check(True)
        self.assertEqual(tray.icon.title, "SpoSync - waiting for Spotify")
        tui = app.SpotuiApp("127.0.0.1", 0, "window", self.log)
        app.AppHooks(tui).on_peer_check(False)
        self.assertTrue(tui.tray.title.endswith(" – peer check off"))

    async def test_no_peer_check_tells_the_ui_too(self):
        hooks = RecordingHooks()
        relay = self.make(lookup=StubLookup(SAME), peer_check=False, hooks=hooks)
        await relay.start()
        self.relays.append((relay, asyncio.ensure_future(relay.run())))
        self.assertEqual(hooks.peer_checks, [False])

    async def test_a_cancelled_or_timed_out_self_test_leaves_no_socket_behind(self):
        made, entered, finished = [], threading.Event(), threading.Event()
        real_pair = app._loopback_pair

        def slow_pair(family, host):
            entered.set()
            self.release.wait(10)
            pair = real_pair(family, host)
            if pair is not None:
                made.extend(pair)
            finished.set()
            return pair

        for how in ("cancel", "timeout"):
            with self.subTest(how=how):
                made.clear()
                entered.clear()
                finished.clear()
                self.release.clear()
                relay = self.make(lookup=StubLookup(SAME), selftest=False)
                relay._selftest_timeout = 0.05
                with mock.patch.object(app, "_loopback_pair", slow_pair):
                    if how == "cancel":
                        task = asyncio.ensure_future(relay._peer_selftest_body())
                        self.assertTrue(await until(entered.is_set))
                        task.cancel()
                        with self.assertRaises(asyncio.CancelledError):
                            await task
                    else:
                        self.assertEqual(await relay._peer_selftest_attempt(), ("inconclusive", "timeout"))
                    self.release.set()  # the executor job finishes after nobody waits for it any more
                    self.assertTrue(await until(finished.is_set))
                    self.assertTrue(made)
                    self.assertTrue(await until(lambda: all(s.fileno() == -1 for s in made)))

    async def test_a_failed_pair_closes_what_it_opened(self):
        opened = []
        real_socket = socket.socket

        def sock(*args, **kwargs):
            if len(opened) == 1:
                raise OSError("no more sockets")
            opened.append(real_socket(*args, **kwargs))
            return opened[-1]

        with mock.patch.object(app.socket, "socket", sock):
            self.assertIsNone(app._loopback_pair(socket.AF_INET, "127.0.0.1"))
        self.assertEqual(len(opened), 1)
        self.assertEqual(opened[0].fileno(), -1)

    async def test_a_closing_relay_leaves_no_self_test_socket_open(self):
        before = len(self.open_sockets())
        for _ in range(10):
            relay = self.make(lookup=StubLookup(SAME))
            await relay.start()
            await relay.close()
            await asyncio.sleep(0)
        await asyncio.sleep(0.2)  # the executor jobs that were still building a pair
        self.assertLessEqual(len(self.open_sockets()), before)

    @staticmethod
    def open_sockets():
        import gc
        gc.collect()
        return [o for o in gc.get_objects() if isinstance(o, socket.socket) and o.fileno() != -1]

    async def test_a_failing_ipv6_loopback_alone_switches_the_check_off(self):
        pair = await asyncio.get_running_loop().run_in_executor(None, app._loopback_pair, socket.AF_INET6, "::1")
        if pair is None:
            self.skipTest("no ::1 loopback")
        for s in pair:
            s.close()

        def lookup(peer, local):
            return (app.PEER_SAME, os.getpid()) if ":" not in peer[0] else OTHER

        relay = await self.start(lookup=lookup)
        await self.settled(relay)
        self.assertIn("peer check self-test failed (other); peer check off for this run", self.log_lines.lines)
        self.assertFalse(relay._peer_check)

    async def test_no_peer_check_skips_the_self_test_altogether(self):
        lookup = StubLookup(AssertionError("must not be called"))
        relay = await self.start(lookup=lookup, peer_check=False)
        self.assertIsNone(relay._selftest_task)
        self.assertEqual((await self.theme_status())["type"], "status")
        self.assertEqual(lookup.calls, [])
        self.assertIn("peer check disabled by --no-peer-check", self.log_lines.lines)
        self.assertEqual(self.count("peer check on"), 0)
        self.assertEqual(self.count("self-test"), 0)

    async def test_the_self_test_is_for_the_real_lookup_unless_asked_for(self):
        self.assertTrue(app.Relay("127.0.0.1", 0, self.log)._peer_selftest)
        self.assertFalse(app.Relay("127.0.0.1", 0, self.log, peer_lookup=StubLookup(SAME))._peer_selftest)
        self.assertEqual(app.Relay("127.0.0.1", 0, self.log)._selftest_timeout, 3.0)

    async def test_listening_is_not_delayed_and_a_client_during_the_test_waits_and_is_then_handled(self):
        started = []

        def lookup(peer, local):
            started.append(local)
            self.release.wait(10)
            return (app.PEER_SAME, os.getpid())

        relay = await self.start(lookup=lookup)  # returns while the first lookup is still blocked
        self.assertIsNotNone(listening_port(self.log_lines.lines))
        self.assertNotIn("peer check on", self.log_lines.lines)
        theme = asyncio.ensure_future(self.theme_status())
        control = asyncio.ensure_future(self.control_ping())
        await asyncio.sleep(0.4)
        self.assertFalse(theme.done() or control.done())  # neither refused nor let in unchecked
        self.assertEqual(self.count("rejected peer"), 0)
        self.assertEqual(len(relay.clients), 0)
        self.release.set()
        self.assertEqual((await asyncio.wait_for(theme, 4))["type"], "status")
        self.assertEqual((await asyncio.wait_for(control, 4))["app"], "sposync")
        await self.settled(relay)
        self.assertEqual(self.count("peer check on"), 1)
        self.assertGreaterEqual(len(started), 3)  # the self-test (IPv4, IPv6 when there is one) and the two clients

    async def test_closing_during_the_self_test_cancels_it(self):
        def lookup(peer, local):
            self.release.wait(10)
            return SAME

        relay = self.make(lookup=lookup)  # not run(): that would start the server again after the close
        await relay.start()
        task = relay._selftest_task
        await relay.close()
        await asyncio.wait({task}, timeout=2)
        self.assertTrue(task.cancelled())
        self.assertEqual(self.count("self-test"), 0)
        self.release.set()


# ---------------------------------------------------------------- search echo

class SearchEchoCase(unittest.IsolatedAsyncioTestCase):
    """The search view: what the user types is the source of truth, and only the answer to the latest query is shown."""

    async def asyncSetUp(self):
        self._saved_state = app.S
        app.S = app.State()
        self.log, self.log_lines = make_log()
        self.client = app.Client(None, "theme")
        # The tests send by hand (flush_search): the 0.35 s debounce timer must not fire meanwhile.
        patcher = mock.patch.object(app.SpotuiApp, "schedule_search", lambda self: None)
        patcher.start()
        self.addCleanup(patcher.stop)

    async def asyncTearDown(self):
        app.S = self._saved_state

    def echo(self, tui, query, results=()):
        tui.relay._apply(self.client, {"type": "search", "query": query, "results": list(results)})

    @staticmethod
    def hit(name):
        return {"type": "Track", "name": name, "uri": "spotify:track:" + name}

    async def open_search(self, pilot, tui):
        await pilot.pause()
        tui.set_mode("search")
        await pilot.pause()

    async def test_the_echo_of_an_older_query_never_rewrites_what_is_being_typed(self):
        tui = app.SpotuiApp("127.0.0.1", 0, "window", self.log)
        async with tui.run_test(size=(100, 30)) as pilot:
            await self.open_search(pilot, tui)
            await pilot.press("a", "b")
            tui.flush_search()  # the debounce ran: "ab" was sent
            await pilot.press("c")
            self.assertEqual(app.S.search_q, "abc")
            self.echo(tui, "ab")  # the theme answers "ab" while the user is at "abc"
            self.assertEqual(app.S.search_q, "abc")
            self.assertIn("abc", plain(tui.query_one(app.SearchList).render()))
            tui.flush_search()  # "abc" sent
            self.echo(tui, "ab", [self.hit("old")])  # a late result for "ab"
            self.assertEqual(app.S.search_results, [])
            self.assertEqual(app.S.search_q, "abc")
            self.echo(tui, "abc", [self.hit("new")])
            self.assertEqual([r["name"] for r in app.S.search_results], ["new"])
            self.assertEqual(app.S.search_q, "abc")
            self.assertIn("new", plain(tui.query_one(app.SearchList).render()))
            self.assertIn("abc", plain(tui.query_one(app.SearchList).render()))
        self.assertIsNone(tui._exception)

    async def test_keys_typed_before_the_echo_arrives_are_kept(self):
        tui = app.SpotuiApp("127.0.0.1", 0, "window", self.log)
        async with tui.run_test(size=(100, 30)) as pilot:
            await self.open_search(pilot, tui)
            await pilot.press("a", "b")
            tui.flush_search()
            await pilot.press("c", "d")  # typed after the debounce, before the echo
            self.echo(tui, "ab", [self.hit("ab-hit")])  # the answer to the latest SENT query is applied ...
            self.assertEqual([r["name"] for r in app.S.search_results], ["ab-hit"])
            self.assertEqual(app.S.search_q, "abcd")  # ... and the input is not
            await pilot.press("e")
            self.assertEqual(app.S.search_q, "abcde")

    async def test_the_comparison_uses_the_form_the_theme_echoes(self):
        tui = app.SpotuiApp("127.0.0.1", 0, "window", self.log)
        async with tui.run_test(size=(100, 30)) as pilot:
            await self.open_search(pilot, tui)
            app.S.search_q = "  the   cure \t"  # the theme trims and joins the words with one space
            tui.flush_search()
            self.assertEqual(app.S.search_sent, "the cure")
            self.echo(tui, "the cure", [self.hit("x")])
            self.assertEqual(len(app.S.search_results), 1)
            self.assertEqual(app.S.search_q, "  the   cure \t")
            app.S.search_q = "the cur"
            tui.flush_search()
            app.S.search_q = "the cure"
            tui.flush_search()
            self.echo(tui, "the cur", [self.hit("y"), self.hit("z")])  # a sent query that is not the latest
            self.assertEqual(len(app.S.search_results), 1)
            self.echo(tui, " the   cur ", [self.hit("y"), self.hit("z")])  # whatever its blanks
            self.assertEqual(len(app.S.search_results), 1)
            self.echo(tui, "the cure", [self.hit("w")])
            self.assertEqual([r["name"] for r in app.S.search_results], ["w"])

    async def test_enter_and_the_search_command_remember_what_was_sent_too(self):
        tui = app.SpotuiApp("127.0.0.1", 0, "window", self.log)
        sent = []
        tui.ws_send = sent.append
        async with tui.run_test(size=(100, 30)) as pilot:
            await self.open_search(pilot, tui)
            app.S.search_q = "enter q"
            await pilot.press("enter")
            self.assertEqual(sent[-1], {"type": "command", "cmd": "search enter q"})
            self.assertEqual(app.S.search_sent, "enter q")
            self.assertEqual(list(app.S.search_recent), ["enter q"])
            self.echo(tui, "enter q", [self.hit("e")])
            self.assertEqual([r["name"] for r in app.S.search_results], ["e"])
            tui.set_mode("lyrics")
            await pilot.pause()
            inp = tui.query_one(app.Input)
            inp.value = "search  cmd   q"
            await inp.action_submit()
            await pilot.pause()
            self.assertEqual(sent[-1]["cmd"], "search  cmd   q")
            self.assertEqual((app.S.search_sent, app.S.search_q), ("cmd q", "cmd   q"))
            inp.value = "search"
            await inp.action_submit()
            await pilot.pause()
            self.assertIsNone(app.S.search_sent)  # nothing sent: no latest query
            self.assertEqual(list(app.S.search_recent), ["enter q", "cmd q"])  # the older ones are still recognised

    async def test_a_message_with_no_query_is_ignored_while_a_search_is_pending(self):
        tui = app.SpotuiApp("127.0.0.1", 0, "window", self.log)
        async with tui.run_test(size=(100, 30)) as pilot:
            await self.open_search(pilot, tui)
            await pilot.press("a")
            tui.flush_search()
            tui.relay._apply(self.client, {"type": "search", "results": [self.hit("x")]})
            self.assertEqual(app.S.search_results, [])

    async def test_with_no_search_sent_the_theme_still_opens_the_search_view(self):
        tui = app.SpotuiApp("127.0.0.1", 0, "window", self.log)
        async with tui.run_test(size=(100, 30)) as pilot:
            await pilot.pause()
            self.assertIsNone(app.S.search_sent)
            self.echo(tui, "from theme", [self.hit("t")])
            self.assertEqual(app.S.mode, "search")
            self.assertEqual(app.S.search_q, "from theme")
            self.assertEqual([r["name"] for r in app.S.search_results], ["t"])
            self.assertEqual(app.S.search_i, 0)

    # -- L1 / M-b: a reply is never a new search

    async def test_audit_one_a_late_reply_of_an_older_query_after_esc_does_not_reopen_the_view(self):
        tui = app.SpotuiApp("127.0.0.1", 0, "window", self.log)
        async with tui.run_test(size=(100, 30)) as pilot:
            await self.open_search(pilot, tui)
            await pilot.press("a", "b", "c")
            tui.flush_search()  # "abc" sent
            await pilot.press("d")
            tui.flush_search()  # "abcd" sent: the latest
            await pilot.press("escape")
            self.assertEqual(app.S.mode, "lyrics")
            self.echo(tui, "abc")  # the immediate empty echo of the older query
            self.echo(tui, "abc", [self.hit("late")])  # its results
            await pilot.pause()
            self.assertEqual(app.S.mode, "lyrics")
            self.assertFalse(tui.query_one("#search").display)
            self.assertTrue(tui.query_one("#lyrics").display)
            self.assertEqual(app.S.search_results, [])
            self.assertEqual(app.S.search_q, "abcd")  # the input is not rewritten
            self.echo(tui, "abcd", [self.hit("latest")])  # the answer to the latest one: view still closed
            await pilot.pause()
            self.assertEqual(app.S.mode, "lyrics")
            self.assertEqual(app.S.search_results, [])
        self.assertIsNone(tui._exception)

    async def test_audit_two_esc_before_the_immediate_echo_leaves_the_view_closed_for_the_results_too(self):
        tui = app.SpotuiApp("127.0.0.1", 0, "window", self.log)
        async with tui.run_test(size=(100, 30)) as pilot:
            await self.open_search(pilot, tui)
            await pilot.press("a", "b")
            tui.flush_search()
            await pilot.press("escape")  # before the theme's empty echo
            for results in ([], [self.hit("x")]):  # the echo does not use the entry up: the results are a reply too
                self.echo(tui, "ab", results)
                await pilot.pause()
                self.assertEqual(app.S.mode, "lyrics")
                self.assertEqual(app.S.search_results, [])
            self.assertTrue(tui.query_one("#lyrics").display)
        self.assertIsNone(tui._exception)

    async def test_the_plain_case_both_answers_are_applied_and_the_view_stays_as_it_is(self):
        modes = []
        tui = app.SpotuiApp("127.0.0.1", 0, "window", self.log)
        async with tui.run_test(size=(100, 30)) as pilot:
            await self.open_search(pilot, tui)
            await pilot.press("a", "b")
            tui.flush_search()
            relay_call = tui.relay._call
            tui.relay._call = lambda fn, *a, **k: (modes.append(a), relay_call(fn, *a, **k))[1]
            self.echo(tui, "ab")  # the immediate empty echo
            self.assertEqual(app.S.search_results, [])
            self.echo(tui, "ab", [self.hit("now")])
            self.assertEqual([r["name"] for r in app.S.search_results], ["now"])
            self.echo(tui, "ab", [self.hit("again"), self.hit("more")])  # entries are not used up by a match
            self.assertEqual(len(app.S.search_results), 2)
            self.assertEqual(modes, [])  # a reply never changes the mode
            self.assertEqual(app.S.mode, "search")
            self.assertTrue(tui.query_one("#search").display)
            self.assertEqual(app.S.search_q, "ab")
        self.assertIsNone(tui._exception)

    async def test_a_search_of_the_theme_opens_the_view_while_the_user_is_elsewhere(self):
        tui = app.SpotuiApp("127.0.0.1", 0, "window", self.log)
        async with tui.run_test(size=(100, 30)) as pilot:
            await self.open_search(pilot, tui)
            await pilot.press("a", "b")
            tui.flush_search()
            await pilot.press("escape")
            self.assertEqual(app.S.mode, "lyrics")
            self.echo(tui, "something else", [self.hit("x")])  # not a query the TUI sent
            await pilot.pause()
            self.assertEqual(app.S.mode, "search")
            self.assertTrue(tui.query_one("#search").display)
            self.assertEqual(app.S.search_q, "something else")
            self.assertEqual([r["name"] for r in app.S.search_results], ["x"])
        self.assertIsNone(tui._exception)

    def test_the_relay_calls_on_mode_only_for_the_theme_s_own_search(self):
        hooks = RecordingHooks()
        relay = app.Relay("127.0.0.1", 0, self.log, hooks, StubCapture(), peer_check=False)
        reply = {"type": "search", "query": "ab", "results": [self.hit("x")]}
        app.S.search_remember("ab")
        for mode in ("lyrics", "search", "playlist"):
            app.S.mode = mode
            relay._apply(self.client, reply)
        self.assertEqual(hooks.modes, [])
        self.assertEqual(len(app.S.search_results), 1)  # applied once, in the search view only
        app.S.mode = "lyrics"
        relay._apply(self.client, {"type": "search", "query": "cd", "results": []})  # nothing sent for "cd"
        self.assertEqual(hooks.modes, ["search"])
        relay._apply(self.client, {"type": "search", "results": [self.hit("y")]})  # no query, an answer pending
        self.assertEqual(hooks.modes, ["search"])
        app.S.search_forget()
        relay._apply(self.client, {"type": "search", "results": [self.hit("y")]})  # no query, nothing pending
        self.assertEqual(hooks.modes, ["search", "search"])

    def test_only_the_latest_query_is_shown_and_an_older_one_is_still_a_reply(self):
        hooks = RecordingHooks()
        relay = app.Relay("127.0.0.1", 0, self.log, hooks, StubCapture(), peer_check=False)
        app.S.mode = "search"
        app.S.search_remember("abc")
        app.S.search_remember("abcd")
        relay._apply(self.client, {"type": "search", "query": "abc", "results": [self.hit("old")]})
        self.assertEqual((app.S.search_results, hooks.modes), ([], []))
        relay._apply(self.client, {"type": "search", "query": "abcd", "results": [self.hit("new")]})
        self.assertEqual(([r["name"] for r in app.S.search_results], hooks.modes), (["new"], []))
        app.S.search_remember("abc")  # sent again: the latest now
        relay._apply(self.client, {"type": "search", "query": "abc", "results": [self.hit("again")]})
        self.assertEqual([r["name"] for r in app.S.search_results], ["again"])

    def test_a_sent_query_is_remembered_for_fifteen_seconds(self):
        now = [100.0]
        app.S.clock = lambda: now[0]
        hooks = RecordingHooks()
        relay = app.Relay("127.0.0.1", 0, self.log, hooks, StubCapture(), peer_check=False)
        app.S.search_remember("ab")
        now[0] += 14.9
        relay._apply(self.client, {"type": "search", "query": "ab", "results": [self.hit("x")]})
        self.assertEqual(hooks.modes, [])  # still a reply
        app.S.search_remember("cd")
        now[0] += 0.2  # "ab" is 15.1 s old, "cd" 0.2 s
        relay._apply(self.client, {"type": "search", "query": "ab", "results": [self.hit("y")]})
        self.assertEqual(hooks.modes, ["search"])  # expired: the theme's own search
        self.assertEqual(list(app.S.search_recent), ["cd"])
        relay._apply(self.client, {"type": "search", "query": "cd", "results": []})
        self.assertEqual(hooks.modes, ["search"])
        app.S.search_remember("cd")  # sending it again renews it
        now[0] += 14.0
        self.assertTrue(app.S.search_recent_has("cd"))
        now[0] += 1.1
        self.assertFalse(app.S.search_recent_has("cd"))

    def test_at_most_sixteen_queries_are_remembered_the_oldest_go_first(self):
        for i in range(20):
            app.S.search_remember(f"q{i}")
        self.assertEqual(list(app.S.search_recent), [f"q{i}" for i in range(4, 20)])
        self.assertEqual(len(app.S.search_recent), app.SEARCH_RECENT_MAX)
        self.assertEqual((app.SEARCH_RECENT_MAX, app.SEARCH_RECENT_SECONDS), (16, 15.0))
        self.assertEqual(app.S.search_sent, "q19")
        app.S.search_remember("q4")  # sent again: the newest, not a second entry
        self.assertEqual(list(app.S.search_recent)[-2:], ["q19", "q4"])
        self.assertEqual(len(app.S.search_recent), 16)
        self.assertFalse(app.S.search_recent_has("q0"))

    async def test_a_theme_disconnect_forgets_what_was_sent(self):
        hooks = RecordingHooks()
        relay = app.Relay("127.0.0.1", 0, hooks=hooks, log=self.log, capture=StubCapture(), peer_check=False)
        await relay.start()
        runner = asyncio.ensure_future(relay.run())
        try:
            app.S.search_remember("ab")
            app.S.search_remember("cd")
            async with connect(f"ws://127.0.0.1:{relay.port}", origin=THEME) as ws:
                await recv_type(ws, "status")
                self.assertEqual((app.S.search_sent, list(app.S.search_recent)), ("cd", ["ab", "cd"]))  # connecting changes nothing
            self.assertTrue(await until(lambda: app.S.search_sent is None and not app.S.search_recent))
        finally:
            await relay.close()
            await asyncio.wait_for(runner, 3)

    # -- L2: the space bar

    async def test_space_is_typed_into_the_search(self):
        tui = app.SpotuiApp("127.0.0.1", 0, "window", self.log)
        async with tui.run_test(size=(100, 30)) as pilot:
            await self.open_search(pilot, tui)
            await pilot.press("t", "h", "e", "space", "c", "u", "r", "e")
            self.assertEqual(app.S.search_q, "the cure")
            await pilot.press("space")
            self.assertEqual(app.S.search_q, "the cure ")
            await pilot.press("backspace", "backspace")
            self.assertEqual(app.S.search_q, "the cur")
            await pilot.press("é", "1", "-")  # other characters the key names spell out or abbreviate
            self.assertEqual(app.S.search_q, "the curé1-")
            await pilot.press("tab", "f1", "left")  # keys with no printable character add nothing
            self.assertEqual(app.S.search_q, "the curé1-")
        self.assertIsNone(tui._exception)

    async def test_the_typed_character_goes_through_clean(self):
        tui = app.SpotuiApp("127.0.0.1", 0, "window", self.log)
        async with tui.run_test(size=(100, 30)) as pilot:
            await self.open_search(pilot, tui)
            for char in ("\ud83d", "\x1b", "​", "ab", "", None, "\t", "\n"):
                event = types.SimpleNamespace(key="x", character=char, prevent_default=lambda: None, stop=lambda: None)
                await tui.on_key(event)
            self.assertEqual(app.S.search_q, "")
            event = types.SimpleNamespace(key="space", character=" ", prevent_default=lambda: None, stop=lambda: None)
            with mock.patch.object(app, "clean", wraps=app.clean) as cleaned:
                await tui.on_key(event)
            cleaned.assert_called_with(" ", 1)
            self.assertEqual(app.S.search_q, " ")

    async def test_blanks_that_are_not_printable_are_typed_too(self):
        tui = app.SpotuiApp("127.0.0.1", 0, "window", self.log)
        async with tui.run_test(size=(100, 30)) as pilot:
            await self.open_search(pilot, tui)

            async def type_(char):
                event = types.SimpleNamespace(key="x", character=char, prevent_default=lambda: None, stop=lambda: None)
                await tui.on_key(event)

            for char in ("a", "　", " ", "b", " "):  # ideographic space, no-break space, em space
                await type_(char)
            self.assertEqual(app.S.search_q, "a　 b ")
            self.assertEqual(app.norm_query(app.S.search_q), "a b")  # the theme sees them as the blanks they are
            for char in ("​", "\x00", " ", " ", "\x85"):  # zero width, control, line and paragraph breaks
                await type_(char)
            self.assertEqual(app.S.search_q, "a　 b ")
        self.assertIsNone(tui._exception)

    # -- L3: the query as the theme echoes it

    def test_norm_query_collapses_the_blanks_before_it_applies_the_cap(self):
        self.assertEqual(app.norm_query("  the   cure \t"), "the cure")
        self.assertEqual(app.norm_query(" " * 1500 + "needle"), "needle")  # the blanks do not eat the cap
        self.assertEqual(app.norm_query("a" + " " * 300 + "b"), "a b")
        self.assertEqual(app.norm_query("word " * 100), " ".join(["word"] * 40))  # 40 words = 199 characters
        self.assertEqual(len(app.norm_query("x" * 500)), app.LIMIT_QUERY)
        self.assertEqual(app.norm_query("a ​ b"), "a b")  # an invisible character between blanks
        self.assertEqual(app.norm_query("a\x1b[31m b"), "a[31m b")
        self.assertEqual(app.norm_query("w " * 150), " ".join(["w"] * 100))
        self.assertEqual(app.norm_query("ab" + " " * 198 + "c"), "ab c")
        self.assertIsNone(app.norm_query(None))
        self.assertIsNone(app.norm_query(5))
        self.assertEqual(app.norm_query(""), "")

    def test_the_cap_never_leaves_a_trailing_blank(self):
        text = ("x" * 199) + " tail"
        got = app.norm_query(text)
        self.assertEqual(got, "x" * 199)
        self.assertFalse(got.endswith(" "))


# ---------------------------------------------------------------- spectrum pacing

class PumpClock:
    """A clock and a sleep that move together; `quantum` rounds each wake-up up to a timer tick."""

    def __init__(self, relay, quantum=0.0, limit=None):
        self.now = 100.0
        self.start = self.now
        self.quantum = quantum
        self.limit = limit
        self.reads = 0
        self.sleeps = []
        self.frames = []
        self.done = asyncio.Event()
        self.on_frame = None
        relay._pump_clock = self.clock
        relay._pump_sleep = self.sleep
        relay.broadcast = self.broadcast

    def clock(self):
        self.reads += 1
        return self.now

    async def broadcast(self, obj, *, viz_only=False):
        assert obj["type"] == "spectrum" and viz_only
        self.frames.append(self.now)
        if self.on_frame:
            self.on_frame(len(self.frames))

    async def sleep(self, delay):
        self.sleeps.append(delay)
        self.now += delay
        if self.quantum:
            self.now = math.ceil(self.now / self.quantum - 1e-9) * self.quantum
        await asyncio.sleep(0)
        if self.limit is not None and self.now - self.start >= self.limit:
            self.done.set()
            await asyncio.Event().wait()

    def gaps(self, frames=None):
        f = self.frames if frames is None else frames
        return [b - a for a, b in zip(f, f[1:])]


class SpectrumPaceCase(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self._saved_state = app.S
        app.S = app.State()
        self.log, _ = make_log()
        self.relay = app.Relay("127.0.0.1", 0, self.log, RecordingHooks(), StubCapture())
        self.pump = None

    async def asyncTearDown(self):
        if self.pump is not None:
            self.pump.cancel()
            await asyncio.gather(self.pump, return_exceptions=True)
        app.S = self._saved_state

    def run_pump(self):
        self.pump = asyncio.ensure_future(self.relay.spectrum_pump())

    async def test_an_exact_timer_gives_30_frames_per_second(self):
        clock = PumpClock(self.relay, limit=10.0)
        self.relay._viz_event.set()
        self.run_pump()
        await asyncio.wait_for(clock.done.wait(), 5)
        self.assertEqual(app.SPECTRUM_FPS, 30)
        self.assertAlmostEqual(len(clock.frames) / 10.0, 30, delta=0.2)
        for gap in clock.gaps():
            self.assertAlmostEqual(gap, 1 / 30, places=6)

    async def test_a_coarse_timer_tick_does_not_slow_the_rate(self):
        # Windows wakes a sleep at the next 15.6 ms tick: a fixed sleep(0.033) lasts 47 ms there (21 fps).
        clock = PumpClock(self.relay, quantum=0.015625, limit=10.0)
        self.relay._viz_event.set()
        self.run_pump()
        await asyncio.wait_for(clock.done.wait(), 5)
        self.assertAlmostEqual(len(clock.frames) / 10.0, 30, delta=0.2)
        gaps = clock.gaps()
        self.assertLessEqual(max(gaps), 3 * 0.015625 + 1e-9)  # never more than 3 ticks (47 ms) between two frames
        self.assertGreaterEqual(min(gaps), 0.015625 - 1e-9)
        # What the old pacing did on the same timer, for contrast: 47 ms per frame.
        now, count = 0.0, 0
        while now < 10:
            now = math.ceil((now + 0.033) / 0.015625 - 1e-9) * 0.015625
            count += 1
        self.assertLess(count / 10.0, 22)

    async def test_the_time_a_frame_takes_counts_against_the_next_wait(self):
        clock = PumpClock(self.relay, limit=2.0)

        async def slow_broadcast(obj, *, viz_only=False):
            clock.frames.append(clock.now)
            clock.now += 0.010  # sending takes 10 ms

        self.relay.broadcast = slow_broadcast
        self.relay._viz_event.set()
        self.run_pump()
        await asyncio.wait_for(clock.done.wait(), 5)
        self.assertAlmostEqual(len(clock.frames) / 2.0, 30, delta=0.6)
        self.assertAlmostEqual(clock.sleeps[3], 1 / 30 - 0.010, places=6)

    async def test_far_behind_resynchronises_instead_of_bursting(self):
        clock = PumpClock(self.relay, limit=8.0)

        def stall(n):
            if n == 10:
                clock.now += 5.0  # the loop was blocked for 5 s

        clock.on_frame = stall
        self.relay._viz_event.set()
        self.run_pump()
        await asyncio.wait_for(clock.done.wait(), 5)
        after = clock.frames[10:]
        self.assertAlmostEqual(after[0] - clock.frames[9], 5.0, places=6)  # one frame the moment it is back
        for gap in clock.gaps(after):
            self.assertAlmostEqual(gap, 1 / 30, places=6)  # no catch-up burst

    async def test_a_small_delay_is_caught_up_within_three_frames(self):
        clock = PumpClock(self.relay, limit=2.0)

        def stall(n):
            if n == 10:
                clock.now += 2.5 / 30  # 2.5 frames late: below the resync limit

        clock.on_frame = stall
        self.relay._viz_event.set()
        self.run_pump()
        await asyncio.wait_for(clock.done.wait(), 5)
        # Frames 11 and 12 follow at once, then the schedule is the original one: no frame was lost.
        self.assertAlmostEqual(clock.frames[10] - clock.frames[9], 2.5 / 30, places=6)
        self.assertLess(clock.frames[11] - clock.frames[10], 1 / 30 / 2)
        self.assertAlmostEqual(clock.frames[-1] - clock.frames[0], (len(clock.frames) - 1) / 30, places=6)

    async def test_a_clock_that_steps_back_does_not_park_the_pump(self):
        clock = PumpClock(self.relay, limit=1.0)
        def step_back(n):
            if n == 5:
                clock.now -= 3600
                clock.start -= 3600

        clock.on_frame = step_back
        self.relay._viz_event.set()
        self.run_pump()
        await asyncio.wait_for(clock.done.wait(), 5)
        self.assertLessEqual(max(clock.sleeps), 1 / 30 + 1e-9)

    async def test_idle_means_no_wakeups_at_all(self):
        clock = PumpClock(self.relay)
        self.run_pump()
        await asyncio.sleep(0.1)
        self.assertEqual((clock.reads, clock.sleeps, clock.frames), (0, [], []))
        self.assertFalse(self.pump.done())

    async def test_clearing_the_event_parks_the_pump_and_a_new_viz_client_restarts_a_fresh_schedule(self):
        clock = PumpClock(self.relay)
        clock.on_frame = lambda n: self.relay._viz_event.clear() if n == 5 else None
        self.relay._viz_event.set()
        self.run_pump()
        await asyncio.sleep(0.1)
        self.assertEqual(len(clock.frames), 5)
        sleeps, reads = len(clock.sleeps), clock.reads
        await asyncio.sleep(0.1)
        self.assertEqual((len(clock.sleeps), clock.reads, len(clock.frames)), (sleeps, reads, 5))  # parked
        clock.now += 600  # a long idle, then a client wants the bars again
        clock.on_frame = None
        self.relay._viz_event.set()
        await asyncio.sleep(0.1)
        self.assertGreater(len(clock.frames), 7)
        self.assertAlmostEqual(clock.frames[5] - clock.frames[4], 600 + 1 / 30, places=6)  # first frame at once ...
        self.assertAlmostEqual(clock.frames[6] - clock.frames[5], 1 / 30, places=6)  # ... then the normal pace

    async def test_the_bars_are_rounded_to_three_decimals_and_the_frame_gets_smaller(self):
        import random
        rng = random.Random(7)
        for bars in (48, 256):
            raw = [rng.random() for _ in range(bars)]
            app.S.spectrum = raw
            sent = []

            async def broadcast(obj, *, viz_only=False):
                sent.append(obj)

            self.relay.broadcast = broadcast
            self.relay._viz_event.set()
            self.run_pump()
            self.assertTrue(await until(lambda: sent))
            self.pump.cancel()
            await asyncio.gather(self.pump, return_exceptions=True)
            self.relay._viz_event.clear()
            frame = sent[0]
            self.assertEqual(frame["type"], "spectrum")
            self.assertEqual(frame["bars"], [round(v, 3) for v in raw])
            self.assertTrue(all(isinstance(v, float) for v in frame["bars"]))
            for text in json.dumps(frame["bars"]).strip("[]").split(", "):
                self.assertLessEqual(len(text.partition(".")[2]), 3, text)
            before, after = len(json.dumps({"type": "spectrum", "bars": raw})), len(json.dumps(frame))
            self.assertLess(after, before * 0.6, (bars, before, after))
        self.assertEqual(app.S.spectrum, raw)  # the state itself is not rounded

    async def test_a_real_viz_client_gets_frames_through_the_real_pump(self):
        await self.relay.start()
        runner = asyncio.ensure_future(self.relay.run())
        try:
            async with connect(f"ws://127.0.0.1:{self.relay.port}", origin=THEME, max_queue=None) as ws:
                await recv_type(ws, "status")
                await ws.send(json.dumps({"type": "update", "visualizer": True}))
                for _ in range(3):
                    self.assertEqual(len((await recv_type(ws, "spectrum"))["bars"]), app.S.bars)
        finally:
            await self.relay.close()
            await asyncio.wait_for(runner, 3)


if __name__ == "__main__":
    unittest.main()
