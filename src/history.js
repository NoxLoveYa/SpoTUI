import { HISTORY_ENTRY_MAX, HISTORY_KEY, HISTORY_LIMIT } from "./constants.js";
import { app } from "./state.js";
import { storageGet, storageSet } from "./storage.js";

// Persistent command history (unix-style): what the user typed survives
// Spotify restarts in localStorage; Ctrl+R reverse-searches it from the
// command bar. Only interactive bar input is recorded — commands fired by
// keybinds, theme cards, or actions never land here (bash parity).
// Secrets never persist: pin tokens stay session-only.

// Commands matching this are kept out of persisted history.
const HISTORY_SKIP_REGEX = /^\s*tui\s+-pin-token\b/i;

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

function persistHistory() {
    try { storageSet(HISTORY_KEY, JSON.stringify(app.commandHistory)); } catch (e) {}
}

// Newest-first, de-duped, capped. No-op for blanks and secrets.
export function pushHistory(cmd) {
    const t = String(cmd || "").trim().slice(0, HISTORY_ENTRY_MAX);
    if (!t || HISTORY_SKIP_REGEX.test(t)) return;
    app.commandHistory = [t, ...app.commandHistory.filter((e) => e !== t)].slice(0, HISTORY_LIMIT);
    app.commandHistoryIndex = -1;
    persistHistory();
}

// Newest-first matches for the reverse search: empty query matches the
// whole history (bash shows the last command on bare Ctrl+R); otherwise a
// case-insensitive substring filter.
export function searchHistory(query) {
    const q = String(query || "").toLowerCase();
    if (!q) return [...app.commandHistory];
    return app.commandHistory.filter((e) => e.toLowerCase().includes(q));
}
