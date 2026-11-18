import { execute } from "./commands.js";
import { CUSTOM_BAR_PROGRESS_STYLE, PROGRESS_STYLES, VISUALIZER_BARS, VISUALIZER_MODE, VISUALIZER_SMOOTH } from "./constants.js";
import { getAllowedJamGuestCommands } from "./jam.js";
import { isSensitiveCommand } from "./keybinds.js";
import { getCurrentTrackLyricsInfo, resolveTrackLyrics } from "./lyrics.js";
import { getPlaylists, normalizeTrackItem } from "./playlists.js";
import { searchSpotify } from "./search.js";
import { app } from "./state.js";
import { storageGet } from "./storage.js";
import { dbg, playFresh } from "./utils.js";
import { setVisualizerBars } from "./visualizer.js";

const WS_URL = "ws://localhost:8765";
const HEARTBEAT_MS = 1000;
const RECONNECT_MS = 3000;
const RECONNECT_MAX_MS = 30000;
const SYNC_ICON_OFF = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path><circle cx="18.5" cy="18.5" r="4.5" fill="#ef4444" stroke="none"></circle><path d="m16.8 16.8 3.4 3.4m0-3.4-3.4 3.4" stroke="#fff" stroke-width="1.5"></path></svg>`;
const SYNC_ICON_ON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path><circle cx="18.5" cy="18.5" r="4.5" fill="#22c55e" stroke="none"></circle><path d="m16.3 18.5 1.4 1.4 3-3" stroke="#fff" stroke-width="1.5"></path></svg>`;

let reconnectDelay = RECONNECT_MS;

let socket = null;
let reconnectTimer = null;
let heartbeatTimer = null;
let lyricsToken = 0;
let lyricsCache = { uri: "", lines: [], synced: false, instrumental: false, error: "", loading: false };

function toHex(value, fallback) {
    const v = String(value || "").trim();
    if (!v || v === "transparent" || v === "none") return fallback;
    if (v[0] === "#") {
        if (v.length === 4 || v.length === 5) return "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
        return v.slice(0, 7);
    }
    const m = v.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!m) return fallback;
    return "#" + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("");
}

function cssVar(style, name, fallback) {
    return toHex(style.getPropertyValue(name), fallback);
}

function getColors() {
    const style = getComputedStyle(document.documentElement);
    return {
        active: cssVar(style, "--lyrics-color-active", "#ff8c42"),
        inactive: cssVar(style, "--lyrics-color-inactive", "#777777"),
        near: cssVar(style, "--lyrics-color-light-inactive", "#b3b3b3"),
        accent: cssVar(style, "--spotui-accent", "#ff8c42"),
        panel_bg: cssVar(style, "--panel-bg-color", "#000000"),
        panel_border: cssVar(style, "--panel-border-color", "#ff8c42"),
        panel_text: cssVar(style, "--panel-text-color", "#ff8c42"),
        bar_bg: cssVar(style, "--player-bar-background", "#000000"),
        bar_text: cssVar(style, "--player-bar-text-color", "#ff8c42"),
        visualizer: cssVar(style, "--visualizer-color", "#ff8c42"),
    };
}

// 9 forced style reads per call — cache for 5s (worst case the relay sees
// a recolor a few seconds late).
let colorsCache = null;
let colorsCacheAt = 0;
const COLORS_CACHE_MS = 5000;

function getCachedColors() {
    const now = Date.now();
    if (!colorsCache || now - colorsCacheAt > COLORS_CACHE_MS) {
        colorsCache = getColors();
        colorsCacheAt = now;
    }
    return colorsCache;
}

function isPlayingNow() {
    try {
        if (typeof Spicetify.Player.isPlaying === "function") return Spicetify.Player.isPlaying();
    } catch {}
    return !Spicetify.Player.data?.isPaused;
}

function getDurationMs(item) {
    if (!item) return 0;
    if (typeof item.duration === "number") return item.duration;
    if (item.duration?.milliseconds != null) return item.duration.milliseconds;
    return 0;
}

function getVisualizerBars() {
    const stored = storageGet(VISUALIZER_BARS);
    if (stored === null) return 48;
    const value = Number(stored);
    return Number.isFinite(value) ? Math.min(256, Math.max(1, Math.floor(value))) : 48;
}

function getVisualizerSmooth() {
    const stored = storageGet(VISUALIZER_SMOOTH);
    if (stored === null) return 45;
    const value = Number(stored);
    return Number.isFinite(value) ? Math.min(100, Math.max(1, Math.floor(value))) : 45;
}

function getVisualizerMode() {
    const stored = storageGet(VISUALIZER_MODE);
    return stored === "global" ? "global" : "adaptive";
}

function getTrackPayload() {
    const data = Spicetify.Player.data;
    const item = data?.item ?? data?.track;
    if (!item) return null;
    const progressStyle = storageGet(CUSTOM_BAR_PROGRESS_STYLE) || "classic-block";
    return {
        type: "update",
        title: item.name ?? item.metadata?.title ?? "",
        artist: item.artists?.map((a) => a.name).join(", ") ?? item.metadata?.artist_name ?? "",
        album: item.album?.name ?? item.metadata?.album_title ?? "",
        uri: item.uri ?? "",
        duration_ms: getDurationMs(item),
        position_ms: Spicetify.Player.getProgress() || 0,
        is_playing: isPlayingNow(),
        timestamp: Date.now(),
        colors: getCachedColors(),
        lyrics: lyricsCache,
        progress_style: progressStyle,
        progress_chars: PROGRESS_STYLES[progressStyle] || PROGRESS_STYLES["classic-block"],
        visualizer: app.visualizerOpen,
        visualizer_bars: getVisualizerBars(),
        visualizer_smoothing: getVisualizerSmooth(),
        visualizer_mode: getVisualizerMode(),
    };
}

function sendJson(obj) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(obj));
}

function send() {
    const payload = getTrackPayload();
    if (payload) sendJson(payload);
    else sendJson({ type: "update", visualizer: app.visualizerOpen, visualizer_bars: getVisualizerBars(), visualizer_smoothing: getVisualizerSmooth(), visualizer_mode: getVisualizerMode(), colors: getCachedColors(), lyrics: lyricsCache });
}

async function refreshLyrics() {
    const info = getCurrentTrackLyricsInfo();
    const token = ++lyricsToken;
    if (!info) {
        lyricsCache = { uri: "", lines: [], synced: false, instrumental: false, error: "", loading: false };
        send();
        return;
    }
    if (lyricsCache.uri === info.uri && (lyricsCache.lines.length || lyricsCache.instrumental || lyricsCache.error) && !lyricsCache.loading) {
        send();
        return;
    }
    lyricsCache = { uri: info.uri, lines: [], synced: false, instrumental: false, error: "", loading: true };
    send();
    const result = await resolveTrackLyrics(info);
    if (token !== lyricsToken) return;
    lyricsCache = {
        uri: info.uri,
        lines: result.lines || [],
        synced: Boolean(result.synced),
        instrumental: Boolean(result.instrumental),
        error: result.error || "",
        loading: false,
    };
    send();
}

async function sendSongs(uri) {
    let songs = [];
    try {
        const res = await Spicetify.Platform.PlaylistAPI.getContents(uri);
        songs = (res.items || [])
            .filter((item) => item && item.uri && item.isPlayable !== false)
            .map((item, index) => normalizeTrackItem(item, index))
            .map((s) => ({ name: s.name, artist: s.artist, uri: s.uri }));
    } catch {}
    sendJson({ type: "songs", uri, songs });
}

async function handleTuiSearch(query) {
    sendJson({ type: "search", query, results: [] });
    try {
        const { results } = await searchSpotify(query);
        sendJson({
            type: "search",
            query,
            results: (results || []).map((r) => ({ name: r.name, uri: r.uri, type: r.type || "" })),
        });
    } catch {
        sendJson({ type: "search", query, results: [] });
    }
}

async function handleTuiPlaylist(argText) {
    let list = [];
    try { list = await getPlaylists(); } catch { list = []; }
    const slim = list.map((p) => ({ name: p.name, uri: p.uri }));
    if (argText) {
        const q = argText.toLowerCase();
        const match = slim.filter((p) => p.name.toLowerCase().includes(q));
        if (match.length === 1) {
            playFresh(match[0].uri);
            return;
        }
        if (match.length > 1) {
            sendJson({ type: "playlists", playlists: match });
            if (match[0]?.uri) sendSongs(match[0].uri);
            return;
        }
    }
    sendJson({ type: "playlists", playlists: slim });
    if (slim[0]?.uri) sendSongs(slim[0].uri);
}

function playUri(uri, context) {
    if (!uri) return;
    playFresh(uri, context);
}

function syncTip(show) {
    let tip = document.getElementById("spotui-sposync-tip");
    if (!show) { if (tip) tip.hidden = true; return; }
    const el = document.getElementById("spotui-sposync-status");
    if (!el) return;
    if (!tip) {
        tip = document.createElement("div");
        tip.id = "spotui-sposync-tip";
        document.body.appendChild(tip);
    }
    const on = socket?.readyState === WebSocket.OPEN;
    tip.textContent = on ? "SpoSync:\nConnected" : "SpoSync:\nDisconnected";
    const r = el.getBoundingClientRect();
    tip.style.left = r.left + r.width / 2 + "px";
    tip.style.bottom = window.innerHeight - r.top + 8 + "px";
    tip.hidden = false;
}

function paintSyncIcon() {
    const el = document.getElementById("spotui-sposync-status");
    if (!el) return;
    const on = socket?.readyState === WebSocket.OPEN;
    app.sposyncConnected = on;
    const key = on ? "1" : "0";
    if (el.dataset.sync === key) return;
    el.dataset.sync = key;
    el.innerHTML = on ? SYNC_ICON_ON : SYNC_ICON_OFF;
    el.setAttribute("aria-label", on ? "SpoSync: Connected" : "SpoSync: Disconnected");
    const tip = document.getElementById("spotui-sposync-tip");
    if (tip && !tip.hidden) syncTip(true);
}

function mountSyncIcon() {
    const host = document.querySelector(".main-nowPlayingBar-extraControls");
    if (!host) return;
    let el = document.getElementById("spotui-sposync-status");
    if (el && host.firstChild === el) return;
    if (!el) {
        el = document.createElement("span");
        el.id = "spotui-sposync-status";
        el.setAttribute("role", "img");
        el.addEventListener("mouseenter", () => syncTip(true));
        el.addEventListener("mouseleave", () => syncTip(false));
    }
    host.prepend(el);
    paintSyncIcon();
}

function scheduleReconnect() {
    clearTimeout(reconnectTimer);
    // Back off while the relay is down: 3s -> 30s cap, reset on open.
    reconnectTimer = setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
}

function connect() {
    // Never strand a live socket: close before replacing.
    try { if (socket) socket.close(); } catch {}
    try {
        socket = new WebSocket(WS_URL);
    } catch {
        scheduleReconnect();
        return;
    }
    socket.onopen = () => {
        reconnectDelay = RECONNECT_MS;
        app.sposyncConnected = true;
        paintSyncIcon();
        send();
        refreshLyrics();
    };
    socket.onclose = () => {
        app.sposyncConnected = false;
        paintSyncIcon();
        scheduleReconnect();
    };
    socket.onerror = () => {
        try { socket.close(); } catch {}
    };
    socket.onmessage = (event) => {
        let data;
        try { data = JSON.parse(event.data); } catch { return; }
        // The relay is an unauthenticated localhost socket: playback stays,
        // but guests keep their restrictions and sensitive commands
        // (binds, secrets, destructive/theme-defacing ops) never run remote.
        const guestAllowed = getAllowedJamGuestCommands();
        if (data?.type === "spectrum") {
            setVisualizerBars(data.bars);
            return;
        }
        if (data?.type === "play") {
            if (guestAllowed) return;
            playUri(data.uri, data.context);
            return;
        }
        if (data?.type === "get_songs" && data.uri) {
            sendSongs(data.uri);
            return;
        }
        if (data?.type === "command" && data.cmd) {
            const cleaned = String(data.cmd).trim();
            const [raw, ...rest] = cleaned.split(/\s+/);
            const command = (raw || "").toLowerCase();
            const argText = rest.join(" ").trim();
            if (guestAllowed && !guestAllowed.has(command)) return;
            if (command === "search") { handleTuiSearch(argText); return; }
            if (command === "playlist" || command === "list") { handleTuiPlaylist(argText); return; }
            if (isSensitiveCommand(cleaned)) {
                dbg("[SpoTUI-sync] refused remote sensitive command.");
                return;
            }
            execute(cleaned).then(send);
        }
    };
}

export function initSync() {
    // Once-guard on window (not module state): a re-evaluated bundle must
    // not double-register Player listeners or strand a second socket.
    // Set only after Player exists so boot retries keep working.
    try {
        if (window.__spotuiSyncStarted) return;
    } catch (e) {}
    if (!Spicetify?.Player || !Spicetify?.Platform) {
        setTimeout(initSync, 300);
        return;
    }
    try {
        window.__spotuiSyncStarted = true;
    } catch (e) {}
    Spicetify.Player.addEventListener("songchange", () => {
        lyricsCache = { uri: "", lines: [], synced: false, instrumental: false, error: "", loading: true };
        send();
        // refreshLyrics only feeds the SpoSync relay (the in-app lyrics panel
        // loads its own via lyrics.js), so without a connection nothing
        // consumes the result and no lyric request should leave the app. On
        // connect, onopen fetches for the current track.
        if (app.sposyncConnected) refreshLyrics();
    });
    Spicetify.Player.addEventListener("onplaypause", send);
    // onprogress fires many times per second; the 1s heartbeat already
    // covers steady state, so throttle progress sends to 1s.
    let lastProgressSend = 0;
    Spicetify.Player.addEventListener("onprogress", () => {
        const now = Date.now();
        if (now - lastProgressSend < 1000) return;
        lastProgressSend = now;
        send();
    });
    if (!heartbeatTimer) heartbeatTimer = setInterval(send, HEARTBEAT_MS);
    mountSyncIcon();
    if (!app.syncIconTimer) app.syncIconTimer = setInterval(mountSyncIcon, 2000);
    connect();
}
