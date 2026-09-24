import { applyCustomBarState, applyInputButtonsVisibility, applyInputColors, applyLyricColors, applyPanelColors, applyPlayerBarColors, applyPlayerBarVisibility, applyProgressBarColors, toggleLogo } from "./appearance.js";
import { resetGrid } from "./ascii.js";
import { ACTIONS_STORAGE_KEY, ANIMATION_KEY, HISTORY_KEY, KEYBIND_STORAGE_KEY, SHADE_KEY, WP_FIT_KEY, WP_OPACITY_KEY, WP_POS_KEY, WP_RICH_KEY, WP_URL_KEY } from "./constants.js";
import { POSTERS_IMGS, POSTERS_LAYOUT, renderPosters, renderSavedLayout, startRotateTimer } from "./posters.js";
import { applyShade, isValidShade } from "./shade.js";
import { app } from "./state.js";
import { storageGet, storageSet } from "./storage.js";
import { dbg, pinToast } from "./utils.js";
import { setWallpaper } from "./wallpaper.js";

// Local theme snapshots: everything a Spotify restart preserves, saved
// under one name — except personal config (history, keybinds, actions),
// which is yours, not a look. storage.js has no key enumeration, so this
// module touches localStorage directly (guarded) for the snapshot/restore
// loops only.
const SAVES_KEY = "spotui:theme-saves";

// Personal config, not a look: never snapshotted, never wiped, and never
// restored over live values (old snapshots may still carry these keys).
const PERSONAL_KEYS = new Set([HISTORY_KEY, KEYBIND_STORAGE_KEY, ACTIONS_STORAGE_KEY]);

function readSaves() {
    try {
        const raw = storageGet(SAVES_KEY);
        const obj = raw ? JSON.parse(raw) : {};
        return obj && typeof obj === "object" ? obj : {};
    } catch (e) { return {}; }
}

function snapshotSettings() {
    const out = {};
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith("spotui:") && k !== SAVES_KEY && !PERSONAL_KEYS.has(k)) out[k] = localStorage.getItem(k);
        }
    } catch (e) {}
    return out;
}

// One-line inventory of a snapshot so save/apply toasts show what is
// actually inside (e.g. whether a wallpaper URL was stored at all).
function describeSnapshot(settings) {
    const parts = [];
    const wp = settings[WP_URL_KEY];
    parts.push(wp
        ? `wallpaper ${String(wp).split("/").pop().slice(0, 30)} @${settings[WP_OPACITY_KEY] || "1"} ${settings[WP_FIT_KEY] || "cover"}/${settings[WP_POS_KEY] || "center"} rich${settings[WP_RICH_KEY] || "100"}`
        : "no wallpaper");
    let posters = 0;
    const boards = {};
    try {
        const arr = JSON.parse(settings[POSTERS_IMGS] || "[]");
        if (Array.isArray(arr)) {
            posters = arr.length;
            for (const e of arr) {
                const b = (e && e.b) || "?";
                boards[b] = (boards[b] || 0) + 1;
            }
        }
    } catch (e) {}
    const names = Object.keys(boards);
    parts.push(`${posters} poster${posters === 1 ? "" : "s"}${names.length ? ` (${names.map((b) => `${b}:${boards[b]}`).join(", ")})` : ""}${settings[POSTERS_LAYOUT] ? " +layout" : ""}`);
    parts.push(settings[SHADE_KEY] && isValidShade(settings[SHADE_KEY])
        ? `shade ${settings[SHADE_KEY]}`
        : (settings[SHADE_KEY] ? `shade ${settings[SHADE_KEY]} invalid, ignored` : "orange"));
    return parts.join(" · ");
}

// Re-run the boot look-restore against current storage (mirrors main.js:
// appearance everywhere, wallpaper, wall, shade — no session resume).
function refreshLook() {
    toggleLogo(storageGet("spotui:logo-visible") === "off" ? "off" : "on");
    if (storageGet(ANIMATION_KEY) === "off") {
        app.asciiEnabled = false;
        resetGrid();
    } else {
        app.asciiEnabled = true;
    }
    applyLyricColors();
    applyPlayerBarColors();
    applyPlayerBarVisibility();
    applyCustomBarState();
    applyProgressBarColors();
    applyInputColors();
    applyInputButtonsVisibility();
    applyPanelColors();
    applyShade();
    const url = storageGet(WP_URL_KEY);
    if (url) {
        setWallpaper(url, storageGet(WP_OPACITY_KEY) || "1", false, {
            fit: storageGet(WP_FIT_KEY) || undefined,
            pos: storageGet(WP_POS_KEY) || undefined,
            rich: storageGet(WP_RICH_KEY) || undefined,
        });
    } else {
        const wp = document.getElementById("spotui-wallpaper");
        if (wp) wp.remove();
    }
    restoreWall();
}

// Theme apply restores the snapshot's exact wall: each poster back to its
// saved slot. Falls back to a seed roll when the snapshot has no layout.
function restoreWall() {
    if (!renderSavedLayout()) renderPosters();
    startRotateTimer();
}

export function saveTheme(name) {
    const n = String(name || "").trim();
    if (!n) {
        console.warn("[SpoTUI] usage: tui -t save <name>  (single word, e.g. tui -t save cozy)");
        return;
    }
    const saves = readSaves();
    const existed = !!saves[n];
    const settings = snapshotSettings();
    saves[n] = { savedAt: Date.now(), settings };
    storageSet(SAVES_KEY, JSON.stringify(saves));
    pinToast(`${existed ? "theme updated" : "theme saved"}: ${n}\n${describeSnapshot(settings)}`);
    dbg("[SpoTUI] theme saved:", n);
}

export function listThemes() {
    // Non-empty case opens the menu (see commands); this stays as the
    // empty-library hint.
    pinToast("no saved themes — save one with: tui -t save <name>");
    dbg("[SpoTUI] saved themes: none");
}

export function savedThemeNames() {
    return Object.keys(readSaves());
}

export function savedThemeDetails() {
    const saves = readSaves();
    return Object.keys(saves).map((n) => ({ name: n, savedAt: (saves[n] && saves[n].savedAt) || 0 }));
}

export function deleteTheme(name) {
    const n = String(name || "").trim();
    if (!n) {
        console.warn("[SpoTUI] usage: tui -t delete <name>  (see tui -t list)");
        return;
    }
    const saves = readSaves();
    if (!saves[n]) {
        console.warn(`[SpoTUI] no saved theme "${n}". See: tui -t list`);
        return;
    }
    delete saves[n];
    storageSet(SAVES_KEY, JSON.stringify(saves));
    pinToast(`theme deleted: ${n}`);
    dbg("[SpoTUI] theme deleted:", n);
}

export function applyTheme(name) {
    const n = String(name || "").trim();
    if (!n) {
        console.warn("[SpoTUI] usage: tui -t apply <name>  (see tui -t list)");
        return;
    }
    const snap = readSaves()[n];
    if (!snap || typeof snap.settings !== "object") {
        console.warn(`[SpoTUI] no saved theme "${n}". See: tui -t list`);
        return;
    }
    try {
        const keep = new Set(Object.keys(snap.settings));
        for (const [k, v] of Object.entries(snap.settings)) {
            if (PERSONAL_KEYS.has(k)) continue;
            localStorage.setItem(k, v);
        }
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && k.startsWith("spotui:") && k !== SAVES_KEY && !PERSONAL_KEYS.has(k) && !keep.has(k)) localStorage.removeItem(k);
        }
    } catch (e) {
        console.error("[SpoTUI] theme apply failed:", e.message);
        return;
    }
    try {
        refreshLook();
    } catch (e) {
        console.error("[SpoTUI] theme refresh failed:", e.message);
        return;
    }
    pinToast(`theme applied: ${n}\n${describeSnapshot(snap.settings)}`);
    dbg("[SpoTUI] theme applied:", n);
}
