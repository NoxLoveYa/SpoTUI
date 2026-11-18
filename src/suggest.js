import { COMMAND_NAMES } from "./constants.js";
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
    "tui -video on",
    "tui -video off",
    "tui -video toggle",
    "tui -posters on",
    "tui -posters off",
    "tui -posters shuffle",
    "tui -posters settings",
    "tui -posters add ",
    "tui -posters clear",
    "tui -posters count ",
    "tui -bar ",
    "tui -panel ",
    "tui -inputs ",
    "tui -progress ",
    "tui -ly ",
    "tui -viz ",
    "tui -viz off",
    "tui -pin-board ",
    "tui -pin-boards",
    "tui -pin-clear ",
    "tui -pin-feed",
    "tui -pin-refresh",
    "tui -pin-token ",
    "tui unbind ",
    "tui -debug on",
    "tui -debug off",
    "tui -l on",
    "tui -l off",
    "tui -bar -c -progress ",
    "tui bind \"\" \"\"",
    "tui actions list",
    "playlist ",
    "add2list",
    "queue",
    "search ",
    "theme",
    "lyrics",
    "visualizer",
    "dj",
    "play",
    "pause",
    "skip",
    "back",
    "seek ",
    "volume ",
    "v ",
    "shuffle",
    "like",
    "loop",
    "superloop",
    "standby",
    "about",
    "discord",
    "jam create",
    "jam join ",
    "jam leave",
];

// Word-by-word completion over every command in COMMAND_LIST (see
// COMMAND_NAMES): finishes the last partial word when the words before it
// match a known command ("tui -viz -ga" -> "tui -viz -gap"). Keeps a
// leading "/" or ".".
function wordCompletions(q) {
    const slash = /^[/.]/.test(q) ? q[0] : "";
    const body = slash ? q.slice(1) : q;
    const partial = (/\S+$/.exec(body) || [""])[0];
    if (!partial) return [];
    const head = body.slice(0, body.length - partial.length);
    const words = head.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const lowerPartial = partial.toLowerCase();
    const next = new Set();
    for (const name of COMMAND_NAMES) {
        const cmd = name.split(/\s+/);
        if (cmd.length > words.length
            && words.every((word, i) => cmd[i] === word)
            && cmd[words.length].startsWith(lowerPartial)) next.add(cmd[words.length]);
    }
    // "-live" may follow the theme id (or come before it); the fixed-width
    // command names above cannot express a free-form id in the middle.
    if (lowerPartial.startsWith("-") && "-live".startsWith(lowerPartial)
        && /^tui\s+-t\s+pull\s/i.test(body) && !/\s-live(?:\s|$)/i.test(head)) next.add("-live");
    return [...next].map((word) => slash + head + word);
}

// Newest-first history matches, then static matches, then word completions,
// none repeated. Empty or exact input suggests nothing (quiet bar).
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
        // "tui -t pull " and "tui -t pull" are one suggestion.
        const key = cand.trimEnd();
        if (seen.has(key)) return;
        seen.add(key);
        out.push(cand);
    };
    for (const h of historyList || []) take(h);
    for (const s of STATIC_SUGGESTIONS) take(s);
    for (const w of wordCompletions(q)) take(w);
    return out;
}

// Live session wrapper: history comes from the app list.
export function suggestFor(input) {
    return getSuggestions(input, app.commandHistory);
}
