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
// the legacy `window.spotuiThemes = [...];` wrapper (exact prefix only), so
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
