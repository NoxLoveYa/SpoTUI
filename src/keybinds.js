import { execute } from "./commands.js";
import { BIND_CMD_REGEX, F_KEY_REGEX, KEYBIND_STORAGE_KEY, THEME_ALLOWED_COMMANDS, THEME_ALLOWED_TUI_SUBS, THEME_BLOCKED_POSTER_WORDS, WP_HOST_FLAGS } from "./constants.js";
import { app, isInputBlockingPanelOpen } from "./state.js";
import { readJsonObject, storageSet } from "./storage.js";

// Map common key name variations to standard names
const SPECIAL_KEY_MAP = {
    esc: "Escape", escape: "Escape",
    enter: "Enter", return: "Enter",
    space: " ", spacebar: " ",
    up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight",
    tab: "Tab", backspace: "Backspace", delete: "Delete", del: "Delete",
    home: "Home", end: "End", pageup: "PageUp", pagedown: "PageDown",
    insert: "Insert",
};
const MODIFIER_ORDER = { Ctrl: 0, Alt: 1, Shift: 2, Meta: 3 };

// Retrieve stored keyboard shortcuts
export function getKeybinds() {
    const parsed = readJsonObject(KEYBIND_STORAGE_KEY);
    const clean = {};
    Object.keys(parsed).forEach((key) => {
        if (typeof parsed[key] === "string") clean[key] = parsed[key];
    });
    return clean;
}

export function saveKeybinds(map) {
    return storageSet(KEYBIND_STORAGE_KEY, JSON.stringify(map));
}

// Remove leading slash or dot from command strings
export function stripCommandPrefix(cmd) {
    const raw = String(cmd || "").trim();
    return raw.startsWith("/") || raw.startsWith(".") ? raw.slice(1).trim() : raw;
}

// Check if command is a keybind configuration command
export function isBindCommand(cmd) {
    return BIND_CMD_REGEX.test(stripCommandPrefix(cmd));
}

// Remote themes (feed submissions) may only run look commands: allowlist.
// Tokenizes exactly like executeInner (same prefix strip, same whitespace
// split, case-insensitive), so what is checked is what would be dispatched.
export function isRestrictedThemeCommand(cmd) {
    const [command, sub, ...rest] = stripCommandPrefix(cmd).toLowerCase().split(/\s+/);
    if (command === "tui") {
        if (!THEME_ALLOWED_TUI_SUBS.has(sub)) return true;
        // Approving wallpaper hosts is the user's call, never a theme's.
        if (rest.some((word) => WP_HOST_FLAGS.has(word))) return true;
        // The wall's look is fine; adding remote images or clearing the
        // user's pins is not.
        if ((sub === "-posters" || sub === "-poster") && rest.some((word) => THEME_BLOCKED_POSTER_WORDS.has(word))) return true;
        return false;
    }
    return !THEME_ALLOWED_COMMANDS.has(command);
}

// Normalize keyboard shortcuts to canonical format
export function normalizeKeyCombo(comboStr) {
    const parts = String(comboStr).split("+").map((p) => p.trim()).filter(Boolean);
    const mods = [];
    let mainKey = "";
    parts.forEach((p) => {
        const lower = p.toLowerCase();
        if (lower === "ctrl" || lower === "control") mods.push("Ctrl");
        else if (lower === "alt") mods.push("Alt");
        else if (lower === "shift") mods.push("Shift");
        else if (lower === "meta" || lower === "cmd" || lower === "command" || lower === "win") mods.push("Meta");
        else mainKey = p;
    });
    if (!mainKey) return "";
    let keyName;
    if (mainKey.length === 1) {
        keyName = mainKey.toUpperCase();
    } else {
        const lower = mainKey.toLowerCase();
        if (SPECIAL_KEY_MAP[lower]) keyName = SPECIAL_KEY_MAP[lower];
        else if (F_KEY_REGEX.test(mainKey)) keyName = mainKey.toUpperCase();
        else keyName = mainKey;
    }
    mods.sort((a, b) => MODIFIER_ORDER[a] - MODIFIER_ORDER[b]);
    return [...mods, keyName].join("+");
}

export function eventToKeyCombo(e) {
    const mods = [];
    if (e.ctrlKey) mods.push("Ctrl");
    if (e.altKey) mods.push("Alt");
    if (e.shiftKey) mods.push("Shift");
    if (e.metaKey) mods.push("Meta");
    let keyName = e.key;
    if (keyName.length === 1) keyName = keyName.toUpperCase();
    return [...mods, keyName].join("+");
}

// Global keydown handler for custom keybinds
export function handleKeybindKeydown(e) {
    if (app.standbyOpen) return;

    // Ignore AltGr
    const isAltGr = e.ctrlKey && e.altKey;
    if (isAltGr) return;

    const binds = getKeybinds();
    if (!Object.keys(binds).length) return;

    const combo = eventToKeyCombo(e);
    const cmd = binds[combo];
    if (!cmd) return;

    const hasModifier = e.ctrlKey || e.altKey || e.metaKey;
    // An open interactive menu (saves/boards/playlists/search/...) owns
    // bare keys: this handler runs in the capture phase, so without this
    // a bare-key bind (e.g. Del -> "tui -t list") would stopPropagation the
    // event and toggle the menu shut before its own bubble-phase handler
    // ever sees Enter/Del/arrows. Modifier combos stay global.
    // (Shift alone is not treated as a modifier here: Shift+Del still reads
    // as a bare Delete to the open menu.)
    if (!hasModifier && isInputBlockingPanelOpen()) return;

    const activeEl = document.activeElement;
    const isTypingField = activeEl && (
        activeEl.id === "spotui-input" ||
        activeEl.id === "spotui-theme-search" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.tagName === "SELECT" ||
        (activeEl.tagName === "INPUT" && activeEl.type !== "button")
    );
    if (isTypingField && !hasModifier) return;

    e.preventDefault();
    e.stopPropagation();
    execute(cmd);
}
