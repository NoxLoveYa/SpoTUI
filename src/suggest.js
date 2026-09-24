import { app } from "./state.js";

// Ghost-text fill suggestions for the command bar: known full-line
// commands plus your history (newest first). Tab fills, Tab again cycles.

// Curated full lines — COMMAND_LIST carries HTML entities and [flag]
// noise, so the vocabulary lives here instead.
const STATIC_SUGGESTIONS = [
    "help",
    "tui -t list",
    "tui -t save ",
    "tui -t apply ",
    "tui -t delete ",
    "tui -t pull ",
    "tui -wp ",
    "tui -wp off",
    "tui -shade ",
    "tui -shade off",
    "tui -posters on",
    "tui -posters off",
    "tui -posters shuffle",
    "tui -posters settings",
    "tui -posters add ",
    "tui -pin-board ",
    "tui -pin-boards",
    "tui -pin-refresh",
    "tui -debug on",
    "tui -debug off",
    "tui -l on",
    "tui -l off",
    "tui -bar -c -progress ",
    "tui bind \"\" \"\"",
    "tui actions list",
    "playlist ",
    "search ",
    "theme",
    "lyrics",
    "dj",
    "play",
    "pause",
    "skip",
    "back",
    "shuffle",
    "like",
    "standby",
    "about",
    "discord",
    "jam create",
    "jam join ",
    "jam leave",
];

// Newest-first history matches, then static matches not already listed.
// Empty or exact input suggests nothing (quiet bar).
export function getSuggestions(input, historyList) {
    const q = String(input || "").trimStart();
    if (!q) return [];
    const lower = q.toLowerCase();
    const seen = new Set();
    const out = [];
    const take = (cand) => {
        if (typeof cand !== "string") return;
        if (cand.length <= q.length) return;
        if (!cand.toLowerCase().startsWith(lower)) return;
        if (seen.has(cand)) return;
        seen.add(cand);
        out.push(cand);
    };
    for (const h of historyList || []) take(h);
    for (const s of STATIC_SUGGESTIONS) take(s);
    return out;
}

// Live session wrapper: history comes from the app list.
export function suggestFor(input) {
    return getSuggestions(input, app.commandHistory);
}
