import { HISTORY_ENTRY_MAX, HISTORY_KEY, HISTORY_LIMIT } from "./constants.js";
import { app } from "./state.js";
import { storageGet, storageSet } from "./storage.js";

// Persistent command history (unix-style): what the user typed survives
// Spotify restarts in localStorage; Ctrl+R reverse-searches it from the
// command bar. Only interactive bar input is recorded — commands fired by
// keybinds, theme cards, or actions never land here (bash parity).
// Secrets never persist: pin tokens and jam join lines stay session-only.

// Commands matching this are kept out of persisted history (a PIN grants
// jam guests volume/lyrics control while the jam lives).
const HISTORY_SKIP_REGEX = /^\s*tui\s+-pin-token\b|^\s*jam\s+join\b/i;

export function sanitizeHistory(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const e of raw) {
        if (typeof e !== "string") continue;
        const t = e.trim().slice(0, HISTORY_ENTRY_MAX);
        if (!t || HISTORY_SKIP_REGEX.test(t) || out.includes(t)) continue;
        out.push(t);
    }
    return out.slice(0, HISTORY_LIMIT);
}

export function loadHistory() {
    try {
        const raw = storageGet(HISTORY_KEY);
        if (!raw) return [];
        return sanitizeHistory(JSON.parse(raw));
    } catch (e) { return []; }
}

// Session list (arrows + Ctrl+R source) always takes the command; the
// persisted list only takes valid ones — typos stay memory-only.
// opts.persist === false records session-only.
export function pushHistory(cmd, opts = {}) {
    const t = String(cmd || "").trim().slice(0, HISTORY_ENTRY_MAX);
    if (!t || HISTORY_SKIP_REGEX.test(t)) return false;
    app.commandHistory = [t, ...app.commandHistory.filter((e) => e !== t)].slice(0, HISTORY_LIMIT);
    app.commandHistoryIndex = -1;
    if (opts.persist === false) return true;
    try {
        const stored = sanitizeHistory(JSON.parse(storageGet(HISTORY_KEY) || "[]"));
        storageSet(HISTORY_KEY, JSON.stringify([t, ...stored.filter((e) => e !== t)].slice(0, HISTORY_LIMIT)));
    } catch (e) {}
    return true;
}

// Newest-first matches for the reverse search: empty query matches the
// whole history (bash shows the last command on bare Ctrl+R); otherwise a
// case-insensitive substring filter.
export function searchHistory(query) {
    const q = String(query || "").toLowerCase();
    if (!q) return [...app.commandHistory];
    return app.commandHistory.filter((e) => e.toLowerCase().includes(q));
}
