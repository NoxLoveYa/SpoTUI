import { WP_HOST_FLAGS, WP_HOSTS_KEY, WP_HOSTS_MAX, WP_URL_KEY } from "./constants.js";
import { app } from "./state.js";
import { storageGet, storageSet } from "./storage.js";
import { dbg, PIN_TOAST_CSS, pinToast, toastBase } from "./utils.js";

// Host consent for wallpapers that come from a feed theme. A wallpaper is
// persistent: its host sees the user's IP and every Spotify start. A theme
// may therefore only load one from a host the user approved; any other host
// is skipped and offered to the user. The user's own `tui -wp <url>` is never
// restricted (it approves its own host). Nothing here runs a command a theme
// wrote except through the user's own Allow click / `tui -wp -allow`.

const URL_MAX = 2000;
const TOAST_ID = "spotui-wp-consent";
const TOAST_MS = 30000;
// Private or local names: never offered, always refused for themes.
const LOCAL_SUFFIXES = ["local", "lan", "internal", "home.arpa", "localhost"];

// A hostname (as URL.hostname gives it: lowercase, punycode) a theme
// wallpaper may ever load from. No IP literals, no single-label or local names.
export function isOfferableHost(host) {
    if (typeof host !== "string" || !host || host.length > 253) return false;
    if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/.test(host)) return false;
    const labels = host.split(".");
    if (labels.length < 2) return false;
    if (labels.some((l) => !l || l.length > 63)) return false;
    // URL parsing turns every IPv4 spelling into dotted decimal; a numeric last
    // label is never a real name.
    if (/^\d+$/.test(labels[labels.length - 1])) return false;
    return !LOCAL_SUFFIXES.some((s) => host === s || host.endsWith("." + s));
}

// A theme wallpaper URL, or null when it is never acceptable: https only, no
// credentials, a public name, bounded length. `href` is the normalised form:
// load THAT, never the raw text (a raw `")` would break out of the CSS url()).
export function checkWallpaperUrl(raw) {
    const text = String(raw ?? "");
    if (!text || text.length > URL_MAX) return null;
    let u;
    try { u = new URL(text); } catch (e) { return null; }
    if (u.protocol !== "https:" || u.username || u.password) return null;
    if (!isOfferableHost(u.hostname) || u.href.length > URL_MAX) return null;
    return { host: u.hostname, href: u.href };
}

// `tui -wp -allow/-deny <host>` argument: a bare hostname or a full https URL.
export function parseHostInput(raw) {
    const t = String(raw ?? "").trim();
    if (!t) return null;
    if (t.includes("://")) {
        const c = checkWallpaperUrl(t);
        return c ? c.host : null;
    }
    let u;
    try { u = new URL("https://" + t); } catch (e) { return null; }
    if (u.username || u.password || u.port || u.pathname !== "/" || u.search || u.hash) return null;
    return isOfferableHost(u.hostname) ? u.hostname : null;
}

// Approved hosts: corrupt or odd JSON reads as empty and is left alone until
// the next change.
export function getWpHosts() {
    try {
        const raw = storageGet(WP_HOSTS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return [...new Set(parsed.filter((h) => typeof h === "string" && h).map((h) => h.toLowerCase()))];
    } catch (e) {
        return [];
    }
}

// Oldest dropped past the cap. An empty list is still written, so the key
// existing means "migration done" even after the user denied everything.
function saveHosts(list) {
    return storageSet(WP_HOSTS_KEY, JSON.stringify([...new Set(list)].slice(-WP_HOSTS_MAX)));
}

export function isHostApproved(host) {
    return getWpHosts().includes(String(host || "").toLowerCase());
}

export function approveHost(host) {
    const list = getWpHosts();
    if (list.includes(host)) return true;
    list.push(host);
    return saveHosts(list);
}

// First run without the key: the wallpaper already stored keeps working if a
// theme re-uses its host. The key is always written (an empty list marks
// "migrated"), so this never runs twice and never approves a URL that gets
// stored later.
export function migrateWpHosts() {
    try {
        if (storageGet(WP_HOSTS_KEY) !== null) return;
        const stored = storageGet(WP_URL_KEY);
        const c = stored ? checkWallpaperUrl(stored) : null;
        saveHosts(c ? [c.host] : []);
    } catch (e) {}
}

// The user typed `tui -wp <url>` themself: they chose that host.
export function noteUserWallpaper(url) {
    const c = checkWallpaperUrl(url);
    if (c && !approveHost(c.host)) dbg("[SpoTUI] wallpaper host not remembered: storage full");
}

// Forms only the user may run. A theme must not approve hosts or read the
// list, wherever in the command the word sits.
export function isHostMgmtToken(word) {
    return WP_HOST_FLAGS.has(word);
}

export function hasHostMgmtToken(argsLower) {
    return argsLower.some(isHostMgmtToken);
}

// ---- pending theme wallpaper + consent toast ----

// One at a time, memory only: { host, cmd, run }. `cmd` is the theme's own
// command with the URL replaced by its normalised form.
let pending = null;
// An onboarding panel is open: show the toast once it closes.
let deferred = false;

export function getPendingWallpaper() {
    return pending ? { host: pending.host, cmd: pending.cmd } : null;
}

function removeToast() {
    try {
        const t = document.getElementById(TOAST_ID);
        if (t) t.remove();
    } catch (e) {}
}

// A new theme apply starts clean: the previous offer and its toast go.
export function beginThemeApply() {
    clearPendingWallpaper();
}

// The offer is void: the user chose a wallpaper themself (tui -wp, a saved
// theme, tui restore) or dismissed it. A later `tui -wp -allow` (history,
// keybind) must not replace that choice with an old theme's wallpaper.
export function clearPendingWallpaper() {
    pending = null;
    deferred = false;
    removeToast();
}

function appendLine(parent, text) {
    const line = document.createElement("div");
    line.textContent = text;
    parent.appendChild(line);
    return line;
}

// Fixed colors, not theme variables: a theme may set a panel color to full
// transparency (#00000000), which would leave this prompt, and its Allow
// button, invisible but clickable. Applied inline, after any shared CSS.
const FIXED_LOOK = "color:#e8e2d4;background:rgba(10,14,18,0.92);border:1px solid #7fd4d4;";

function mkConsentButton(label, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.tabIndex = -1;
    b.style.cssText = FIXED_LOOK + "padding:2px 10px;margin-right:8px;font:inherit;cursor:pointer;overflow-wrap:anywhere;";
    // A mouse press must not pull focus out of the command bar.
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("click", onClick);
    return b;
}

function showConsentToast() {
    if (!pending) return;
    if (app.onboardingPanelOpen) {
        deferred = true;
        return;
    }
    deferred = false;
    const host = pending.host;
    const t = toastBase(TOAST_ID, "", TOAST_MS, PIN_TOAST_CSS + "pointer-events:auto;bottom:176px;text-align:left;overflow-wrap:anywhere;" + FIXED_LOOK);
    if (!t) return;
    // The host is untrusted text from a feed theme: textContent only.
    appendLine(t, `Theme wallpaper from ${host} was not loaded.`);
    if (host.split(".").some((l) => l.startsWith("xn--"))) appendLine(t, "(internationalised name)");
    const row = document.createElement("div");
    row.style.cssText = "margin:8px 0 4px;";
    row.appendChild(mkConsentButton(`Allow ${host}`, () => applyPendingWallpaper()));
    row.appendChild(mkConsentButton("Dismiss", () => clearPendingWallpaper()));
    t.appendChild(row);
    appendLine(t, "or type: tui -wp -allow");
}

// Onboarding stage 3 ("Theme applied."): when the chosen theme's wallpaper was
// skipped, say so there with an Allow button, because a first-time user has
// no approved host and could not type the command. Mouse only: the buttons
// stay out of the tab order and onboarding's own keys are untouched. Without
// a click the toast still comes after onboarding closes.
export function appendOnboardingConsent(parent) {
    if (!pending) return null;
    const box = document.createElement("div");
    box.style.cssText = FIXED_LOOK + "padding:8px 12px;margin:12px auto 0;max-width:420px;font:inherit;text-align:center;overflow-wrap:anywhere;";
    const line = appendLine(box, `This theme's wallpaper comes from ${pending.host}.`);
    const row = document.createElement("div");
    row.style.cssText = "margin:8px 0 2px;";
    const allow = mkConsentButton("Allow wallpaper", () => {
        if (!applyPendingWallpaper()) return;
        line.textContent = "Wallpaper allowed.";
        allow.remove();
    });
    allow.style.marginRight = "0";
    row.appendChild(allow);
    box.appendChild(row);
    parent.appendChild(box);
    return box;
}

// Called by closeOnboardingPanel: the toast that had to wait.
export function flushDeferredConsent() {
    if (deferred && pending) showConsentToast();
}

export function offerThemeWallpaper(offer) {
    pending = offer;
    dbg("[SpoTUI] theme wallpaper waiting for consent:", offer.host);
    showConsentToast();
}

// Approve the pending wallpaper's host and load it exactly once, as the user.
// True when the host was approved and the wallpaper started.
function applyPendingWallpaper() {
    const p = pending;
    if (!p) {
        pinToast("no theme wallpaper is waiting");
        return false;
    }
    if (!approveHost(p.host)) {
        pinToast("host not saved: storage full");
        return false;
    }
    clearPendingWallpaper();
    pinToast(`wallpaper host allowed: ${p.host}`);
    try {
        Promise.resolve(p.run(p.cmd)).catch((e) => dbg("[SpoTUI] pending wallpaper failed:", e));
    } catch (e) {
        dbg("[SpoTUI] pending wallpaper failed:", e);
    }
    return true;
}

// Theme wallpaper URL gate. Returns the URL to load, or null when the theme's
// wallpaper is skipped (with the offer or the notice already raised).
// buildCmd(href) rebuilds the command around the normalised URL.
export function gateThemeWallpaper(url, buildCmd, run) {
    const c = checkWallpaperUrl(url);
    if (!c) {
        dbg("[SpoTUI] theme wallpaper refused:", String(url).slice(0, 200));
        pinToast("theme wallpaper skipped (unsupported address)");
        return null;
    }
    if (isHostApproved(c.host)) return c.href;
    offerThemeWallpaper({ host: c.host, cmd: buildCmd(c.href), run });
    return null;
}

// `tui -wp -allow|-deny|-hosts`: user only (callers refuse these for themes).
export function handleWpHostCommand(sub, arg) {
    if (sub === "-hosts") {
        const list = getWpHosts();
        pinToast(list.length
            ? `approved wallpaper hosts (${list.length})\n${list.slice(0, 20).join("\n")}${list.length > 20 ? `\n+${list.length - 20} more (see console)` : ""}`
            : "no approved wallpaper hosts");
        console.log("[SpoTUI] approved wallpaper hosts:", list.length ? list : "(none)");
        return;
    }
    const shown = String(arg ?? "").slice(0, 80);
    if (sub === "-deny") {
        const host = parseHostInput(arg) ?? String(arg ?? "").trim().toLowerCase();
        if (!host) {
            pinToast("usage: tui -wp -deny <host>  (see tui -wp -hosts)");
            return;
        }
        const list = getWpHosts();
        if (!list.includes(host)) {
            pinToast(`${shown} is not an approved wallpaper host`);
            return;
        }
        if (!saveHosts(list.filter((h) => h !== host))) {
            pinToast("host not removed: storage full");
            return;
        }
        let live = false;
        const cur = checkWallpaperUrl(storageGet(WP_URL_KEY));
        if (cur && cur.host === host) live = true;
        pinToast(`removed wallpaper host: ${host}${live ? "\nthe current wallpaper stays until you change it" : ""}`);
        return;
    }
    // -allow
    if (!String(arg ?? "").trim()) {
        applyPendingWallpaper();
        return;
    }
    const host = parseHostInput(arg);
    if (!host) {
        pinToast(`not a valid wallpaper host: ${shown}\nuse a name like cdn.example.com (https only, no IP addresses or local names)`);
        return;
    }
    if (pending && pending.host === host) {
        applyPendingWallpaper();
        return;
    }
    pinToast(approveHost(host) ? `wallpaper host allowed: ${host}` : "host not saved: storage full");
}
