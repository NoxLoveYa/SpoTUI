// Theme feed as DATA: fetched as text, parsed without executing anything and
// validated into fresh objects. No imports on purpose, so the parsing stays
// pure and testable on its own.

export const FEED_MAX_BYTES = 2 * 1024 * 1024;
export const FEED_TIMEOUT_MS = 8000;
export const FEED_MAX_THEMES = 1000;
const NAME_MAX = 120;
const ID_MAX = 200;
const URL_MAX = 2000;
const COMMANDS_MAX = 300;
// Longest real feed command is ~570 chars (a wallpaper URL with a signed
// token), so 500 would drop a legitimate theme.
const COMMAND_MAX = 1000;
const ID_REGEX = /^[A-Za-z0-9+/=_-]+$/;
const FORBIDDEN_KEYS = ["__proto__", "constructor", "prototype"];
const FEED_PREFIX_REGEX = /^window\.spotuiThemes\s*=\s*/;

// https URL or "". The feed's preview images must never be http:, data:,
// javascript: or anything else.
export function safeHttpsUrl(value) {
    if (typeof value !== "string" || !value || value.length > URL_MAX) return "";
    try {
        const url = new URL(value);
        if (url.protocol !== "https:" || url.username || url.password) return "";
        return url.href;
    } catch (e) {
        return "";
    }
}

function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

// One feed entry -> { theme } or { reason } (why it is dropped). Only the
// fields the cards and the apply path read are copied; the rest is dropped.
// `null` counts as a missing optional field. A bad id only costs the theme its
// id (still usable from the panel); anything that could apply a partial or
// unsafe look drops the whole theme.
function validateTheme(item) {
    if (!isPlainObject(item)) return { reason: "not-object" };
    if (FORBIDDEN_KEYS.some((k) => Object.hasOwn(item, k))) return { reason: "forbidden-key" };
    const { id, name, commands, screenshot_url: shot } = item;
    if (typeof name !== "string" || !name.trim() || name.length > NAME_MAX) return { reason: "bad-name" };
    let list = [];
    if (commands !== undefined && commands !== null) {
        if (!Array.isArray(commands) || commands.length > COMMANDS_MAX) return { reason: "bad-commands" };
        if (!commands.every((c) => typeof c === "string" && c.length <= COMMAND_MAX)) return { reason: "bad-command" };
        list = commands.slice();
    }
    const theme = { name, screenshot_url: safeHttpsUrl(shot), commands: Object.freeze(list) };
    if (typeof id === "string" && id && id.length <= ID_MAX && ID_REGEX.test(id)) theme.id = id;
    return { theme: Object.freeze(theme) };
}

// Parsed feed -> { themes, dropped, reasons }. `reasons` counts drops by
// cause (no feed content). Throws when the feed is not a list.
export function validateThemeFeed(data) {
    if (!Array.isArray(data)) throw new Error("Theme feed is not a list");
    const themes = [];
    const reasons = {};
    let dropped = 0;
    const drop = (reason, n = 1) => {
        dropped += n;
        reasons[reason] = (reasons[reason] || 0) + n;
    };
    if (data.length > FEED_MAX_THEMES) drop("over-limit", data.length - FEED_MAX_THEMES);
    for (let i = 0; i < data.length && i < FEED_MAX_THEMES; i++) {
        const { theme, reason } = validateTheme(data[i]);
        if (theme) themes.push(theme);
        else drop(reason);
    }
    return { themes, dropped, reasons };
}

// Feed text -> parsed value, never evaluated. Accepts the plain JSON list and
// the legacy `window.<feed global> = [...];` wrapper (exact prefix only), so
// anything else (extra statements, other assignments) fails to parse.
export function parseThemeFeedText(text) {
    if (typeof text !== "string") throw new Error("Theme feed is not text");
    let body = text.trim().replace(FEED_PREFIX_REGEX, "");
    if (body.endsWith(";")) body = body.slice(0, -1);
    if (body[0] !== "[") throw new Error("Theme feed is not a list");
    return JSON.parse(body);
}

// Read a response body as text, refusing more than `max` bytes.
async function readCappedText(res, max) {
    const declared = Number(res.headers.get("content-length"));
    if (declared > max) throw new Error("Theme feed too large");
    if (!res.body || typeof res.body.getReader !== "function") {
        const whole = await res.text();
        if (whole.length > max) throw new Error("Theme feed too large");
        return whole;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let size = 0;
    let out = "";
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > max) {
            reader.cancel().catch(() => {});
            throw new Error("Theme feed too large");
        }
        out += decoder.decode(value, { stream: true });
    }
    return out + decoder.decode();
}

// { signal, clear } — the timer is cleared once the request is over.
function timeoutSignal(ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

// Feed URL shape the frame loader accepts: https, no credentials or fragment,
// and exactly the numeric cache-buster as query. The caller builds it from a
// hard-coded channel URL; this is the last gate before it reaches srcdoc.
// `allowLocalHttp` (tests only, never set by the app) also lets
// http://localhost / 127.0.0.1 through.
const FRAME_QUERY_REGEX = /^\?_=\d{1,16}$/;

function frameFeedUrl(url, allowLocalHttp) {
    let u;
    try { u = new URL(url); } catch (e) { throw new Error("Theme feed URL invalid"); }
    const https = u.protocol === "https:";
    const local = allowLocalHttp === true && u.protocol === "http:"
        && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
    if (!(https || local) || u.username || u.password || u.hash || !FRAME_QUERY_REGEX.test(u.search)) {
        throw new Error("Theme feed URL invalid");
    }
    return u;
}

function escapeAttr(text) {
    return String(text)
        .replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
        .replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Policy for the frame: nothing loads except inline script and scripts from the
// feed's own origin; no connections, forms, <base>, child frames or WebRTC.
// `frame-src`/`child-src` 'none' do not stop about:blank/srcdoc children, and
// `webrtc 'block'` is not enforced everywhere (Edge 157 ignored it), so two
// more layers sit behind them: Trusted Types (the only policy is the bootstrap's
// own, for the feed script URL) makes every string-to-HTML/javascript:/srcdoc
// sink throw, which is what stops a feed from planting a child frame with its
// own script, and the bootstrap below removes the WebRTC entry points.
function frameCsp(origin) {
    return `default-src 'none'; script-src 'unsafe-inline' ${origin}; frame-src 'none'; child-src 'none'; webrtc 'block'; base-uri 'none'; form-action 'none'; require-trusted-types-for 'script'; trusted-types spotui-feed`;
}

// Runs in the frame BEFORE the feed script is added. Best-effort hardening, not
// a guarantee: the browser sandbox + CSP above are what contain the feed, this
// closes the ambient channels CSP does not cover in an opaque-origin frame.
// It removes the WebRTC constructors (UDP/STUN to any host) and the obvious
// routes to a fresh realm that would bring them back: window.open and the
// contentWindow/contentDocument getters of iframe/object/frame. The non-
// configurable redefinition means the feed cannot put them back in this realm.
// Checked in Edge 157: with only the constructors removed, a feed still got a
// working RTCPeerConnection through a srcdoc child frame (innerHTML, srcdoc,
// setAttribute, createContextualFragment, DOMParser, javascript: src); with
// Trusted Types all of those throw. Not closed: one self-navigation (a GET to
// the feed's own host), and a feed that finds a realm by a route not tried
// could still send STUN packets, which only reveal the public IP the feed host
// already sees. fetch, XHR, WebSocket, EventSource and sendBeacon fall under
// `default-src 'none'` (connect-src); WebTransport/WebSocketStream are removed
// too because MDN does not list them under connect-src. <object>/<embed> use
// object-src -> 'none'.
const FRAME_HARDEN = "var TP=null;try{TP=window.trustedTypes.createPolicy('spotui-feed',{createScriptURL:function(u){return u}})}catch(e){}"
    + "var X=function(o,n,d){try{delete o[n]}catch(e){}try{Object.defineProperty(o,n,d)}catch(e){}},"
    + "U={value:undefined,configurable:false,writable:false},G={get:function(){},configurable:false};"
    + "[\"RTCPeerConnection\",\"webkitRTCPeerConnection\",\"RTCDataChannel\",\"RTCSessionDescription\",\"RTCIceCandidate\","
    + "\"WebTransport\",\"WebSocketStream\",\"open\"].forEach(function(n){X(window,n,U)});"
    + "[\"HTMLIFrameElement\",\"HTMLFrameElement\",\"HTMLObjectElement\"].forEach(function(c){"
    + "var P=window[c]&&window[c].prototype;if(P)[\"contentWindow\",\"contentDocument\"].forEach(function(n){X(P,n,G)})});";

// The frame document. The same policy rides in a <meta> too. The bootstrap grabs
// `parent.postMessage` and `JSON.stringify` before the feed script runs, then
// reports the feed global as a JSON string. Feed URL and nonce travel as
// escaped attributes, never as script text.
function buildFrameDoc(origin, url, nonce) {
    return "<!doctype html><html><head><meta charset=\"utf-8\">"
        + `<meta http-equiv="Content-Security-Policy" content="${escapeAttr(frameCsp(origin))}">`
        + "<meta name=\"referrer\" content=\"no-referrer\"></head><body>"
        + `<script data-src="${escapeAttr(url)}" data-k="${escapeAttr(nonce)}">`
        + "(function(){"
        + "var post=parent.postMessage.bind(parent),S=JSON.stringify,me=document.currentScript,"
        + "k=me.dataset.k,s=document.createElement('script');"
        + FRAME_HARDEN
        + "s.onload=function(){try{var d=S(window.spotuiThemes);post({k:k,ok:typeof d==='string',d:d},'*')}"
        + "catch(e){post({k:k,ok:false},'*')}};"
        + "s.onerror=function(){post({k:k,ok:false},'*')};"
        + "s.src=TP?TP.createScriptURL(me.dataset.src):me.dataset.src;document.head.appendChild(s)})();"
        + "</script></body></html>";
}

function randomNonce(getRandomValues) {
    const bytes = new Uint8Array(16);
    getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Load a feed whose host sends no CORS header WITHOUT running its code in the
// page: the script runs in a hidden sandboxed frame (`allow-scripts` only, so
// an opaque origin: no page DOM, storage, cookies or Spicetify) and only a JSON
// string comes back through postMessage. A message counts only from that
// frame's window with this load's nonce. The nonce is readable by the feed
// script, so a hostile feed can still post any DATA: it is parsed and validated
// like every other feed, and nothing else crosses over.
// Resolves { themes, dropped, reasons }; always settles (timeout) and always
// removes the frame, the listener and the timer.
// `deps` (document, window, setTimeout, clearTimeout, getRandomValues,
// allowLocalHttp) exist for tests; the app passes none.
export function loadThemeFeedInFrame(url, deps = {}) {
    return new Promise((resolve, reject) => {
        const doc = deps.document || document;
        const win = deps.window || window;
        const setTimer = deps.setTimeout || setTimeout;
        const clearTimer = deps.clearTimeout || clearTimeout;
        const random = deps.getRandomValues || ((bytes) => crypto.getRandomValues(bytes));
        let frame = null;
        let timer = 0;
        let finished = false;
        let listening = false;
        let onMessage = null;
        const finish = (settle) => {
            if (finished) return;
            finished = true;
            clearTimer(timer);
            if (listening) win.removeEventListener("message", onMessage);
            try { if (frame) frame.remove(); } catch (e) { /* already detached */ }
            settle();
        };
        const fail = (message) => finish(() => reject(new Error(message)));
        try {
            const feed = frameFeedUrl(url, deps.allowLocalHttp);
            const nonce = randomNonce(random);
            onMessage = (event) => {
                if (finished) return;
                const own = frame && frame.contentWindow;
                if (!own || event.source !== own) return;
                const data = event.data;
                if (!data || typeof data !== "object" || data.k !== nonce) return;
                if (data.ok !== true) { fail("Theme feed script failed"); return; }
                if (typeof data.d !== "string" || data.d.length > FEED_MAX_BYTES) { fail("Theme feed too large or not text"); return; }
                let result;
                try { result = validateThemeFeed(JSON.parse(data.d)); } catch (e) { finish(() => reject(e)); return; }
                finish(() => resolve(result));
            };
            frame = doc.createElement("iframe");
            // sandbox first and exactly this: no same-origin, navigation,
            // popups, forms, modals or downloads.
            frame.setAttribute("sandbox", "allow-scripts");
            frame.setAttribute("referrerpolicy", "no-referrer");
            frame.setAttribute("loading", "eager");
            frame.setAttribute("credentialless", "");
            frame.setAttribute("aria-hidden", "true");
            frame.setAttribute("tabindex", "-1");
            frame.setAttribute("style", "position:fixed;width:0;height:0;border:0;visibility:hidden");
            frame.setAttribute("csp", frameCsp(feed.origin));
            frame.setAttribute("srcdoc", buildFrameDoc(feed.origin, feed.href, nonce));
            win.addEventListener("message", onMessage);
            listening = true;
            timer = setTimer(() => fail("Theme feed timed out"), FEED_TIMEOUT_MS);
            doc.body.appendChild(frame);
        } catch (e) {
            finish(() => reject(e));
        }
    });
}

// Fetch a feed URL as data and validate it: { themes, dropped, reasons }.
export async function fetchThemeFeed(url) {
    const timeout = timeoutSignal(FEED_TIMEOUT_MS);
    try {
        const res = await fetch(url, {
            cache: "no-store",
            credentials: "omit",
            referrerPolicy: "no-referrer",
            signal: timeout.signal,
        });
        if (!res.ok) {
            try { res.body?.cancel().catch(() => {}); } catch (e) { /* body already gone */ }
            throw new Error(`Theme feed HTTP ${res.status}`);
        }
        return validateThemeFeed(parseThemeFeedText(await readCappedText(res, FEED_MAX_BYTES)));
    } finally {
        timeout.clear();
    }
}
