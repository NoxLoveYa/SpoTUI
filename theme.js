(function () {
    'use strict';

    // Theme feed host for pulling community themes
    const THEME_HOST = "https://spotui.root.sx/";

    // LocalStorage keys for user preferences
    const ANIMATION_KEY = "spotui:ascii-animation";
    const LYRICS_STORAGE_KEY = "spotui:lyrics-open";
    const LYRICS_ANIMATION_KEY = "spotui:lyrics-animation";
    const WP_URL_KEY = "spotui:wp-url";
    const WP_FIT_KEY = "spotui:wp-fit";
    const WP_POS_KEY = "spotui:wp-pos";
    const WP_RICH_KEY = "spotui:wp-rich";
    const SHADE_KEY = "spotui:shade";
    const DEBUG_KEY = "spotui:debug";

    // External endpoints used by the poster wall (kept here, not inline).
    const PINTEREST_WIDGET_BASE = "https://widgets.pinterest.com/v3/pidgets";
    const PINTEREST_API_BASE = "https://api.pinterest.com/v5";
    const PINTEREST_WWW_BASE = "https://www.pinterest.com";
    const WP_OPACITY_KEY = "spotui:wp-opacity";
    const LYRICS_COLOR_ACTIVE = "spotui:lyrics-color-active";
    const LYRICS_COLOR_INACTIVE = "spotui:lyrics-color-inactive";
    const LYRICS_COLOR_LIGHT_INACTIVE = "spotui:lyrics-color-light-inactive";
    const LYRICS_LINE_SPACING = "spotui:lyrics-line-spacing";
    const VISUALIZER_STORAGE_KEY = "spotui:visualizer-open";
    const VISUALIZER_COLOR = "spotui:visualizer-color";
    const PLAYER_BAR_BG = "spotui:player-bar-bg";
    const PLAYER_BAR_BORDER = "spotui:player-bar-border";
    const PLAYER_BAR_TEXT = "spotui:player-bar-text";
    const PLAYER_BAR_VISIBLE = "spotui:player-bar-visible";
    const CUSTOM_BAR_ENABLED = "spotui:custom-bar-enabled";
    const CUSTOM_BAR_PROGRESS_STYLE = "spotui:custom-bar-progress-style";
    const PROGRESS_BAR_BG = "spotui:progress-bar-bg";
    const PROGRESS_BAR_FG = "spotui:progress-bar-fg";
    const INPUT_BG = "spotui:input-bg";
    const INPUT_BG_HOVER = "spotui:input-bg-hover";
    const INPUT_TEXT = "spotui:input-text";
    const INPUT_BORDER = "spotui:input-border";
    const INPUT_BUTTONS = "spotui:inputs-buttons";
    const PANEL_BG = "spotui:panel-bg";
    const PANEL_BORDER = "spotui:panel-border";
    const PANEL_TEXT = "spotui:panel-text";
    const UPDATE_BANNER_KEY = "spotui:update-banner";

    // Jam configs
    const JAM_SERVER_URL = "https://relay-spotui.root.sx/";
    const JAM_STATE_KEY = "spotui:jam-state";
    const JAM_POLL_MS = 1000;
    const JAM_SEEK_DRIFT_MS = 400; // Tolerated position drift before forcing seek

    const KEYBIND_STORAGE_KEY = "spotui:keybinds";
    const HISTORY_KEY = "spotui:cmd-history";
    const HISTORY_LIMIT = 50;
    const HISTORY_ENTRY_MAX = 500;
    const ACTIONS_STORAGE_KEY = "spotui:actions";
    const DISCORD_INVITE_URL = "https://discord.gg/WTzBEKDeKg";
    const LAUNCHED_KEY = "spotui:launched";

    // Theme IDs shown in first-boot onboarding
    const FIRST_BOOT_THEME_IDS = new Set([
        "U3BvVFVJIC0gRGVmYXVsdA==",
        "SGlyb2tpIEthd2FuYWJlIC0gU3RvcmU=",
        "UmVkIEF1dHVtbiBSb25pbiAtIExpdmUgV2FsbHBhcGVy",
    ]);
    // Progress bar styles for custom player bar
    const PROGRESS_STYLES = {
        "classic-block": { fg: "█", bg: "░" },
        "dark-block": { fg: "▓", bg: "░" },
        "gradient": { fg: "█▓▒", bg: "░" }, // Multi-char gradient from filled to empty
        "thin": { fg: "━", bg: "░" },
        "line": { fg: "━", bg: "─" },
        "square": { fg: "■", bg: "□" },
        "circle": { fg: "●", bg: "○" },
        "diamond": { fg: "◆", bg: "◇" },
        "chevron": { fg: ">", bg: "░" },
        "triangle": { fg: "▶", bg: "▷" },
        "braille": { fg: "⣿", bg: "⣀" },
        "retro": { fg: "▰", bg: "▱" },
        "pixel": { fg: "█", bg: "▀" },
        "dashed": { fg: "━", bg: "╸" }
    };

    const SPOTUI_ASCII_ART = [
        "   ▄████████    ▄███████▄  ▄██████▄      ███     ███    █▄   ▄█  ",
        "  ███    ███   ███    ███ ███    ███ ▀█████████▄ ███    ███ ███  ",
        "  ███    █▀    ███    ███ ███    ███    ▀███▀▀██ ███    ███ ███▌ ",
        "  ███          ███    ███ ███    ███     ███   ▀ ███    ███ ███▌ ",
        "▀███████████ ▀█████████▀  ███    ███     ███     ███    ███ ███▌ ",
        "         ███   ███        ███    ███     ███     ███    ███ ███  ",
        "   ▄█    ███   ███        ███    ███     ███     ███    ███ ███  ",
        " ▄████████▀   ▄████▀       ▀██████▀     ▄████▀   ████████▀  █▀   ",
    ];

    const GLITCH_CHARS = "01";

    // Orange-to-yellow gradient palette for logo coloring
    const ORANGE_PALETTE_RGB = [
        [255, 106, 0],
        [255, 122, 10],
        [255, 140, 26],
        [255, 158, 51],
        [255, 176, 77],
        [255, 194, 102],
        [255, 212, 128],
        [255, 230, 153],
    ];

    // Validation and parsing patterns
    const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
    const THEME_SKIP_CMD_REGEX = /^(?:tui\s+(?:bind|unbind|actions|restore)\b|jam\b)/i;
    const LRC_STAMP_REGEX = /\[(\d{1,2}):(\d{2}(?:\.\d+)?)\]/g; // LRC timestamp [mm:ss.ms]
    const LRC_STAMP_STRIP_REGEX = /\[\d{1,2}:\d{2}(?:\.\d+)?\]/g;

    // Placeholder images for "Add Theme" card in theme browser
    const ADD_THEME_IMG_OK = `https://imgs.search.brave.com/2VYp5kTKXFu84NcOgmYXQM8zyBByOalm9xwmIOX4Lp8/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9jZG4t/aWNvbnMtcG5nLmZs/YXRpY29uLmNvbS8x/MjgvOTU5Ni85NTk2/MTU2LnBuZw`;
    const ADD_THEME_IMG_ERR = `https://imgs.search.brave.com/qsWzCiBrdeOE9PQmFvp0eS0rfLyVkcm97DyHxEXGNBk/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9jZG4t/aWNvbnMtcG5nLm1h/Z25pZmljLmNvbS8y/NTYvMTAwODQvMTAw/ODQzOTAucG5nP3Nl/bXQ9YWlzX3doaXRl/X2xhYmVs`;

    // Available commands shown in help panel
    // This renders as innerHTML
    const COMMAND_LIST = [
        { cmd: "tui -l &lt;on/off&gt;", desc: "Toggle ASCII logo visibility" },
        { cmd: "tui -l -a &lt;on/off&gt;", desc: "Toggle ASCII animation" },
        { cmd: "tui -wp &lt;url&gt; [-o &lt;0-1&gt;] [-fit &lt;cover/contain/fill/none&gt;] [-pos &lt;center/top/bottom/left/right&gt;] [-rich &lt;0-200&gt;]", desc: "Set wallpaper — bare tui -wp shows current, flags alone tweak it: opacity, fit, position, richness (100 = default, 0 = off)" },
        { cmd: "tui -wp off", desc: "Remove wallpaper" },
        { cmd: "tui -shade &lt;#hex|off&gt;", desc: "Set the UI accent to any hex color (exact hue, saturation, lightness — even gray/white/black); video + posters stay true; bare tui -shade shows current" },
        { cmd: "tui -debug &lt;on/off&gt;", desc: "Verbose wallpaper/poster/shade logging for troubleshooting (warnings always print)" },
        { cmd: "tui -t pull &lt;theme_id&gt;", desc: "Apply a theme by its ID (you can find the id on our website)" },
        { cmd: "tui -t &lt;save &lt;name&gt;|list|apply &lt;name&gt;|delete &lt;name&gt;&gt;", desc: "Snapshot the current look locally (incl. poster wall layout); list opens the themes menu (Enter applies, Del/D fills in the delete command); restore/delete snapshots" },
        { cmd: 'tui bind "&lt;Letter&gt;" "&lt;command&gt;"', desc: "Bind Alt+&lt;Letter&gt; to run a TUI command (e.g. tui bind &quot;T&quot; &quot;tui -t list&quot; opens the themes menu on Alt+T; Ctrl combos never reach the page)" },
        { cmd: 'tui unbind "&lt;Letter&gt;"', desc: "Remove the Alt+&lt;Letter&gt; keybind" },
        { cmd: "tui bind clear", desc: "Remove all keybinds" },
        { cmd: "tui restore [-full]", desc: "Reset all settings to defaults and reload (keeps history, keybinds, actions; -full wipes everything)" },
        { cmd: "Ctrl+R", desc: "Reverse-search persistent command history (typing filters, Ctrl+R cycles older matches, Enter fills the bar, Esc aborts; unknown commands stay session-only)" },
        { cmd: "Tab", desc: "Accept the ghost fill suggestion (repeat to cycle matches)" },
        { cmd: "Esc", desc: "Abort history search, or leave the command bar so Spotify gets its keys back" },
        { cmd: "tui actions create &lt;name&gt;", desc: "Create a named action" },
        { cmd: "tui actions &lt;name&gt; &lt;listener&gt; &lt;command&gt;", desc: "Bind an action to a listener" },
        { cmd: "tui actions list", desc: "List saved actions" },
        { cmd: "tui actions enable &lt;name&gt;", desc: "Enable an action" },
        { cmd: "tui actions disable &lt;name&gt;", desc: "Disable an action" },
        { cmd: "tui actions delete &lt;name&gt;", desc: "Delete an action" },
        { cmd: "tui -ly -cp -active &lt;#hex&gt; -inactive &lt;#hex&gt; -near &lt;#hex&gt;", desc: "Set lyrics colors" },
        { cmd: "tui -ly -cp off", desc: "Reset lyrics colors" },
        { cmd: "tui -ly -animation &lt;on/off&gt;", desc: "Toggle lyrics loader animation" },
        { cmd: "tui -ly -spacing &lt;value&gt;", desc: "Controls vertical spacing between lines in lyrics" },
        { cmd: "tui -ly -spacing off", desc: "Resets line spacing in lyrics" },
        { cmd: "tui -viz -color &lt;#hex&gt;", desc: "Set visualizer bar color" },
        { cmd: "tui -viz off", desc: "Reset visualizer bar color" },
        { cmd: "tui -bar -bg &lt;#hex&gt; -border &lt;#hex&gt; -text &lt;#hex&gt;", desc: "Set player bar colors" },
        { cmd: "tui -bar -v &lt;on/off&gt;", desc: "Toggle play bar visibility" },
        { cmd: "tui -bar -c &lt;on/off&gt;", desc: "Toggle custom TUI play bar" },
        { cmd: "tui -bar -c -progress &lt;id&gt;", desc: "Set custom bar progress style" },
        { cmd: "tui -bar off", desc: "Reset player bar colors" },
        { cmd: "tui -progress -bg &lt;#hex&gt; -fg &lt;#hex&gt;", desc: "Set progress bar colors" },
        { cmd: "tui -progress off", desc: "Reset progress bar colors" },
        { cmd: "tui -inputs -bg &lt;#hex&gt; -bg-hover &lt;#hex&gt; -text &lt;#hex&gt; -border &lt;#hex&gt;", desc: "Set input colors" },
        { cmd: "tui -inputs -buttons &lt;on/off&gt;", desc: "Toggle bottom right buttons visibility" },
        { cmd: "tui -inputs off", desc: "Reset input colors" },
        { cmd: "tui -panel -bg &lt;#hex&gt; -border &lt;#hex&gt; -text &lt;#hex&gt;", desc: "Set help/playlist/theme/about panel colors" },
        { cmd: "tui -panel off", desc: "Reset panel colors" },
        { cmd: "playlist / list &lt;playlist-name&gt;", desc: "Open playlist viewer or play a specific playlist" },
        { cmd: "add2list", desc: "Add the current song to a playlist" },
        { cmd: "play / pause / p", desc: "Toggle playback" },
        { cmd: "skip", desc: "Next track" },
        { cmd: "back", desc: "Previous track" },
        { cmd: "s / seek <mm:ss>", desc: "Jump to a specific time" },
        { cmd: "v / volume <%>", desc: "Set volume" },
        { cmd: "shuffle", desc: "Toggle shuffle" },
        { cmd: "loop / superloop", desc: "Toggle repeat mode" },
        { cmd: "like", desc: "Like/unlike current song" },
        { cmd: "lyrics", desc: "Toggle lyrics panel" },
        { cmd: "visualizer", desc: "Toggle audio visualizer" },
        { cmd: "dj", desc: "Play the DJ playlist" },
        { cmd: "echo &lt;text&gt;", desc: "Display a message" },
        { cmd: "search &lt;query&gt;", desc: "Search Spotify" },
        { cmd: "about", desc: "Show about panel" },
        { cmd: "theme", desc: "Browse and apply themes" },
        { cmd: "standby", desc: "Enter standby mode (any key to exit)" },
        { cmd: "discord", desc: "Show the Discord update banner and re-enable it on boot" },
        { cmd: "jam create", desc: "Start a listening jam and get a PIN" },
        { cmd: "jam join <pin>", desc: "Join a jam by PIN (volume/lyrics only)" },
        { cmd: "jam leave", desc: "Leave the current jam" },
        { cmd: "tui -posters &lt;on/off&gt;", desc: "Show the wall (pin images first) / hide it, images are kept" },
        { cmd: "tui -posters &lt;shuffle/clear/settings&gt;", desc: "Re-roll posters, spots and sizes / delete everything and switch the wall off / print current settings" },
        { cmd: "tui -posters &lt;add &lt;url&gt; [board]|count &lt;1-12|lo-hi&gt;|density &lt;1-10|lo-hi&gt;|theme &lt;#hex&gt;|opacity &lt;0-1&gt;|autoshuffle &lt;on/off&gt;|symmetric &lt;on/off&gt;|rotate &lt;min/off&gt;&gt;", desc: "Pin an image URL (optional board tag so -pin-clear removes it); visible count (range = random each shuffle); size (range = random per poster); any frame color; layer opacity; fresh layout on every launch; mirrored pairs layout; auto re-roll timer" },
        { cmd: "tui -posters [-o &lt;0-1&gt;] [-c &lt;1-12|lo-hi&gt;] [-d &lt;1-10|lo-hi&gt;] [-t &lt;#hex&gt;] [-r &lt;min|off&gt;]", desc: "Flag style, combinable with each other and with on/off: opacity, count, density, frame color, re-roll timer" },
        { cmd: "tui -pin-board &lt;board-url&gt; [token] [-o/-c/-d/-t/-r]", desc: "Sync a board's pins; public boards need no token, private ones do; poster flags apply after sync" },
        { cmd: "tui -pin-boards | tui -pin-clear &lt;board&gt;", desc: "Boards menu (Enter re-pulls, Del/D forgets, A adds) / forget one board (wall switches off if empty)" },
        { cmd: "tui -pin-feed | tui -pin-refresh [board] [-o/-c/-d/-t/-r] | tui -pin-token &lt;token&gt;", desc: "Random mix from all your boards (needs token) / re-pull boards — or one matching board — to pick up new pins, then recreate the wall (flags apply after) / save API token on this machine only" },
        { cmd: "help", desc: "Show this panel" },
    ];

    function storageGet(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    // Returns false when the write fails (e.g. quota exceeded) so callers can
    // surface it instead of toasting false success.
    function storageSet(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) { return false; }
    }

    function storageRemove(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {}
    }

    // Parse a JSON object value defensively: {} on missing/corrupt/shape-mismatch.
    function readJsonObject(key) {
        try {
            const raw = storageGet(key);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
        } catch (e) { return {}; }
    }

    // Parse a JSON array value defensively: [] on missing/corrupt/shape-mismatch.
    function readJsonArray(key) {
        try {
            const raw = storageGet(key);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) { return []; }
    }

    function storageClear() {
        try {
            localStorage.clear();
        } catch (e) {}
    }

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // randomizing animation sequences - fisher-yates
    function shuffleArray(array) {
        for (let index = array.length - 1; index > 0; index -= 1) {
            const j = Math.floor(Math.random() * (index + 1));
            [array[index], array[j]] = [array[j], array[index]];
        }
        return array;
    }
    function createButton(id, className, text, onClick) {
        const btn = document.createElement("button");
        btn.id = id;
        btn.className = className;
        btn.textContent = text;
        btn.addEventListener("click", onClick);
        return btn;
    }

    // Verbose troubleshooting logs. Off by default — toggle with `tui -debug on`.
    // Warnings/errors always print; only info-level chatter goes through here.
    function isDebug() {
        try { return storageGet(DEBUG_KEY) === "1"; } catch (e) { return false; }
    }

    function dbg(tag, ...args) {
        if (isDebug()) console.log(tag, ...args);
    }

    // Shared toast skeleton: fixed bottom-center single instance, auto-remove
    // after ms (null = sticky). Callers pass their exact visuals as cssText so
    // unifying here changes no pixels.
    function toastBase(id, text, ms, cssText) {
        try {
            const old = document.getElementById(id);
            if (old) old.remove();
            const t = document.createElement("div");
            t.id = id;
            t.textContent = text;
            t.style.cssText = cssText;
            document.body.appendChild(t);
            if (ms !== null && ms !== undefined) setTimeout(() => t.remove(), ms);
        } catch (e) {}
    }

    // Status tag cluster (jam/dj tags): one .spotui-jam-tag div per line,
    // wrap removed when lines is empty.
    function setStatusTag(id, lines) {
        try {
            const old = document.getElementById(id);
            if (old) old.remove();
            const items = (lines || []).filter((t) => typeof t === "string" && t);
            if (!items.length) return;
            const wrap = document.createElement("div");
            wrap.id = id;
            for (const text of items) {
                const tag = document.createElement("div");
                tag.className = "spotui-jam-tag";
                tag.textContent = text;
                wrap.appendChild(tag);
            }
            document.body.appendChild(wrap);
        } catch (e) {}
    }

    // Small non-blocking toast (console.log alone is invisible without DevTools).
    function pinToast(text, ms = 7000) {
        // Border follows --spotui-accent (what -shade re-points) with the panel
        // border as fallback. The toast lives on document.body, outside the
        // TUI container, so the var reads as the exact target color.
        toastBase("spotui-pin-toast", text, ms, "position:fixed;left:50%;bottom:120px;transform:translateX(-50%);z-index:10000;background:rgba(10,14,18,.45);background:color-mix(in srgb, var(--panel-bg-color,#0a0e12) 45%, transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);color:var(--panel-text-color,var(--text-base,#e8e2d4));border:1px solid var(--spotui-accent,var(--panel-border-color,var(--essential-base,#7fd4d4)));padding:10px 16px;font-family:'JetBrains Mono',monospace;font-size:12px;max-width:70vw;white-space:pre-wrap;text-align:center;pointer-events:none;");
    }

    // SpoTUI's default accent color is orange #ff8c42 (the fallback baked into
    // every var(--spotui-accent, ...) rule). The shade command re-points the
    // var at any hex — hue, saturation, lightness, even gray/white/black.
    // Wallpaper and posters never go through the accent path, so they stay
    // true with no counter-filtering involved.

    function hexToRgb01(hex) {
        const m = String(hex || "").replace("#", "");
        const full = (m.length === 3 || m.length === 4)
            ? [...m.slice(0, 3)].map((c) => c + c).join("")
            : m.slice(0, 6);
        return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
    }

    function parseHexToRgb255(hex) {
        return hexToRgb01(hex).map((v) => Math.round(v * 255));
    }

    // sRGB relative luminance (0-1) for accent/contrast decisions.
    function hexLuminance(hex) {
        const [r, g, b] = hexToRgb01(hex).map((v) => {
            const c = Math.max(0, Math.min(1, v));
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    // Text color for accent backgrounds: whichever of black/white contrasts
    // more (WCAG ratio). Orange and other light accents keep black text.
    function onAccentFor(hex) {
        const l = hexLuminance(hex);
        const black = (l + 0.05) / 0.05;
        const white = 1.05 / (l + 0.05);
        return black >= white ? "#000000" : "#ffffff";
    }

    function rgbToHsl01(r, g, b) {
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const l = (max + min) / 2;
        const d = max - min;
        let h = 0, s = 0;
        if (d !== 0) {
            s = d / (1 - Math.abs(2 * l - 1));
            if (max === r) h = 60 * (((g - b) / d) % 6);
            else if (max === g) h = 60 * ((b - r) / d + 2);
            else h = 60 * ((r - g) / d + 4);
            if (h < 0) h += 360;
        }
        return { h, s, l };
    }

    function hexToHsl01(hex) {
        const [r, g, b] = hexToRgb01(hex);
        return rgbToHsl01(r, g, b);
    }

    function hslToRgb255(h, s, l) {
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = l - c / 2;
        let r = 0, g = 0, b = 0;
        if (h < 60) { r = c; g = x; }
        else if (h < 120) { r = x; g = c; }
        else if (h < 180) { g = c; b = x; }
        else if (h < 240) { g = x; b = c; }
        else if (h < 300) { r = x; b = c; }
        else { r = c; b = x; }
        return [r, g, b].map((v) => Math.round((v + m) * 255));
    }

    // Accent hue for effects that can't read the CSS var (canvas logo,
    // glitch flashes). Null when no shade is set.
    function accentHue() {
        try {
            const target = storageGet(SHADE_KEY);
            if (!isValidShade(target)) return null;
            return hexToHsl01(target).h;
        } catch (e) { return null; }
    }

    // Logo gradient re-tinted: each palette step keeps its lightness, but takes
    // the accent's hue and saturation (grays stay gray, pastels stay pastel).
    // Returns null when no shade is set so callers keep the orange palette.
    function accentLogoPalette(base) {
        const hue = accentHue();
        if (hue === null) return null;
        try {
            const { s } = hexToHsl01(storageGet(SHADE_KEY));
            return base.map(([r, g, b]) => {
                const { l } = rgbToHsl01(r / 255, g / 255, b / 255);
                return hslToRgb255(hue, s, l);
            });
        } catch (e) { return null; }
    }

    function shadeStyleEl() {
        let s = document.getElementById("spotui-shade-vars");
        if (!s) {
            s = document.createElement("style");
            s.id = "spotui-shade-vars";
            document.head.appendChild(s);
        }
        return s;
    }

    // Strict hex check shared by set/report/apply paths so an invalid stored
    // value is never presented as active nor painted as NaN.
    function isValidShade(v) {
        return typeof v === "string" && HEX_COLOR_REGEX.test(v.trim());
    }

    function applyShade() {
        const tui = document.getElementById("spotui-tui");
        if (!tui) return false;
        const rawTarget = storageGet(SHADE_KEY);
        // Self-heal a corrupt stored value instead of painting invalid CSS.
        if (rawTarget && !isValidShade(rawTarget)) {
            storageRemove(SHADE_KEY);
            console.warn("[SpoTUI-shade] ignoring invalid stored shade, reset to orange:", rawTarget);
        }
        const target = isValidShade(rawTarget) ? rawTarget : null;
        const st = shadeStyleEl();
        if (!target) {
            st.textContent = "";
            try { refreshLogoColors(); } catch (e) {}
            return true;
        }
        // Exact accent: hue, saturation, and lightness all come from the hex.
        const [r, g, b] = parseHexToRgb255(target);
        st.textContent = `
body.spotui-spotify-enabled, body {
    --spotui-accent: ${target} !important;
    --spotui-accent-rgb: ${r}, ${g}, ${b} !important;
    --spotui-on-accent: ${onAccentFor(target)} !important;
}`;
        try { refreshLogoColors(); } catch (e) {}
        return true;
    }

    function setShade(arg) {
        const v = String(arg || "").trim();
        if (v.toLowerCase() === "off") {
            storageRemove(SHADE_KEY);
            applyShade();
            pinToast("shade off — back to orange");
            dbg("[SpoTUI-shade] off, orange restored.");
            return;
        }
        if (!isValidShade(v)) {
            pinToast(`not a hex color: ${v} (e.g. tui -shade #7fd4d4)`);
            console.warn("[SpoTUI-shade] usage: tui -shade <#hex|off>  (e.g. tui -shade #7fd4d4)");
            return;
        }
        storageSet(SHADE_KEY, v);
        applyShade();
        pinToast(`UI shade ${v} (any color — video + posters untouched)`);
        dbg("[SpoTUI-shade] applied:", v);
    }

    function reportShade() {
        const cur = storageGet(SHADE_KEY);
        if (cur && !isValidShade(cur)) {
            pinToast(`shade ${cur} is not a valid hex — ignored (back to orange)`);
            dbg("[SpoTUI-shade] stored value invalid:", cur);
            return;
        }
        pinToast(cur ? `UI shade ${cur}` : "UI shade: orange (default)");
        dbg("[SpoTUI-shade] current:", cur || "orange (default)");
    }

    const app = {
        asciiAnimationInitialized: false,
        asciiCharData: [],
        asciiEnabled: true,
        standbyOpen: false,
        lyricsObserver: null,
        syncIconTimer: null,
        sposyncConnected: false,
        djObserver: null,
        djMode: false,
        djPanelOpen: false,
        djPrevPane: null,
        commandHistory: [],
        commandHistoryIndex: -1,
        historySearch: null,
        cmdSuggest: null,
        playlistPanelOpen: false,
        add2listPanelOpen: false,
        playlists: [],
        playlistSongs: [],
        playlistSongsTotal: 0,
        playlistSongsFetchToken: 0,
        playlistSongsFetchTimer: null,
        selectedPlaylist: 0,
        selectedSong: 0,
        activePane: "playlist",
        helpPanelOpen: false,
        aboutPanelOpen: false,
        themePanelOpen: false,
        boardsPanelOpen: false,
        savesPanelOpen: false,
        selectedBoard: 0,
        selectedSave: 0,
        pendingMenu: null,
        onboardingPanelOpen: false,
        onboardingStage: "commands",
        onboardingShowAllThemes: false,
        lyricsPanelOpen: false,
        visualizerOpen: false,
        lyricsLoadToken: 0,
        lyricsActiveIndex: -1,
        lyricsActiveLoaderIndex: -1,
        searchPanelOpen: false,
        searchResults: [],
        searchSelected: 0,
        searchFocus: "input",
        searchQuery: "",
        searchAutocomplete: "",
        searchFetchToken: 0,
        searchDebounce: null,
        searchBound: false,
        lyricsCache: { uri: "", lines: [], synced: false, provider: "", instrumental: false, error: "" },
        lyricsBound: false,
        lyricsSyncInterval: null,
        cachedLyricsRows: [],
        cachedLyricsLoaders: [],
        jamRole: null,
        jamPin: null,
        jamToken: null,
        jamIntervalId: null,
        jamBarPrevHidden: null,
        jamLastAppliedUri: null,
        themesFeedPromise: null,
        playlistListScrollRaf: null,
        songListScrollRaf: null,
        songScrollAnimRaf: null,
        navRafPending: false,
        playlistNavLastAt: 0,
        playlistNavFast: false,
        playlistSortOpen: false,
        playlistSortIndex: 0,
        playlistsDefault: [],
        playlistSongsDefault: [],
        playlistFindOpen: false,
        playlistFindQuery: "",
        playlistFindSource: []
    };

    // Panels with their own inputs or key handling: the command bar yields to them.
    // Read-only panels (help, about) leave the command input usable.
    function isInputBlockingPanelOpen() {
        return app.standbyOpen || app.playlistPanelOpen || app.add2listPanelOpen || app.searchPanelOpen ||
            app.themePanelOpen || app.boardsPanelOpen || app.savesPanelOpen ||
            app.onboardingPanelOpen || app.djPanelOpen;
    }

    // Generate random character for glitch effects
    function randomGlitchChar() {
        return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
    }

    function randomGlitchColor(minLightness = 50, lightnessRange = 30) {
        const base = accentHue() ?? 20;
        return `hsl(${base + Math.random() * 35}, 100%, ${minLightness + Math.random() * lightnessRange}%)`;
    }

    // Logo gradient: orange by default, re-tinted to the shade accent.
    function activePalette() {
        try {
            return accentLogoPalette(ORANGE_PALETTE_RGB) || ORANGE_PALETTE_RGB;
        } catch (e) { return ORANGE_PALETTE_RGB; }
    }
    function getCharColor(row, col, totalRows, totalCols) {
        const palette = activePalette();
        const normRow = row / Math.max(totalRows - 1, 1);
        const normCol = col / Math.max(totalCols - 1, 1);
        const mix = normRow * 0.55 + normCol * 0.45; // Weighted blend favoring vertical
        const len = palette.length;
        const idx = Math.floor(mix * (len - 1));
        const frac = mix * (len - 1) - idx; // Fractional position for interpolation
        const i = Math.min(idx, len - 2);
        const [r1, g1, b1] = palette[i];
        const [r2, g2, b2] = palette[i + 1] || palette[i];
        const r = Math.round(r1 + (r2 - r1) * frac);
        const g = Math.round(g1 + (g2 - g1) * frac);
        const b = Math.round(b1 + (b2 - b1) * frac);
        return `rgb(${r},${g},${b})`;
    }

    // Re-tint the logo after a shade change: recompute every stored color
    // (live spans, restore points, and the canvas paint source). Totals come
    // from the data itself so this works even before layout ran.
    function refreshLogoColors() {
        const data = app.asciiCharData;
        if (!data.length) return;
        const rows = Math.max(...data.map((e) => e.row)) + 1;
        const cols = Math.max(...data.map((e) => e.col)) + 1;
        for (const entry of data) {
            const color = getCharColor(entry.row, entry.col, rows, cols);
            entry.color = color;
            entry.el.style.color = color;
            if (entry.el.dataset) entry.el.dataset.origColor = color;
        }
        pokeAsciiPaint();
    }

    const asciiDraw = {
        canvas: null,
        ctx: null,
        cols: 0,
        rows: 0,
        pad: 20,
        fontSize: 0,
        cellW: 0,
        cellH: 0,
        dpr: 1,
        raf: 0,
    };

    let visibilityHooked = false;

    function getAsciiFontSize() {
        const vw = window.innerWidth;
        if (vw <= 450) return Math.min(Math.max(3.5, vw * 0.014), 7);
        if (vw <= 700) return Math.min(Math.max(5, vw * 0.011), 11);
        return Math.min(Math.max(9, vw * 0.014), 22);
    }

    function asciiFont(size) {
        return `400 ${size}px "JetBrains Mono", "Fira Code", monospace`;
    }

    function layoutAsciiCanvas() {
        const { canvas, ctx, cols, rows, pad } = asciiDraw;
        if (!canvas || !ctx) return;
        const fontSize = getAsciiFontSize();
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.font = asciiFont(fontSize);
        ctx.fontKerning = "none";
        ctx.letterSpacing = "0px";
        const cellW = ctx.measureText("0").width;
        const cellH = fontSize;
        const cssW = pad * 2 + cols * cellW;
        const cssH = pad * 2 + rows * cellH;
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;
        canvas.width = Math.max(1, Math.round(cssW * dpr));
        canvas.height = Math.max(1, Math.round(cssH * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        asciiDraw.fontSize = fontSize;
        asciiDraw.cellW = cellW;
        asciiDraw.cellH = cellH;
        asciiDraw.dpr = dpr;
    }

    function paintAsciiCanvas() {
        const { canvas, ctx, cols, rows, pad, fontSize, cellW, cellH } = asciiDraw;
        if (!canvas || !ctx) return;
        const dpr = window.devicePixelRatio || 1;
        if (dpr !== asciiDraw.dpr || fontSize !== getAsciiFontSize()) layoutAsciiCanvas();
        const cssW = pad * 2 + cols * cellW;
        const cssH = pad * 2 + rows * cellH;
        ctx.clearRect(0, 0, cssW, cssH);
        ctx.font = asciiFont(asciiDraw.fontSize);
        ctx.fontKerning = "none";
        ctx.letterSpacing = "0px";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fontVariantCaps = "normal";
        const chars = app.asciiCharData;
        for (let i = 0; i < chars.length; i += 1) {
            const { el, row, col } = chars[i];
            const ch = el.textContent;
            if (!ch || ch === " ") continue;
            const color = el.style.color;
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 6;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.fillText(ch, pad + col * asciiDraw.cellW, pad + row * asciiDraw.cellH);
        }
    }

    function startAsciiPaintLoop() {
        if (asciiDraw.raf) return;
        if (!animationWanted()) return;
        const tick = () => {
            // Stop the moment nothing can see the canvas; restart hooks
            // (visibility, logo toggle, TUI re-show, animation on) bring it back.
            if (!animationWanted()) { asciiDraw.raf = 0; return; }
            paintAsciiCanvas();
            asciiDraw.raf = requestAnimationFrame(tick);
        };
        asciiDraw.raf = requestAnimationFrame(tick);
    }

    // Logo paint is only worth running while visible and enabled.
    function animationWanted() {
        if (!app.asciiEnabled) return false;
        try {
            if (storageGet(ANIMATION_KEY) === "off") return false;
        } catch (e) {}
        return logoVisible();
    }

    function logoVisible() {
        try {
            if (document.hidden) return false;
            const cls = document.body.classList;
            if (cls.contains("logo-off")) return false;
            if (cls.contains("spotui-tui-hidden")) return false;
        } catch (e) {}
        return true;
    }

    // Single frame for settled states (shade switch, resize, re-show) when the
    // loop is stopped. No-op while the loop runs.
    function pokeAsciiPaint() {
        if (asciiDraw.raf) return;
        try { paintAsciiCanvas(); } catch (e) {}
    }

    // Reset ASCII logo animation to original state
    function resetGrid() {
        app.asciiCharData.forEach(({ el, original, color }) => {
            el.textContent = original;
            el.style.color = color;
        });
    }

    // Restore one char after a glitch flash. Animations snapshot entries at
    // start and run for hundreds of ms, so a shade change mid-flight would
    // repaint stale colors — always read the live value refreshLogoColors()
    // keeps current instead of a captured copy.
    function restoreChar(el, original) {
        el.textContent = original;
        if (el.dataset && el.dataset.origColor) el.style.color = el.dataset.origColor;
    }

    function initAsciiAnimation() {
        if (app.asciiAnimationInitialized) return;
        app.asciiAnimationInitialized = true;

        const logo = document.getElementById("spotui-logo");
        if (!logo) return;

        logo.innerHTML = "";

        const canvas = document.createElement("canvas");
        canvas.className = "spotui-ascii-canvas";
        canvas.setAttribute("aria-hidden", "true");
        logo.appendChild(canvas);
        asciiDraw.canvas = canvas;
        asciiDraw.ctx = canvas.getContext("2d");

        const rows = SPOTUI_ASCII_ART.length;
        const cols = Math.max(...SPOTUI_ASCII_ART.map((row) => row.length));
        asciiDraw.rows = rows;
        asciiDraw.cols = cols;
        const charData = [];
        const rowSpansCache = [];

        SPOTUI_ASCII_ART.forEach((line, rowIdx) => {
            const padded = line.padEnd(cols, " ");
            const chars = [...padded];
            const rowSpans = [];
            chars.forEach((ch, colIdx) => {
                const color = getCharColor(rowIdx, colIdx, rows, cols);
                const el = {
                    textContent: ch,
                    style: { color },
                    dataset: {
                        row: String(rowIdx),
                        col: String(colIdx),
                        original: ch,
                        origColor: color,
                    },
                };
                charData.push({
                    row: rowIdx,
                    col: colIdx,
                    el,
                    original: ch,
                    color,
                });
                rowSpans.push(el);
            });
            rowSpansCache.push(rowSpans);
        });

        app.asciiCharData = charData;
        layoutAsciiCanvas();
        startAsciiPaintLoop();
        pokeAsciiPaint();
        window.addEventListener("resize", layoutAsciiCanvas);
        if (!visibilityHooked) {
            visibilityHooked = true;
            document.addEventListener("visibilitychange", () => {
                if (document.hidden) {
                    if (asciiDraw.raf) {
                        cancelAnimationFrame(asciiDraw.raf);
                        asciiDraw.raf = 0;
                    }
                } else {
                    startAsciiPaintLoop();
                    pokeAsciiPaint();
                }
            });
        }
        if (document.fonts?.ready) document.fonts.ready.then(layoutAsciiCanvas);

        function getRowSpans(rowIdx) {
            return rowSpansCache[rowIdx] || [];
        }

        // Decrypt animation
        async function decryptRow(rowIdx) {
            const spans = getRowSpans(rowIdx);
            if (!spans.length) return;
            const origs = spans.map((span) => span.dataset.original || " ");

            spans.forEach((span) => {
                span.textContent = randomGlitchChar();
            });

            const indices = Array.from({ length: spans.length }, (_, i) => i);
            shuffleArray(indices);

            const batchSize = 4;
            for (let start = 0; start < indices.length; start += batchSize) {
                const batch = indices.slice(start, start + batchSize);
                batch.forEach((idx) => {
                    spans[idx].textContent = randomGlitchChar();
                });
                await sleep(8);
                batch.forEach((idx) => {
                    restoreChar(spans[idx], origs[idx]);
                });
                await sleep(6);
            }
        }

        // Glitch wave
        async function glitchRowWave(rowIdx, duration = 500) {
            const spans = getRowSpans(rowIdx);
            if (!spans.length) return;
            const origs = spans.map((span) => span.dataset.original || " ");
            const steps = 8;
            for (let step = 0; step < steps; step += 1) {
                spans.forEach((span) => {
                    span.textContent = randomGlitchChar();
                    span.style.color = randomGlitchColor();
                });
                await sleep(Math.floor(duration / steps));
            }
            spans.forEach((span, i) => {
                restoreChar(span, origs[i] || " ");
            });
        }

        // run glitch effect based on distance from center
        async function runGlitchByDist(duration, logic) {
            const centerRow = Math.floor(rows / 2);
            const centerCol = Math.floor(cols / 2);
            const withDist = charData.map((entry) => {
                const dr = entry.row - centerRow;
                const dc = entry.col - centerCol;
                return { ...entry, dist: Math.sqrt(dr * dr + dc * dc) };
            });
            const maxDist = Math.max(...withDist.map((entry) => entry.dist), 1);
            await logic(withDist, maxDist);
            resetGrid();
        }

        // Burst
        async function burstGlitch(duration = 800) {
            const steps = 8;
            await runGlitchByDist(duration, async (withDist, maxDist) => {
                for (let step = 0; step < steps; step += 1) {
                    const progress = step / steps;
                    withDist.forEach(({ el, original, dist }) => {
                        const norm = dist / maxDist;
                        const threshold = progress * 1.1;
                        if (norm < threshold + 0.12 && norm > threshold - 0.12) {
                            if (Math.random() < 0.75) {
                                el.textContent = randomGlitchChar();
                                el.style.color = randomGlitchColor();
                            }
                        } else if (norm < threshold - 0.12) {
                            restoreChar(el, original);
                        }
                    });
                    await sleep(Math.floor(duration / steps));
                }
            });
        }

        // Pulse
        async function pulseGlitch(duration = 1200) {
            const waves = 3;
            const stepsPerWave = 10;
            await runGlitchByDist(duration, async (withDist, maxDist) => {
                for (let wave = 0; wave < waves; wave += 1) {
                    for (let step = 0; step < stepsPerWave; step += 1) {
                        const progress = step / stepsPerWave;
                        const threshold = progress * 1.0;
                        withDist.forEach(({ el, original, dist }) => {
                            const norm = dist / maxDist;
                            if (norm < threshold + 0.1 && norm > threshold - 0.1) {
                                if (Math.random() < 0.7) {
                                    el.textContent = randomGlitchChar();
                                    el.style.color = randomGlitchColor(55, 25);
                                }
                            } else if (norm < threshold - 0.1 && wave === waves - 1) {
                                restoreChar(el, original);
                            }
                        });
                        await sleep(Math.floor(duration / (waves * stepsPerWave)));
                    }
                    await sleep(40);
                }
            });
        }

        // Implosion
        async function implosionGlitch(duration = 900) {
            const steps = 10;
            await runGlitchByDist(duration, async (withDist, maxDist) => {
                withDist.forEach(({ el }) => {
                    el.textContent = randomGlitchChar();
                    el.style.color = randomGlitchColor(45, 35);
                });
                for (let step = 0; step < steps; step += 1) {
                    const progress = step / steps;
                    const threshold = 1.0 - progress * 1.1;
                    withDist.forEach(({ el, original, dist }) => {
                        const norm = dist / maxDist;
                        if (norm <= threshold) {
                            restoreChar(el, original);
                        }
                    });
                    await sleep(Math.floor(duration / steps));
                }
            });
        }

        // Spiral
        async function spiralGlitch(duration = 1000) {
            const centerRow = Math.floor(rows / 2);
            const centerCol = Math.floor(cols / 2);
            const withAngle = charData.map((entry) => {
                const dr = entry.row - centerRow;
                const dc = entry.col - centerCol;
                const angle = Math.atan2(dc, dr);
                const dist = Math.sqrt(dr * dr + dc * dc);
                return { ...entry, angle, dist };
            });
            const steps = 36;
            const wedgeWidth = 0.5;

            for (let step = 0; step < steps; step += 1) {
                const sweepAngle = (step / steps) * Math.PI * 2 - Math.PI;
                withAngle.forEach(({ el, original, angle, dist }) => {
                    let diff = Math.abs(angle - sweepAngle);
                    if (diff > Math.PI) diff = Math.PI * 2 - diff;
                    if (diff < wedgeWidth && dist > 0.1) {
                        el.textContent = randomGlitchChar();
                        el.style.color = randomGlitchColor(55, 25);
                    } else {
                        restoreChar(el, original);
                    }
                });
                await sleep(Math.floor(duration / steps));
            }
            resetGrid();
        }

        // Fuzz wave
        async function fuzzWaveGlitch(duration = 1000) {
            const steps = 20;
            const bandWidth = 0.25;
            await runGlitchByDist(duration, async (withDist, maxDist) => {
                for (let step = 0; step < steps; step += 1) {
                    const progress = step / steps;
                    const targetNorm = progress * 1.0;
                    withDist.forEach(({ el, original, dist }) => {
                        const norm = dist / maxDist;
                        const distanceFromTarget = Math.abs(norm - targetNorm);
                        if (distanceFromTarget < bandWidth && Math.random() < 0.65) {
                            el.textContent = randomGlitchChar();
                            el.style.color = randomGlitchColor();
                        } else if (distanceFromTarget > bandWidth * 1.5) {
                            restoreChar(el, original);
                        }
                    });
                    await sleep(Math.floor(duration / steps));
                }
            });
        }

        // Static
        async function staticGlitch(duration = 600) {
            const steps = 6;
            for (let step = 0; step < steps; step += 1) {
                charData.forEach(({ el }) => {
                    if (Math.random() < 0.8) {
                        el.textContent = randomGlitchChar();
                        el.style.color = randomGlitchColor();
                    }
                });
                await sleep(Math.floor(duration / steps));
            }
            resetGrid();
        }

        // Horizontal band
        // 1 = downward, -1 = upward
        async function horizontalBand(direction = 1, duration = 800) {
            const start = direction === 1 ? 0 : rows - 1;
            const totalSteps = rows + 2;
            for (let step = 0; step <= totalSteps; step += 1) {
                resetGrid();
                const bandCenter = start + direction * step;
                const bandTop = Math.max(0, bandCenter - 1);
                const bandBottom = Math.min(rows - 1, bandCenter + 1);
                for (let row = bandTop; row <= bandBottom; row += 1) {
                    const spans = getRowSpans(row);
                    spans.forEach((span) => {
                        span.textContent = randomGlitchChar();
                        span.style.color = randomGlitchColor();
                    });
                }
                await sleep(Math.floor(duration / totalSteps));
            }
            resetGrid();
        }

        // Vertical slice
        // 1 = rightward, -1 = leftward
        async function verticalSlice(direction = 1, duration = 800) {
            const start = direction === 1 ? 0 : cols - 1;
            const totalSteps = cols + 2;
            for (let step = 0; step <= totalSteps; step += 1) {
                resetGrid();
                const bandCenter = start + direction * step;
                const bandLeft = Math.max(0, bandCenter - 1);
                const bandRight = Math.min(cols - 1, bandCenter + 1);
                charData.forEach(({ el, col }) => {
                    if (col >= bandLeft && col <= bandRight) {
                        el.textContent = randomGlitchChar();
                        el.style.color = randomGlitchColor();
                    }
                });
                await sleep(Math.floor(duration / totalSteps));
            }
            resetGrid();
        }

        // Stage functions
        async function stageWaveDown() {
            for (let row = 0; row < rows; row += 1) {
                await glitchRowWave(row, 300);
                await sleep(20);
            }
        }

        async function stageWaveUp() {
            for (let row = rows - 1; row >= 0; row -= 1) {
                await glitchRowWave(row, 260);
                await sleep(15);
            }
        }

        async function stageDecrypt() {
            charData.forEach(({ el }) => {
                el.textContent = randomGlitchChar();
            });
            for (let row = 0; row < rows; row += 1) {
                await decryptRow(row);
            }
        }

        async function stageBurst() { await burstGlitch(900); }
        async function stagePulse() { await pulseGlitch(1200); }
        async function stageImplosion() { await implosionGlitch(900); }
        async function stageSpiral() { await spiralGlitch(1000); }
        async function stageFuzzWave() { await fuzzWaveGlitch(1000); }
        async function stageStatic() { await staticGlitch(700); }
        async function stageHSlashDown() { await horizontalBand(1, 800); }
        async function stageHSlashUp() { await horizontalBand(-1, 800); }
        async function stageVSlashRight() { await verticalSlice(1, 800); }
        async function stageVSlashLeft() { await verticalSlice(-1, 800); }

        const stageFunctions = [
            stageWaveDown,
            stageWaveUp,
            stageDecrypt,
            stageBurst,
            stagePulse,
            stageImplosion,
            stageSpiral,
            stageFuzzWave,
            stageStatic,
            stageHSlashDown,
            stageHSlashUp,
            stageVSlashRight,
            stageVSlashLeft,
        ];

        async function runLoop() {
            while (true) {
                if (!app.asciiEnabled || storageGet(ANIMATION_KEY) === "off") {
                    await sleep(500);
                    continue;
                }
                const shuffled = shuffleArray([...stageFunctions]);
                for (const stageFn of shuffled) {
                    if (!app.asciiEnabled || storageGet(ANIMATION_KEY) === "off") break;
                    await stageFn();
                    await sleep(700 + Math.random() * 400);
                }
                resetGrid();
                await sleep(300);
            }
        }

        runLoop().catch(console.error);
    }

    // Poster wall: Pinterest-style prints pinned on top of the video wallpaper.
    // Layer order: wallpaper (z -1) < posters (z 0) < terminal content (z 1).

    const POSTERS_ON = "spotui:posters-on";
    const POSTERS_IMGS = "spotui:posters-imgs";
    const POSTERS_COUNT = "spotui:posters-count";
    const POSTERS_ROTATE = "spotui:posters-rotate";
    const POSTERS_SEED = "spotui:posters-seed";
    const POSTERS_DENSITY = "spotui:posters-density";
    const POSTERS_THEME = "spotui:posters-theme";
    const POSTERS_OPACITY = "spotui:posters-opacity";
    const POSTERS_AUTOSHUFFLE = "spotui:posters-autoshuffle";
    const POSTERS_SYMMETRIC = "spotui:posters-symmetric";
    // Exact wall arrangement captured on every render: [{u:url, b:board,
    // slot:{x,y,w,r}, mult}]. Snapshots pick it up automatically (spotui:*),
    // so theme apply re-pins each poster to its saved slot — no seed re-roll.
    const POSTERS_LAYOUT = "spotui:posters-layout";
    const PIN_TOKEN = "spotui:pin-token";

    const MAX_STORED = 40;

    // Fixed wall slots (percent coords) so posters frame the terminal, never cover it.
    // Columns hug the left/right edges, top row clears the logo, bottom corners
    // stop at y63 so capped posters (28vh) stay above the command bar.
    // Declared as mirrored pairs: symmetric mode fills a pair together, and a
    // lone slot in its own pair renders solo — no geometric guessing involved.
    const SLOT_PAIRS = [
        [{ x: 2, y: 2, w: 12, r: -4 }, { x: 86, y: 2, w: 12, r: 3 }],
        [{ x: 2, y: 23, w: 12, r: 3 }, { x: 86, y: 23, w: 12, r: -3 }],
        [{ x: 2, y: 44, w: 12, r: -2 }, { x: 86, y: 44, w: 12, r: 2 }],
        [{ x: 2, y: 63, w: 12, r: 4 }, { x: 86, y: 63, w: 12, r: -4 }],
        [{ x: 20, y: 1, w: 11, r: 2 }, { x: 69, y: 1, w: 11, r: -2 }],
        [{ x: 15, y: 63, w: 11, r: -3 }, { x: 74, y: 63, w: 11, r: 3 }],
    ];
    const SLOTS = SLOT_PAIRS.flat();

    let rotateTimer = null;

    function mulberry32(a) {
        return function () {
            a |= 0; a = (a + 0x6d2b79f5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // Seeded Fisher-Yates shared by every wall shuffle so layouts stay
    // deterministic per seed.
    function shuffleSeeded(arr, rnd) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(rnd() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // Stored as [{u:url, b:boardLabel}]; legacy entries carrying retired
    // video fields ({u,p,id,k}) resolve to their still thumbnail.
    function getPosterImages() {
        try {
            const raw = storageGet(POSTERS_IMGS);
            const arr = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(arr)) return [];
            return arr
                .map((e) => (typeof e === "string" ? { u: e, b: "?" } : { u: e.u || e.p, b: e.b || "?" }))
                .filter((e) => e && typeof e.u === "string" && e.u.length > 0);
        } catch (e) { return []; }
    }

    function savePosterImages(imgs) {
        storageSet(POSTERS_IMGS, JSON.stringify(imgs.slice(0, MAX_STORED)));
    }

    function getBoardCounts() {
        const map = {};
        for (const e of getPosterImages()) map[e.b || "?"] = (map[e.b || "?"] || 0) + 1;
        return map;
    }

    function showBoardList() {
        // Non-empty case opens the menu (see commands); this stays as the
        // empty-library hint.
        pinToast("no synced boards — pull one with: tui -pin-board <board-url>");
        dbg("[SpoTUI-pin] synced boards: none");
    }

    function clearBoard(ref) {
        const q = String(ref || "").toLowerCase();
        const imgs = getPosterImages();
        const kept = imgs.filter((e) => !String(e.b || "").toLowerCase().includes(q));
        const removed = imgs.length - kept.length;
        savePosterImages(kept);
        if (!kept.length) {
            // Library is empty: power the wall off so boot stays clean too.
            storageRemove(POSTERS_ON);
            storageRemove(POSTERS_LAYOUT);
            stopRotateTimer();
        }
        if (isPostersEnabled()) renderPosters();
        else { const box = document.getElementById("spotui-posters"); if (box) box.innerHTML = ""; }
        dbg(`[SpoTUI-pin] forgot ${removed} image(s) matching "${ref}". Left:`, getBoardCounts());
        pinToast(`forgot ${removed} image(s).`);
    }

    function isPostersEnabled() {
        return storageGet(POSTERS_ON) === "1";
    }

    // Shared -o/-c/-d/-t/-r flag handling for poster commands (combinable,
    // works alongside subcommands and after board syncs).
    function flagArg(argsLower, args, name) {
        const i = argsLower.indexOf(name);
        return i !== -1 && args[i + 1] ? args[i + 1] : undefined;
    }

    function applyPosterFlags(argsLower, args) {
        let n = 0;
        const o = flagArg(argsLower, args, "-o");
        if (o !== undefined) { setPosterOpacity(o); n++; }
        const c = flagArg(argsLower, args, "-c");
        if (c !== undefined) { setPosterCount(c); n++; }
        const d = flagArg(argsLower, args, "-d");
        if (d !== undefined) { setPosterDensity(d); n++; }
        const t = flagArg(argsLower, args, "-t");
        if (t !== undefined) { setPosterTheme(t); n++; }
        const r = flagArg(argsLower, args, "-r");
        if (r !== undefined) { setPosterRotate(r); n++; }
        return n;
    }

    function ensureContainer() {
        const tui = document.getElementById("spotui-tui");
        if (!tui) return null;
        let box = document.getElementById("spotui-posters");
        if (!box) {
            box = document.createElement("div");
            box.id = "spotui-posters";
            box.style.position = "absolute";
            box.style.inset = "0";
            box.style.overflow = "hidden";
            box.style.pointerEvents = "none";
            tui.appendChild(box);
        }
        // Stay above wallpaper (z -1), below terminal content (z 1).
        // setWallpaper() bumps every child to z 1, so re-assert after it runs.
        box.style.setProperty("z-index", "0", "important");
        if (window.getComputedStyle(box).position === "static") box.style.position = "absolute";
        return box;
    }

    // Called from setWallpaper() so a wallpaper swap never buries the posters.
    function reassertPosterLayer() {
        const box = document.getElementById("spotui-posters");
        if (box) box.style.setProperty("z-index", "0", "important");
    }

    function renderPosters() {
        const box = ensureContainer();
        if (!box) return;
        box.innerHTML = "";
        const frame = prepBox(box);
        if (!isPostersEnabled()) { storageRemove(POSTERS_LAYOUT); return; }
        const imgs = getPosterImages();
        if (!imgs.length) {
            storageRemove(POSTERS_LAYOUT);
            dbg("[SpoTUI-pin] posters on but no images yet. Add: tui -posters add <url> or tui -pin-board <board-url>");
            return;
        }
        const seed = parseInt(storageGet(POSTERS_SEED) || "7", 10) || 7;
        const rnd = mulberry32(seed);
        const [cLo, cHi] = parseCountRange();
        const count = Math.min(cLo + Math.floor(rnd() * (cHi - cLo + 1)), SLOTS.length, imgs.length);
        const [dLo, dHi] = parseDensity();
        const placed = [];
        let shown = count;
        if (storageGet(POSTERS_SYMMETRIC) === "1") {
            shown = renderPostersSymmetric(box, frame, count, dLo, dHi, rnd, imgs, placed);
        } else {
            const slotIdx = shuffleSeeded(SLOTS.map((_, i) => i), rnd);
            const imgIdx = shuffleSeeded(imgs.map((_, i) => i), rnd);
            for (let k = 0; k < count; k++) {
                const mult = (dLo + rnd() * (dHi - dLo)) / 5;
                placePoster(box, frame, SLOTS[slotIdx[k]], mult, imgs[imgIdx[k]], placed);
            }
        }
        savePosterLayout(placed);
        dbg(`[SpoTUI-pin] rendered ${shown} poster(s) from ${imgs.length} saved.`);
    }

    // Shared box setup (opacity); returns the frame color.
    function prepBox(box) {
        const opRaw = parseFloat(storageGet(POSTERS_OPACITY) || "1");
        box.style.opacity = String(Math.max(0, Math.min(1, isNaN(opRaw) ? 1 : opRaw)));
        return posterFrameColor();
    }

    function validLayoutEntry(e) {
        if (!e || typeof e.u !== "string" || !e.u.length) return false;
        if (!e.slot) return false;
        if (![e.slot.x, e.slot.y, e.slot.w, e.slot.r].every((n) => typeof n === "number" && isFinite(n))) return false;
        if (e.mult !== undefined && (typeof e.mult !== "number" || !isFinite(e.mult))) return false;
        return true;
    }

    function savePosterLayout(placed) {
        try {
            const clean = (placed || []).filter(validLayoutEntry).slice(0, SLOTS.length);
            if (!clean.length) { storageRemove(POSTERS_LAYOUT); return; }
            storageSet(POSTERS_LAYOUT, JSON.stringify(clean));
        } catch (e) {}
    }

    function readPosterLayout() {
        try {
            const raw = storageGet(POSTERS_LAYOUT);
            const arr = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(arr)) return [];
            return arr.filter(validLayoutEntry);
        } catch (e) { return []; }
    }

    // Re-pin each poster to its saved slot (theme apply / wall re-enable).
    // Entries whose url left the library are skipped. Returns false when
    // there is nothing exact to restore so callers fall back to a seed roll.
    function renderSavedLayout() {
        const box = ensureContainer();
        if (!box) return false;
        if (!isPostersEnabled()) return false;
        const layout = readPosterLayout();
        if (!layout.length) return false;
        const known = new Set(getPosterImages().map((e) => e.u));
        const valid = layout.filter((e) => known.has(e.u)).slice(0, SLOTS.length);
        if (!valid.length) return false;
        box.innerHTML = "";
        const frame = prepBox(box);
        const placed = [];
        for (const e of valid) {
            placePoster(box, frame, e.slot, typeof e.mult === "number" ? e.mult : 1, { u: e.u, b: e.b }, placed);
        }
        savePosterLayout(placed);
        dbg(`[SpoTUI-pin] restored ${placed.length} poster(s) to saved slots.`);
        return true;
    }

    function placePoster(box, frame, slot, mult, entry, record) {
        const fig = document.createElement("figure");
        fig.style.margin = "0";
        fig.style.position = "absolute";
        fig.style.left = slot.x + "%";
        fig.style.top = slot.y + "%";
        fig.style.width = Math.min(30, slot.w * mult) + "%";
        fig.style.maxHeight = "28vh";
        fig.style.overflow = "hidden";
        fig.style.transform = `rotate(${slot.r}deg)`;
        fig.style.background = frame;
        fig.style.padding = "6px 6px 20px 6px";
        fig.style.boxShadow = "0 6px 18px rgba(0,0,0,.55)";
        fig.appendChild(posterImg(entry.u, fig));
        box.appendChild(fig);
        if (record) record.push({ u: entry.u, b: entry.b || "?", slot: { x: slot.x, y: slot.y, w: slot.w, r: slot.r }, mult });
    }

    function renderPostersSymmetric(box, frame, count, dLo, dHi, rnd, imgs, record) {
        const order = shuffleSeeded(SLOT_PAIRS.map((_, i) => i), rnd);
        const picks = shuffleSeeded(imgs.map((_, i) => i), rnd);
        let shown = 0, ip = 0;
        for (const pi of order) {
            if (shown >= count) break;
            const mult = (dLo + rnd() * (dHi - dLo)) / 5;
            for (const s of SLOT_PAIRS[pi]) {
                if (shown >= count || ip >= picks.length) break;
                placePoster(box, frame, s, mult, imgs[picks[ip++]], record);
                shown++;
            }
        }
        return shown;
    }

    function posterImg(src, fig) {
        const img = document.createElement("img");
        img.src = src || "";
        img.alt = "";
        img.draggable = false;
        img.style.width = "100%";
        img.style.display = "block";
        img.style.pointerEvents = "none";
        img.onerror = () => {
            console.warn("[SpoTUI-pin] poster image failed to load, hiding:", src);
            fig.remove();
        };
        return img;
    }

    // Reset wall preferences to defaults (used by theme reset). The pinned
    // library, its layout, and the API token are personal, not a look: kept.
    function resetPosterPrefs() {
        storageRemove(POSTERS_COUNT);
        storageRemove(POSTERS_DENSITY);
        storageRemove(POSTERS_THEME);
        storageRemove(POSTERS_OPACITY);
        storageRemove(POSTERS_ROTATE);
        storageRemove(POSTERS_SEED);
        storageRemove(POSTERS_AUTOSHUFFLE);
        storageRemove(POSTERS_SYMMETRIC);
    }

    function setPostersEnabled(on) {    if (on) {
            storageSet(POSTERS_ON, "1");
            if (!renderSavedLayout()) renderPosters();
            startRotateTimer();
            dbg("[SpoTUI-pin] posters ON. Shuffle: tui -posters shuffle");
        } else {
            storageRemove(POSTERS_ON);
            stopRotateTimer();
            const box = document.getElementById("spotui-posters");
            if (box) box.innerHTML = "";
            dbg("[SpoTUI-pin] posters OFF (images kept).");
        }
    }

    function addPoster(url, board) {
        const u = String(url || "").trim();
        const b = String(board || "manual");
        if (!u) return;
        if (/\s/.test(u) && !/%20/.test(u)) console.warn("[SpoTUI-pin] URL has raw spaces, encode as %20:", u);
        const imgs = getPosterImages();
        if (imgs.some((e) => e.u === u)) {
            dbg("[SpoTUI-pin] already pinned:", u);
            return;
        }
        imgs.unshift({ u, b });
        savePosterImages(imgs);
        dbg(`[SpoTUI-pin] pinned (${imgs.length} total):`, u);
        if (isPostersEnabled()) renderPosters();
    }

    function clearPosters() {
        const n = getPosterImages().length;
        storageRemove(POSTERS_IMGS);
        storageRemove(POSTERS_ON);
        storageRemove(POSTERS_LAYOUT);
        stopRotateTimer();
        const box = document.getElementById("spotui-posters");
        if (box) box.innerHTML = "";
        dbg(`[SpoTUI-pin] nuked ${n} image(s) and switched the wall OFF. Nothing can come back on restart. Re-enable with: tui -posters on`);
    }

    function shufflePosters() {
        storageSet(POSTERS_SEED, String(Date.now() % 100000));
        renderPosters();
        dbg("[SpoTUI-pin] shuffled.");
    }

    function setPosterCount(arg) {
        const [lo, hi] = parseRange(arg, SLOTS.length, 5);
        const val = lo === hi ? String(lo) : `${lo}-${hi}`;
        storageSet(POSTERS_COUNT, val);
        renderPosters();
        dbg(`[SpoTUI-pin] showing ${val} poster(s)${val.includes("-") ? " (random in range each shuffle)" : ""}.`);
    }

    // Parse "n" or "lo-hi" into a clamped [lo, hi] pair (single numbers pass
    // through as [n, n], reversed ranges are swapped).
    function parseRange(arg, max, fallback) {
        const s = String(arg ?? "").trim();
        const m = s.match(/(\d+)\s*-\s*(\d+)/);
        let lo, hi;
        if (m) { lo = parseInt(m[1], 10); hi = parseInt(m[2], 10); }
        else { lo = hi = parseInt(s, 10) || fallback; }
        lo = Math.max(1, Math.min(max, lo)); hi = Math.max(1, Math.min(max, hi));
        if (lo > hi) [lo, hi] = [hi, lo];
        return [lo, hi];
    }

    function parseCountRange() {
        return parseRange(storageGet(POSTERS_COUNT), SLOTS.length, 5);
    }

    // Frame color: any hex. Legacy "dark"/"light" presets map to their hexes.
    function posterFrameColor() {
        const v = String(storageGet(POSTERS_THEME) || "").trim();
        if (v === "dark") return "#1a1e24";
        if (HEX_COLOR_REGEX.test(v)) return v;
        return "#f5f1e6";
    }
    function setPosterTheme(color) {
        const v = String(color || "").trim();
        if (!HEX_COLOR_REGEX.test(v)) {
            console.warn("[SpoTUI-pin] usage: tui -posters theme <#hex>  (e.g. tui -posters theme #1a1e24)");
            return;
        }
        storageSet(POSTERS_THEME, v);
        renderPosters();
        dbg("[SpoTUI-pin] poster frames:", v);
    }

    function setPosterOpacity(v) {
        const f = parseFloat(String(v));
        const op = Math.max(0, Math.min(1, isNaN(f) ? 1 : f));
        storageSet(POSTERS_OPACITY, String(op));
        renderPosters();
        dbg("[SpoTUI-pin] poster layer opacity:", op);
    }

    function setPosterDensity(arg) {
        const [lo, hi] = parseRange(arg, 10, 5);
        const val = lo === hi ? String(lo) : `${lo}-${hi}`;
        storageSet(POSTERS_DENSITY, val);
        renderPosters();
        dbg(`[SpoTUI-pin] density ${val}/10 — each poster rolls a random size in that range (re-rolled on shuffle).`);
    }

    function parseDensity() {
        return parseRange(storageGet(POSTERS_DENSITY), 10, 5);
    }

    function setPosterRotate(min) {
        const m = String(min || "").toLowerCase();
        if (m === "off" || m === "0") {
            storageRemove(POSTERS_ROTATE);
            stopRotateTimer();
            dbg("[SpoTUI-pin] auto-rotate OFF.");
            return;
        }
        const v = Math.max(1, parseInt(m, 10) || 10);
        storageSet(POSTERS_ROTATE, String(v));
        startRotateTimer();
        dbg(`[SpoTUI-pin] auto-rotate every ${v} min (new random picks).`);
    }

    function setPosterAutoshuffle(state) {
        const on = String(state || "").toLowerCase() === "on";
        if (on) storageSet(POSTERS_AUTOSHUFFLE, "1");
        else storageRemove(POSTERS_AUTOSHUFFLE);
        dbg(`[SpoTUI-pin] launch shuffle ${on ? "ON (fresh layout every Spotify start)" : "OFF"}.`);
    }

    function setPosterSymmetric(state) {
        const on = String(state || "").toLowerCase() === "on";
        if (on) storageSet(POSTERS_SYMMETRIC, "1");
        else storageRemove(POSTERS_SYMMETRIC);
        renderPosters();
        dbg(`[SpoTUI-pin] symmetric layout ${on ? "ON (mirrored pairs)" : "OFF"}.`);
    }

    // Called on boot before first render when the wall is enabled.
    function maybeAutoshuffle() {
        if (storageGet(POSTERS_AUTOSHUFFLE) !== "1") return false;
        storageSet(POSTERS_SEED, String(Date.now() % 100000));
        dbg("[SpoTUI-pin] boot: launch shuffle rolled a fresh layout.");
        return true;
    }

    function showPosterSettings() {
        const [cLo, cHi] = parseCountRange();
        const [dLo, dHi] = parseDensity();
        const opRaw = parseFloat(storageGet(POSTERS_OPACITY) || "1");
        const op = String(Math.max(0, Math.min(1, isNaN(opRaw) ? 1 : opRaw)));
        const theme = posterFrameColor();
        const boards = getBoardCounts();
        const boardStr = Object.keys(boards).length
            ? Object.entries(boards).map(([b, n]) => `${b} (${n})`).join(", ")
            : "none";
        const summary =
            `wall ${isPostersEnabled() ? "ON" : "OFF"} · ${getPosterImages().length} images\n` +
            `boards: ${boardStr}\n` +
            `count ${cLo === cHi ? cLo : `${cLo}-${cHi}`} · density ${dLo === dHi ? dLo : `${dLo}-${dHi}`} · ${theme} · opacity ${op}\n` +
            `rotate ${storageGet(POSTERS_ROTATE) ? `every ${storageGet(POSTERS_ROTATE)} min` : "off"} · autoshuffle ${storageGet(POSTERS_AUTOSHUFFLE) === "1" ? "on" : "off"} · symmetric ${storageGet(POSTERS_SYMMETRIC) === "1" ? "on" : "off"}`;
        pinToast(summary);
        console.log("[SpoTUI-pin] current settings:\n" + summary, boards);
    }

    function stopRotateTimer() {
        if (rotateTimer) { clearInterval(rotateTimer); rotateTimer = null; }
    }

    function startRotateTimer() {
        stopRotateTimer();
        const v = parseInt(storageGet(POSTERS_ROTATE) || "0", 10) || 0;
        if (!isPostersEnabled() || v <= 0) return;
        rotateTimer = setInterval(() => {
            if (!isPostersEnabled()) return stopRotateTimer();
            storageSet(POSTERS_SEED, String(Date.now() % 100000));
            renderPosters();
            dbg("[SpoTUI-pin] auto-rotated posters.");
        }, v * 60 * 1000);
    }

    // ---------- Pinterest sync ----------

    // Extract the still image URL from a board pin record. Video pins resolve
    // to their cover still — animation lives in wallpapers, not the wall.
    function pickPidgetImage(p) {
        try {
            const im = p.images || {};
            return (im["600x"] && im["600x"].url) || (im.orig && im.orig.url) || (im["237x"] && im["237x"].url) || null;
        } catch (e) { return null; }
    }

    async function fetchJsonLoose(url, headers) {
        const res = await fetch(url, headers ? { headers } : undefined);
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        const text = await res.text();
        try { return JSON.parse(text); }
        catch (e) {
            const m = text.match(/^[^(]*\((.*)\)\s*;?\s*$/s);
            if (m) return JSON.parse(m[1]);
            throw e;
        }
    }

    function parseBoardRef(input) {
        const s = String(input || "").trim();
        if (/^\d+$/.test(s)) return { id: s };
        const m = s.match(/pinterest\.[a-z.]+\/([^/?#]+)\/([^/?#]+)/i);
        if (m) return { user: m[1], slug: m[2] };
        if (/^[^/?#]+\/[^/?#]+$/.test(s)) {
            const [user, slug] = s.split("/");
            return { user, slug };
        }
        return {};
    }

    // No-auth attempt via Pinterest's public widget endpoint. Returns still
    // thumbnails — video pins resolve to their cover still, like at the start.
    async function syncViaPidgets(user, slug) {
        const url = `${PINTEREST_WIDGET_BASE}/boards/${encodeURIComponent(user)}/${encodeURIComponent(slug)}/pins/`;
        dbg("[SpoTUI-pin] trying public board endpoint (no login needed)...");
        const data = await fetchJsonLoose(url);
        const pins = (data && data.data && data.data.pins) || [];
        return pins
            .map((p) => pickPidgetImage(p))
            .filter(Boolean);
    }

    async function pinterestV5(path, token) {
        return fetchJsonLoose(`${PINTEREST_API_BASE}${path}`, {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        });
    }

    // Full account sync with a token: match board by slug across YOUR boards, pull pins.
    async function syncViaV5(ref, token) {
        let boardId = ref.id;
        if (!boardId) {
            dbg("[SpoTUI-pin] listing your boards to find a match...");
            const boards = await pinterestV5("/boards?page_size=100", token);
            const items = boards.items || boards || [];
            const hit = items.find((b) => {
                const name = String(b.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
                return name.includes(String(ref.slug).toLowerCase()) || String(ref.slug).toLowerCase().includes(name);
            });
            if (!hit) throw new Error(`board "${ref.slug}" not found in your account (${items.length} boards checked)`);
            boardId = hit.id;
            dbg("[SpoTUI-pin] matched board:", hit.name, `(${boardId})`);
        }
        const pins = await pinterestV5(`/boards/${boardId}/pins?page_size=25`, token);
        return ((pins.items || pins) || []).map((p) => (p.image && p.image.original && p.image.original.url) || null).filter(Boolean);
    }

    // Re-pull synced boards (or only those matching `filter`), merge any new
    // pins, then recreate the wall randomly with the current count/density
    // ranges.
    async function refreshBoards(filter) {
        const q = String(filter || "").toLowerCase();
        const boards = Object.keys(getBoardCounts())
            .filter((b) => b && b !== "manual" && b !== "?")
            .filter((b) => !q || b.toLowerCase().includes(q));
        if (!boards.length) {
            if (q) console.warn(`[SpoTUI-pin] no synced board matches "${filter}". See: tui -pin-boards`);
            else {
                dbg("[SpoTUI-pin] nothing to re-pull (only manual pins). Sync a board first: tui -pin-board <url>");
                shufflePosters();
            }
            return;
        }
        const token = (storageGet(PIN_TOKEN) || "").trim();
        let ok = 0;
        for (const b of boards) {
            try {
                if (b === "feed-mix") await syncPinterestFeed(token);
                else if (b.startsWith("board:")) await syncPinterestBoard(b.slice(6), token);
                else await syncPinterestBoard(`${PINTEREST_WWW_BASE}/${b}/`, token);
                ok++;
            } catch (e) { console.warn("[SpoTUI-pin] re-pull failed for", b, "-", e.message); }
        }
        shufflePosters();
        pinToast(`re-pulled ${ok}/${boards.length} board(s) — wall recreated`);
        dbg(`[SpoTUI-pin] re-pulled ${ok}/${boards.length} board(s), wall recreated randomly.`);
    }

    function setPinToken(token) {
        const t = String(token || "").trim();
        if (!t) {
            console.warn("[SpoTUI-pin] usage: tui -pin-token <paste-token-here>  (stored only in this machine's localStorage)");
            return;
        }
        storageSet(PIN_TOKEN, t);
        dbg("[SpoTUI-pin] token saved. Now run: tui -pin-board <board-url>");
    }

    async function syncPinterestBoard(input, tokenArg) {
        const ref = parseBoardRef(input);
        const token = (tokenArg || storageGet(PIN_TOKEN) || "").trim();
        dbg("[SpoTUI-pin] syncing board:", input);
        if (!ref.user && !ref.id) {
            console.warn('[SpoTUI-pin] need a board URL like pinterest.com/<you>/<board>/ , "<you>/<board>", or a numeric board id.');
            return;
        }
        let media = [];
        // 1) public endpoint first (works for public boards, no token)
        if (ref.user) {
            try {
                media = await syncViaPidgets(ref.user, ref.slug);
                dbg(`[SpoTUI-pin] public endpoint gave ${media.length} image(s).`);
            } catch (e) {
                console.warn("[SpoTUI-pin] public endpoint failed:", e.message);
            }
        }
        // 2) authenticated API (works for private boards + your whole account)
        if (!media.length && token) {
            try {
                const urls = await syncViaV5(ref, token);
                media = urls;
                dbg(`[SpoTUI-pin] Pinterest API gave ${media.length} image(s).`);
            } catch (e) {
                console.error("[SpoTUI-pin] Pinterest API failed:", e.message);
            }
        }
        if (!media.length) {
            if (!token) {
                pinToast("nothing fetched — board may be private (save a token) or blocked");
                console.warn("[SpoTUI-pin] nothing fetched. Board may be private — save a token (tui -pin-token <token>) and retry, or paste image URLs directly: tui -posters add <url>");
            } else {
                pinToast("nothing fetched — check board URL/id and token scopes");
                console.warn("[SpoTUI-pin] nothing fetched. Check the board URL/id and token scopes (boards:read, pins:read).");
            }
            return;
        }
        const label = ref.slug ? `${ref.user}/${ref.slug}` : `board:${ref.id}`;
        const imgs = getPosterImages();
        let added = 0;
        for (const u of media) {
            if (!imgs.some((x) => x.u === u) && imgs.length < MAX_STORED) { imgs.unshift({ u, b: label }); added++; }
        }
        savePosterImages(imgs);
        if (!isPostersEnabled()) storageSet(POSTERS_ON, "1");
        startRotateTimer();
        renderPosters();
        pinToast(`synced ${added} new image(s) — wall updated`);
        dbg(`[SpoTUI-pin] synced ${added} new image(s), ${imgs.length} total. Shuffle: tui -posters shuffle`);
    }

    // Random mix across ALL your boards = closest thing to a "feed" the API allows.
    async function syncPinterestFeed(tokenArg) {
        const token = (tokenArg || storageGet(PIN_TOKEN) || "").trim();
        if (!token) {
            console.warn("[SpoTUI-pin] feed needs a token: tui -pin-token <token>  (get one at developers.pinterest.com, scopes boards:read pins:read)");
            return;
        }
        try {
            dbg("[SpoTUI-pin] pulling a random mix from all your boards...");
            const boards = await pinterestV5("/boards?page_size=100", token);
            const items = boards.items || [];
            if (!items.length) { console.warn("[SpoTUI-pin] no boards on this account."); return; }
            const shuffled = [...items].sort(() => Math.random() - 0.5).slice(0, 5);
            let urls = [];
            for (const b of shuffled) {
                try {
                    const pins = await pinterestV5(`/boards/${b.id}/pins?page_size=10`, token);
                    urls.push(...(((pins.items || [])).map((p) => (p.image && p.image.original && p.image.original.url) || null).filter(Boolean)));
                } catch (e) { console.warn("[SpoTUI-pin] skip board", b.name, "-", e.message); }
            }
            urls = urls.sort(() => Math.random() - 0.5).slice(0, 25);
            if (!urls.length) { console.warn("[SpoTUI-pin] boards gave no pin images."); return; }
            const imgs = getPosterImages();
            let added = 0;
            for (const u of urls) {
                if (!imgs.some((e) => e.u === u) && imgs.length < MAX_STORED) { imgs.unshift({ u, b: "feed-mix" }); added++; }
            }
            savePosterImages(imgs);
            if (!isPostersEnabled()) storageSet(POSTERS_ON, "1");
            startRotateTimer();
            renderPosters();
            pinToast(`feed mix: ${added} new from ${shuffled.length} board(s)`);
            dbg(`[SpoTUI-pin] feed mix: ${added} new image(s) from ${shuffled.length} board(s).`);
        } catch (e) {
            if (String(e.message || "").includes("Failed to fetch")) {
                console.error("[SpoTUI-pin] request blocked (CORS/network). Paste image URLs directly instead: tui -posters add <i.pinimg.com url>");
            } else {
                console.error("[SpoTUI-pin] feed failed:", e.message);
            }
        }
    }

    // Display restart notification popup
    // persistSession - to survive the reload after all settings get reset.
    // Sticky (no auto-remove): it must survive until the reload happens.
    function showRestartPopup(message = "Wait 5 seconds and relaunch Spotify", persistSession = false) {
        toastBase("spotui-restart-popup", message, null, "position:fixed;left:50%;bottom:120px;transform:translateX(-50%);z-index:10000;background:rgba(0,0,0,0.92);border:1px solid var(--spotui-accent,#ff8c42);border-radius:6px;padding:12px 16px;color:var(--spotui-accent,#ff8c42);font-family:\"JetBrains Mono\",monospace;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,0.35);");
        if (persistSession) {
            try { sessionStorage.setItem("spotui:restart-popup", message); } catch (e) {}
        }
        return popup;
    }
    // Initialize Discord community update banner
    // Shows unless user has dismissed with "never show again"
    function initUpdateBanner() {
        if (document.getElementById("spotui-update-banner")) return;
        if (storageGet(UPDATE_BANNER_KEY) === "never") return;

        const banner = document.createElement("div");
        banner.id = "spotui-update-banner";
        banner.innerHTML = `
        <div class="spotui-banner-secondary-actions">
            <button id="banner-dismiss-btn" class="spotui-banner-link-btn" title="Dismiss">Dismiss</button>
            <button id="banner-never-btn" class="spotui-banner-link-btn" title="Never show again">Never show</button>
        </div>
        <div class="spotui-banner-header">
            <img class="spotui-banner-icon" src="https://raw.githubusercontent.com/SkenSMasteR/SpoTUI/refs/heads/master/assets/logo.png" alt="SpoTUI Logo">
            <div>
                <h3>Updates & Community</h3>
            </div>
        </div>
        <p>Did you know that SpoTUI gets new updates almost every day?</p>
        <p>Join the SpoTUI Discord server to get breakdowns of every new feature, and notifications when new updates arrive.</p>
        <div class="spotui-update-actions">
            <button id="banner-join-btn" class="spotui-control-btn">Join Discord</button>
        </div>
    `;
        document.body.appendChild(banner);

        document.getElementById("banner-join-btn").onclick = () => {
            window.open(DISCORD_INVITE_URL, "_blank");
        };

        document.getElementById("banner-dismiss-btn").onclick = () => {
            banner.remove();
        };

        document.getElementById("banner-never-btn").onclick = () => {
            storageSet(UPDATE_BANNER_KEY, "never");
            banner.remove();
        };
    }

    // Get current theme accent color from CSS variables
    function getSpotuiAccentColor() {
        try {
            const accent = getComputedStyle(document.documentElement).getPropertyValue("--spotui-accent").trim();
            return accent || "#ff8c42";
        } catch (e) {
            return "#ff8c42";
        }
    }

    // Show temporary toast notification for jam-related messages
    function jamSay(text) {
        const accent = getSpotuiAccentColor();
        toastBase("spotui-jam-toast", text, 4000, `position:fixed;left:50%;bottom:120px;transform:translateX(-50%);z-index:10000;background:rgba(0,0,0,0.45);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border:1px solid ${accent};border-radius:6px;padding:12px 16px;color:${accent};font-family:"JetBrains Mono",monospace;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,0.35);`);
    }

    // Display jam session status tags (role and PIN)
    function showJamTags(pin, role) {
        setStatusTag("spotui-jam-tags", [
            role === "host"
                ? "This client is connected to the server."
                : "This client is controlled by an autonomous relay server.",
            `Room pin: ${pin}`,
        ]);
    }

    // Remove jam status tags from display
    function hideJamTags() {
        setStatusTag("spotui-jam-tags", []);
    }

    // Save current jam state to localStorage for session persistence
    function jamStorageSave() {
        if (!app.jamRole) { storageRemove(JAM_STATE_KEY); return; }
        storageSet(JAM_STATE_KEY, JSON.stringify({
            role: app.jamRole, pin: app.jamPin, token: app.jamToken, barPrevHidden: app.jamBarPrevHidden,
        }));
    }

    // Make fetch request to jam server
    async function jamFetch(path, opts) {
        const res = await fetch(JAM_SERVER_URL + path, opts);
        return res.json().catch(() => ({}));
    }

    // Stop jam polling interval
    function jamStopPolling() {
        if (app.jamIntervalId) { clearInterval(app.jamIntervalId); app.jamIntervalId = null; }
    }

    // Hide player bar when joining jam as guest
    function jamForceHideBar() {
        app.jamBarPrevHidden = document.body.classList.contains("spotui-bar-off");
        document.body.classList.add("spotui-bar-off");
    }

    function jamRestoreBar() {
        if (app.jamBarPrevHidden === true) {
            document.body.classList.add("spotui-bar-off");
        } else if (app.jamBarPrevHidden === false) {
            document.body.classList.remove("spotui-bar-off");
        } else {
            applyPlayerBarVisibility();
        }
        app.jamBarPrevHidden = null;
    }

    // Broadcast current playback state to jam server (host only)
    function jamHostTick() {
        try {
            const item = Spicetify.Player?.data?.item;
            const uri = item?.uri || null;
            const position_ms = Spicetify.Player.getProgress() || 0;
            const is_playing = Spicetify.Player.isPlaying();
            jamFetch(`/jam/${app.jamPin}/state`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: app.jamToken, uri, position_ms, is_playing }),
            }).catch(() => {});
        } catch (e) {}
    }

    // Create a new jam session as host
    // Displays the PIN for others to join
    async function jamCreate() {
        if (app.jamRole) { jamSay("You are already in a jam, run 'jam leave' first."); return; }
        try {
            const res = await jamFetch("/jam/create", { method: "POST" });
            if (!res.pin) { jamSay("Failed to create jam."); return; }
            app.jamRole = "host";
            app.jamPin = res.pin;
            app.jamToken = res.token;
            jamStorageSave();
            jamStopPolling();
            app.jamIntervalId = setInterval(jamHostTick, JAM_POLL_MS);
            jamHostTick();
            showJamTags(app.jamPin, "host");
            jamSay(`Jam created — PIN ${app.jamPin}. Others join with: jam join ${app.jamPin}`);
        } catch (e) {
            jamSay("Failed to create jam: " + e.message);
        }
    }

    // Fetch and sync playback state (guest only)
    async function jamGuestTick() {
        try {
            const data = await jamFetch(`/jam/${app.jamPin}/state?token=${encodeURIComponent(app.jamToken)}`);
            if (data.ended || data.error === "invalid_token") {
                jamSay("Jam ended.");
                await jamLeave();
                return;
            }
            const s = data.state;
            if (!s) return;

            const elapsedSinceUpdate = s.is_playing ? Math.max(0, (data.server_time - s.updated_at) * 1000) : 0;
            const expectedPos = s.position_ms + elapsedSinceUpdate;

            if (s.uri && s.uri !== app.jamLastAppliedUri) {
                app.jamLastAppliedUri = s.uri;
                await Spicetify.Player.playUri(s.uri);
                setTimeout(() => { try { Spicetify.Player.seek(expectedPos); } catch (e) {} }, 250);
            } else if (s.uri) {
                const currentPos = Spicetify.Player.getProgress() || 0;
                if (Math.abs(currentPos - expectedPos) > JAM_SEEK_DRIFT_MS) {
                    try { Spicetify.Player.seek(expectedPos); } catch (e) {}
                }
            }

            const nowPlaying = Spicetify.Player.isPlaying();
            if (s.is_playing && !nowPlaying) Spicetify.Player.togglePlay();
            if (!s.is_playing && nowPlaying) Spicetify.Player.togglePlay();
        } catch (e) {}
    }

    // Join an existing jam session as guest using PIN
    async function jamJoin(pin) {
        if (app.jamRole) { jamSay("Already in a jam — run 'jam leave' first."); return; }
        if (!pin) { jamSay("Usage: jam join <pin>"); return; }
        try {
            const res = await jamFetch(`/jam/${pin}/join`, { method: "POST" });
            if (res.error) { jamSay("Could not join jam: " + res.error); return; }
            app.jamRole = "guest";
            app.jamPin = pin;
            app.jamToken = res.token;
            app.jamLastAppliedUri = null;
            jamForceHideBar();
            jamStorageSave();
            jamStopPolling();
            app.jamIntervalId = setInterval(jamGuestTick, JAM_POLL_MS);
            jamGuestTick();
            showJamTags(pin, "guest");
            jamSay(`Joined jam ${pin}. Only volume, lyrics, and 'jam leave' are available.`);
        } catch (e) {
            jamSay("Failed to join jam: " + e.message);
        }
    }

    // Leave current jam session (host or guest)
    async function jamLeave() {
        if (!app.jamRole) { jamSay("Not in a jam."); return; }
        const wasGuest = app.jamRole === "guest";
        try {
            await jamFetch(`/jam/${app.jamPin}/leave`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: app.jamToken }),
            });
        } catch (e) {}
        jamStopPolling();
        if (wasGuest) jamRestoreBar();
        hideJamTags();
        app.jamRole = null; app.jamPin = null; app.jamToken = null; app.jamLastAppliedUri = null;
        jamStorageSave();
        jamSay("Left jam.");
    }

    // Return set of commands available to jam guests
    function getAllowedJamGuestCommands() {
        if (app.jamRole !== "guest") return null;
        return new Set(["v", "volume", "lyrics", "visualizer", "jam"]);
    }

    // Resume jam session from localStorage after page reload
    function resumeJamFromStorage() {
        try {
            const raw = storageGet(JAM_STATE_KEY);
            if (!raw) return;
            const saved = JSON.parse(raw);
            if (!saved || !saved.role || !saved.pin || !saved.token) return;
            app.jamRole = saved.role;
            app.jamPin = saved.pin;
            app.jamToken = saved.token;
            app.jamBarPrevHidden = typeof saved.barPrevHidden === "boolean" ? saved.barPrevHidden : null;
            showJamTags(app.jamPin, app.jamRole);
            if (app.jamRole === "guest") {
                document.body.classList.add("spotui-bar-off");
                app.jamIntervalId = setInterval(jamGuestTick, JAM_POLL_MS);
                jamGuestTick();
            } else if (app.jamRole === "host") {
                app.jamIntervalId = setInterval(jamHostTick, JAM_POLL_MS);
                jamHostTick();
            }
        } catch (e) {}
    }

    // Retrieve stored keyboard shortcuts
    function getKeybinds() {
        const parsed = readJsonObject(KEYBIND_STORAGE_KEY);
        const clean = {};
        Object.keys(parsed).forEach((key) => {
            if (typeof parsed[key] === "string") clean[key] = parsed[key];
        });
        return clean;
    }

    function saveKeybinds(map) {
        return storageSet(KEYBIND_STORAGE_KEY, JSON.stringify(map));
    }

    // Remove leading slash or dot from command strings
    function stripCommandPrefix(cmd) {
        const raw = String(cmd || "").trim();
        return raw.startsWith("/") || raw.startsWith(".") ? raw.slice(1).trim() : raw;
    }

    function isRestrictedThemeCommand(cmd) {
        const cleaned = stripCommandPrefix(cmd).toLowerCase();
        const [command, sub] = cleaned.split(/\s+/);
        if (command === "jam") return true;
        if (command === "tui" && (sub === "bind" || sub === "unbind" || sub === "actions" || sub === "restore")) return true;
        return THEME_SKIP_CMD_REGEX.test(cleaned);
    }

    // Too powerful for remote/store-and-fire paths: meta commands, secrets,
    // destructive theme ops, and tracking/defacement URLs. Local bar authoring
    // stays unrestricted — this gates the relay ingress (sync.js) only.
    const SENSITIVE_CMD_REGEX = /^(?:tui\s+(?:bind|unbind|actions|restore)\b|jam\b|tui\s+-(?:pin-token|pin-board|pin-feed|pin-refresh)\b|tui\s+-t\b|tui\s+-wp\b|tui\s+-posters\s+(?:add|clear)\b)/i;

    function isSensitiveCommand(cmd) {
        return SENSITIVE_CMD_REGEX.test(stripCommandPrefix(cmd).trim());
    }

    function eventToKeyCombo(e) {
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
    function handleKeybindKeydown(e) {
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
            (activeEl.tagName === "INPUT" && activeEl.type !== "button")
        );
        if (isTypingField && !hasModifier) return;

        e.preventDefault();
        e.stopPropagation();
        execute(cmd);
    }

    let bars = [];
    let raf = 0;

    function paint() {
        raf = 0;
        const c = document.getElementById("spotui-visualizer");
        if (!c || !app.visualizerOpen) return;
        const ctx = c.getContext("2d");
        const w = c.clientWidth;
        const h = c.clientHeight;
        if (c.width !== w) c.width = w;
        if (c.height !== h) c.height = h;
        ctx.clearRect(0, 0, w, h);
        const n = bars.length;
        if (!n || !w || !h) return;
        const gap = 2;
        const bw = Math.max(1, (w - gap * n) / n);
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--visualizer-color").trim() || "#ff8c42";
        for (let i = 0; i < n; i++) {
            const bh = bars[i] * h;
            if (bh > 0) ctx.fillRect(i * (bw + gap), h - bh, bw, bh);
        }
    }

    function setVisualizerBars(next) {
        bars = next || [];
        if (app.visualizerOpen && !raf) raf = requestAnimationFrame(paint);
    }

    function handleVisualizerCommand(arg, silent) {
        const mode = String(arg || "").trim().toLowerCase();
        const on = () => {
            if (!app.sposyncConnected) {
                if (silent) return;
                const popup = showRestartPopup("");
                const accent = getSpotuiAccentColor();
                popup.style.border = `1px solid ${accent}`;
                popup.style.color = accent;
                popup.style.maxWidth = "420px";
                popup.style.lineHeight = "1.45";
                popup.style.display = "flex";
                popup.style.flexDirection = "column";
                popup.style.gap = "12px";
                popup.innerHTML = `<div>Unable to enable visualizer because you do not have SpoSync.<br><br>SpoSync lets SpoTUI fetch live audio data and gives you the full TUI experience.<br><br>Download it from:<br>GitHub: <a href="https://github.com/SkenSMasteR/SpoTUI" target="_blank" rel="noopener" style="color:inherit">https://github.com/SkenSMasteR/SpoTUI</a><br>Discord: <a href="${DISCORD_INVITE_URL}" target="_blank" rel="noopener" style="color:inherit">${DISCORD_INVITE_URL}</a></div>`;
                popup.appendChild(createButton("", "spotui-control-btn", "OK", () => popup.remove()));
                return;
            }
            app.visualizerOpen = true;
            storageSet(VISUALIZER_STORAGE_KEY, "1");
            document.body.classList.add("spotui-visualizer-on");
            setVisualizerBars(bars);
        };
        const off = () => {
            app.visualizerOpen = false;
            storageSet(VISUALIZER_STORAGE_KEY, "0");
            document.body.classList.remove("spotui-visualizer-on");
        };
        if (mode === "on" || mode === "open") { if (!app.visualizerOpen) on(); return; }
        if (mode === "off" || mode === "close") { off(); return; }
        if (mode && mode !== "toggle") return;
        if (app.visualizerOpen) off();
        else on();
    }

    function restoreVisualizer() {
        if (storageGet(VISUALIZER_STORAGE_KEY) === "1") handleVisualizerCommand("on", true);
    }

    const PLAYLIST_SONGS_FETCH_DELAY = 150;

    function scheduleSongsFetchForSelectedPlaylist() {
        if (app.playlistSongsFetchTimer) clearTimeout(app.playlistSongsFetchTimer);
        app.playlistSongsFetchTimer = setTimeout(() => {
            app.playlistSongsFetchTimer = null;
            fetchSongsForSelectedPlaylist();
        }, PLAYLIST_SONGS_FETCH_DELAY);
    }

    function getLikedSongsUri() {
        try {
            const internalUri = Spicetify.Platform?.LibraryAPI?._likedSongsUri;
            if (internalUri) return internalUri;
            const username = Spicetify.Platform?.LocalStorageAPI?.namespace;
            if (!username) return "";
            return `spotify:user:${username}:collection`;
        } catch (e) {
            return "";
        }
    }

    async function fetchSongsForSelectedPlaylist() {
        const token = ++app.playlistSongsFetchToken;
        cancelSongScrollAnim();
        const selectedPlaylistEntry = app.playlists[app.selectedPlaylist];
        const selectedPlaylistUri = selectedPlaylistEntry?.isLikedSongs
            ? getLikedSongsUri()
            : selectedPlaylistEntry?.uri;
        let songs = [];

        if (selectedPlaylistUri) {
            try {
                const res = await Spicetify.Platform.PlaylistAPI.getContents(selectedPlaylistUri);
                songs = (res.items || [])
                    .filter(item => item && item.uri && item.isPlayable !== false)
                    .map((item, index) => normalizeTrackItem(item, index));
            } catch (err) {
                songs = [{ name: "Error loading songs", artist: "" }];
            }
        }

        if (token !== app.playlistSongsFetchToken) return;
        if (!app.playlistPanelOpen) return;

        app.playlistSongs = songs;
        app.playlistSongsDefault = songs.slice();
        app.playlistSongsTotal = songs.length;
        // The new list can be shorter: clamp before any songs[selectedSong] use.
        if (app.selectedSong < 0 || app.selectedSong >= songs.length) app.selectedSong = 0;
        renderSongListVirtual();
        if (app.activePane === "song") scrollSongIntoView(app.selectedSong, false);
    }

    async function renderPlaylistPanel() {
        const playlistList = document.getElementById("spotui-playlist-list");
        const songList = document.getElementById("spotui-song-list");
        if (!playlistList || !songList) return;

        renderPlaylistListVirtual();

        if (app.playlistSongsFetchTimer) {
            clearTimeout(app.playlistSongsFetchTimer);
            app.playlistSongsFetchTimer = null;
        }
        await fetchSongsForSelectedPlaylist();

        scrollSelectedIntoView();
    }

    // Virtual scrolling constants for performance with large playlists
    const SONG_ROW_HEIGHT = 26; // px
    const PLAYLIST_ROW_HEIGHT = 26; // px
    const PLAYLIST_SORT_OPTS = ["Default", "Alphabetical", "Z-A"];

    function renderPlaylistSortMenu() {
        const el = document.getElementById("spotui-playlist-sort");
        if (!el) return;
        el.hidden = !app.playlistSortOpen;
        el.classList.toggle("songs", app.activePane === "song");
        if (!app.playlistSortOpen) return;
        el.innerHTML = PLAYLIST_SORT_OPTS.map((label, i) => `<div class="playlist-item${i === app.playlistSortIndex ? " selected" : ""}">${label}</div>`).join("");
    }

    function closePlaylistFind() {
        app.playlistFindOpen = false;
        app.playlistFindQuery = "";
        const el = document.getElementById("spotui-playlist-find");
        if (el) { el.hidden = true; el.value = ""; el.blur(); }
    }

    function applyPlaylistFind() {
        const q = app.playlistFindQuery.trim().toLowerCase();
        const source = app.playlistFindSource || [];
        const filtered = q ? source.filter((item) => (item.name || "").toLowerCase().includes(q) || (item.artist || "").toLowerCase().includes(q)) : source.slice();
        if (app.activePane === "song") {
            app.playlistSongs = filtered;
            app.playlistSongsTotal = filtered.length;
            app.selectedSong = 0;
            renderSongListVirtual();
            scrollSongIntoView(0, false);
        } else {
            app.playlists = filtered;
            app.selectedPlaylist = 0;
            renderPlaylistListVirtual();
            scrollPlaylistIntoView(0, false);
            if (!app.add2listPanelOpen) scheduleSongsFetchForSelectedPlaylist();
        }
    }

    function openPlaylistFind() {
        closePlaylistFind();
        app.playlistFindOpen = true;
        app.playlistFindQuery = "";
        app.playlistFindSource = app.activePane === "song" ? (app.playlistSongs || []).slice() : (app.playlists || []).slice();
        const el = document.getElementById("spotui-playlist-find");
        if (!el) return;
        el.hidden = false;
        el.classList.toggle("songs", app.activePane === "song");
        el.value = "";
        el.focus();
        if (!el.dataset.bound) {
            el.dataset.bound = "1";
            el.addEventListener("input", () => {
                app.playlistFindQuery = el.value;
                applyPlaylistFind();
            });
            el.addEventListener("keydown", (e) => {
                if (e.key === "Escape" || e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    closePlaylistFind();
                }
            });
        }
    }


    function ensurePlaylistListScaffold() {
        const id = app.add2listPanelOpen ? "spotui-add2list-list" : "spotui-playlist-list";
        const container = document.getElementById(id);
        if (!container || document.getElementById(id + "-spacer")) return;
        container.innerHTML = '<legend>Playlists</legend><div id="' + id + '-spacer" style="position:relative;"><div id="' + id + '-viewport" style="position:absolute;top:0;left:0;right:0;"></div></div>';
        container.addEventListener("scroll", () => {
            if (app.playlistListScrollRaf) return;
            app.playlistListScrollRaf = requestAnimationFrame(() => {
                app.playlistListScrollRaf = null;
                renderPlaylistListVirtual();
            });
        });
    }

    // Render visible playlist items using virtual scrolling
    function renderPlaylistListVirtual() {
        const id = app.add2listPanelOpen ? "spotui-add2list-list" : "spotui-playlist-list";
        const container = document.getElementById(id);
        if (!container) return;
        ensurePlaylistListScaffold();
        const spacer = document.getElementById(id + "-spacer");
        const viewport = document.getElementById(id + "-viewport");
        if (!spacer || !viewport) return;

        const total = app.playlists.length;
        spacer.style.height = `${total * PLAYLIST_ROW_HEIGHT}px`;

        const scrollTop = container.scrollTop;
        const viewHeight = container.clientHeight || 400;
        const buffer = 10;
        const startIdx = Math.max(0, Math.floor(scrollTop / PLAYLIST_ROW_HEIGHT) - buffer);
        const endIdx = Math.min(total, Math.ceil((scrollTop + viewHeight) / PLAYLIST_ROW_HEIGHT) + buffer);

        const needed = Math.max(0, endIdx - startIdx);
        while (viewport.childNodes.length > needed) viewport.removeChild(viewport.lastChild);
        while (viewport.childNodes.length < needed) viewport.appendChild(document.createElement("div"));
        viewport.style.transform = `translateY(${startIdx * PLAYLIST_ROW_HEIGHT}px)`;
        for (let i = 0; i < needed; i++) {
            const idx = startIdx + i;
            const p = app.playlists[idx];
            const item = viewport.childNodes[i];
            const className = "playlist-item" + (idx === app.selectedPlaylist && (app.activePane === "playlist" || app.add2listPanelOpen) ? " selected" : "");
            const text = p.name;
            if (item.className !== className) item.className = className;
            if (item.textContent !== text) item.textContent = text;
        }
    }

    function scrollPlaylistIntoView(idx, smooth = true) {
        const container = document.getElementById(app.add2listPanelOpen ? "spotui-add2list-list" : "spotui-playlist-list");
        if (!container) return;
        const itemTop = idx * PLAYLIST_ROW_HEIGHT;
        const itemCenter = itemTop + PLAYLIST_ROW_HEIGHT / 2;
        const targetScrollTop = itemCenter - container.clientHeight / 2;
        container.scrollTo({
            top: targetScrollTop,
            behavior: smooth ? "smooth" : "auto",
        });
    }


    function ensureSongListScaffold() {
        const container = document.getElementById("spotui-song-list");
        if (!container || document.getElementById("spotui-song-list-spacer")) return;
        container.innerHTML = '<legend>Songs</legend><div id="spotui-song-list-spacer" style="position:relative;"><div id="spotui-song-list-viewport" style="position:absolute;top:0;left:0;right:0;"></div></div>';
        container.addEventListener("scroll", () => {
            if (app.songListScrollRaf) return;
            app.songListScrollRaf = requestAnimationFrame(() => {
                app.songListScrollRaf = null;
                renderSongListVirtual();
            });
        });
    }

    // Render visible song items with virtual scrolling
    function renderSongListVirtual() {
        const container = document.getElementById("spotui-song-list");
        if (!container) return;
        ensureSongListScaffold();
        const spacer = document.getElementById("spotui-song-list-spacer");
        const viewport = document.getElementById("spotui-song-list-viewport");
        if (!spacer || !viewport) return;

        const total = app.playlistSongs.length;
        spacer.style.height = `${total * SONG_ROW_HEIGHT}px`;

        const scrollTop = container.scrollTop;
        const viewHeight = container.clientHeight || 400;
        const buffer = 10;
        const startIdx = Math.max(0, Math.floor(scrollTop / SONG_ROW_HEIGHT) - buffer);
        const endIdx = Math.min(total, Math.ceil((scrollTop + viewHeight) / SONG_ROW_HEIGHT) + buffer);

        const needed = Math.max(0, endIdx - startIdx);
        while (viewport.childNodes.length > needed) viewport.removeChild(viewport.lastChild);
        while (viewport.childNodes.length < needed) viewport.appendChild(document.createElement("div"));
        viewport.style.transform = `translateY(${startIdx * SONG_ROW_HEIGHT}px)`;
        for (let i = 0; i < needed; i++) {
            const idx = startIdx + i;
            const s = app.playlistSongs[idx];
            const item = viewport.childNodes[i];
            const className = "song-item" + (idx === app.selectedSong && app.activePane === "song" ? " selected" : "");
            const text = `${s.name} - ${s.artist}`;
            if (item.className !== className) item.className = className;
            if (item.textContent !== text) item.textContent = text;
        }
    }

    function scrollSongIntoView(idx, smooth = true) {
        const container = document.getElementById("spotui-song-list");
        if (!container) return;
        const itemTop = idx * SONG_ROW_HEIGHT;
        const itemCenter = itemTop + SONG_ROW_HEIGHT / 2;
        const targetScrollTop = itemCenter - container.clientHeight / 2;
        container.scrollTo({
            top: targetScrollTop,
            behavior: smooth ? "smooth" : "auto",
        });
    }

    function cancelSongScrollAnim() {
        if (app.songScrollAnimRaf) {
            cancelAnimationFrame(app.songScrollAnimRaf);
            app.songScrollAnimRaf = null;
        }
    }

    function animateSongScrollToIndex(targetIdx) {
        cancelSongScrollAnim();
        const container = document.getElementById("spotui-song-list");
        if (!container) return;

        const token = app.playlistSongsFetchToken;
        const total = app.playlistSongs.length;
        if (!total) return;
        const destination = Math.max(0, Math.min(targetIdx, total - 1));
        const viewHeight = container.clientHeight || 400;
        const targetTop = Math.max(0, destination * SONG_ROW_HEIGHT - viewHeight / 2);
        if (Math.abs(targetTop - container.scrollTop) > viewHeight * 3) {
            container.scrollTop = targetTop;
            renderSongListVirtual();
            return;
        }

        const step = () => {
            app.songScrollAnimRaf = null;
            if (!app.playlistPanelOpen || app.activePane !== "song" || token !== app.playlistSongsFetchToken) return;

            const current = container.scrollTop;
            const distance = targetTop - current;
            if (Math.abs(distance) < 1) return;

            const speed = Math.max(36, Math.min(Math.abs(distance) * 0.25, 1800));
            container.scrollTop = current + Math.sign(distance) * Math.min(speed, Math.abs(distance));
            renderSongListVirtual();
            app.songScrollAnimRaf = requestAnimationFrame(step);
        };

        app.songScrollAnimRaf = requestAnimationFrame(step);
    }

    function scrollSelectedIntoView() {
        if (app.activePane === 'playlist') {
            scrollPlaylistIntoView(app.selectedPlaylist);
        } else {
            scrollSongIntoView(app.selectedSong);
        }
    }


    // Update song list after navigation
    function commitSongNav(smooth) {
        renderSongListVirtual();
        scrollSongIntoView(app.selectedSong, smooth);
    }

    // Handle keyboard navigation in playlist panel
    async function handlePlaylistPanelKeydown(e) {
        if (app.playlistSortOpen) {
            if (e.key === "Escape" || e.key === "o" || e.key === "O") {
                e.preventDefault();
                app.playlistSortOpen = false;
                renderPlaylistSortMenu();
                return;
            }
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                const dir = e.key === "ArrowDown" ? 1 : -1;
                app.playlistSortIndex = (app.playlistSortIndex + dir + PLAYLIST_SORT_OPTS.length) % PLAYLIST_SORT_OPTS.length;
                renderPlaylistSortMenu();
                return;
            }
            if (e.key === "Enter") {
                e.preventDefault();
                const sortSongs = app.activePane === "song";
                const list = (sortSongs ? app.playlistSongsDefault || app.playlistSongs : app.playlistsDefault || app.playlists).slice();
                if (app.playlistSortIndex === 1) list.sort((a, b) => a.name.localeCompare(b.name));
                else if (app.playlistSortIndex === 2) list.sort((a, b) => b.name.localeCompare(a.name));
                app.playlistSortOpen = false;
                renderPlaylistSortMenu();
                if (sortSongs) {
                    app.playlistSongs = list;
                    app.playlistSongsTotal = list.length;
                    if (app.selectedSong >= list.length) app.selectedSong = Math.max(0, list.length - 1);
                    renderSongListVirtual();
                    scrollSongIntoView(app.selectedSong, false);
                } else {
                    app.playlists = list;
                    if (app.selectedPlaylist >= list.length) app.selectedPlaylist = Math.max(0, list.length - 1);
                    renderPlaylistListVirtual();
                    scrollPlaylistIntoView(app.selectedPlaylist, false);
                    scheduleSongsFetchForSelectedPlaylist();
                }
                return;
            }
            return;
        }

        if (!app.add2listPanelOpen && !app.playlistFindOpen && (e.key === "o" || e.key === "O") && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            app.playlistSortOpen = true;
            app.playlistSortIndex = 0;
            renderPlaylistSortMenu();
            return;
        }

        if (!app.add2listPanelOpen && !app.playlistFindOpen && (e.key === "s" || e.key === "S") && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            openPlaylistFind();
            return;
        }

        if (e.key === "Escape") {
            e.preventDefault();
            if (app.add2listPanelOpen) closeAdd2listPanel();
            else closePlaylistPanel();
            return;
        }

        const isPlaylist = app.activePane === 'playlist';

        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const dir = e.key === "ArrowUp" ? -1 : 1;

            if (isPlaylist) {
                if (!app.playlists.length) return;
                cancelSongScrollAnim();
                app.selectedPlaylist = (app.selectedPlaylist + dir + app.playlists.length) % app.playlists.length;
                const now = performance.now();
                app.playlistNavFast = e.repeat || now - app.playlistNavLastAt < 160;
                app.playlistNavLastAt = now;

                if (app.navRafPending) return;
                app.navRafPending = true;
                requestAnimationFrame(() => {
                    app.navRafPending = false;
                    renderPlaylistListVirtual();
                    scrollPlaylistIntoView(app.selectedPlaylist, !app.playlistNavFast);
                });

                if (!app.add2listPanelOpen) scheduleSongsFetchForSelectedPlaylist();
                return;
            }

            if (!app.playlistSongs.length) return;

            const navTotal = app.playlistSongsTotal || app.playlistSongs.length;
            const prevSelected = app.selectedSong;
            app.selectedSong = (prevSelected + dir + navTotal) % navTotal;
            const wrapped = (dir === -1 && prevSelected === 0) || (dir === 1 && prevSelected === navTotal - 1);
            const now = performance.now();
            app.playlistNavFast = e.repeat || now - app.playlistNavLastAt < 160;
            app.playlistNavLastAt = now;

            if (app.navRafPending) return;
            app.navRafPending = true;
            requestAnimationFrame(() => {
                app.navRafPending = false;
                cancelSongScrollAnim();
                if (wrapped && !app.playlistNavFast) {
                    renderSongListVirtual();
                    animateSongScrollToIndex(app.selectedSong);
                } else {
                    commitSongNav(!app.playlistNavFast);
                }
            });
            return;
        }

        if (app.add2listPanelOpen) {
            if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                const p = app.playlists[app.selectedPlaylist];
                const uri = Spicetify.Player.data?.item?.uri || Spicetify.Player.data?.track?.uri;
                if (!uri) { jamSay("Nothing playing"); return; }
                if (!p) return;
                try {
                    await Spicetify.Platform.PlaylistAPI.add(p.uri, [uri], { after: "end" });
                    jamSay("Added to " + p.name);
                    closeAdd2listPanel();
                } catch (err) {
                    jamSay("Add error: " + (err.message || err));
                }
            }
            return;
        }

        if (e.key === "ArrowLeft") {
            e.preventDefault();
            app.activePane = 'playlist';
            await renderPlaylistPanel();
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            app.activePane = 'song';
            await renderPlaylistPanel();
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (isPlaylist) {
                const p = app.playlists[app.selectedPlaylist];
                if (p) {
                    Spicetify.Player.playUri(p.uri);
                    dbg("[SpoTUI] playing playlist:", p.name);
                    closePlaylistPanel();
                }
            } else {
                const song = app.playlistSongs[app.selectedSong];
                const context = app.playlists[app.selectedPlaylist];
                if (song && context) {
                    Spicetify.Player.playUri(context.uri, {}, { skipTo: { uri: song.uri } });
                    dbg("[SpoTUI] playing:", song.name, "from", context.name);
                    closePlaylistPanel();
                }
            }
        }
    }

    function getTrackTitle(track, index = 0) {
        const meta = track?.metadata || track?.contextTrack?.metadata || {};
        return track?.name || track?.title || meta.title || meta.name || `Track ${index + 1}`;
    }

    function getTrackArtist(track) {
        const meta = track?.metadata || track?.contextTrack?.metadata || {};
        if (track?.artist) return track.artist;
        if (Array.isArray(track?.artists) && track.artists.length) {
            return track.artists.map((artist) => artist?.name).filter(Boolean).join(", ");
        }
        if (meta.artist_name) return meta.artist_name;
        if (meta["artist_name:1"]) return meta["artist_name:1"];
        return "";
    }

    // Normalize track object to consistent {uri, name, artist} format
    function normalizeTrackItem(track, index = 0) {
        const uri = track?.uri || track?.contextTrack?.uri || "";
        return {
            uri,
            name: getTrackTitle(track, index),
            artist: getTrackArtist(track),
        };
    }

    async function getPlaylists() {
        const rootlist = await Spicetify.Platform.RootlistAPI.getContents();
        const list = [];
        const likedSongsUri = getLikedSongsUri();
        if (likedSongsUri) {
            list.push({ name: "Liked Songs", uri: likedSongsUri, isLikedSongs: true });
        }
        function flatten(items) {
            for (const item of items) {
                if (item.type === "playlist") {
                    list.push({ name: item.name, uri: item.uri });
                } else if (item.type === "folder" && item.items) {
                    flatten(item.items);
                }
            }
        }
        flatten(rootlist.items);
        return list;
    }

    const SEARCH_DEBOUNCE_MS = 250;

    function resolveName(data) {
        const candidates = [
            data.profile?.name,
            data.name,
            data.title,
            data.text,
            data.displayName,
            data.identity?.name,
            data.owner?.name,
        ];
        return candidates.find((value) => typeof value === "string" && value.trim()) || "";
    }

    function toResult(entry) {
        const data = entry?.item?.data ?? entry?.data ?? entry;
        if (!data || !data.uri) return null;
        const name = resolveName(data);
        if (!name) return null;
        return {
            type: data.__typename ?? entry?.item?.__typename ?? "",
            name,
            uri: data.uri,
            raw: data,
        };
    }

    function isAutocompleteEntry(entry, data) {
        const types = [entry?.item?.__typename, data?.__typename, entry?.__typename];
        return types.some((type) => typeof type === "string" && /autocomplete/i.test(type));
    }

    function extractResults(searchV2) {
        const results = [];
        const seen = new Set();
        let autocomplete = "";
        Object.values(searchV2 || {}).forEach((section) => {
            const list = section?.itemsV2 || section?.items;
            if (!Array.isArray(list)) return;
            list.forEach((entry) => {
                const data = entry?.item?.data ?? entry?.data ?? entry;
                const name = resolveName(data);
                if (isAutocompleteEntry(entry, data)) {
                    if (!autocomplete && name) autocomplete = name;
                    return;
                }
                const item = toResult(entry);
                if (!item || seen.has(item.uri)) return;
                seen.add(item.uri);
                results.push(item);
            });
        });
        return { results, autocomplete };
    }

    async function searchSpotify(query, limit = 20) {
        const definitions = Spicetify.GraphQL?.Definitions ?? {};
        const attempts = [];
        if (definitions.searchSuggestions) {
            attempts.push([
                definitions.searchSuggestions,
                {
                    query: query,
                    offset: 0,
                    limit: limit,
                    numberOfTopResults: limit,
                    includeAuthors: true,
                    includeAlbumPreReleases: true,
                    includeEpisodeContentRatingsV2: true,
                },
            ]);
        }
        if (definitions.searchModalResults) {
            attempts.push([
                definitions.searchModalResults,
                {
                    searchTerm: query,
                    offset: 0,
                    limit: limit,
                    numberOfTopResults: limit,
                    includeAudiobooks: true,
                    includeAuthors: true,
                    includePreRelease: true,
                    includeArtistHasConcertsField: false,
                },
            ]);
        }
        for (const [definition, variables] of attempts) {
            try {
                const res = await Spicetify.GraphQL.Request(definition, variables);
                const parsed = extractResults(res?.data?.searchV2);
                if (parsed.results.length || parsed.autocomplete) return parsed;
            } catch (err) {}
        }
        return { results: [], autocomplete: "" };
    }

    function updateSearchBarFocus() {
        const bar = document.getElementById("spotui-search-bar");
        if (bar) bar.classList.toggle("focused", app.searchFocus === "input");
    }

    function scrollSearchSelectedIntoView() {
        const selected = document.querySelector("#spotui-search-results .spotui-search-item.selected");
        if (selected) selected.scrollIntoView({ block: "nearest" });
    }

    function renderSearchResults() {
        const container = document.getElementById("spotui-search-results");
        if (!container) return;
        container.innerHTML = "";
        if (!app.searchResults.length) {
            const empty = document.createElement("div");
            empty.className = "spotui-search-empty";
            empty.textContent = app.searchQuery ? "No results" : "";
            container.appendChild(empty);
            return;
        }
        app.searchResults.forEach((item, idx) => {
            const row = document.createElement("div");
            row.className = "spotui-search-item" + (app.searchFocus === "results" && idx === app.searchSelected ? " selected" : "");
            const type = document.createElement("span");
            type.className = "spotui-search-type";
            type.textContent = item.type || "";
            const name = document.createElement("span");
            name.className = "spotui-search-name";
            name.textContent = item.name || "";
            row.appendChild(type);
            row.appendChild(name);
            row.addEventListener("click", () => playSearchResult(idx));
            container.appendChild(row);
        });
    }

    function renderSearchAutocomplete() {
        const input = document.getElementById("spotui-search-input");
        const ghost = document.getElementById("spotui-search-ghost");
        if (!input || !ghost) return;
        const value = input.value;
        const completion = app.searchAutocomplete || "";
        const matches = completion.length > value.length && completion.toLowerCase().startsWith(value.toLowerCase());
        if (!matches) {
            ghost.hidden = true;
            ghost.textContent = "";
            return;
        }
        ghost.hidden = false;
        ghost.style.left = `${input.offsetLeft}px`;
        ghost.style.top = `${input.offsetTop}px`;
        ghost.style.width = `${input.offsetWidth}px`;
        ghost.style.height = `${input.offsetHeight}px`;
        ghost.innerHTML = "";
        const typed = document.createElement("span");
        typed.style.visibility = "hidden";
        typed.textContent = value;
        const rest = document.createElement("span");
        rest.textContent = completion.slice(value.length);
        ghost.appendChild(typed);
        ghost.appendChild(rest);
    }

    async function runSearch(query) {
        const token = ++app.searchFetchToken;
        const term = query.trim();
        app.searchQuery = term;
        if (!term) {
            app.searchResults = [];
            app.searchSelected = 0;
            app.searchAutocomplete = "";
            renderSearchResults();
            renderSearchAutocomplete();
            return;
        }
        try {
            const { results, autocomplete } = await searchSpotify(term);
            if (token !== app.searchFetchToken) return;
            app.searchResults = results;
            app.searchAutocomplete = autocomplete;
        } catch (err) {
            if (token !== app.searchFetchToken) return;
            app.searchResults = [];
            app.searchAutocomplete = "";
        }
        if (app.searchSelected >= app.searchResults.length) {
            app.searchSelected = Math.max(0, app.searchResults.length - 1);
        }
        renderSearchResults();
        renderSearchAutocomplete();
        scrollSearchSelectedIntoView();
    }

    function scheduleSearch(query) {
        if (app.searchDebounce) clearTimeout(app.searchDebounce);
        app.searchDebounce = setTimeout(() => {
            app.searchDebounce = null;
            runSearch(query);
        }, SEARCH_DEBOUNCE_MS);
    }

    function setSearchFocus(mode) {
        app.searchFocus = mode;
        const input = document.getElementById("spotui-search-input");
        if (mode === "input" && input) input.focus();
        if (mode === "results" && input) input.blur();
        updateSearchBarFocus();
    }

    function playSearchResult(idx) {
        const item = app.searchResults[idx];
        if (!item || !item.uri) return;
        Spicetify.Player.playUri(item.uri);
        closeSearchPanel();
    }

    function initSearchPanel() {
        if (app.searchBound) return;
        const input = document.getElementById("spotui-search-input");
        const bar = document.getElementById("spotui-search-bar");
        if (!input || !bar) return;
        app.searchBound = true;
        if (!document.getElementById("spotui-search-ghost")) {
            const ghost = document.createElement("div");
            ghost.id = "spotui-search-ghost";
            ghost.hidden = true;
            bar.appendChild(ghost);
        }
        bar.addEventListener("click", () => {
            if (app.searchPanelOpen) setSearchFocus("input");
        });
        input.addEventListener("input", (e) => {
            app.searchSelected = 0;
            app.searchAutocomplete = "";
            renderSearchAutocomplete();
            scheduleSearch(e.target.value);
        });
        input.addEventListener("scroll", () => {
            if (app.searchAutocomplete) renderSearchAutocomplete();
        });
    }

    function handleSearchPanelKeydown(e) {
        if (!app.searchPanelOpen) return;
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopImmediatePropagation();
            closeSearchPanel();
            return;
        }
        if (e.key === "Tab") {
            const input = document.getElementById("spotui-search-input");
            const completion = app.searchAutocomplete || "";
            const value = input ? input.value : "";
            const canComplete = input && completion.length > value.length && completion.toLowerCase().startsWith(value.toLowerCase());
            if (!canComplete) return;
            e.preventDefault();
            input.value = completion;
            input.setSelectionRange(completion.length, completion.length);
            app.searchAutocomplete = "";
            renderSearchAutocomplete();
            // Kill the pending debounce: it would re-search the pre-Tab query
            // and overwrite these results when it fires.
            if (app.searchDebounce != null) {
                clearTimeout(app.searchDebounce);
                app.searchDebounce = null;
            }
            runSearch(completion);
            return;
        }
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!app.searchResults.length) return;
            if (app.searchFocus === "input") {
                setSearchFocus("results");
                app.searchSelected = 0;
            } else {
                app.searchSelected = Math.min(app.searchSelected + 1, app.searchResults.length - 1);
            }
            renderSearchResults();
            scrollSearchSelectedIntoView();
            return;
        }
        if (e.key === "ArrowUp") {
            e.preventDefault();
            if (app.searchFocus !== "results") return;
            if (app.searchSelected <= 0) {
                setSearchFocus("input");
            } else {
                app.searchSelected -= 1;
            }
            renderSearchResults();
            scrollSearchSelectedIntoView();
            return;
        }
        if (e.key === "Enter") {
            e.preventDefault();
            if (!app.searchResults.length) return;
            if (app.searchFocus === "input") {
                // Enter on a fresh query plays the top hit instead of nothing.
                app.searchSelected = Math.min(Math.max(0, app.searchSelected), app.searchResults.length - 1);
            }
            playSearchResult(app.searchSelected);
        }
    }

    function closeSearchPanel() {
        const wasOpen = app.searchPanelOpen;
        app.searchPanelOpen = false;
        app.searchAutocomplete = "";
        const ghost = document.getElementById("spotui-search-ghost");
        if (ghost) {
            ghost.hidden = true;
            ghost.textContent = "";
        }
        document.body.classList.remove("spotui-search-panel");
        const panel = document.getElementById("spotui-search-panel");
        if (panel) panel.hidden = true;
        document.removeEventListener("keydown", handleSearchPanelKeydown, true);
        if (app.searchDebounce) {
            clearTimeout(app.searchDebounce);
            app.searchDebounce = null;
        }
        const input = document.getElementById("spotui-input");
        if (input) input.focus();
        if (wasOpen) emitPaneClose("search");
    }

    function openSearchPanel(query = "") {
        app.searchPanelOpen = true;
        app.searchResults = [];
        app.searchSelected = 0;
        app.searchAutocomplete = "";
        app.searchFetchToken += 1;
        // A debounce from a prior instance must not fire into the fresh panel.
        if (app.searchDebounce != null) {
            clearTimeout(app.searchDebounce);
            app.searchDebounce = null;
        }
        document.body.classList.add("spotui-search-panel");
        const panel = document.getElementById("spotui-search-panel");
        if (panel) panel.hidden = false;
        const input = document.getElementById("spotui-search-input");
        if (input) {
            input.value = query;
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        }
        setSearchFocus("input");
        document.addEventListener("keydown", handleSearchPanelKeydown, true);
        runSearch(query);
    }

    // Check if URL points to video file
    function isVideoWallpaperUrl(url) {
        try {
            const clean = String(url).split("?")[0].split("#")[0];
            return /\.(mp4|webm)$/i.test(clean);
        } catch (e) {
            return false;
        }
    }

    function dbgState(tag, wp, url) {
        try {
            dbg(`[SpoTUI-dbg] ${tag}`, {
                url,
                tag: wp && wp.tagName,
                src: wp && (wp.currentSrc || wp.src || wp.style.backgroundImage),
                networkState: wp && wp.networkState,
                readyState: wp && wp.readyState,
                videoSize: wp && wp.tagName === "VIDEO" ? `${wp.videoWidth}x${wp.videoHeight}` : "n/a",
                error: wp && wp.error ? { code: wp.error.code, message: wp.error.message } : null,
                canPlayWebm: document.createElement("video").canPlayType('video/webm; codecs="vp9, opus"'),
                canPlayMp4: document.createElement("video").canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"'),
            });
        } catch (e) {}
    }

    function explainFailure(url, wp) {
        const u = String(url);
        const hints = [];
        if (/^[A-Za-z]:\\/.test(u) || u.includes("\\")) hints.push("Windows path with backslashes will NOT load. Use a file:///D:/path/file.webm URL with forward slashes, or better a same-origin https://xpui.app.spotify.com/videos/<file>.webm URL.");
        if (/\s/.test(u) && !/%20/.test(u)) hints.push("URL contains raw spaces. Encode as %20 or rename file to dashes.");
        if (/^file:\/\//i.test(u)) hints.push("file:// is often blocked by Spotify (Not allowed to load local resource). Prefer an https:// link or a same-origin https://xpui.app.spotify.com/videos/<file>.webm URL.");
        if (/^http:\/\/(?!localhost|127\.0\.0\.1)/i.test(u)) hints.push("http:// (non-localhost) from Spotify's https:// origin is mixed-content and gets blocked. Use https:// URLs.");
        if (/\.mp4$/i.test(u.split("?")[0].split("#")[0])) hints.push(".mp4/H.264 is blocked in some Spotify builds. .webm/VP9 (like shimmer.webm) always works.");
        if (wp && wp.error) {
            const codes = { 1: "MEDIA_ERR_ABORTED", 2: "MEDIA_ERR_NETWORK (404/CORS/blocked)", 3: "MEDIA_ERR_DECODE (bad codec)", 4: "MEDIA_ERR_SRC_NOT_SUPPORTED (codec/URL blocked)" };
            hints.push(`MediaError ${wp.error.code} = ${codes[wp.error.code] || "unknown"}.`);
        }
        if (wp && wp.tagName === "VIDEO" && !wp.videoWidth) hints.push("No video frames decoded yet. If networkState=3 and readyState=0 after 4s, the src never loaded (blocked/404).");
        console.warn("[SpoTUI-dbg] likely cause(s):\n - " + (hints.length ? hints.join("\n - ") : "unknown, see state dump above."));
    }

    // Set background wallpaper (image or video) — debug instrumented.
    // opts: { fit: cover|contain|fill|none, pos: css position, rich: 0-200 }.
    function setWallpaper(url, opacity, save = true, opts = {}) {
        dbg("[SpoTUI-dbg] setWallpaper called:", { url, opacity, save, ...opts });
        let tui = document.getElementById("spotui-tui");
        if (!tui) {
            console.warn("[SpoTUI-dbg] abort: #spotui-tui not found yet (Spotify still loading). Retry the command in a few seconds.");
            return;
        }

        const clean = String(url).split("?")[0].split("#")[0];
        const isVideo = isVideoWallpaperUrl(url);
        dbg("[SpoTUI-dbg] detect:", { clean, isVideo });
        if (!isVideo && /\.(mp4|webm)/i.test(String(url))) {
            console.warn("[SpoTUI-dbg] URL has video extension but with ?# suffix confusing detection. Clean:", clean);
        }
        if (/^[A-Za-z]:\\/.test(String(url))) {
            console.warn('[SpoTUI-dbg] Got a raw Windows path (C:\\...). The <video> src needs a URL — use file:///D:/path/file.webm (forward slashes) or an https:// link.');
        }

        let wp = document.getElementById("spotui-wallpaper");

        if (wp && ((isVideo && wp.tagName !== "VIDEO") || (!isVideo && wp.tagName === "VIDEO"))) {
            dbg(`[SpoTUI-dbg] swapping element ${wp.tagName} -> ${isVideo ? "VIDEO" : "DIV"}`);
            wp.remove();
            wp = null;
        }

        if (!wp) {
            wp = document.createElement(isVideo ? "video" : "div");
            wp.id = "spotui-wallpaper";
            wp.style.position = "absolute";
            wp.style.top = "0";
            wp.style.left = "0";
            wp.style.width = "100%";
            wp.style.height = "100%";
            wp.style.zIndex = "-1";
            if (isVideo) {
                wp.muted = true;
                wp.autoplay = true;
                wp.loop = true;
                wp.playsInline = true;
                wp.controls = false;
                wp.referrerPolicy = "no-referrer";
                wp.setAttribute("muted", "");
                wp.setAttribute("autoplay", "");
                wp.setAttribute("loop", "");
                wp.setAttribute("playsinline", "");
                wp.setAttribute("referrerpolicy", "no-referrer");
                ["loadstart", "loadedmetadata", "loadeddata", "canplay", "canplaythrough", "playing", "waiting", "stalled", "suspend", "abort", "emptied"].forEach((ev) =>
                    wp.addEventListener(ev, () => dbgState("video event: " + ev, wp, url))
                );
            }
            tui.prepend(wp);
            dbg(`[SpoTUI-dbg] created <${wp.tagName} id=spotui-wallpaper>`);
        } else {
            dbg("[SpoTUI-dbg] reusing existing element:", wp.tagName);
        }

        // Fit / position / richness — applied on create AND reuse so changes take
        // effect without clearing first. rich 100 = default lift, 0 = filter off.
        const fit = ["cover", "contain", "fill", "none"].includes(String(opts.fit || "").toLowerCase())
            ? String(opts.fit).toLowerCase() : "cover";
        const posWords = String(opts.pos || "center").toLowerCase().split(/\s+/).filter(Boolean);
        const posOk = posWords.length >= 1 && posWords.length <= 2 &&
            posWords.every((w) => ["center", "top", "bottom", "left", "right"].includes(w));
        const pos = posOk ? posWords.join(" ") : "center";
        if (!posOk && opts.pos) console.warn('[SpoTUI-dbg] bad -pos, use e.g. center, top, "top left". Got:', opts.pos);
        let rich = parseInt(opts.rich ?? "100", 10);
        if (isNaN(rich)) rich = 100;
        rich = Math.max(0, Math.min(200, rich));
        const r = rich / 100;
        wp.style.objectFit = fit;
        wp.style.objectPosition = pos;
        wp.style.backgroundSize = fit === "fill" ? "100% 100%" : fit;
        wp.style.backgroundPosition = pos;
        const richFilter = rich === 0 ? "" : `saturate(${(1 + 0.1 * r).toFixed(3)}) contrast(${(1 + 0.04 * r).toFixed(3)})`;
        wp.style.filter = richFilter;
        dbg("[SpoTUI-dbg] applied:", { fit, pos, rich });

        if (isVideo) {
            if (wp.getAttribute("src") !== url) {
                dbg("[SpoTUI-dbg] setting video src:", url);
                wp.src = url;
                wp.onerror = () => {
                    console.error("[SpoTUI-dbg] wallpaper video FAILED:", url);
                    dbgState("onerror", wp, url);
                    explainFailure(url, wp);
                };
            } else {
                dbg("[SpoTUI-dbg] src unchanged, re-playing");
            }
            dbgState("before play()", wp, url);
            wp.muted = true;
            const playPromise = wp.play();
            if (playPromise && playPromise.catch) {
                playPromise.catch((err) => {
                    console.error("[SpoTUI-dbg] play() rejected:", err && err.name, err && err.message);
                    dbgState("play rejected", wp, url);
                });
            }
            setTimeout(() => {
                dbgState("4s health-check", wp, url);
                if (wp.readyState < 2 || !wp.videoWidth) explainFailure(url, wp);
                else dbg("[SpoTUI-dbg] OK: video is rendering.");
            }, 4000);
        } else {
            dbg("[SpoTUI-dbg] setting image background:", url);
            wp.style.backgroundImage = `url("${url}")`;
            const probe = new Image();
            probe.onload = () => dbg("[SpoTUI-dbg] image probe OK:", url);
            probe.onerror = () => console.error("[SpoTUI-dbg] image probe FAILED (404/blocked/CORS):", url);
            probe.src = url;
        }
        wp.style.opacity = opacity;
        tui.style.backgroundColor = "transparent";
        // Content stays above the wallpaper via the #spotui-tui > * rule in
        // styles.js (covers late-created nodes too); posters re-assert below.
        try { reassertPosterLayer(); } catch (e) {}
        if (save) {
            storageSet(WP_URL_KEY, url);
            storageSet(WP_OPACITY_KEY, opacity);
            storageSet(WP_FIT_KEY, fit);
            storageSet(WP_POS_KEY, pos);
            storageSet(WP_RICH_KEY, String(rich));
            dbg("[SpoTUI-dbg] saved to storage. Clear anytime with: tui -wp off");
        }
    }

    // Local theme snapshots: everything a Spotify restart preserves, saved
    // under one name — except personal config (history, keybinds, actions),
    // which is yours, not a look. storage.js has no key enumeration, so this
    // module touches localStorage directly (guarded) for the snapshot/restore
    // loops only.
    const SAVES_KEY = "spotui:theme-saves";

    // Cap: every save duplicates the whole poster library + layout, so the blob
    // would otherwise grow without bound (and readSaves re-parses all of it).
    const MAX_SAVES = 100;

    // Parsed-blob memo: menus call savedThemeDetails() per keypress, so cache
    // until the next local mutation (save/delete are the only writers).
    let savesCache = null;

    // Personal config, not a look: never snapshotted, never wiped, and never
    // restored over live values (old snapshots may still carry these keys).
    const PERSONAL_KEYS = new Set([HISTORY_KEY, KEYBIND_STORAGE_KEY, ACTIONS_STORAGE_KEY]);

    // App state, not a look either: applying an old snapshot must never delete
    // these (wiping launched re-triggers onboarding, wiping the banner flag
    // resurrects a dismissed banner).
    const NEVER_WIPE_KEYS = new Set([LAUNCHED_KEY, UPDATE_BANNER_KEY]);

    function readSaves() {
        if (savesCache) return savesCache;
        try {
            const raw = storageGet(SAVES_KEY);
            const obj = raw ? JSON.parse(raw) : {};
            savesCache = obj && typeof obj === "object" ? obj : {};
        } catch (e) {
            savesCache = {};
            backupCorruptSaves();
        }
        return savesCache;
    }

    // A corrupt blob must never silently evaporate on next save: stash the raw
    // value once (single bounded backup key) so nothing is lost.
    let savesCorruptNote = false;

    function backupCorruptSaves() {
        try {
            const raw = storageGet(SAVES_KEY);
            if (!raw || storageGet(SAVES_KEY + ".corrupt")) return;
            if (storageSet(SAVES_KEY + ".corrupt", raw)) {
                savesCorruptNote = true;
            }
            console.error("[SpoTUI] saved themes unreadable — raw blob backed up, starting fresh.");
        } catch (e) {}
    }

    // External mutations bypass readSaves writers (e.g. tui restore wiping
    // storage): callers must invalidate so menus never show ghost themes.
    function invalidateSavesCache() {
        savesCache = null;
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
        applyLyricLineSpacing();
        applyVisualizerColor();
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

    function saveTheme(name) {
        const n = String(name || "").trim();
        if (!n) {
            console.warn("[SpoTUI] usage: tui -t save <name>  (quote multi-word names, e.g. tui -t save cozy or tui -t save \"my theme\")");
            return;
        }
        const saves = readSaves();
        const existed = !!saves[n];
        const settings = snapshotSettings();
        saves[n] = { savedAt: Date.now(), settings };
        // Evict oldest snapshots past the cap (never the one just saved).
        const names = Object.keys(saves).filter((k) => k !== n)
            .sort((a, b) => ((saves[a] && saves[a].savedAt) || 0) - ((saves[b] && saves[b].savedAt) || 0));
        let evicted = null;
        while (Object.keys(saves).length > MAX_SAVES && names.length) {
            evicted = names.shift();
            delete saves[evicted];
        }
        if (!storageSet(SAVES_KEY, JSON.stringify(saves))) {
            invalidateSavesCache();
            pinToast(`theme save failed: storage full (delete a theme or clear posters)`);
            console.error("[SpoTUI] theme save failed: storage write failed for", n);
            return;
        }
        invalidateSavesCache();
        const corruptNote = savesCorruptNote ? `\n(previous library was corrupt — backed up, starting fresh)` : "";
        savesCorruptNote = false;
        pinToast(`${existed ? "theme updated" : "theme saved"}: ${n}\n${describeSnapshot(settings)}${evicted ? `\n(oldest snapshot ${evicted} evicted, cap ${MAX_SAVES})` : ""}${corruptNote}`);
        dbg("[SpoTUI] theme saved:", n);
    }

    function listThemes() {
        // Non-empty case opens the menu (see commands); this stays as the
        // empty-library hint.
        pinToast("no saved themes — save one with: tui -t save <name>");
        dbg("[SpoTUI] saved themes: none");
    }

    function savedThemeNames() {
        return Object.keys(readSaves());
    }

    function savedThemeDetails() {
        const saves = readSaves();
        return Object.keys(saves).map((n) => ({ name: n, savedAt: (saves[n] && saves[n].savedAt) || 0 }));
    }

    function deleteTheme(name) {
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
        invalidateSavesCache();
        pinToast(`theme deleted: ${n}`);
        dbg("[SpoTUI] theme deleted:", n);
    }

    function applyTheme(name) {
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
                if (k && k.startsWith("spotui:") && k !== SAVES_KEY && !PERSONAL_KEYS.has(k) && !NEVER_WIPE_KEYS.has(k) && !keep.has(k)) localStorage.removeItem(k);
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

    // Persistent command history (unix-style): what the user typed survives
    // Spotify restarts in localStorage; Ctrl+R reverse-searches it from the
    // command bar. Only interactive bar input is recorded — commands fired by
    // keybinds, theme cards, or actions never land here (bash parity).
    // Secrets never persist: pin tokens and jam join lines stay session-only.

    // Commands matching this are kept out of persisted history (a PIN grants
    // jam guests volume/lyrics control while the jam lives; a pin subcommand
    // may carry the API token inline as its second positional arg).
    const HISTORY_SKIP_REGEX = /^\s*tui\s+-(pin-token|pin-board|pin-feed|pin-refresh)\b|^\s*jam\s+join\b/i;

    function sanitizeHistory(raw) {
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

    function loadHistory() {
        return sanitizeHistory(readJsonArray(HISTORY_KEY));
    }

    // Lazy load for arrows / reverse search: browse storage even if the
    // session list started empty (missed boot load, restore, wipe).
    function ensureHistoryLoaded() {
        if (!app.commandHistory.length) app.commandHistory = loadHistory();
    }

    // Session list (arrows + Ctrl+R source) always takes the command; the
    // persisted list only takes valid ones — typos stay memory-only.
    // opts.persist === false records session-only.
    let historyFullWarned = false;

    function pushHistory(cmd, opts = {}) {
        const t = String(cmd || "").trim().slice(0, HISTORY_ENTRY_MAX);
        if (!t || HISTORY_SKIP_REGEX.test(t)) return false;
        app.commandHistory = [t, ...app.commandHistory.filter((e) => e !== t)].slice(0, HISTORY_LIMIT);
        app.commandHistoryIndex = -1;
        if (opts.persist === false) return true;
        const stored = sanitizeHistory(readJsonArray(HISTORY_KEY));
        if (!storageSet(HISTORY_KEY, JSON.stringify([t, ...stored.filter((e) => e !== t)].slice(0, HISTORY_LIMIT)))) {
            console.error("[SpoTUI] history persist failed: storage full (session-only from here)");
            if (!historyFullWarned) {
                historyFullWarned = true;
                pinToast("history not saving: storage full (session-only)");
            }
        }
        return true;
    }

    // Newest-first matches for the reverse search: empty query matches the
    // whole history (bash shows the last command on bare Ctrl+R); otherwise a
    // case-insensitive substring filter.
    function searchHistory(query) {
        const q = String(query || "").toLowerCase();
        if (!q) return [...app.commandHistory];
        return app.commandHistory.filter((e) => e.toLowerCase().includes(q));
    }

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

    // Newest-first history matches, then static matches not already listed.
    // Empty or exact input suggests nothing (quiet bar).
    function getSuggestions(input, historyList) {
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
    function suggestFor(input) {
        return getSuggestions(input, app.commandHistory);
    }

    // Inline unix-style reverse search over persisted command history.
    // While active the prompt shows `(reverse-i-search)`query': ` and the bar
    // shows the current match: typing filters, Ctrl+R cycles older matches,
    // Enter accepts into the bar (no execute), Esc/Ctrl+C aborts, arrows leave
    // search mode and fall back to normal history browsing.
    function searchPromptEl(input) {
        try {
            return (input.parentElement && input.parentElement.querySelector(".prompt")) || null;
        } catch (e) { return null; }
    }

    function renderHistorySearch(input) {
        const s = app.historySearch;
        if (!s) return;
        const prompt = searchPromptEl(input);
        if (prompt) {
            if (s.savedPrompt === undefined) s.savedPrompt = prompt.textContent;
            prompt.textContent = `(reverse-i-search)\`${s.query}': `;
        }
        input.value = s.matches.length ? (s.matches[s.matchIdx] || "") : "";
    }

    function enterHistorySearch(input) {
        // Lazy load: whatever the boot path left behind, search sees storage.
        ensureHistoryLoaded();
        app.historySearch = {
            query: "",
            matches: searchHistory(""),
            matchIdx: 0,
            savedBar: input.value,
            savedPrompt: undefined,
        };
        renderHistorySearch(input);
    }

    function exitHistorySearch(input, restoreBar) {
        const s = app.historySearch;
        app.historySearch = null;
        const prompt = searchPromptEl(input);
        if (prompt && s && s.savedPrompt !== undefined) prompt.textContent = s.savedPrompt;
        if (restoreBar && s) input.value = s.savedBar;
        renderCmdGhost(input);
    }

    function updateHistorySearch(input, query) {
        const s = app.historySearch;
        if (!s) return;
        s.query = query;
        s.matches = searchHistory(query);
        s.matchIdx = 0;
        renderHistorySearch(input);
    }

    function cycleHistorySearch(input) {
        const s = app.historySearch;
        if (!s || !s.matches.length) return;
        s.matchIdx = (s.matchIdx + 1) % s.matches.length;
        renderHistorySearch(input);
    }

    // Ghost-text fill suggestion over the command bar (search-ghost pattern:
    // hidden typed echo keeps alignment, visible span shows the remainder).
    function cmdGhostEl() {
        try { return document.getElementById("spotui-cmd-ghost"); }
        catch (e) { return null; }
    }

    function renderCmdGhost(input) {
        const ghost = cmdGhostEl();
        if (!ghost) return;
        const value = input.value;
        const matches = (!value || app.historySearch || isInputBlockingPanelOpen())
            ? [] : suggestFor(value);
        const first = matches.length ? matches[0] : "";
        if (!first || first.length <= value.length || !first.toLowerCase().startsWith(value.toLowerCase())) {
            ghost.hidden = true;
            ghost.textContent = "";
            return;
        }
        ghost.hidden = false;
        // Mirror the input's text metrics exactly: same font, spacing, and
        // text origin (offset + padding), otherwise the ghost drifts.
        let padLeft = 0;
        try {
            const cs = getComputedStyle(input);
            ghost.style.font = cs.font;
            ghost.style.letterSpacing = cs.letterSpacing;
            ghost.style.wordSpacing = cs.wordSpacing;
            ghost.style.lineHeight = cs.lineHeight;
            padLeft = parseFloat(cs.paddingLeft) || 0;
        } catch (e) {}
        ghost.style.left = `${input.offsetLeft + padLeft}px`;
        ghost.style.top = `${input.offsetTop}px`;
        ghost.style.width = `${Math.max(0, input.offsetWidth - padLeft)}px`;
        ghost.style.height = `${input.offsetHeight}px`;
        ghost.innerHTML = "";
        const typed = document.createElement("span");
        typed.style.visibility = "hidden";
        typed.textContent = value;
        const rest = document.createElement("span");
        rest.textContent = first.slice(value.length);
        ghost.appendChild(typed);
        ghost.appendChild(rest);
    }

    function clearCmdGhost() {
        const ghost = cmdGhostEl();
        if (ghost) {
            ghost.hidden = true;
            ghost.textContent = "";
        }
        app.cmdSuggest = null;
    }

    // Create main terminal interface (idempotent: a re-evaluated bundle or a
    // late Platform appearing after the retry timer must not duplicate the TUI,
    // its ids, or its document/input listeners).
    function createTerminal() {
        try {
            if (document.getElementById("spotui-tui")) return;
        } catch (e) {}
        const box = document.createElement("div");
        box.id = "spotui-tui";
        box.innerHTML = `
<div id="spotui-logo"></div>
<div id="spotui-top-fade"></div>
<div id="spotui-lyrics" hidden>
<div class="spotui-lyrics-viewport">
<div class="spotui-lyrics-lines"></div>
<div class="spotui-lyrics-fade spotui-lyrics-fade-bottom"></div>
</div>
</div>
<div id="spotui-dj" hidden>
<svg class="spotui-dj-logo" viewBox="-2 -2 20 20" overflow="visible" aria-hidden="true"><path d="M7.813 14.497A6.5 6.5 0 0 1 1.5 8.016c.008-3.553 2.71-5.744 5.043-6.078.85-.121 1.288.037 1.564.246.312.238.553.639.822 1.276q.115.277.239.602c.451 1.167 1.05 2.717 2.505 3.81 1.01.76 1.46 1.529 1.592 2.209.13.679-.037 1.375-.468 2.03-.88 1.34-2.793 2.388-4.844 2.388zm-.037 1.5A8 8 0 1 0 0 8.032c0 4.34 3.464 7.87 7.776 7.965m6.666-7.124c-.358-.788-.979-1.532-1.868-2.2-1.082-.813-1.51-1.9-1.967-3.06a31 31 0 0 0-.296-.736 6.3 6.3 0 0 0-.605-1.151 6.53 6.53 0 0 1 4.39 4.01 6.5 6.5 0 0 1 .346 3.137"/></svg>
</div>
<div id="spotui-playlist-panel" hidden>
    <fieldset id="spotui-playlist-list">
        <legend>Playlists</legend>
    </fieldset>
    <fieldset id="spotui-song-list">
        <legend>Songs</legend>
    </fieldset>
    <div id="spotui-playlist-sort" hidden></div>
    <input id="spotui-playlist-find" hidden autocomplete="off" spellcheck="false" placeholder="search...">
    <button id="spotui-playlist-info" type="button"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/><path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/></svg></button>
    <div id="spotui-playlist-info-popup" hidden>Sort: press <span>o</span> · Search: press <span>s</span></div>
</div>
<div id="spotui-add2list-panel" hidden>
    <fieldset id="spotui-add2list-list">
        <legend>Playlists</legend>
    </fieldset>
</div>
<div id="spotui-help-panel" hidden><fieldset class="spotui-help-fieldset"><legend class="spotui-help-legend">Exit - Esc</legend><div class="spotui-help-content"></div></fieldset></div>
<div id="spotui-about-panel" hidden></div>
<div id="spotui-search-panel" hidden>
    <div id="spotui-search-bar">
        <span class="spotui-search-prompt">></span>
        <input id="spotui-search-input" autocomplete="off" spellcheck="false" placeholder="type to search...">
    </div>
    <div id="spotui-search-results"></div>
</div>
<div id="spotui-theme-panel" hidden></div>
<div id="spotui-boards-panel" hidden><fieldset class="spotui-help-fieldset"><legend class="spotui-help-legend">Boards — Enter — re-pull · Del/D — forget · A — add · Esc</legend><div class="spotui-boards-content"></div></fieldset></div>
<div id="spotui-saves-panel" hidden><fieldset class="spotui-help-fieldset"><legend class="spotui-help-legend">Themes — Enter — apply · Del/D — delete hovered theme · S — save · Esc</legend><div class="spotui-saves-content"></div></fieldset></div>
<div id="spotui-onboarding-panel" hidden></div>
<canvas id="spotui-visualizer"></canvas>
<div id="spotui-footer">
<span class="prompt">></span>
<input id="spotui-input" autofocus autocomplete="off" spellcheck="false" placeholder="type help for a list of commands">
<div id="spotui-cmd-ghost" hidden></div>
</div>
`;
        document.body.appendChild(box);
        initAsciiAnimation();
        initSearchPanel();
        const playlistInfo = document.getElementById("spotui-playlist-info");
        const playlistInfoPopup = document.getElementById("spotui-playlist-info-popup");
        if (playlistInfo && playlistInfoPopup) {
            playlistInfo.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                playlistInfoPopup.hidden = !playlistInfoPopup.hidden;
            });
        }

        const input = document.getElementById("spotui-input");

        // Command history survives restarts (localStorage, capped + deduped).
        app.commandHistory = loadHistory();
        app.commandHistoryIndex = -1;

        // Focus the command input when user starts typing.
        // Read-only panels (help/about) don't steal the bar; panels with their
        // own inputs or key handling (playlist/search/theme/...) keep it.
        document.addEventListener("keydown", (e) => {
            if (document.activeElement === input) return;
            if (isInputBlockingPanelOpen()) return;
            const ae = document.activeElement;
            if (ae && ae !== input && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.tagName === "SELECT" || ae.isContentEditable)) return;
            if (e.ctrlKey || e.altKey || e.metaKey) return;
            if (e.key.length !== 1) return;
            input.focus();
        });

        input.addEventListener("keydown", async (e) => {
            if (isInputBlockingPanelOpen()) {
                // Never trap the bar inside a search that a fresh panel orphaned.
                if (app.historySearch) exitHistorySearch(input, true);
                clearCmdGhost();
                e.stopImmediatePropagation();
                return;
            }
            const isCtrlR = (e.key === "r" || e.key === "R") && e.ctrlKey && !e.altKey && !e.metaKey;
            if (isCtrlR) {
                // Scoped strictly to the composer: anywhere else the keystroke
                // belongs to Spotify (e.g. loop), so never claim it there.
                if (document.activeElement !== input) return;
                // Unix reverse search: first press enters, repeats cycle older.
                e.preventDefault();
                clearCmdGhost();
                if (!app.historySearch) enterHistorySearch(input);
                else cycleHistorySearch(input);
                return;
            }
            if (app.historySearch) {
                if (e.key === "Tab") {
                    // Tab abandons the search instead of moving focus away.
                    e.preventDefault();
                    exitHistorySearch(input, true);
                    app.commandHistoryIndex = -1;
                    renderCmdGhost(input);
                    return;
                }
                if (e.key === "Enter") {
                    // Accept the shown match into the bar; a second Enter runs it.
                    e.preventDefault();
                    exitHistorySearch(input, false);
                    return;
                }
                if (e.key === "Escape" || ((e.key === "c" || e.key === "C") && e.ctrlKey && !e.altKey && !e.metaKey)) {
                    e.preventDefault();
                    exitHistorySearch(input, true);
                    app.commandHistoryIndex = -1;
                    return;
                }
                if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                    // Leave search mode, then browse normal history below.
                    exitHistorySearch(input, true);
                } else if (e.key === "Backspace" && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    e.preventDefault();
                    updateHistorySearch(input, app.historySearch.query.slice(0, -1));
                    return;
                } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    e.preventDefault();
                    updateHistorySearch(input, app.historySearch.query + e.key);
                    return;
                }
            }
            if (e.key === "Tab") {
                // Fill the ghost suggestion; repeat with unchanged text cycles.
                e.preventDefault();
                const cur = input.value;
                const s = app.cmdSuggest;
                if (!s || !s.matches.length || cur !== s.matches[s.idx]) {
                    const matches = suggestFor(cur);
                    app.cmdSuggest = { matches, idx: 0 };
                } else if (s.matches.length > 1) {
                    s.idx = (s.idx + 1) % s.matches.length;
                }
                const pick = app.cmdSuggest.matches[app.cmdSuggest.idx];
                if (pick) input.value = pick;
                renderCmdGhost(input);
                return;
            }
            if (e.key === "Escape") {
                // Leave the composer entirely so Spotify gets its keys back
                // (e.g. Ctrl+R for loop) instead of us.
                input.blur();
                return;
            }
            if ((e.key === "c" || e.key === "C") && e.ctrlKey && !e.altKey && !e.metaKey) {
                // Clear the compose box. A text selection is left alone so
                // copying out of the input keeps working.
                if (input.selectionStart === input.selectionEnd) {
                    e.preventDefault();
                    input.value = "";
                    app.commandHistoryIndex = -1;
                    renderCmdGhost(input);
                }
                return;
            }
            if (e.key === "Enter") {
                const cmd = input.value.trim();
                // Unknown shapes stay session-only (arrows/Ctrl+R this run).
                if (cmd) pushHistory(cmd, { persist: isKnownCommand(cmd) });
                app.commandHistoryIndex = -1;
                clearCmdGhost();
                input.value = "";
                await execute(cmd);
                return;
            }
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                // Same lazy load as the reverse search: arrows browse storage
                // even if the session list started empty.
                ensureHistoryLoaded();
                if (!app.commandHistory.length) return;
                e.preventDefault();
                if (e.key === "ArrowUp") {
                    if (app.commandHistoryIndex < app.commandHistory.length - 1) app.commandHistoryIndex += 1;
                } else if (app.commandHistoryIndex >= 0) {
                    app.commandHistoryIndex -= 1;
                }
                input.value = app.commandHistoryIndex >= 0 ? app.commandHistory[app.commandHistoryIndex] || "" : "";
                renderCmdGhost(input);
                return;
            }
        });

        // Ghost suggestion follows typing; manual edits invalidate cycling.
        input.addEventListener("input", () => {
            app.cmdSuggest = null;
            renderCmdGhost(input);
        });
        input.addEventListener("blur", () => {
            clearCmdGhost();
        });
    }

    // Singleton promise for theme feed

    // Load theme catalog from remote server
    function loadThemeFeed(onLoad, onError) {
        if (window.spotuiThemes && window.spotuiThemes.length) {
            onLoad();
            return;
        }
        if (!app.themesFeedPromise) {
            app.themesFeedPromise = new Promise((resolve, reject) => {
                const script = document.createElement("script");
                script.src = `${THEME_HOST}themes.js?_=${Math.floor(Date.now() / 1000)}`;
                script.onload = () => {
                    try {
                        if (window.spotuiThemes && window.spotuiThemes.length) {
                            resolve();
                        } else {
                            reject(new Error("Theme feed loaded but empty"));
                        }
                    } finally {
                        script.remove();
                    }
                };
                script.onerror = () => {
                    try {
                        reject(new Error("Failed to load themes"));
                    } finally {
                        script.remove();
                    }
                };
                document.body.appendChild(script);
            });
            app.themesFeedPromise.then(
                () => { app.themesFeedPromise = null; },
                () => { app.themesFeedPromise = null; }
            );
        }
        app.themesFeedPromise.then(onLoad, onError);
    }

    function createAddThemeCard(imgUrl) {
        const card = document.createElement("div");
        card.className = "theme-card";
        card.innerHTML = `
        <h3>Add yours</h3>
        <img src="${imgUrl}" alt="Add Theme">
        <button>Add</button>
    `;
        card.querySelector("button").addEventListener("click", () => {
            window.open("https://spotui.root.sx/", "_blank");
        });
        return card;
    }

    function createThemeCard(theme) {
        const card = document.createElement("div");
        card.className = "theme-card";
        const title = document.createElement("h3");
        title.textContent = theme.name || "";
        const img = document.createElement("img");
        img.src = theme.screenshot_url || "";
        img.alt = `${theme.name || ""} screenshot`;
        const btn = document.createElement("button");
        btn.textContent = "Apply";
        btn.dataset.commands = JSON.stringify(theme.commands || []);
        card.appendChild(title);
        card.appendChild(img);
        card.appendChild(btn);
        return card;
    }
    // Apply community theme by name
    function applyThemeByName(themeName, opts = {}) {
        const skipNonTui = Boolean(opts.skipNonTui);
        return new Promise((resolve, reject) => {
            loadThemeFeed(
                async () => {
                    try {
                        resetAllSettings();
                        const themes = window.spotuiThemes || [];
                        const theme = themes.find((t) => t.name === themeName);

                        if (theme && theme.commands) {
                            const pending = [];
                            theme.commands.forEach((cmd, idx) => {
                                const text = String(cmd || "").trim();
                                if (skipNonTui && !text.startsWith("tui")) return;
                                if (isRestrictedThemeCommand(text)) return;
                                pending.push(
                                    new Promise((res, rej) => {
                                        setTimeout(() => {
                                            execute(cmd, { bypassOnboarding: skipNonTui, fromTheme: true }).then(res, rej);
                                        }, idx * 120);
                                    })
                                );
                            });
                            await Promise.all(pending);
                        }
                        resolve(theme || null);
                    } catch (err) {
                        reject(err);
                    }
                },
                () => reject(new Error("Failed to load themes"))
            );
        });
    }

    // Encode theme name for theme ID generation
    function encodeThemeName(name) {
        try {
            return btoa(unescape(encodeURIComponent(String(name || ""))));
        } catch (e) {
            return "";
        }
    }

    function getThemeSelectionList(themes, showAll = false) {
        if (showAll) return themes;

        const curated = themes.filter((theme) => {
            const themeId = String(theme?.id || "");
            const encodedName = encodeThemeName(theme?.name);
            return FIRST_BOOT_THEME_IDS.has(themeId) || FIRST_BOOT_THEME_IDS.has(encodedName);
        });

        if (curated.length) return curated;
        return themes.slice(0, 3);
    }

    const PANE_TARGETS = {
        helpPanelOpen: "help",
        aboutPanelOpen: "about",
        themePanelOpen: "theme",
        boardsPanelOpen: "boards",
        savesPanelOpen: "saves",
    };

    // Global Escape key handler - closes active panels
    function handleGlobalEsc(e) {
        if (e.key !== "Escape") return;
        if (app.onboardingPanelOpen) {
            e.preventDefault();
            return;
        }
        e.preventDefault();
        closeActivePanel();
    }

    // Close all open panels
    function closeActivePanel() {
        if (app.helpPanelOpen) setPanelState("spotui-help-panel", "spotui-help-panel", "helpPanelOpen", false);
        if (app.aboutPanelOpen) setPanelState("spotui-about-panel", "spotui-about-panel", "aboutPanelOpen", false);
        if (app.lyricsPanelOpen) closeLyricsPanel();
        if (app.playlistPanelOpen) closePlaylistPanel();
        if (app.add2listPanelOpen) closeAdd2listPanel();
        if (app.themePanelOpen) closeThemePanel();
        if (app.boardsPanelOpen) closeBoardsPanel();
        if (app.savesPanelOpen) closeSavesPanel();
        if (app.searchPanelOpen) closeSearchPanel();
        if (app.onboardingPanelOpen) closeOnboardingPanel();
        if (app.djPanelOpen) {
            const root = document.getElementById("spotui-dj");
            app.djPanelOpen = false;
            app.djPrevPane = null;
            if (root) {
                root.classList.remove("spotui-dj-active");
                root.hidden = true;
            }
            document.body.classList.remove("spotui-dj-panel");
        }
    }

    // Generic panel state manager
    function setPanelState(panelId, className, openVarName, targetState) {
        const wasOpen = Boolean(app[openVarName]);
        const panels = {
            'helpPanelOpen': () => app.helpPanelOpen = targetState,
            'aboutPanelOpen': () => app.aboutPanelOpen = targetState,
            'themePanelOpen': () => app.themePanelOpen = targetState,
            'boardsPanelOpen': () => app.boardsPanelOpen = targetState,
            'savesPanelOpen': () => app.savesPanelOpen = targetState,
            'onboardingPanelOpen': () => app.onboardingPanelOpen = targetState,
        };
        if (panels[openVarName]) panels[openVarName]();
        document.body.classList.toggle(className, targetState);
        const panel = document.getElementById(panelId);
        if (panel) panel.hidden = !targetState;
        const input = document.getElementById("spotui-input");
        if (input) {
            // Read-only panels leave the command bar live so commands can be
            // sent while reading; interactive panels take focus away.
            if (targetState && (openVarName === "helpPanelOpen" || openVarName === "aboutPanelOpen")) input.focus();
            else if (targetState) input.blur();
            else input.focus();
        }
        if (targetState) document.addEventListener("keydown", handleGlobalEsc);
        else document.removeEventListener("keydown", handleGlobalEsc);
        if (!targetState && wasOpen) emitPaneClose(PANE_TARGETS[openVarName] || "");
    }

    // Open or toggle help panel
    function openHelpPanel() {
        if (app.helpPanelOpen) { setPanelState("spotui-help-panel", "spotui-help-panel", "helpPanelOpen", false); return; }
        closeActivePanel();

        setPanelState("spotui-help-panel", "spotui-help-panel", "helpPanelOpen", true);
        const panel = document.getElementById("spotui-help-panel");
        if (panel) {
            const content = panel.querySelector('.spotui-help-content');
            if (content) {
                content.innerHTML = COMMAND_LIST.map(
                    item => `<div class="help-item"><span class="command">${item.cmd}</span><span class="description">${item.desc}</span></div>`
                ).join('');
            }
        }
    }

    // Open or toggle about panel
    function openAboutPanel() {
        if (app.aboutPanelOpen) { setPanelState("spotui-about-panel", "spotui-about-panel", "aboutPanelOpen", false); return; }
        closeActivePanel();

        setPanelState("spotui-about-panel", "spotui-about-panel", "aboutPanelOpen", true);
        const panel = document.getElementById("spotui-about-panel");
        if (panel) {
            panel.innerHTML = `
<div class="help-item"><span class="command">Developer</span><span class="description">SkenS</span></div>
<div class="help-item"><span class="command">Repository</span><span class="description"><a href="https://github.com/SkenSMasteR/SpoTUI">https://github.com/SkenSMasteR/SpoTUI</a></span></div>
<div class="help-item"><span class="command">Docs</span><span class="description"><a href="https://spotui.root.sx/">https://spotui.root.sx/</a></span></div>
<div class="help-item"><span class="command">Contact</span><span class="description"><a href="mailto:receive@gmx.us">receive@gmx.us</a></span></div>
        `;
        }
    }

    function closePlaylistPanel() {
        const wasOpen = app.playlistPanelOpen;
        app.playlistPanelOpen = false;
        app.playlistSortOpen = false;
        app.playlistFindOpen = false;
        app.playlistFindQuery = "";
        document.body.classList.remove("spotui-playlist-panel");
        const sortMenu = document.getElementById("spotui-playlist-sort");
        if (sortMenu) sortMenu.hidden = true;
        const findInput = document.getElementById("spotui-playlist-find");
        if (findInput) { findInput.hidden = true; findInput.value = ""; }
        const infoPopup = document.getElementById("spotui-playlist-info-popup");
        if (infoPopup) infoPopup.hidden = true;
        const panel = document.getElementById("spotui-playlist-panel");
        if (panel) panel.hidden = true;
        const input = document.getElementById("spotui-input");
        if (input) input.focus();
        document.removeEventListener("keydown", handlePlaylistPanelKeydown);
        // A pending prefetch must not fetch+render into the closed panel.
        if (app.playlistSongsFetchTimer) {
            clearTimeout(app.playlistSongsFetchTimer);
            app.playlistSongsFetchTimer = null;
        }
        if (wasOpen) emitPaneClose("playlist");
    }

    // Open playlist panel and load users playlists
    async function openPlaylistPanel() {
        if (app.playlistPanelOpen) { closePlaylistPanel(); return; }
        closeActivePanel();

        try {
            app.playlists = (await getPlaylists()).filter((p) => p.name !== "DJ");
            app.playlistsDefault = app.playlists.slice();
        } catch (err) {
            pinToast("Playlist error: " + err.message);
            return;
        }

        app.playlistPanelOpen = true;
        document.body.classList.add("spotui-playlist-panel");
        const panel = document.getElementById("spotui-playlist-panel");
        if (panel) panel.hidden = false;

        const input = document.getElementById("spotui-input");
        if (input) input.blur();

        app.selectedPlaylist = 0;
        app.selectedSong = 0;
        app.activePane = 'playlist';

        await renderPlaylistPanel();
        document.addEventListener("keydown", handlePlaylistPanelKeydown);
    }

    function closeAdd2listPanel() {
        const wasOpen = app.add2listPanelOpen;
        app.add2listPanelOpen = false;
        document.body.classList.remove("spotui-add2list-panel");
        const panel = document.getElementById("spotui-add2list-panel");
        if (panel) panel.hidden = true;
        const input = document.getElementById("spotui-input");
        if (input) input.focus();
        document.removeEventListener("keydown", handlePlaylistPanelKeydown);
        if (wasOpen) emitPaneClose("add2list");
    }

    async function openAdd2listPanel() {
        if (app.add2listPanelOpen) { closeAdd2listPanel(); return; }
        closeActivePanel();

        try {
            app.playlists = (await getPlaylists()).filter((p) => p.name !== "DJ" && !p.isLikedSongs);
        } catch (err) {
            pinToast("Playlist error: " + err.message);
            return;
        }

        app.add2listPanelOpen = true;
        document.body.classList.add("spotui-add2list-panel");
        const panel = document.getElementById("spotui-add2list-panel");
        if (panel) panel.hidden = false;

        const input = document.getElementById("spotui-input");
        if (input) input.blur();

        app.selectedPlaylist = 0;
        app.activePane = 'playlist';

        renderPlaylistListVirtual();
        document.addEventListener("keydown", handlePlaylistPanelKeydown);
    }

    function closeThemePanel() {
        setPanelState("spotui-theme-panel", "spotui-theme-panel", "themePanelOpen", false);
    }

    // Open theme browser panel (with search and theme cards)
    async function openThemePanel() {
        if (app.themePanelOpen) { closeThemePanel(); return; }
        closeActivePanel();

        setPanelState("spotui-theme-panel", "spotui-theme-panel", "themePanelOpen", true);
        const panel = document.getElementById("spotui-theme-panel");
        if (!panel) return;

        panel.innerHTML = `<div class="spotui-theme-loading"><div class="spotui-lyrics-loader active"></div></div>`;

        loadThemeFeed(
            () => {
                const themes = window.spotuiThemes || [];
                    panel.innerHTML = `
                <div style="margin-bottom: 20px; display: flex;">
                    <input id="spotui-theme-search" placeholder="Search themes..." style="width: 100%; background: rgba(0,0,0,0.5); border: 1px solid var(--panel-border-color, var(--spotui-accent, #ff8c42)); border-radius: 4px; color: #ddd; padding: 8px 12px; font-family: 'JetBrains Mono', monospace; font-size: 14px;">
                </div>
                <div class="theme-grid"></div>
            `;
                const grid = panel.querySelector('.theme-grid');
                const searchInput = document.getElementById('spotui-theme-search');

                searchInput.addEventListener('input', (e) => {
                    const searchTerm = e.target.value.toLowerCase();
                    const cards = grid.querySelectorAll('.theme-card');
                    cards.forEach(card => {
                        const title = card.querySelector('h3')?.textContent.toLowerCase();
                        if (title) {
                            card.style.display = title.includes(searchTerm) ? '' : 'none';
                        }
                    });
                });

                grid.appendChild(createAddThemeCard(ADD_THEME_IMG_OK));

                themes.forEach(theme => {
                    grid.appendChild(createThemeCard(theme));
                });

                grid.addEventListener('click', e => {
                    if (e.target.tagName === 'BUTTON' && e.target.dataset.commands) {
                        resetAllSettings();
                        const commands = JSON.parse(e.target.dataset.commands);
                        commands.forEach(cmd => { if (!isRestrictedThemeCommand(cmd)) execute(cmd, { fromTheme: true }); });
                        closeThemePanel();
                    }
                });
            },
            () => {
                    panel.innerHTML = `
                <div style="margin-bottom: 20px; display: flex;">
                     <input id="spotui-theme-search" placeholder="Search themes..." style="width: 100%; background: rgba(0,0,0,0.5); border: 1px solid var(--panel-border-color, var(--spotui-accent, #ff8c42)); border-radius: 4px; color: #ddd; padding: 8px 12px; font-family: 'JetBrains Mono', monospace; font-size: 14px;" disabled>
                </div>
                <p>¯\\_(ツ)_/¯</p><p>Error loading themes. The server may be down or you are rate-limited. Please wait and try again.</p>
            `;
                const grid = document.createElement('div');
                grid.className = 'theme-grid';
                grid.appendChild(createAddThemeCard(ADD_THEME_IMG_ERR));
                panel.appendChild(grid);
            }
        );
    }

    // Escape user data rendered into menu rows.
    function escMenu(s) {
        return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function renderMenuRows(content, rows, selected) {
        content.innerHTML = rows.map((r, i) =>
            `<div class="help-item${i === selected ? " selected" : ""}"><span class="command">${r[0]}</span><span class="description">${r[1]}</span></div>`
        ).join("");
    }

    // Close everything and hand the command bar back with text ready to edit.
    // When menu/prefix are given, the next fired command that starts with the
    // prefix reopens that menu (see consumePendingMenu) — the add/save
    // round-trip back into an updated list.
    function prefillCommand(text, menu, prefix) {
        app.pendingMenu = { menu, prefix };
        closeActivePanel();
        const input = document.getElementById("spotui-input");
        if (input) {
            input.value = text;
            input.focus();
            renderCmdGhost(input);
        }
    }

    // Called after every executed command: a menu prefill that got its
    // associated command reopens with fresh data; anything else just clears.
    function consumePendingMenu(cmd) {
        if (!app.pendingMenu) return;
        const pending = app.pendingMenu;
        app.pendingMenu = null;
        if (!cmd || !cmd.startsWith(pending.prefix)) return;
        if (pending.menu === "boards") openBoardsPanel();
        else if (pending.menu === "saves") openSavesPanel();
    }

    // ---- Synced-boards menu (Enter re-pulls, Del forgets, A adds) ----

    function boardRows() {
        return Object.entries(getBoardCounts());
    }

    function renderBoardsPanel() {
        const panel = document.getElementById("spotui-boards-panel");
        const content = panel && panel.querySelector(".spotui-boards-content");
        if (!content) return;
        const rows = boardRows();
        if (app.selectedBoard >= rows.length) app.selectedBoard = 0;
        renderMenuRows(content, rows.map(([b, n]) => [escMenu(b), `${n} poster${n === 1 ? "" : "s"}`]), app.selectedBoard);
    }

    function openBoardsPanel() {
        if (app.boardsPanelOpen) { closeBoardsPanel(); return; }
        closeActivePanel();
        setPanelState("spotui-boards-panel", "spotui-boards-panel", "boardsPanelOpen", true);
        app.selectedBoard = 0;
        renderBoardsPanel();
        // Deferred past the in-flight Enter: the keydown that submitted the
        // command bubbles to document AFTER this runs, and a synchronously
        // attached handler would receive its own opening Enter as activation.
        setTimeout(() => { if (app.boardsPanelOpen) document.addEventListener("keydown", handleBoardsKeydown); }, 0);
    }

    function closeBoardsPanel() {
        document.removeEventListener("keydown", handleBoardsKeydown);
        setPanelState("spotui-boards-panel", "spotui-boards-panel", "boardsPanelOpen", false);
    }

    async function handleBoardsKeydown(e) {
        const rows = boardRows();
        if (e.key === "Escape") {
            e.preventDefault();
            closeBoardsPanel();
            return;
        }
        if (e.key === "a" || e.key === "A") {
            // Before the empty check: A is exactly how an empty library gains
            // its first board. preventDefault first so focusing the input below
            // must not let this same keystroke type itself into the composer
            // after the prefill.
            e.preventDefault();
            prefillCommand("tui -pin-board ", "boards", "tui -pin-board ");
            return;
        }
        if (!rows.length) { closeBoardsPanel(); return; }
        // The library can shrink under an open menu (keybind delete, re-pull):
        // clamp before any rows[selectedBoard] dereference.
        if (app.selectedBoard < 0 || app.selectedBoard >= rows.length) app.selectedBoard = 0;
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            app.selectedBoard = (app.selectedBoard + (e.key === "ArrowUp" ? -1 : 1) + rows.length) % rows.length;
            renderBoardsPanel();
        } else if (e.key === "Enter") {
            e.preventDefault();
            const [b] = rows[app.selectedBoard];
            closeBoardsPanel();
            await refreshBoards(b);
        } else if (e.key === "Delete" || e.key === "Backspace" || e.key === "d" || e.key === "D") {
            e.preventDefault();
            const [b] = rows[app.selectedBoard];
            clearBoard(b);
            if (!boardRows().length) closeBoardsPanel();
            else renderBoardsPanel();
        }
    }

    // ---- Saved-themes menu (Enter applies, Del deletes, S saves) ----

    function renderSavesPanel() {
        const panel = document.getElementById("spotui-saves-panel");
        const content = panel && panel.querySelector(".spotui-saves-content");
        if (!content) return;
        const items = savedThemeDetails();
        if (app.selectedSave >= items.length) app.selectedSave = 0;
        renderMenuRows(content, items.map((t) => [escMenu(t.name), t.savedAt ? new Date(t.savedAt).toLocaleDateString() : "saved theme"]), app.selectedSave);
    }

    function openSavesPanel() {
        if (app.savesPanelOpen) { closeSavesPanel(); return; }
        closeActivePanel();
        setPanelState("spotui-saves-panel", "spotui-saves-panel", "savesPanelOpen", true);
        app.selectedSave = 0;
        renderSavesPanel();
        // Same deferred attach as the boards menu (opening Enter must not self-activate).
        setTimeout(() => { if (app.savesPanelOpen) document.addEventListener("keydown", handleSavesKeydown); }, 0);
    }

    function closeSavesPanel() {
        document.removeEventListener("keydown", handleSavesKeydown);
        setPanelState("spotui-saves-panel", "spotui-saves-panel", "savesPanelOpen", false);
    }

    async function handleSavesKeydown(e) {
        const items = savedThemeDetails();
        if (e.key === "Escape") {
            e.preventDefault();
            closeSavesPanel();
            return;
        }
        if (e.key === "s" || e.key === "S") {
            // Before the empty check: S is exactly how an empty library gains
            // its first snapshot. Swallow like the boards menu does for A.
            e.preventDefault();
            prefillCommand("tui -t save ", "saves", "tui -t save ");
            return;
        }
        if (!items.length) { closeSavesPanel(); return; }
        // Same staleness guard as the boards menu (see above).
        if (app.selectedSave < 0 || app.selectedSave >= items.length) app.selectedSave = 0;
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            app.selectedSave = (app.selectedSave + (e.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
            renderSavesPanel();
        } else if (e.key === "Enter") {
            e.preventDefault();
            const name = items[app.selectedSave].name;
            closeSavesPanel();
            applyTheme(name);
        } else if (e.key === "Delete" || e.key === "Backspace" || e.key === "d" || e.key === "D") {
            // Fill the bar with the delete command for the hovered theme;
            // Enter confirms it and the round-trip reopens this menu.
            e.preventDefault();
            const name = items[app.selectedSave].name;
            const quoted = name.includes(" ") ? `"${name}"` : name;
            prefillCommand(`tui -t delete ${quoted}`, "saves", "tui -t delete ");
        }
    }

    // Mark that the user has launched SpoTUI at least once
    function markLaunched() {
        storageSet(LAUNCHED_KEY, "1");
    }

    // Check if this is the users first time using SpoTUI
    function isFirstBoot() {
        return storageGet(LAUNCHED_KEY) !== "1";
    }

    function closeOnboardingPanel() {
        const wasFirstBoot = app.onboardingPanelOpen && app.onboardingStage === "done";
        app.onboardingPanelOpen = false;
        app.onboardingStage = "commands";
        app.onboardingShowAllThemes = false;
        document.body.classList.remove("spotui-onboarding-panel");
        const panel = document.getElementById("spotui-onboarding-panel");
        if (panel) panel.hidden = true;
        const input = document.getElementById("spotui-input");
        if (input) input.focus();
        document.removeEventListener("keydown", handleGlobalEsc);
        if (wasFirstBoot) initUpdateBanner();
    }
    function openOnboardingPanel() {
        if (app.onboardingPanelOpen) return;
        closeActivePanel();
        app.onboardingPanelOpen = true;
        document.body.classList.add("spotui-onboarding-panel");
        const panel = document.getElementById("spotui-onboarding-panel");
        if (panel) panel.hidden = false;
        const input = document.getElementById("spotui-input");
        if (input) input.focus();
        document.addEventListener("keydown", handleGlobalEsc);
    }

    // Create theme card for onboarding selection
    function onboardingThemeCard(theme) {
        const button = document.createElement("button");
        button.className = "spotui-onboarding-theme";
        button.dataset.themeName = theme.name || "";
        const img = document.createElement("img");
        img.src = theme.screenshot_url || "";
        img.alt = `${theme.name || ""} screenshot`;
        const label = document.createElement("span");
        label.textContent = theme.name || "";
        button.appendChild(img);
        button.appendChild(label);
        return button;
    }

    // Render current onboarding stage content
    function renderOnboardingStage(panel) {
        const themes = getThemeSelectionList(window.spotuiThemes || [], app.onboardingShowAllThemes);
        const themeCards = themes.map(onboardingThemeCard);

        if (app.onboardingStage === "commands") {
            panel.innerHTML = `
            <div class="spotui-onboarding-stage">
                <div class="spotui-onboarding-copy">
                    <div class="spotui-onboarding-kicker">Onboarding · stage 1</div>
                    <h2>Learn commands.</h2>
                    <p>These are some of the most common commands you can use, try them out!</p>
                </div>
                <div class="spotui-onboarding-primer">
                    <div class="help-item"><span class="command">p</span><span class="description">Play / pause</span></div>
                    <div class="help-item"><span class="command">v 50</span><span class="description">Set volume to 50%</span></div>
                    <div class="help-item"><span class="command">loop</span><span class="description">Loop current playlist</span></div>
                </div>
                <div class="spotui-onboarding-callout">
                    <div class="arrow">↙</div>
                    <div>Enter <code>p</code> to play and pause.</div>
                </div>
                <div class="spotui-onboarding-actions centered">
                    <button id="spotui-onboarding-next" class="spotui-control-btn">Next</button>
                </div>
            </div>
        `;
            document.getElementById("spotui-onboarding-next")?.addEventListener("click", () => {
                app.onboardingStage = "themes";
                renderOnboardingPanel();
            });
        } else if (app.onboardingStage === "themes") {
            panel.innerHTML = `
            <div class="spotui-onboarding-stage">
                <div class="spotui-onboarding-copy">
                    <div class="spotui-onboarding-kicker">Onboarding · stage 2</div>
                    <h2>Pick theme.</h2>
                    <p>These are some of the most popular themes. Choose the one that fits your style!</p>
                    <p>You dont like the top 3? Click "View all" to see more themes.</p>
                    <p>Don't worry, you can change theme any time with <code>theme</code>.</p>
                </div>
                <div class="theme-grid spotui-onboarding-grid"></div>
                <div class="spotui-onboarding-actions centered">
                    <button id="spotui-onboarding-view-all" class="spotui-control-btn">View all</button>
                </div>
            </div>
        `;
            const grid = panel.querySelector(".spotui-onboarding-grid");
            if (grid) {
                themeCards.forEach((card) => grid.appendChild(card));
            }
            panel.querySelectorAll(".spotui-onboarding-theme").forEach((button) => {
                button.addEventListener("click", () => {
                    const themeName = button.dataset.themeName;
                    if (!themeName) return;
                    app.onboardingStage = "theme-picked";
                    applyOnboardingTheme(themeName);
                });
            });
            const viewAllBtn = document.getElementById("spotui-onboarding-view-all");
            if (viewAllBtn && !app.onboardingShowAllThemes) {
                viewAllBtn.addEventListener("click", () => {
                    app.onboardingShowAllThemes = true;
                    renderOnboardingPanel();
                });
            } else if (viewAllBtn) {
                viewAllBtn.remove();
            }
        } else if (app.onboardingStage === "theme-picked") {
            panel.innerHTML = `
            <div class="spotui-onboarding-stage">
                <div class="spotui-onboarding-copy">
                    <div class="spotui-onboarding-kicker">Onboarding · stage 3</div>
                    <h2>Theme applied.</h2>
                    <p>You can change theme any time with <code>theme</code>.</p>
                </div>
                <div class="spotui-onboarding-actions centered">
                    <button id="spotui-onboarding-continue" class="spotui-control-btn">Continue</button>
                </div>
            </div>
        `;
            document.getElementById("spotui-onboarding-continue")?.addEventListener("click", () => {
                app.onboardingStage = "done";
                renderOnboardingPanel();
            });
        } else {
            markLaunched();
            panel.innerHTML = `
            <div class="spotui-onboarding-stage">
                <div class="spotui-onboarding-copy">
                    <div class="spotui-onboarding-kicker">Onboarding · stage 4</div>
                    <h2>Ready.</h2>
                    <p>Enter <code>list</code> or <code>playlist</code> to open menu for playlists.</p>
                    <br>
                    <p>Note: You must run one of the commands above to finish onboarding!</p>
                    <p>After finishing onboarding, feel free to explore all the commands with <code>help</code>.</p>
                </div>
            </div>
        `;
        }
    }

    function renderOnboardingFeedError(panel) {
        panel.innerHTML = `
        <div class="spotui-onboarding-copy">
            <div class="spotui-onboarding-kicker">Onboarding · stage 5</div>
            <h2>Theme feed failed.</h2>
            <p>This may happen if you have been ratelimited, wait a few seconds and click the retry button below.</p>
            <p>Or skip theme selection for now, you can pick one later with <code>theme</code>.</p>
        </div>
        <div class="spotui-onboarding-actions centered">
            <button id="spotui-onboarding-retry" class="spotui-control-btn">Retry</button>
            <button id="spotui-onboarding-skip" class="spotui-control-btn">Skip</button>
        </div>
    `;
        document.getElementById("spotui-onboarding-retry")?.addEventListener("click", () => renderOnboardingPanel());
        document.getElementById("spotui-onboarding-skip")?.addEventListener("click", () => {
            app.onboardingStage = "done";
            renderOnboardingPanel();
        });
    }

    // Apply theme during onboarding flow
    function applyOnboardingTheme(themeName) {
        const panel = document.getElementById("spotui-onboarding-panel");
        if (!panel) return;
        panel.innerHTML = `
        <div class="spotui-onboarding-stage">
            <div class="spotui-onboarding-copy">
                <div class="spotui-onboarding-kicker">Onboarding · stage 3</div>
                <h2>Applying theme...</h2>
            </div>
        </div>
    `;
        applyThemeByName(themeName, { skipNonTui: true })
            .then((theme) => {
                if (!theme) throw new Error("Theme not found");
                if (app.onboardingStage !== "theme-picked") return;
                renderOnboardingStage(panel);
            })
            .catch(() => {
                if (app.onboardingStage !== "theme-picked") return;
                app.onboardingStage = "themes";
                renderOnboardingFeedError(panel);
            });
    }

    function renderOnboardingPanel() {
        const panel = document.getElementById("spotui-onboarding-panel");
        if (!panel) return;

        if (app.onboardingStage !== "themes") {
            renderOnboardingStage(panel);
            return;
        }

        if (window.spotuiThemes && window.spotuiThemes.length) {
            renderOnboardingStage(panel);
            return;
        }

        panel.innerHTML = "<p>Loading first boot...</p>";

        loadThemeFeed(
            () => renderOnboardingStage(panel),
            () => renderOnboardingFeedError(panel)
        );
    }

    // Launch first-boot onboarding if user has never launched before
    async function launchFirstBootIfNeeded() {
        if (!isFirstBoot()) return;
        openOnboardingPanel();
        app.onboardingStage = "commands";
        app.onboardingShowAllThemes = false;
        renderOnboardingPanel();
    }
    // Return set of allowed commands during onboarding stages
    // Restricts the user to safe commands until onboarding is complete
    function getAllowedOnboardingCommands() {
        if (!app.onboardingPanelOpen) return null;
        if (app.onboardingStage === "done") return new Set(["p", "v", "loop", "list", "playlist"]);
        return new Set(["p", "v", "loop"]);
    }

    const STANDBY_HTML_URL = "https://raw.githubusercontent.com/SkenSMasteR/spotui-standby/refs/heads/main/index.html";
    const OVERLAY_ID = "spotui-standby-overlay";
    const CATCHER_ID = "spotui-standby-catcher";

    let standbyToken = 0;
    let swallowKeys = false;

    function swallowEvent(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    }

    function attachKeyListeners() {
        window.addEventListener("keydown", onStandbyKey, true);
        window.addEventListener("keyup", onStandbyKey, true);
        window.addEventListener("keypress", onStandbyKey, true);
        document.addEventListener("keydown", onStandbyKey, true);
        document.addEventListener("keyup", onStandbyKey, true);
        document.addEventListener("keypress", onStandbyKey, true);
    }

    function detachKeyListeners() {
        window.removeEventListener("keydown", onStandbyKey, true);
        window.removeEventListener("keyup", onStandbyKey, true);
        window.removeEventListener("keypress", onStandbyKey, true);
        document.removeEventListener("keydown", onStandbyKey, true);
        document.removeEventListener("keyup", onStandbyKey, true);
        document.removeEventListener("keypress", onStandbyKey, true);
    }

    function onStandbyKey(e) {
        if (!app.standbyOpen && !swallowKeys) return;
        swallowEvent(e);
        if (app.standbyOpen && e.type === "keydown") {
            swallowKeys = true;
            exitStandby();
            return;
        }
        if (e.type === "keyup") {
            // Key listeners are already detached by exitStandby; here just clear
            // the swallow flag and hand focus back.
            swallowKeys = false;
            if (!app.standbyOpen) {
                const input = document.getElementById("spotui-input");
                if (input) input.focus();
            }
        }
    }

    function onStandbyClick(e) {
        if (!app.standbyOpen) return;
        e.preventDefault();
        e.stopPropagation();
        exitStandby();
    }

    function onStandbyBlur() {
        if (!app.standbyOpen) return;
        requestAnimationFrame(focusCatcher);
    }

    function focusCatcher() {
        const catcher = document.getElementById(CATCHER_ID);
        if (catcher) catcher.focus();
    }

    function removeOverlay() {
        const overlay = document.getElementById(OVERLAY_ID);
        if (overlay) overlay.remove();
    }

    function restoreSpotui() {
        document.body.classList.remove("spotui-standby", "spotui-spotify-enabled", "spotui-tui-hidden");
        const spotifyBtn = document.getElementById("enable-spotify-btn");
        if (spotifyBtn) spotifyBtn.textContent = "Enable Spotify";
        if (swallowKeys) return;
        const input = document.getElementById("spotui-input");
        if (input) input.focus();
    }

    function exitStandby() {
        if (!app.standbyOpen) return;
        standbyToken += 1;
        app.standbyOpen = false;
        // Always detach: the in-flight exit keystroke was already swallowed
        // before this ran, so only future events are affected. Deferring the
        // detach to keyup stranded all six listeners whenever the key was
        // released off-window.
        detachKeyListeners();
        window.removeEventListener("blur", onStandbyBlur, true);
        document.removeEventListener("focusin", onStandbyBlur, true);
        removeOverlay();
        restoreSpotui();
    }

    async function enterStandby() {
        if (app.standbyOpen) return;
        app.standbyOpen = true;
        const token = ++standbyToken;

        document.body.classList.add("spotui-standby");
        const input = document.getElementById("spotui-input");
        if (input) input.blur();

        const overlay = document.createElement("div");
        overlay.id = OVERLAY_ID;

        const frame = document.createElement("iframe");
        frame.setAttribute("sandbox", "allow-scripts");
        frame.setAttribute("tabindex", "-1");

        const catcher = document.createElement("input");
        catcher.id = CATCHER_ID;
        catcher.type = "text";
        catcher.autocomplete = "off";
        catcher.spellcheck = false;
        catcher.setAttribute("aria-label", "Standby");

        overlay.appendChild(frame);
        overlay.appendChild(catcher);
        document.body.appendChild(overlay);

        attachKeyListeners();
        window.addEventListener("blur", onStandbyBlur, true);
        document.addEventListener("focusin", onStandbyBlur, true);
        catcher.addEventListener("blur", onStandbyBlur);
        catcher.addEventListener("click", onStandbyClick);
        overlay.addEventListener("click", onStandbyClick);
        focusCatcher();

        try {
            const res = await fetch(STANDBY_HTML_URL, { cache: "no-store" });
            if (!res.ok) throw new Error("standby fetch failed");
            const html = await res.text();
            if (token !== standbyToken || !app.standbyOpen) return;
            frame.srcdoc = html;
            focusCatcher();
        } catch (e) {
            if (token !== standbyToken) return;
            console.error("SpoTUI: failed to load standby overlay", e);
            exitStandby();
        }
    }

    // All command traffic (typed, keybound, themed, synced) flows through here,
    // so menu round-trips are consumed in one place: if a menu prefill armed a
    // reopen and this command matches it, the menu comes back with fresh data.
    async function execute(cmd, opts = {}) {
        const out = await executeInner(cmd, opts);
        try {
            consumePendingMenu(stripCommandPrefix(cmd).trim());
        } catch (e) {}
        return out;
    }

    // First-token command inventory (mirrors the executeInner branches below).
    // Used by history: unknown shapes stay session-only instead of persisting.
    const KNOWN_COMMANDS = new Set([
        "tui", "standby", "help", "about", "playlist", "list", "add2list", "theme",
        "discord", "search", "seek", "s", "volume", "v", "loop", "superloop",
        "lyrics", "visualizer", "dj", "echo", "jam",
        "play", "pause", "p", "skip", "back", "shuffle", "like",
    ]);
    const KNOWN_TUI_SUBS = new Set([
        "-l", "-a", "-debug", "-shade", "-wp", "-t", "bind", "unbind",
        "actions", "restore", "-posters", "-poster", "-pin-board",
        "-pin-boards", "-pin-clear", "-pin-feed", "-pin-refresh", "-pin-token",
        "-ly", "-viz", "-bar", "-progress", "-panel", "-inputs",
    ]);
    const KNOWN_JAM_SUBS = new Set(["create", "join", "leave"]);

    function isKnownCommand(cmd) {
        const parts = stripCommandPrefix(cmd).split(/\s+/).filter(Boolean);
        const command = (parts[0] || "").toLowerCase();
        if (!KNOWN_COMMANDS.has(command)) return false;
        if (command === "tui") return KNOWN_TUI_SUBS.has((parts[1] || "").toLowerCase());
        if (command === "jam") return KNOWN_JAM_SUBS.has((parts[1] || "").toLowerCase());
        return true;
    }

    // Strip one pair of surrounding double quotes so multi-word names and refs
    // survive the whitespace split above: "my theme" -> my theme.
    function unquote(s) {
        const t = String(s || "").trim();
        return t.length >= 2 && t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
    }

    async function executeInner(cmd, opts = {}) {
        const cleanedCmd = stripCommandPrefix(cmd);
        const [rawCommand, ...args] = cleanedCmd.split(/\s+/);
        const command = (rawCommand || "").toLowerCase();
        const argText = args.join(" ").trim();    if (opts.fromTheme && isRestrictedThemeCommand(cleanedCmd)) return;

        const allowedOnboardingCommands = opts.bypassOnboarding ? null : getAllowedOnboardingCommands();
        if (allowedOnboardingCommands && !allowedOnboardingCommands.has(command)) return;

        const allowedJamCommands = getAllowedJamGuestCommands();
        if (allowedJamCommands && !allowedJamCommands.has(command)) {
            jamSay("Commands limited to: `volume`, `lyrics`, `visualizer`, `jam leave`");
            return;
        }

        if (command === "tui") {
            const argsLower = args.map((a) => a.toLowerCase());
            if (argsLower.includes("-l") && argsLower.includes("-a")) {
                const state = (args[args.length - 1] || "").toLowerCase();
                if (state === "off") {
                    app.asciiEnabled = false;
                    resetGrid();
                    storageSet(ANIMATION_KEY, "off");
                } else if (state === "on") {
                    app.asciiEnabled = true;
                    storageRemove(ANIMATION_KEY);
                    startAsciiPaintLoop();
                }
                return;
            }
            if (argsLower[0] === "-l") {
                const state = (args[1] || "").toLowerCase();
                if (state === "on" || state === "off") {
                    toggleLogo(state);
                }
                return;
            }
            if (argsLower[0] === "-debug") {
                const state = (args[1] || "").toLowerCase();
                if (state === "on") {
                    storageSet(DEBUG_KEY, "1");
                    console.log("[SpoTUI] debug logging ON (verbose wallpaper/poster/shade output).");
                } else if (state === "off") {
                    storageRemove(DEBUG_KEY);
                    console.log("[SpoTUI] debug logging OFF.");
                } else {
                    console.warn("[SpoTUI] usage: tui -debug <on/off>");
                }
                return;
            }
            if (argsLower[0] === "-shade") {
                const v = args[1];
                if (!v) reportShade();
                else if (v.toLowerCase() === "off") setShade("off");
                else setShade(v);
                return;
            }
            if (argsLower.includes("-wp")) {
                dbg("[SpoTUI-dbg] -wp raw:", JSON.stringify(cleanedCmd), "args:", JSON.stringify(args));
                const urlIdx = argsLower.indexOf("-wp") + 1;
                const url = args[urlIdx];
                if ((url || "").toLowerCase() === "off") {
                    dbg("[SpoTUI-dbg] -wp off: removing wallpaper + clearing storage");
                    const wp = document.getElementById("spotui-wallpaper");
                    if (wp) wp.remove();
                    storageRemove(WP_URL_KEY);
                    storageRemove(WP_OPACITY_KEY);
                    storageRemove(WP_FIT_KEY);
                    storageRemove(WP_POS_KEY);
                    storageRemove(WP_RICH_KEY);
                    return;
                }
                const flag = (name) => flagArg(argsLower, args, name);
                const hasFlags = ["-o", "-fit", "-pos", "-rich"].some((f) => argsLower.includes(f));
                const looksLikeUrl = url && !url.startsWith("-");
                if (!looksLikeUrl && !hasFlags) {
                    // Bare `tui -wp`: report current wallpaper (toast + console).
                    const cur = {
                        url: storageGet(WP_URL_KEY) || "(none)",
                        opacity: storageGet(WP_OPACITY_KEY) || "1",
                        fit: storageGet(WP_FIT_KEY) || "cover",
                        pos: storageGet(WP_POS_KEY) || "center",
                        rich: storageGet(WP_RICH_KEY) || "100",
                        live: document.getElementById("spotui-wallpaper") ? "yes" : "no",
                    };
                    pinToast(`wallpaper\n${cur.url}\nopacity ${cur.opacity} · ${cur.fit} · ${cur.pos} · rich ${cur.rich}`);
                    console.log("[SpoTUI-dbg] current wallpaper:", cur);
                    return;
                }
                if (!looksLikeUrl && hasFlags) {
                    // Flags alone: tweak the current wallpaper, keep its URL.
                    const live = document.getElementById("spotui-wallpaper");
                    let curUrl = storageGet(WP_URL_KEY);
                    let curOp = storageGet(WP_OPACITY_KEY) || "1";
                    if (live) {
                        curUrl = live.tagName === "VIDEO"
                            ? (live.currentSrc || live.src || live.getAttribute("src"))
                            : ((live.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/) || [])[1] || curUrl);
                        curOp = live.style.opacity || curOp;
                    }
                    if (!curUrl) {
                        console.warn("[SpoTUI-dbg] no wallpaper set yet — give a URL first: tui -wp <url>");
                        return;
                    }
                    dbg("[SpoTUI-dbg] -wp tweaking current wallpaper.");
                    setWallpaper(curUrl, flag("-o") ?? curOp, true, {
                        fit: flag("-fit") ?? storageGet(WP_FIT_KEY),
                        pos: flag("-pos") ?? storageGet(WP_POS_KEY),
                        rich: flag("-rich") ?? storageGet(WP_RICH_KEY),
                    });
                    return;
                }
                if (looksLikeUrl) {
                    let opacity = "1";
                    const oIdx = argsLower.indexOf("-o");
                    if (oIdx !== -1 && args[oIdx + 1]) opacity = args[oIdx + 1];
                    if (args.length > urlIdx + 1 && oIdx === -1) console.warn("[SpoTUI-dbg] URL looks space-split (contains spaces?). Got url=" + JSON.stringify(url) + " extra=" + JSON.stringify(args.slice(urlIdx + 1)) + ". Quote handling: commands split on whitespace, so use %20 or dashes.");
                    dbg("[SpoTUI-dbg] -wp parsed:", { url, opacity });
                    setWallpaper(url, opacity, true, { fit: flag("-fit"), pos: flag("-pos"), rich: flag("-rich") });
                } else {
                    console.warn('[SpoTUI-dbg] -wp got no URL. Usage: tui -wp <url> [-o 0-1] [-fit cover|contain|fill|none] [-pos center|top|"top left"] [-rich 0-200] | tui -wp off. Same-origin example: tui -wp https://xpui.app.spotify.com/videos/shimmer.webm -o 0.5');
                }
                return;
            }
            if (argsLower[0] === "-posters" || argsLower[0] === "-poster") {
                const sub = (args[1] || "on").toLowerCase();
                let acted = false;
                if (sub === "on" || sub === "off") { setPostersEnabled(sub === "on"); acted = true; }
                else if (sub === "shuffle") { shufflePosters(); acted = true; }
                else if (sub === "clear") { clearPosters(); acted = true; }
                else if (sub === "settings" || sub === "status") { showPosterSettings(); acted = true; }
                else if (sub === "add" && args[2]) {
                    const addBoard = args.slice(3).find((a) => !a.startsWith("-"));
                    addPoster(args[2], addBoard);
                    acted = true;
                }
                else if (sub === "count") { setPosterCount(args[2]); acted = true; }
                else if (sub === "density") { setPosterDensity(args[2]); acted = true; }
                else if (sub === "theme") { setPosterTheme(args[2]); acted = true; }
                else if (sub === "opacity") { setPosterOpacity(args[2]); acted = true; }
                else if (sub === "autoshuffle") { setPosterAutoshuffle(args[2]); acted = true; }
                else if (sub === "symmetric") { setPosterSymmetric(args[2]); acted = true; }
                else if (sub === "rotate") { setPosterRotate(args[2]); acted = true; }
                else if (sub !== "-o" && sub !== "-c" && sub !== "-d" && sub !== "-t" && sub !== "-r") console.warn("[SpoTUI-pin] usage: tui -posters <on|off|shuffle|clear|settings|add <url> [board]|count <1-12|lo-hi>|density <1-10|lo-hi>|theme <#hex>|opacity <0-1>|autoshuffle <on|off>|symmetric <on/off>|rotate <min|off>> [-o <0-1>] [-c <1-12|lo-hi>] [-d <1-10|lo-hi>] [-t <#hex>] [-r <min|off>]");
                if (applyPosterFlags(argsLower, args) > 0) acted = true;
                if (!acted) console.warn("[SpoTUI-pin] nothing to do — see usage above.");
                return;
            }
            if (argsLower[0] === "-pin-refresh") {
                const filter = args.slice(1).find((a) => !a.startsWith("-"));
                try {
                    await refreshBoards(filter);
                } catch (e) { console.error("[SpoTUI-pin] refresh failed:", e.message); }
                applyPosterFlags(argsLower, args);
                return;
            }
            if (argsLower[0] === "-pin-boards") {
                if (!Object.keys(getBoardCounts()).length) showBoardList();
                else openBoardsPanel();
                return;
            }
            if (argsLower[0] === "-pin-clear") {
                if (!args[1]) console.warn("[SpoTUI-pin] usage: tui -pin-clear <board>  (see tui -pin-boards)");
                else clearBoard(unquote(args.slice(1).join(" ")));
                return;
            }
            if (argsLower[0] === "-pin-board") {
                if (!args[1] || args[1].startsWith("-")) console.warn("[SpoTUI-pin] usage: tui -pin-board <board-url-or-id> [token] [-o <0-1>] [-c <1-12|lo-hi>] [-d <1-10|lo-hi>] [-t <#hex>] [-r <min|off>]");
                else {
                    const token = args[2] && !args[2].startsWith("-") ? args[2] : undefined;
                    try {
                        await syncPinterestBoard(args[1], token);
                    } catch (e) { console.error("[SpoTUI-pin] sync failed:", e.message); }
                    applyPosterFlags(argsLower, args);
                }
                return;
            }
            if (argsLower[0] === "-pin-feed") {
                syncPinterestFeed(args[1])
                    .then(() => { applyPosterFlags(argsLower, args); })
                    .catch((e) => console.error("[SpoTUI-pin] feed failed:", e.message));
                return;
            }
            if (argsLower[0] === "-pin-token") {
                setPinToken(args[1]);
                return;
            }
            // Theme ops only trigger in first position so a "-t" token inside
            // other commands (bind strings, search queries) can't hijack them.
            if (argsLower[0] === "-t") {
                const tSub = (args[1] || "").toLowerCase();
                // Quoted multi-word names: tui -t save "my theme".
                const tName = args[2] && args[2].startsWith('"') ? unquote(args.slice(2).join(" ")) : args[2];
                if (tSub === "save") { saveTheme(tName); return; }
                if (tSub === "list") {
                    if (!savedThemeNames().length) listThemes();
                    else openSavesPanel();
                    return;
                }
                if (tSub === "apply" || tSub === "load") { applyTheme(tName); return; }
                if (tSub === "delete" || tSub === "rm" || tSub === "remove") { deleteTheme(tName); return; }
                if (tSub === "pull" && args[2]) {
                    const base64Name = args[2];
                    try {
                        const themeName = atob(base64Name);
                        applyThemeByName(themeName);
                    } catch (e) {}
                } else if (tSub !== "pull") {
                    console.warn("[SpoTUI] usage: tui -t <save <name>|list|apply <name>|delete <name>|pull <theme_id>>");
                }
                return;
            }
            if (argsLower[0] === "bind") {
                if (argsLower[1] === "clear" && args.length === 2) {
                    if (!saveKeybinds({})) {
                        pinToast("binds not cleared: storage full");
                        console.error("[SpoTUI] bind clear failed: storage full");
                    }
                    return;
                }
                const bindMatch = cleanedCmd.match(/^tui\s+bind\s+"([A-Za-z])"\s+"([^"]+)"\s*$/i);
                if (bindMatch) {
                    const combo = "Alt+" + bindMatch[1].toUpperCase();
                    const binds = getKeybinds();
                    binds[combo] = bindMatch[2];
                    if (!saveKeybinds(binds)) {
                        pinToast("keybind not saved: storage full");
                        console.error("[SpoTUI] keybind save failed: storage full");
                    }
                } else {
                    jamSay('Usage: tui bind "<Letter>" "<command>"');
                }
                return;
            }
            if (argsLower[0] === "unbind") {
                const unbindMatch = cleanedCmd.match(/^tui\s+unbind\s+"([A-Za-z])"\s*$/i);
                if (unbindMatch) {
                    const combo = "Alt+" + unbindMatch[1].toUpperCase();
                    const binds = getKeybinds();
                    delete binds[combo];
                    if (!saveKeybinds(binds)) {
                        pinToast("unbind not saved: storage full");
                        console.error("[SpoTUI] unbind save failed: storage full");
                    }
                } else if (argsLower[1] === "all" && args.length === 2) {
                    if (!saveKeybinds({})) {
                        pinToast("binds not cleared: storage full");
                        console.error("[SpoTUI] bind clear failed: storage full");
                    }
                } else {
                    jamSay('Usage: tui unbind "<Letter>" | tui unbind all');
                }
                return;
            }
            if (argsLower[0] === "actions") {
                handleActionsCommand(cleanedCmd);
                return;
            }
            if (argsLower.includes("-ly") && argsLower.includes("-cp")) {
                handleColorArgs(args, {
                    "-active": LYRICS_COLOR_ACTIVE,
                    "-inactive": LYRICS_COLOR_INACTIVE,
                    "-near": LYRICS_COLOR_LIGHT_INACTIVE,
                });
                applyLyricColors();
                return;
            }
            if (argsLower.includes("-viz")) {
                handleColorArgs(args, { "-color": VISUALIZER_COLOR });
                applyVisualizerColor();
                return;
            }
            if (argsLower.includes("-ly") && argsLower.includes("-animation")) {
                const idx = argsLower.indexOf("-animation");
                const state = (args[idx + 1] || "").toLowerCase();
                if (state === "on") {
                    document.body.classList.add("spotui-lyrics-animation-on");
                    storageSet(LYRICS_ANIMATION_KEY, "on");
                } else if (state === "off") {
                    document.body.classList.remove("spotui-lyrics-animation-on");
                    storageSet(LYRICS_ANIMATION_KEY, "off");
                }
                if (app.lyricsPanelOpen) {
                    syncLyricsHighlight(true);
                }
                return;
            }
            if (argsLower.includes("-ly") && argsLower.includes("-spacing")) {
                const idx = argsLower.indexOf("-spacing");
                let value = args[idx + 1];
                if ((value || "").toLowerCase() === "off") {
                    storageRemove(LYRICS_LINE_SPACING);
                } else {
                    if (!isNaN(value)) {
                        value = value + "px";
                    }
                    storageSet(LYRICS_LINE_SPACING, value);
                }
                applyLyricLineSpacing();
                return;
            }
            if (argsLower.includes("-bar")) {
                if (argsLower.includes("-v")) {
                    const idx = argsLower.indexOf("-v");
                    const state = (args[idx + 1] || "").toLowerCase();
                    if (state === "on" || state === "off") {
                        storageSet(PLAYER_BAR_VISIBLE, state);
                        if (state === "on") storageSet(CUSTOM_BAR_ENABLED, "off");
                        applyPlayerBarVisibility();
                        applyCustomBarState();
                    }
                    const newArgs = args.filter((arg, i) => i !== idx && i !== idx + 1);
                    if (newArgs.length > 1) {
                        handleColorArgs(newArgs, {
                            "-bg": PLAYER_BAR_BG,
                            "-border": PLAYER_BAR_BORDER,
                            "-text": PLAYER_BAR_TEXT,
                        });
                        applyPlayerBarColors();
                    }
                } else if (argsLower.includes("-c")) {
                    const idx = argsLower.indexOf("-c");
                    const state = (args[idx + 1] || "").toLowerCase();
                    if (state === "on" || state === "off") {
                        storageSet(CUSTOM_BAR_ENABLED, state);
                        if (state === "on") {
                            storageSet(PLAYER_BAR_VISIBLE, "off");
                            applyPlayerBarVisibility();
                        }
                        applyCustomBarState();
                    }
                    if (argsLower.includes("-progress")) {
                        const pIdx = argsLower.indexOf("-progress");
                        const styleId = (args[pIdx + 1] || "").toLowerCase();
                        if (styleId && PROGRESS_STYLES[styleId]) {
                            storageSet(CUSTOM_BAR_PROGRESS_STYLE, styleId);
                            if (storageGet(CUSTOM_BAR_ENABLED) === "on") updateCustomBar();
                        }
                    }
                } else {
                    handleColorArgs(args, {
                        "-bg": PLAYER_BAR_BG,
                        "-border": PLAYER_BAR_BORDER,
                        "-text": PLAYER_BAR_TEXT,
                    });
                    applyPlayerBarColors();
                }
                return;
            }
            if (argsLower.includes("-progress")) {
                handleColorArgs(args, {
                    "-bg": PROGRESS_BAR_BG,
                    "-fg": PROGRESS_BAR_FG,
                });
                applyProgressBarColors();
                return;
            }
            if (argsLower.includes("-panel")) {
                handleColorArgs(args, {
                    "-bg": PANEL_BG,
                    "-border": PANEL_BORDER,
                    "-text": PANEL_TEXT,
                });
                applyPanelColors();
                return;
            }
            if (argsLower.includes("-inputs")) {
                if (argsLower.includes("-buttons")) {
                    const idx = argsLower.indexOf("-buttons");
                    const state = (args[idx + 1] || "").toLowerCase();
                    if (state === "on" || state === "off") {
                        storageSet(INPUT_BUTTONS, state);
                        applyInputButtonsVisibility();
                    }
                }
                const filteredArgs = [];
                for (let i = 0; i < args.length; i++) {
                    if (argsLower[i] === "-buttons") {
                        i++;
                    } else {
                        filteredArgs.push(args[i]);
                    }
                }
                if (filteredArgs.length > 1 || (filteredArgs.length === 1 && filteredArgs[0].toLowerCase() === "off")) {
                    handleColorArgs(filteredArgs, {
                        "-bg": INPUT_BG,
                        "-bg-hover": INPUT_BG_HOVER,
                        "-text": INPUT_TEXT,
                        "-border": INPUT_BORDER,
                    });
                    applyInputColors();
                }
                return;
            }
            if (argsLower[0] === "restore") {
                const fullRestore = argsLower[1] === "-full";
                const launchedValue = storageGet(LAUNCHED_KEY);
                const bannerValue = storageGet(UPDATE_BANNER_KEY);
                const keybindsValue = storageGet(KEYBIND_STORAGE_KEY);
                const actionsValue = storageGet(ACTIONS_STORAGE_KEY);
                const historyValue = storageGet(HISTORY_KEY);
                storageClear();
                invalidateSavesCache();
                if (!fullRestore) {
                    if (launchedValue !== null) storageSet(LAUNCHED_KEY, launchedValue);
                    if (bannerValue !== null) storageSet(UPDATE_BANNER_KEY, bannerValue);
                    if (keybindsValue !== null) storageSet(KEYBIND_STORAGE_KEY, keybindsValue);
                    if (actionsValue !== null) storageSet(ACTIONS_STORAGE_KEY, actionsValue);
                    if (historyValue !== null) storageSet(HISTORY_KEY, historyValue);
                }
                showRestartPopup("Wait 5 seconds and relaunch Spotify", true);
                setTimeout(() => location.reload(), 100);
                return;
            }
            return;
        }

        if (command === "standby") { closeActivePanel(); await enterStandby(); return; }
        if (command === "help") { openHelpPanel(); return; }
        if (command === "about") { openAboutPanel(); return; }
        if (command === "playlist" || command === "list") { 
            if (argText) {
                try {
                    app.playlists = await getPlaylists();
                } catch (err) {
                    jamSay("Playlist error: " + err.message);
                    return;
                }

                const match = app.playlists.filter(p => p.name.toLowerCase().includes(unquote(argText).toLowerCase()));
                if (match.length === 1) {
                    Spicetify.Player.playUri(match[0].uri);
                    return;
                } else if (match.length > 1) {
                    jamSay("Multiple matches: " + match.map(p => p.name).join(", "));
                    return;
                }
            }

            openPlaylistPanel(); return; 
        }
        if (command === "add2list") { openAdd2listPanel(); return; }
        if (command === "theme") { openThemePanel(); return; }
        if (command === "discord") {
            storageRemove(UPDATE_BANNER_KEY);
            const existingBanner = document.getElementById("spotui-update-banner");
            if (existingBanner) existingBanner.remove();
            initUpdateBanner();
            return;
        }

        const playerMap = {
            play: { fn: () => { if (!Spicetify.Player.isPlaying()) Spicetify.Player.togglePlay(); }, name: "Play" },
            pause: { fn: () => { if (Spicetify.Player.isPlaying()) Spicetify.Player.togglePlay(); }, name: "Pause" },
            p: { fn: () => { const p = Spicetify.Player.isPlaying(); Spicetify.Player.togglePlay(); return p; }, name: "Play/PauseToggle" },
            skip: { fn: () => Spicetify.Player.next(), name: "Skip" },
            back: { fn: () => Spicetify.Player.back(), name: "Back" },
            shuffle: { fn: () => { const s = Spicetify.Player.getShuffle(); Spicetify.Player.setShuffle(!s); return s; }, name: "Shuffle" },
            like: { fn: async () => { const h = await Spicetify.Player.getHeart(); await Spicetify.Player.toggleHeart(); return h; }, name: "Like" }
        };

        if (playerMap[command]) {
            const act = playerMap[command];
            try { await act.fn(); } catch {}
            return;
        }

        if (command === "search") {
            closeActivePanel();
            openSearchPanel(argText);
            return;
        }

        if (command === "seek" || command === "s") {
            try {
                if (!argText) return;
                const parts = argText.split(':').map(Number);
                if (parts.length !== 2 || parts.some(isNaN)) {
                    jamSay("Usage: seek <mm:ss>  (e.g. seek 1:23)");
                    return;
                }
                Spicetify.Player.seek((parts[0] * 60 + parts[1]) * 1000);
            } catch {}
            return;
        }

        if (command === "volume" || command === "v") {
            try {
                if (!argText) return;
                const cleaned = argText.endsWith("%") ? argText.slice(0, -1) : argText;
                const percent = Number(cleaned);
                if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
                    jamSay("Usage: volume <0-100>  (e.g. volume 50)");
                    return;
                }
                Spicetify.Player.setVolume(percent / 100);
            } catch {}
            return;
        }

        if (command === "loop") { handleRepeatCommand("loop", argText); return; }
        if (command === "superloop") { handleRepeatCommand("superloop", argText); return; }
        if (command === "lyrics") { handleLyricsCommand(argText); return; }
        if (command === "visualizer") { handleVisualizerCommand(argText); return; }
        if (command === "dj") {
            try {
                app.playlists = await getPlaylists();
                const match = app.playlists.find((p) => p.name === "DJ");
                if (!match) {
                    jamSay("Spotify DJ isn’t available for your account yet.");
                    return;
                }
                Spicetify.Player.playUri(match.uri);
            } catch (err) {
                jamSay("Spotify DJ isn’t available for your account yet.");
            }
            return;
        }

        if (command === "echo") {
            if (argText) jamSay(argText);
            return;
        }

        if (command === "jam") {
            const sub = (args[0] || "").toLowerCase();
            if (sub === "create") { await jamCreate(); return; }
            if (sub === "join") { await jamJoin(args[1]); return; }
            if (sub === "leave") { await jamLeave(); return; }
            jamSay("Usage: jam create | jam join <pin> | jam leave");
            return;
        }
    }
    function handleRepeatCommand(kind, arg) {
        try {
            const current = Spicetify.Player.getRepeat();
            const targetMode = kind === "loop" ? 1 : 2;
            let nextMode = targetMode;
            const normalizedArg = String(arg || "").trim().toLowerCase();

            if (normalizedArg === "on") nextMode = targetMode;
            else if (normalizedArg === "off") nextMode = 0;
            else if (normalizedArg === "") nextMode = current === targetMode ? 0 : targetMode;
            else {
                jamSay(`Usage: ${kind} [on|off]`);
                return;
            }

            Spicetify.Player.setRepeat(nextMode);
        } catch (err) {}
    }

    const PANE_CLOSE_EVENT = "pane_close";
    const RESERVED_NAMES = new Set(["create", "list", "enable", "disable", "delete"]);
    const CLAUSE_RE = /^(?:actions:)?spotui@([a-z_]+)(?:>(!?)([a-z0-9_-]+))?$/i;

    let runningActions = false;
    const paneCloseQueue = [];

    function parseQuotedTokens(text) {
        const tokens = [];
        const re = /"([^"]*)"|(\S+)/g;
        let m;
        while ((m = re.exec(String(text || "")))) {
            tokens.push(m[1] !== undefined ? m[1] : m[2]);
        }
        return tokens;
    }

    function getActions() {
        const parsed = readJsonObject(ACTIONS_STORAGE_KEY);
        const clean = {};
        Object.keys(parsed).forEach((key) => {
            const item = parsed[key];
            if (!item || typeof item !== "object") return;
            // Re-validate stored listeners: a plant or hand-edit with a
            // non-pane_close grammar must never arm.
            if (typeof item.listener !== "string" || !parseListener(item.listener)) return;
            clean[key] = {
                enabled: item.enabled !== false,
                listener: item.listener,
                command: typeof item.command === "string" ? item.command : "",
            };
        });
        return clean;
    }

    function saveActions(map) {
        storageSet(ACTIONS_STORAGE_KEY, JSON.stringify(map));
    }

    function validName(name) {
        return typeof name === "string" && /^[A-Za-z0-9_-]+$/.test(name) && !RESERVED_NAMES.has(name.toLowerCase());
    }

    function parseListener(listener) {
        const raw = String(listener || "").trim();
        if (!raw.toLowerCase().startsWith("actions:")) return null;
        const parts = raw.split("|").map((p) => p.trim()).filter(Boolean);
        if (!parts.length) return null;
        const clauses = [];
        for (let i = 0; i < parts.length; i++) {
            const m = parts[i].match(CLAUSE_RE);
            if (!m) return null;
            const event = m[1].toLowerCase();
            const exclude = m[2] === "!";
            const target = (m[3] || "").toLowerCase();
            if (event !== PANE_CLOSE_EVENT) return null;
            if (target === "onboarding") return null;
            clauses.push({ event, exclude, target });
        }
        return clauses;
    }

    function listenerMatches(listener, event, target) {
        const clauses = parseListener(listener);
        if (!clauses) return false;
        const matching = clauses.filter((c) => c.event === event);
        if (!matching.length) return false;
        const closed = String(target || "").toLowerCase();
        const includes = [];
        const excludes = [];
        let anyPane = false;
        for (let i = 0; i < matching.length; i++) {
            const clause = matching[i];
            if (!clause.target) {
                anyPane = true;
                continue;
            }
            if (clause.exclude) excludes.push(clause.target);
            else includes.push(clause.target);
        }
        if (excludes.indexOf(closed) !== -1) return false;
        if (anyPane) return true;
        if (includes.length) return includes.indexOf(closed) !== -1;
        return true;
    }

    function paneTarget(target) {
        return String(target || "").toLowerCase();
    }

    function emitPaneClose(target) {
        const closed = paneTarget(target);
        if (!closed || closed === "onboarding") return;
        paneCloseQueue.push(closed);
        queueMicrotask(pumpPaneCloseQueue);
    }

    // Serial FIFO: concurrent closes queue up instead of dropping all but the
    // first (the old runningActions drop-guard lost N-1 targets).
    async function pumpPaneCloseQueue() {
        if (runningActions) return;
        runningActions = true;
        try {
            let target;
            while ((target = paneCloseQueue.shift()) !== undefined) {
                await runPaneClose(target);
            }
        } finally {
            runningActions = false;
        }
    }

    async function runPaneClose(target) {
        const actions = getActions();
        const names = Object.keys(actions);
        for (let i = 0; i < names.length; i++) {
            const action = actions[names[i]];
            if (!action.enabled || !action.listener || !action.command) continue;
            if (!listenerMatches(action.listener, PANE_CLOSE_EVENT, target)) continue;
            await execute(action.command);
        }
    }

    function handleActionsCommand(cleanedCmd) {
        const rest = parseQuotedTokens(cleanedCmd).slice(2);
        if (!rest.length) {
            jamSay('Usage: tui actions create <name> | tui actions "<name>" "<listener>" "<command>" | tui actions list | tui actions enable <name> | tui actions disable <name> | tui actions delete <name>');
            return;
        }
        const sub = rest[0].toLowerCase();
        if (sub === "create") {
            const name = rest[1];
            if (!validName(name)) {
                jamSay("Invalid action name");
                return;
            }
            const actions = getActions();
            if (actions[name]) {
                jamSay("Action already exists: " + name);
                return;
            }
            actions[name] = { enabled: true, listener: "", command: "" };
            saveActions(actions);
            jamSay("Created action: " + name);
            return;
        }
        if (sub === "list") {
            const actions = getActions();
            const names = Object.keys(actions);
            if (!names.length) {
                jamSay("No actions");
                return;
            }
            jamSay(names.map((n) => {
                const a = actions[n];
                const state = a.enabled ? "on" : "off";
                const listener = a.listener || "-";
                const command = a.command || "-";
                return n + " [" + state + "] " + listener + " -> " + command;
            }).join("\n"));
            return;
        }
        if (sub === "delete") {
            const name = rest[1];
            if (!name) {
                jamSay("Usage: tui actions delete <name>");
                return;
            }
            const actions = getActions();
            if (!actions[name]) {
                jamSay("Unknown action: " + name);
                return;
            }
            delete actions[name];
            saveActions(actions);
            jamSay("Deleted action: " + name);
            return;
        }
        if (sub === "enable" || sub === "disable") {
            const name = rest[1];
            if (!name) {
                jamSay("Usage: tui actions " + sub + " <name>");
                return;
            }
            const actions = getActions();
            if (!actions[name]) {
                jamSay("Unknown action: " + name);
                return;
            }
            actions[name].enabled = sub === "enable";
            saveActions(actions);
            jamSay((sub === "enable" ? "Enabled" : "Disabled") + " action: " + name);
            return;
        }
        if (rest.length >= 3) {
            const name = rest[0];
            const listener = rest[1];
            const command = rest.slice(2).join(" ");
            if (!validName(name)) {
                jamSay("Invalid action name");
                return;
            }
            const parsed = parseListener(listener);
            if (!parsed) {
                jamSay("Unknown listener");
                return;
            }
            if (!String(command || "").trim()) {
                jamSay("Missing command");
                return;
            }
            const actions = getActions();
            const prev = actions[name] || { enabled: true};
            actions[name] = {
                enabled: prev.enabled !== false,
                listener,
                command,
            };
            saveActions(actions);
            jamSay("Updated action: " + name);
            return;
        }
        jamSay('Usage: tui actions create <name> | tui actions "<name>" "<listener>" "<command>" | tui actions list | tui actions enable <name> | tui actions disable <name> | tui actions delete <name>');
    }

    // Check if Spotifys lyrics panel is visible in DOM
    function detectLyricsSurface() {
        return Boolean(
            document.querySelector(
                ".main-nowPlayingView-lyricsContent, .main-lyricsCinema-container, .lyrics-lyricsContainer-LyricsContainer"
            )
        );
    }

    function syncLyricsState() {
        if (!document.body) return;
        const open = detectLyricsSurface();
        if (document.body.classList.contains("spotui-lyrics-open") === open) return;
        document.body.classList.toggle("spotui-lyrics-open", open);
    }

    // Hook into Spotifys native lyrics button to track panel state changes
    function hookLyricsButton() {
        const button = document.querySelector(".main-nowPlayingBar-lyricsButton");
        if (!button || button.dataset.spotuiTuiLyricsHooked === "1") return;
        button.dataset.spotuiTuiLyricsHooked = "1";
        button.addEventListener(
            "click",
            () => {
                setTimeout(syncLyricsState, 50);
                setTimeout(syncLyricsState, 250);
                setTimeout(syncLyricsState, 1000);
            },
            true
        );
    }

    // Track Spotifys lyrics panel visibility
    let lyricsRefreshRaf = 0;

    function initLyricsBridge() {
        if (!document.body) {
            setTimeout(initLyricsBridge, 250);
            return;
        }
        // Mutation bursts (progress, lists) coalesce into one refresh per frame.
        const refresh = () => {
            if (lyricsRefreshRaf) return;
            lyricsRefreshRaf = requestAnimationFrame(() => {
                lyricsRefreshRaf = 0;
                hookLyricsButton();
                syncLyricsState();
            });
        };
        refresh();
        if (!app.lyricsObserver) {
            app.lyricsObserver = new MutationObserver(refresh);
            app.lyricsObserver.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["class", "style"],
            });
            window.addEventListener(
                "beforeunload",
                () => { app.lyricsObserver?.disconnect(); },
                { once: true }
            );
        }
    }
    // Get lyrics panel DOM elements
    function getLyricsEls() {
        const root = document.getElementById("spotui-lyrics");
        if (!root) return null;
        return {
            root,
            track: root.querySelector(".spotui-lyrics-track"),
            meta: root.querySelector(".spotui-lyrics-meta"),
            lines: root.querySelector(".spotui-lyrics-lines"),
        };
    }

    // Extract current playing track metadata for lyrics fetching
    function getCurrentTrackLyricsInfo() {
        const item = Spicetify.Player?.data?.item;
        if (!item?.uri || !String(item.uri).includes(":track:")) return null;

        const track = normalizeTrackItem(item);
        const album = item.album?.name || item.metadata?.album_title || item.metadata?.album || "";
        const durationMs = Spicetify.Player.getDuration() || Number(item.duration?.milliseconds) || 0;

        return {
            uri: item.uri,
            title: track.name,
            artist: track.artist || "Unknown",
            album: album || track.name,
            durationMs,
            durationSec: Math.round(durationMs / 1000),
        };
    }

    // Parse LRC format lyrics to line objects with timestamps
    // LRC format: [mm:ss.ms]lyric text
    // Return an array of {startTime: milliseconds, text: string}
    function parseLrc(lrcText) {
        if (!lrcText) return [];
        const lines = [];
        for (const raw of String(lrcText).split(/\r?\n/)) {
            const stamps = [...raw.matchAll(LRC_STAMP_REGEX)];
            if (!stamps.length) continue;
            const text = raw.replace(LRC_STAMP_STRIP_REGEX, "").trim();
            if (!text) continue;
            for (const stamp of stamps) {
                lines.push({ startTime: (Number(stamp[1]) * 60 + Number(stamp[2])) * 1000, text });
            }
        }
        lines.sort((a, b) => a.startTime - b.startTime);
        return lines;
    }

    // Convert plain text lyrics to line objects (unsynced)
    // startTime -1 indicates no timing data
    function plainLyricsToLines(plainText) {
        return String(plainText || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(text => ({ startTime: -1, text }));
    }

    // Fetch lyrics from Spotify's color-lyrics API
    // Returns {lines, synced, provider, instrumental} or null
    async function fetchSpotifyColorLyrics(uri) {
        if (!uri || !Spicetify.CosmosAsync?.get) return null;
        const id = uri.split(":").pop();
        if (!id) return null;
        try {
            const body = await Spicetify.CosmosAsync.get(
                `https://spclient.wg.spotify.com/color-lyrics/v2/track/${id}?format=json&vocalRemoval=false&market=from_token`
            );
            const lyrics = body?.lyrics;
            if (!lyrics?.lines?.length) return null;
            const synced = lyrics.syncType === "LINE_SYNCED";
            const lines = lyrics.lines
                .map(line => ({ startTime: synced ? Number(line.startTimeMs) || 0 : -1, text: String(line.words || "").trim() }))
                .filter(line => line.text && line.text !== "♪");
            if (!lines.length) return null;
            return { lines, synced, provider: "Spotify", instrumental: false };
        } catch { return null; }
    }

    // Fetch lyrics from lrclib.net (fallback source)
    // Tries exact match first, then searches by closest duration
    async function fetchLrclibLyrics(info) {
        const headers = { "Lrclib-Client": "SpoTUI (https://github.com/SkenS/SpoTUI)" };
        const exactParams = new URLSearchParams({
            track_name: info.title,
            artist_name: info.artist.split(",")[0].trim(),
            album_name: info.album || info.title,
            duration: String(info.durationSec || 0),
        });
        try {
            const exactRes = await fetch(`https://lrclib.net/api/get?${exactParams}`, { headers });
            if (exactRes.ok) {
                const data = await exactRes.json();
                const result = normalizeLrclibPayload(data);
                if (result) return result;
            }
        } catch { }
        try {
            const searchParams = new URLSearchParams({
                track_name: info.title,
                artist_name: info.artist.split(",")[0].trim(),
            });
            const searchRes = await fetch(`https://lrclib.net/api/search?${searchParams}`, { headers });
            if (!searchRes.ok) return null;
            const results = await searchRes.json();
            if (!Array.isArray(results) || !results.length) return null;
            const target = info.durationSec || 0;
            results.sort((a, b) => {
                const da = Math.abs((a.duration || 0) - target);
                const db = Math.abs((b.duration || 0) - target);
                const syncBonus = x => x.syncedLyrics ? -0.5 : 0;
                return (da + syncBonus(a)) - (db + syncBonus(b));
            });
            return normalizeLrclibPayload(results[0]);
        } catch { return null; }
    }

    // Normalize lrclib API response to common format
    function normalizeLrclibPayload(data) {
        if (!data) return null;
        if (data.instrumental) return { lines: [], synced: false, provider: "lrclib", instrumental: true };
        const syncedLines = parseLrc(data.syncedLyrics);
        if (syncedLines.length) return { lines: syncedLines, synced: true, provider: "lrclib", instrumental: false };
        const plainLines = plainLyricsToLines(data.plainLyrics);
        if (plainLines.length) return { lines: plainLines, synced: false, provider: "lrclib", instrumental: false };
        return null;
    }

    // Fetch lyrics from all available sources
    // Tries Spotify first, then lrclib as fallback
    async function resolveTrackLyrics(info) {
        const spotify = await fetchSpotifyColorLyrics(info.uri);
        if (spotify) return spotify;
        const lrclib = await fetchLrclibLyrics(info);
        if (lrclib) return lrclib;
        return { lines: [], synced: false, provider: "", instrumental: false, error: "No lyrics found" };
    }

    // Display empty state message in lyrics panel
    function renderLyricsEmpty(message, detail = "") {
        const els = getLyricsEls();
        if (!els?.lines) return;
        app.lyricsActiveIndex = -1;
        app.cachedLyricsRows = [];
        app.cachedLyricsLoaders = [];
        els.lines.classList.remove("unsynced");
        els.lines.innerHTML = "";
        const empty = document.createElement("div");
        empty.className = "spotui-lyrics-empty";
        empty.textContent = "¯\\_(ツ)_/¯";
        els.lines.appendChild(empty);
    }

    // Animate lyrics panel sliding out (exit transition)
    function slideLyricsOut() {
        return new Promise((resolve) => {
            const els = getLyricsEls();
            if (!els?.lines) { resolve(); return; }
            const lines = els.lines;
            lines.classList.remove("spotui-lyrics-enter", "spotui-lyrics-enter-active");
            lines.classList.add("spotui-lyrics-exit-active");
            let done = false;
            const finish = (e) => {
                if (e && e.target !== lines) return;
                if (done) return;
                done = true;
                lines.removeEventListener("transitionend", finish);
                resolve();
            };
            lines.addEventListener("transitionend", finish);
            setTimeout(finish, 400);
        });
    }

    // Reset transform classes after slide transition
    function resetLyricsTransform() {
        const els = getLyricsEls();
        if (!els?.lines) return;
        const lines = els.lines;
        lines.style.transition = "none";
        lines.classList.remove("spotui-lyrics-exit-active");
        void lines.offsetWidth;
        lines.style.transition = "";
    }

    // Animate lyrics panel sliding in (enter transition)
    function slideLyricsIn() {
        const els = getLyricsEls();
        if (!els?.lines) return;
        const lines = els.lines;
        lines.classList.remove("spotui-lyrics-exit-active");
        lines.classList.add("spotui-lyrics-enter");
        void lines.offsetWidth;
        lines.classList.add("spotui-lyrics-enter-active");
        setTimeout(() => {
            lines.classList.remove("spotui-lyrics-enter", "spotui-lyrics-enter-active");
        }, 400);
    }

    // Display a loader while fetching lyrics
    function renderLyricsLoading() {
        const els = getLyricsEls();
        if (!els?.lines) return;
        app.lyricsActiveIndex = -1;
        app.cachedLyricsRows = [];
        app.cachedLyricsLoaders = [];
        els.lines.classList.remove("unsynced");
        els.lines.innerHTML = "";
        const wrap = document.createElement("div");
        wrap.className = "spotui-lyrics-loading";
        const spinner = document.createElement("span");
        spinner.className = "spotui-lyrics-fetch-loader";
        wrap.appendChild(spinner);
        els.lines.appendChild(wrap);
    }

    // Render lyric lines with optional gap loaders for synced lyrics
    function renderLyricsLines(lines, synced = true) {
        const els = getLyricsEls();
        if (!els?.lines) return;
        els.lines.innerHTML = "";
        els.lines.classList.toggle("unsynced", !synced);
        app.lyricsActiveIndex = -1;
        app.cachedLyricsRows = [];
        app.cachedLyricsLoaders = [];
        if (!lines.length) { renderLyricsEmpty(); return; }

        const GAP_THRESHOLD = 8000;
        const LYRIC_DURATION_ESTIMATE = 2000;

        if (synced && lines.length > 0 && lines[0].startTime > 3000) {
            const startLoader = document.createElement("div");
            startLoader.className = "spotui-lyrics-loader";
            startLoader.dataset.gapStart = "0";
            startLoader.dataset.gapEnd = String(lines[0].startTime);
            els.lines.appendChild(startLoader);
            app.cachedLyricsLoaders.push(startLoader);
        }

        lines.forEach((line, idx) => {
            const row = document.createElement("div");
            row.className = "spotui-lyrics-line";
            row.dataset.index = String(idx);
            row.textContent = line.text;
            els.lines.appendChild(row);
            app.cachedLyricsRows.push(row);

            if (synced && idx < lines.length - 1) {
                const currentLineStart = line.startTime;
                const nextLineStart = lines[idx + 1].startTime;
                const gap = nextLineStart - currentLineStart;

                if (gap >= GAP_THRESHOLD) {
                    const currentLineEnd = currentLineStart + LYRIC_DURATION_ESTIMATE;
                    const loader = document.createElement("div");
                    loader.className = "spotui-lyrics-loader";
                    loader.dataset.gapStart = String(currentLineEnd);
                    loader.dataset.gapEnd = String(nextLineStart);
                    els.lines.appendChild(loader);
                    app.cachedLyricsLoaders.push(loader);
                }
            }
        });

        if (synced && lines.length > 0) {
            const lastLine = lines[lines.length - 1];
            const lastLineEnd = lastLine.startTime + LYRIC_DURATION_ESTIMATE;
            const endLoader = document.createElement("div");
            endLoader.className = "spotui-lyrics-loader";
            endLoader.dataset.gapStart = String(lastLineEnd);
            endLoader.dataset.gapEnd = "999999999";
            els.lines.appendChild(endLoader);
            app.cachedLyricsLoaders.push(endLoader);
        }
    }

    function findActiveLyricIndex(lines, progressMs) {
        if (!lines?.length || lines[0].startTime < 0) return -1;
        let idx = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startTime <= progressMs) idx = i;
            else break;
        }
        return idx;
    }

    // Update lyric highlight and scroll position based on playback progress
    function syncLyricsHighlight(force = false) {
        if (!app.lyricsPanelOpen || !app.lyricsCache.synced || !app.lyricsCache.lines.length) return;
        const els = getLyricsEls();
        if (!els?.lines) return;
        const progress = Spicetify.Player.getProgress() || 0;
        const next = findActiveLyricIndex(app.lyricsCache.lines, progress);

        let activeLoaderIndex = -1;
        const loaders = app.cachedLyricsLoaders;
        const animationEnabled = document.body.classList.contains("spotui-lyrics-animation-on");

        loaders.forEach((loader, loaderIdx) => {
            const gapStart = Number(loader.dataset.gapStart);
            const gapEnd = Number(loader.dataset.gapEnd);
            const show = progress > gapStart && progress < gapEnd && animationEnabled;
            if (loader.style.display !== (show ? "block" : "none")) {
                loader.style.display = show ? "block" : "none";
            }
            if (loader.classList.contains("active") !== show) {
                loader.classList.toggle("active", show);
            }
            if (show) activeLoaderIndex = loaderIdx;
        });

        const useLoader = activeLoaderIndex !== -1 && animationEnabled;
        const loaderStateChanged = useLoader && activeLoaderIndex !== app.lyricsActiveLoaderIndex;
        if (!force && next === app.lyricsActiveIndex && !useLoader && !loaderStateChanged) return;

        const rows = app.cachedLyricsRows;
        const prevIndex = app.lyricsActiveIndex;

        if (useLoader) {
            const activeLoader = loaders[activeLoaderIndex];
            // Single DOM-order pass; rows only pay for real changes.
            const allElements = Array.from(els.lines.children);
            const pos = new Map();
            let p = 0;
            for (const child of allElements) pos.set(child, p++);
            const loaderPosition = pos.get(activeLoader);
            for (const row of rows) {
                const distance = Math.abs((pos.get(row) ?? -99) - loaderPosition);
                if (row.classList.contains("active")) row.classList.remove("active");
                const near = distance === 1;
                if (row.classList.contains("near") !== near) row.classList.toggle("near", near);
            }
        } else {
            // Common path: only the old and new neighborhoods can change.
            const prev = prevIndex;
            for (const i of [prev - 1, prev, prev + 1, next - 1, next, next + 1]) {
                const row = rows[i];
                if (!row) continue;
                if (row.classList.contains("active") !== (i === next)) {
                    row.classList.toggle("active", i === next);
                }
                const near = i === next - 1 || i === next + 1;
                if (row.classList.contains("near") !== near) {
                    row.classList.toggle("near", near);
                }
            }
        }

        app.lyricsActiveIndex = useLoader ? -1 : next;
        app.lyricsActiveLoaderIndex = useLoader ? activeLoaderIndex : -1;

        if (!useLoader && next >= 0) {
            // Step-by-step scrolls smooth; jumps (seek/track change) snap.
            const jumped = force || prevIndex < 0 || Math.abs(next - prevIndex) > 3;
            rows[next]?.scrollIntoView({ block: "center", behavior: jumped ? "auto" : "smooth" });
        } else if (useLoader && (loaderStateChanged || force)) {
            loaders[activeLoaderIndex]?.scrollIntoView({ block: "center", behavior: force ? "auto" : "smooth" });
        }
    }

    // Update lyrics panel header with track title and status
    function setLyricsHeader(info, statusText) {
        const els = getLyricsEls();
        if (!els) return;
        if (els.track) els.track.textContent = info ? `${info.title}${info.artist ? ` — ${info.artist}` : ""}` : "Nothing playing";
        if (els.meta) els.meta.textContent = statusText || "";
    }

    // Load lyrics for currently playing track with optional slide transition
    async function loadLyricsForCurrentTrack(isTransition = false) {
        const token = ++app.lyricsLoadToken;
        const info = getCurrentTrackLyricsInfo();
        const els = getLyricsEls();
        if (!els) return;

        if (isTransition) {
            await slideLyricsOut();
            if (token !== app.lyricsLoadToken) return;
            resetLyricsTransform();
        }

        if (!info) {
            app.lyricsCache = { uri: "", lines: [], synced: false, provider: "", instrumental: false, error: "" };
            setLyricsHeader(null, "");
            renderLyricsEmpty();
            if (isTransition) slideLyricsIn();
            return;
        }

        if (app.lyricsCache.uri === info.uri && (app.lyricsCache.lines.length || app.lyricsCache.instrumental || app.lyricsCache.error)) {
            setLyricsHeader(info, app.lyricsCache.instrumental ? "instrumental" : `${app.lyricsCache.synced ? "synced" : "unsynced"} · ${app.lyricsCache.provider || "cache"}`);
            if (app.lyricsCache.instrumental) renderLyricsEmpty("Instrumental", "No vocals to show for this track.");
            else if (app.lyricsCache.error) renderLyricsEmpty("No lyrics", app.lyricsCache.error);
            else { renderLyricsLines(app.lyricsCache.lines, app.lyricsCache.synced); syncLyricsHighlight(true); }
            if (isTransition) slideLyricsIn();
            return;
        }

        setLyricsHeader(info, "fetching…");
        renderLyricsLoading();

        const fetchPromise = resolveTrackLyrics(info);
        const result = isTransition
            ? (await Promise.all([fetchPromise, sleep(1000)]))[0]
            : await fetchPromise;

        if (token !== app.lyricsLoadToken || !app.lyricsPanelOpen) return;

        app.lyricsCache = {
            uri: info.uri,
            lines: result.lines || [],
            synced: Boolean(result.synced),
            provider: result.provider || "",
            instrumental: Boolean(result.instrumental),
            error: result.error || "",
        };

        if (app.lyricsCache.instrumental) { setLyricsHeader(info, "instrumental"); renderLyricsEmpty(); if (isTransition) slideLyricsIn(); return; }
        if (!app.lyricsCache.lines.length) { setLyricsHeader(info, "not found"); renderLyricsEmpty(); if (isTransition) slideLyricsIn(); return; }
        setLyricsHeader(info, `${app.lyricsCache.synced ? "synced" : "unsynced"} · ${app.lyricsCache.provider}`);
        renderLyricsLines(app.lyricsCache.lines, app.lyricsCache.synced);
        syncLyricsHighlight(true);
        if (isTransition) slideLyricsIn();
    }

    // Persist lyrics panel open/closed state
    function storeLyricsOpen(open) {
        storageSet(LYRICS_STORAGE_KEY, open ? "1" : "0");
    }

    // Check if a playable track is loaded in Spotify player
    function hasPlayableTrackItem() {
        const item = Spicetify?.Player?.data?.item;
        return Boolean(item?.uri && String(item.uri).includes(":track:"));
    }

    // Wait for player to load a track, then execute callback
    // Polls up to 40 times (10 seconds) before giving up. The token aborts
    // chains orphaned by a panel close (or a newer load) at every step.
    function waitForPlayerReadyThen(callback, attempt = 0, token = app.lyricsLoadToken) {
        if (token !== app.lyricsLoadToken) return;
        if (hasPlayableTrackItem()) {
            callback();
            return;
        }
        if (attempt >= 40) {
            callback();
            pollForTrackThenReload(token);
            return;
        }
        setTimeout(() => waitForPlayerReadyThen(callback, attempt + 1, token), 250);
    }

    // Poll for track availability and reload lyrics when found
    function pollForTrackThenReload(token = app.lyricsLoadToken) {
        if (token !== app.lyricsLoadToken || !app.lyricsPanelOpen) return;
        if (hasPlayableTrackItem()) {
            loadLyricsForCurrentTrack();
            return;
        }
        setTimeout(() => pollForTrackThenReload(token), 1000);
    }

    // Open lyrics panel and start syncing with playback
    function openLyricsPanel() {
        closeActivePanel();
        app.lyricsPanelOpen = true;
        storeLyricsOpen(true);
        document.body.classList.add("spotui-lyrics-panel");
        
        const logoVisible = storageGet("spotui:logo-visible");
        if (logoVisible === "on") {
            document.body.classList.add("logo-on");
            document.body.classList.remove("logo-off");
        } else if (logoVisible === "off") {
            document.body.classList.add("logo-off");
            document.body.classList.remove("logo-on");
        } else {
            document.body.classList.add("logo-on");
            document.body.classList.remove("logo-off");
        }
        
        document.addEventListener("keydown", handleGlobalEsc);
        const root = document.getElementById("spotui-lyrics");
        if (root) {
            root.hidden = false;
            setTimeout(() => root.classList.add("spotui-lyrics-active"), 10);
        }
        bindLyricsEvents();
        loadLyricsForCurrentTrack();
        if (!app.lyricsSyncInterval) {
            app.lyricsSyncInterval = setInterval(() => syncLyricsHighlight(), 200);
        }
    }

    // Close lyrics panel and clean up interval/listeners
    function closeLyricsPanel() {
        if (!app.lyricsPanelOpen) return;
        app.lyricsPanelOpen = false;
        app.lyricsLoadToken += 1;
        resetLyricsTransform();
        storeLyricsOpen(false);
        document.removeEventListener("keydown", handleGlobalEsc);
        const root = document.getElementById("spotui-lyrics");
        if (root) {
            root.classList.remove("spotui-lyrics-active");
            setTimeout(() => {
                if (!app.lyricsPanelOpen) {
                    root.hidden = true;
                    document.body.classList.remove("spotui-lyrics-panel");
                }
            }, 500);
        } else {
            document.body.classList.remove("spotui-lyrics-panel");
        }
        if (app.lyricsSyncInterval) { clearInterval(app.lyricsSyncInterval); app.lyricsSyncInterval = null; }
        emitPaneClose("lyrics");
    }

    // Attach event listener for track changes to reload lyrics
    function bindLyricsEvents() {
        if (app.lyricsBound || !Spicetify.Player?.addEventListener) return;
        app.lyricsBound = true;
        Spicetify.Player.addEventListener("songchange", () => {
            if (!app.lyricsPanelOpen) return;
            app.lyricsCache = { uri: "", lines: [], synced: false, provider: "", instrumental: false, error: "" };
            loadLyricsForCurrentTrack(true);
        });
    }

    // Handle lyrics command
    function handleLyricsCommand(arg) {
        const mode = String(arg || "").trim().toLowerCase();
        if (mode === "on" || mode === "open") { if (!app.lyricsPanelOpen) openLyricsPanel(); return; }
        if (mode === "off" || mode === "close") { closeLyricsPanel(); return; }
        if (mode && mode !== "toggle") return;
        if (app.lyricsPanelOpen) { closeLyricsPanel(); }
        else { openLyricsPanel(); }
    }

    function applyCssVar(key, cssVar) {
        const root = document.documentElement;
        const value = storageGet(key);
        if (value) root.style.setProperty(cssVar, value);
        else root.style.removeProperty(cssVar);
    }

    // Parse color flag arguments and save valid hex colors to storage
    function handleColorArgs(args, flagToKey) {
        const argsLower = args.map((a) => a.toLowerCase());
        if (argsLower.includes("off")) {
            Object.keys(flagToKey).forEach((flag) => storageRemove(flagToKey[flag]));
            return;
        }
        Object.keys(flagToKey).forEach((flag) => {
            const idx = argsLower.indexOf(flag);
            if (idx === -1) return;
            const value = args[idx + 1];
            if (isValidShade(value)) storageSet(flagToKey[flag], value);
        });
    }
    // Apply stored lyric color preferences from localStorage
    function applyLyricColors() {
        try {
            applyCssVar(LYRICS_COLOR_ACTIVE, "--lyrics-color-active");
            applyCssVar(LYRICS_COLOR_INACTIVE, "--lyrics-color-inactive");
            applyCssVar(LYRICS_COLOR_LIGHT_INACTIVE, "--lyrics-color-light-inactive");
        } catch (e) {
            console.error("SpoTUI: Failed to apply lyric colors", e);
        }
    }

    function applyLyricLineSpacing() {
    	try {
    		applyCssVar(LYRICS_LINE_SPACING, "--lyrics-line-spacing");
    	} catch (e) {
    		console.error("SpoTUI: Failed to apply line spacing", e);
    	}
    }

    function applyVisualizerColor() {
        applyCssVar(VISUALIZER_COLOR, "--visualizer-color");
    }

    // Apply stored player bar color preferences from localStorage
    function applyPlayerBarColors() {
        try {
            const root = document.documentElement;
            const border = storageGet(PLAYER_BAR_BORDER);
            applyCssVar(PLAYER_BAR_BG, "--player-bar-background");
            if (border) {
                root.style.setProperty("--player-bar-border-color", border);
                root.style.setProperty("--spotui-accent", border);
                const rgb = parseHexToRgb255(border).join(", ");
                if (rgb) root.style.setProperty("--spotui-accent-rgb", rgb);
            } else {
                root.style.removeProperty("--player-bar-border-color");
                root.style.removeProperty("--spotui-accent");
                root.style.removeProperty("--spotui-accent-rgb");
            }
            applyCssVar(PLAYER_BAR_TEXT, "--player-bar-text-color");
        } catch (e) {
            console.error("SpoTUI: Failed to apply player bar colors", e);
        }
    }

    // Toggle player bar visibility
    function applyPlayerBarVisibility() {
        try {
            const visible = storageGet(PLAYER_BAR_VISIBLE);
            document.body.classList.toggle("spotui-bar-off", visible === "off");
            // The legacy .Root__now-playing-bar hook is dead on recent Spotify
            // and the bar can nest inside hidden landmarks, so visibility is
            // enforced inline on the detected bar region (no class names).
            nativeBarTagTries = 0;
            hookBarPlayer();
            if (visible === "off") hideNativeBar();
            else showNativeBar();
        } catch {
            console.error("SpoTUI: Failed to apply player bar visibility");
        }
    }

    // Elements this module hides inline (cleared on Spotify mode) and the last
    // detected native bar region.
    let barTouched = [];
    let nativeBar = null;

    function clearBarInline() {
        barTouched.forEach((el) => { try { el.style.removeProperty("display"); } catch {} });
        barTouched = [];
        document.querySelectorAll("[data-spotui-keep]").forEach((el) => el.removeAttribute("data-spotui-keep"));
    }

    function touchBarNode(el, value) {
        try { el.style.setProperty("display", value, "important"); } catch {}
        if (!barTouched.includes(el)) barTouched.push(el);
    }

    // Exempt a node from landmark hiding. No display value is ever set to
    // show: both inline and stylesheet revert would clobber Spotify's own
    // flex/grid with browser defaults — exemption preserves client layout.
    function keepBarNode(el) {
        try { el.setAttribute("data-spotui-keep", "1"); } catch {}
    }

    // Collect every real control in the bottom strip (play button, art,
    // sliders — any tag, since the player is custom div-built). Pure reads;
    // cheap when batched with no writes in between.
    function scanBottomSeeds(main) {
        let els = [];
        try { els = Array.from(main.querySelectorAll("*")); } catch { return []; }
        const H = window.innerHeight, W = window.innerWidth;
        const out = [];
        for (const el of els) {
            let r;
            try { r = el.getBoundingClientRect(); } catch { continue; }
            if (r.width > 24 && r.width < W * 0.9 && r.height >= 3 && r.height < 200 && r.bottom > H - 280) out.push(el);
            if (out.length >= 40) break;
        }
        return out;
    }

    // Climb from a control to the topmost bar-shaped ancestor (wide, short,
    // bottom-pinned): the player bar region root.
    function climbBarShaped(seed, main) {
        let el = seed, top = null;
        while (el && el !== main) {
            let r;
            try { r = el.getBoundingClientRect(); } catch { break; }
            if (isBarShaped(r)) top = el;
            el = el.parentElement;
        }
        return top;
    }

    function isBarShaped(r) {
        const W = window.innerWidth, H = window.innerHeight;
        return r.width > W * 0.4 && r.height > 0 && r.height < 280 && r.bottom > H - 280;
    }

    // Find the native player bar: the data-testid hook first, then a bottom-strip
    // geometry scan. Hidden nodes report zero rects, so the last resort reveals
    // the client via the mode class, scans, and restores it — synchronously, so
    // nothing paints. Attribute observers (lyrics) only see the settled state.
    function detectNativeBar() {
        try {
            const main = document.getElementById("main");
            if (!main) return null;
            const direct = main.querySelector('[data-testid="now-playing-bar"]');
            if (direct) return direct;
            if (nativeBar && main.contains(nativeBar)) {
                try { if (isBarShaped(nativeBar.getBoundingClientRect())) return nativeBar; } catch {}
            }
            const scan = () => {
                for (const seed of scanBottomSeeds(main)) {
                    const top = climbBarShaped(seed, main);
                    if (top) return top;
                }
                return null;
            };
            const found = scan();
            if (found) return found;
            try {
                document.body.classList.add("spotui-spotify-enabled");
                void main.offsetHeight;
                return scan();
            } finally {
                document.body.classList.remove("spotui-spotify-enabled");
            }
        } catch { return null; }
    }

    // Show native bar: exempt the chain (bar root up to #main) from landmark
    // hiding and hide each level's other children inline. Nothing inside the
    // bar root is touched and no display value is forced to show, so client
    // flex/grid layout and all controls render normally.
    function showNativeBar() {
        clearBarInline();
        const main = document.getElementById("main");
        const bar = detectNativeBar() || nativeBar;
        if (!bar || !main || !main.contains(bar)) {
            scheduleNativeBarTag();
            return;
        }
        nativeBar = bar;
        const chain = [];
        let el = bar;
        while (el && el !== main && el !== document.body) {
            chain.push(el);
            el = el.parentElement;
        }
        chain.forEach((n) => {
            keepBarNode(n);
            const p = n.parentElement;
            if (!p) return;
            Array.from(p.children).forEach((sib) => {
                if (sib !== n && sib.nodeType === 1) touchBarNode(sib, "none");
            });
        });
    }

    // Hide native bar: inline-hide the detected region root (the landmark CSS
    // and the spotui-bar-off class cover the rest).
    function hideNativeBar() {
        clearBarInline();
        const main = document.getElementById("main");
        const bar = detectNativeBar() || nativeBar;
        if (bar && (!main || main.contains(bar))) {
            nativeBar = bar;
            touchBarNode(bar, "none");
        }
    }

    let nativeBarTagTries = 0;
    // The player DOM can mount after the bundle runs; retry a few times
    // (bounded) so a slow boot with native bar on keeps it visible.
    function scheduleNativeBarTag() {
        if (nativeBarTagTries >= 5) return;
        nativeBarTagTries += 1;
        setTimeout(() => {
            try {
                if (storageGet(PLAYER_BAR_VISIBLE) === "off") return;
                if (document.body.classList.contains("spotui-spotify-enabled")) return;
                showNativeBar();
            } catch {}
        }, 4000);
    }

    let barPlayerHooked = false;
    // Re-assert stored bar state on playback changes (covers late mounts,
    // slow boots and node replacements). Installed eagerly; once-guarded.
    function hookBarPlayer() {
        if (barPlayerHooked) return;
        try {
            if (Spicetify?.Player?.addEventListener) {
                const reassert = () => {
                    try {
                        if (document.body.classList.contains("spotui-spotify-enabled")) return;
                        // Not applyPlayerBarVisibility: that would reset the
                        // spotui-bar-off class (jam guests force it on).
                        if (storageGet(PLAYER_BAR_VISIBLE) === "off") hideNativeBar();
                        else showNativeBar();
                    } catch {}
                };
                Spicetify.Player.addEventListener("songchange", reassert);
                Spicetify.Player.addEventListener("onplaypause", reassert);
                barPlayerHooked = true;
            }
        } catch {}
    }

    // Spotify mode shows the full client: drop JS bar overrides (stored state
    // is re-applied when returning to TUI mode).
    function clearNativeBarOverrides() {
        clearBarInline();
    }

    // Render progress bar using specified style and fill percentage
    function renderProgressBar(progress, styleId, width) {
        const style = PROGRESS_STYLES[styleId] || PROGRESS_STYLES["classic-block"];
        const filled = Math.round(progress * width);
        const empty = width - filled;
        let filledStr = "";
        let emptyStr = "";
        if (style.fg.length === 1) {
            filledStr = style.fg.repeat(filled);
            emptyStr = style.bg ? style.bg.repeat(empty) : "";
        } else {
            const fgChars = [...style.fg];
            for (let i = 0; i < filled; i++) {
                const idx = Math.floor((i / filled) * fgChars.length);
                filledStr += fgChars[idx] || fgChars[fgChars.length - 1];
            }
            emptyStr = style.bg ? style.bg.repeat(empty) : "";
        }
        return filledStr + emptyStr;
    }

    // Recalculate custom bar progress width on window resize (cached; the
    // per-second tick reads the cache instead of forcing layout each time).
    function updateCustomBarWidth() {
        if (!document.body.classList.contains("spotui-custom-bar-on")) return;
        const bar = document.getElementById("spotui-custom-bar");
        if (!bar) return;
        const rect = bar.getBoundingClientRect();
        const availableWidth = rect.width - 400;
        customBarLive.width = Math.max(40, Math.floor(availableWidth / 16));
    }

    // Custom bar live values read by the once-attached handlers below.
    const customBarLive = { duration: 0, progress: 0, width: 120, uri: null, heartTick: 0 };
    let customBarUpdating = false;

    function setTextIfChanged(el, text) {
        if (el && el.textContent !== text) el.textContent = text;
    }

    // Build the bar skeleton once (listeners attached once); per-tick updates
    // only touch textContent. Rebuilt from scratch every 300ms before.
    function ensureCustomBarSkeleton(bar) {
        let left = bar.querySelector(".spotui-custom-bar-left");
        if (left) {
            return {
                heart: left.querySelector(".spotui-custom-bar-heart"),
                title: left.querySelector(".spotui-custom-bar-title"),
                artist: left.querySelector(".spotui-custom-bar-artist"),
                progressEl: bar.querySelector(".spotui-custom-bar-progress"),
                timeEl: bar.querySelector(".spotui-custom-bar-time"),
                volEl: bar.querySelector(".spotui-custom-bar-vol"),
            };
        }
        left = document.createElement("div");
        left.className = "spotui-custom-bar-left";
        const heart = document.createElement("button");
        heart.className = "spotui-custom-bar-heart";
        heart.setAttribute("aria-label", "Like/unlike track");
        heart.addEventListener("click", async () => {
            try { await Spicetify.Player.toggleHeart(); } catch {}
        });
        heart.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                try { Spicetify.Player.toggleHeart(); } catch {}
            }
        });
        const title = document.createElement("span");
        title.className = "spotui-custom-bar-title";
        const artistSpan = document.createElement("span");
        artistSpan.className = "spotui-custom-bar-artist";
        left.appendChild(heart);
        left.appendChild(title);
        left.appendChild(artistSpan);
        const progressEl = document.createElement("button");
        progressEl.className = "spotui-custom-bar-progress";
        progressEl.setAttribute("aria-label", "Playback progress");
        progressEl.addEventListener("click", (e) => {
            const rect = progressEl.getBoundingClientRect();
            const offsetX = e.clientX - rect.left;
            const pct = Math.max(0, Math.min(1, offsetX / rect.width));
            try { Spicetify.Player.seek(pct * customBarLive.duration); } catch {}
        });
        progressEl.addEventListener("keydown", (e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                const step = (e.key === "ArrowLeft" ? -5e3 : 5000);
                const targetMs = Math.max(0, Math.min(customBarLive.duration, customBarLive.progress + step));
                try { Spicetify.Player.seek(targetMs); } catch {}
            }
        });
        const timeEl = document.createElement("div");
        timeEl.className = "spotui-custom-bar-time";
        const volEl = document.createElement("div");
        volEl.className = "spotui-custom-bar-vol";
        volEl.addEventListener("wheel", (e) => {
            e.preventDefault();
            const cur = Spicetify.Player.getVolume();
            const delta = e.deltaY < 0 ? 0.05 : -0.05;
            Spicetify.Player.setVolume(Math.max(0, Math.min(1, cur + delta)));
        }, { passive: false });
        const right = document.createElement("div");
        right.className = "spotui-custom-bar-right";
        right.appendChild(volEl);
        const center = document.createElement("div");
        center.className = "spotui-custom-bar-center";
        center.appendChild(progressEl);
        center.appendChild(timeEl);
        bar.innerHTML = "";
        bar.appendChild(left);
        bar.appendChild(center);
        bar.appendChild(right);
        return { heart, title, artist: artistSpan, progressEl, timeEl, volEl };
    }

    // Update custom player bar (in place: skeleton built once above)
    async function updateCustomBar() {
        if (customBarUpdating) return;
        customBarUpdating = true;
        try {
            const bar = document.getElementById("spotui-custom-bar");
            if (!bar) return;
            const track = Spicetify.Player.data?.item;
            if (!track) {
                if (!bar.querySelector(".spotui-custom-bar-empty")) {
                    bar.innerHTML = "<div class='spotui-custom-bar-empty'>Nothing playing</div>";
                }
                return;
            }
            const skel = ensureCustomBarSkeleton(bar);
            const meta = track.metadata || {};
            const title = track.name || meta.title || "Unknown";
            const artist = track.artist || meta.artist_name || "Unknown";
            const uri = track.uri || `${title} - ${artist}`;
            const progress = Spicetify.Player.getProgress();
            const duration = Spicetify.Player.getDuration();
            const volume = Spicetify.Player.getVolume();
            customBarLive.duration = duration;
            customBarLive.progress = progress;
            // Heart state is IPC: refresh on track change, else every 5th tick
            // (covers likes made outside the bar).
            customBarLive.heartTick = (customBarLive.heartTick + 1) % 5;
            let liked = skel.heart.textContent === "X";
            if (uri !== customBarLive.uri || customBarLive.heartTick === 0) {
                customBarLive.uri = uri;
                try {
                    liked = Spicetify.Player.getHeart ? await Spicetify.Player.getHeart() : false;
                } catch { liked = false; }
            }
            const progressPct = duration > 0 ? progress / duration : 0;
            const styleId = storageGet(CUSTOM_BAR_PROGRESS_STYLE) || "classic-block";
            setTextIfChanged(skel.title, title);
            setTextIfChanged(skel.artist, artist);
            const heartText = liked ? "X" : "♥";
            setTextIfChanged(skel.heart, heartText);
            skel.heart.setAttribute("aria-label", liked ? "Unlike track" : "Like track");
            setTextIfChanged(skel.progressEl, renderProgressBar(progressPct, styleId, customBarLive.width));
            setTextIfChanged(skel.timeEl, `${Math.floor(progress / 1000 / 60)}:${String(Math.floor(progress / 1000) % 60).padStart(2, "0")} / ${Math.floor(duration / 1000 / 60)}:${String(Math.floor(duration / 1000) % 60).padStart(2, "0")}`);
            setTextIfChanged(skel.volEl, `Vol: ${Math.round(volume * 100)}%`);
        } catch {
            console.error("SpoTUI: Failed to update custom bar");
        } finally {
            customBarUpdating = false;
        }
    }

    // Apply custom player bar state
    function applyCustomBarState() {
        if (window.spotuiCustomBarInterval) {
            clearInterval(window.spotuiCustomBarInterval);
            delete window.spotuiCustomBarInterval;
        }

        const enabled = storageGet(CUSTOM_BAR_ENABLED);
        const visible = storageGet(PLAYER_BAR_VISIBLE);
        if (enabled === "on" && visible === "off") {
            document.body.classList.add("spotui-custom-bar-on");
            let bar = document.getElementById("spotui-custom-bar");
            if (!bar) {
                bar = document.createElement("div");
                bar.id = "spotui-custom-bar";
                bar.className = "spotui-custom-bar";
                document.body.appendChild(bar);
            }
            updateCustomBar();
            updateCustomBarWidth();
            const interval = setInterval(updateCustomBar, 1000);
            window.spotuiCustomBarInterval = interval;
            window.addEventListener("resize", updateCustomBarWidth);
        } else {
            document.body.classList.remove("spotui-custom-bar-on");
            if (window.spotuiCustomBarInterval) {
                clearInterval(window.spotuiCustomBarInterval);
                delete window.spotuiCustomBarInterval;
            }
            window.removeEventListener("resize", updateCustomBarWidth);
        }
    }

    // Apply stored progress bar colors
    function applyProgressBarColors() {
        try {
            applyCssVar(PROGRESS_BAR_BG, "--progress-bar-background");
            applyCssVar(PROGRESS_BAR_FG, "--progress-bar-foreground");
        } catch (e) {
            console.error("SpoTUI: Failed to apply progress bar colors", e);
        }
    }

    // Apply stored input field colors
    function applyInputColors() {
        try {
            applyCssVar(INPUT_BG, "--input-bg-color");
            applyCssVar(INPUT_BG_HOVER, "--input-bg-hover-color");
            applyCssVar(INPUT_TEXT, "--input-text-color");
            applyCssVar(INPUT_BORDER, "--input-border-color");
        } catch (e) {
            console.error("SpoTUI: Failed to apply input colors", e);
        }
    }

    // Darken hex color by multiplying RGB values (alpha preserved)
    function darkenHexColor(hex, factor) {
        const m = String(hex || "").replace("#", "");
        const alpha = m.length === 4 ? m[3] + m[3] : (m.length === 8 ? m.slice(6, 8) : "");
        const [r, g, b] = parseHexToRgb255(hex);
        const [nr, ng, nb] = [r, g, b].map((v) => Math.max(0, Math.round(v * factor)));
        return `#${[nr, ng, nb].map((v) => v.toString(16).padStart(2, "0")).join("")}${alpha}`;
    }

    // Apply stored panel colors
    function applyPanelColors() {
        try {
            applyCssVar(PANEL_BG, "--panel-bg-color");
            applyCssVar(PANEL_BORDER, "--panel-border-color");
            applyCssVar(PANEL_TEXT, "--panel-text-color");
            const root = document.documentElement;
            const text = storageGet(PANEL_TEXT);
            if (text && isValidShade(text)) {
                root.style.setProperty("--panel-text-hover-color", darkenHexColor(text, 0.7));
            } else {
                root.style.removeProperty("--panel-text-hover-color");
            }
        } catch (e) {
            console.error("SpoTUI: Failed to apply panel colors", e);
        }
    }

    // Apply input control buttons
    function applyInputButtonsVisibility() {
        try {
            const state = storageGet(INPUT_BUTTONS) || "on";
            const controls = document.getElementById("spotui-controls");
            if (controls) {
                controls.style.display = state === "off" ? "none" : "flex";
            }
        } catch (e) {
            console.error("SpoTUI: Failed to apply input buttons visibility", e);
        }
    }
    // Create control buttons - Lyrics, Enable Spotify, Back (idempotent: same
    // double-boot path as createTerminal must not duplicate ids/listeners).
    function createControlButtons() {
        try {
            if (document.getElementById("spotui-controls")) return;
        } catch (e) {}
        const controls = document.createElement("div");
        controls.id = "spotui-controls";
        const state = storageGet(INPUT_BUTTONS) || "on";
        controls.style.display = state === "off" ? "none" : "flex";

        const lyricsBtn = createButton("lyrics-btn", "spotui-control-btn", "Lyrics", () => {
            handleLyricsCommand();
        });

        const placeBackBtn = () => {
            const nav = document.querySelector(".main-globalNav-historyButtonsWrapper");
            if (nav && backBtn.parentElement !== nav) nav.appendChild(backBtn);
        };

        const spotifyBtn = createButton("enable-spotify-btn", "spotui-control-btn", "Enable Spotify", () => {
            const enabled = document.body.classList.toggle("spotui-spotify-enabled");
            if (enabled) {
                document.body.classList.add("spotui-tui-hidden");
                spotifyBtn.textContent = "Disable Spotify";
                clearNativeBarOverrides();
                placeBackBtn();
            } else {
                spotifyBtn.textContent = "Enable Spotify";
                document.body.classList.remove("spotui-tui-hidden");
                applyPlayerBarVisibility();
                applyCustomBarState();
                startAsciiPaintLoop();
            }
        });

        const standbyBtn = createButton("standby-btn", "spotui-control-btn spotui-standby-btn", "", () => {
            enterStandby();
        });
        standbyBtn.setAttribute("aria-label", "Standby");
        standbyBtn.title = "Standby";
        standbyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true"><path fill-rule="evenodd" d="M1 3.5a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 0 1h-13a.5.5 0 0 1-.5-.5M8 6a.5.5 0 0 1 .5.5v5.793l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 .708-.708L7.5 12.293V6.5A.5.5 0 0 1 8 6"/></svg>`;

        controls.appendChild(lyricsBtn);
        controls.appendChild(spotifyBtn);
        controls.appendChild(standbyBtn);
        (document.getElementById("spotui-footer") || document.body).appendChild(controls);

        const backBtn = createButton("spotui-back-btn", "spotui-control-btn", "Back", () => {
            document.body.classList.remove("spotui-spotify-enabled", "spotui-tui-hidden");
            spotifyBtn.textContent = "Enable Spotify";
            applyPlayerBarVisibility();
            applyCustomBarState();
            syncLyricsState();
        });
        backBtn.type = "button";
        document.body.appendChild(backBtn);
    }
    // Toggle ASCII logo visibility
    function toggleLogo(state) {
        if (state === "on") {
            document.body.classList.remove("logo-off");
            document.body.classList.add("logo-on");
            storageSet("spotui:logo-visible", "on");
            startAsciiPaintLoop();
        } else if (state === "off") {
            document.body.classList.remove("logo-on");
            document.body.classList.add("logo-off");
            storageSet("spotui:logo-visible", "off");
        }
    }
    // Reset all theme customizations to defaults.
    // Preserves app state (launched, banner), personal config (keybinds,
    // history, actions), and the poster library + API token.
    function resetAllSettings() {
        const wp = document.getElementById("spotui-wallpaper");
        if (wp) wp.remove();
        storageRemove(WP_URL_KEY);
        storageRemove(WP_OPACITY_KEY);
        storageRemove(WP_FIT_KEY);
        storageRemove(WP_POS_KEY);
        storageRemove(WP_RICH_KEY);

        app.asciiEnabled = true;
        storageRemove(ANIMATION_KEY);

        storageRemove("spotui:logo-visible");
        document.body.classList.remove("logo-off");

        storageRemove(LYRICS_COLOR_ACTIVE);
        storageRemove(LYRICS_COLOR_INACTIVE);
        storageRemove(LYRICS_COLOR_LIGHT_INACTIVE);
        applyLyricColors();

        storageRemove(LYRICS_LINE_SPACING);
        applyLyricLineSpacing();

        storageRemove(VISUALIZER_COLOR);
        applyVisualizerColor();

        storageRemove(PLAYER_BAR_BG);
        storageRemove(PLAYER_BAR_BORDER);
        storageRemove(PLAYER_BAR_TEXT);
        storageRemove(PLAYER_BAR_VISIBLE);
        storageRemove(CUSTOM_BAR_ENABLED);
        storageRemove(CUSTOM_BAR_PROGRESS_STYLE);
        applyPlayerBarColors();
        applyPlayerBarVisibility();
        applyCustomBarState();

        storageRemove(PROGRESS_BAR_BG);
        storageRemove(PROGRESS_BAR_FG);
        applyProgressBarColors();

        storageRemove(INPUT_BG);
        storageRemove(INPUT_BG_HOVER);
        storageRemove(INPUT_TEXT);
        storageRemove(INPUT_BORDER);
        storageRemove(INPUT_BUTTONS);
        applyInputColors();
        applyInputButtonsVisibility();

        storageRemove(PANEL_BG);
        storageRemove(PANEL_BORDER);
        storageRemove(PANEL_TEXT);
        applyPanelColors();

        storageRemove(SHADE_KEY);
        applyShade();

        storageRemove(LYRICS_ANIMATION_KEY);
        document.body.classList.add("spotui-lyrics-animation-on");

        resetPosterPrefs();
        setPostersEnabled(false);
    }

    const PREV_OPENERS = {
        lyrics: openLyricsPanel,
        help: openHelpPanel,
        about: openAboutPanel,
        playlist: openPlaylistPanel,
        theme: openThemePanel,
    };

    let djSyncRaf = 0;

    function detectDjMode() {
        return Boolean(document.querySelector(".XTtlZOmdtscvhPLr, .dj-button"));
    }

    function detectDjCover() {
        return Boolean(document.querySelector(`[src*="Your-DJ-Cover-Art-300.png"], [href*="Your-DJ-Cover-Art-300.png"], [srcset*="Your-DJ-Cover-Art-300.png"], [style*="Your-DJ-Cover-Art-300.png"]`));
    }

    function currentPane() {
        if (app.lyricsPanelOpen) return "lyrics";
        if (app.helpPanelOpen) return "help";
        if (app.aboutPanelOpen) return "about";
        if (app.playlistPanelOpen) return "playlist";
        if (app.themePanelOpen) return "theme";
        return null;
    }

    function showDjTag() {
        setStatusTag("spotui-dj-tags", ["This client is being controlled by Spotify DJ"]);
    }

    function hideDjTag() {
        setStatusTag("spotui-dj-tags", []);
    }

    function openDjPanel() {
        if (!app.djPanelOpen) {
            app.djPrevPane = currentPane();
            closeActivePanel();
            app.djPanelOpen = true;
            document.body.classList.add("spotui-dj-panel");
        }
        const root = document.getElementById("spotui-dj");
        if (root && root.hidden) {
            root.hidden = false;
            setTimeout(() => root.classList.add("spotui-dj-active"), 10);
        }
    }

    function closeDjPanel() {
        if (!app.djPanelOpen) return;
        app.djPanelOpen = false;
        const root = document.getElementById("spotui-dj");
        if (root) {
            root.classList.remove("spotui-dj-active");
            setTimeout(() => {
                if (!app.djPanelOpen) {
                    root.hidden = true;
                    document.body.classList.remove("spotui-dj-panel");
                }
            }, 500);
        } else {
            document.body.classList.remove("spotui-dj-panel");
        }
        const prev = app.djPrevPane;
        app.djPrevPane = null;
        const open = PREV_OPENERS[prev];
        if (open) open();
    }

    function syncDjState() {
        const mode = detectDjMode();
        if (mode !== app.djMode) {
            app.djMode = mode;
            document.body.classList.toggle("spotui-dj-mode", mode);
            if (mode) showDjTag();
            else hideDjTag();
        }
        const cover = detectDjCover();
        if (cover && !app.djPanelOpen) openDjPanel();
        else if (!cover && app.djPanelOpen) closeDjPanel();
    }

    function initDjBridge() {
        if (!document.body) {
            setTimeout(initDjBridge, 250);
            return;
        }
        syncDjState();
        if (!app.djObserver) {
            // Mutation bursts coalesce into one sync per frame; syncDjState
            // itself no-ops when mode/cover are unchanged.
            app.djObserver = new MutationObserver(() => {
                if (djSyncRaf) return;
                djSyncRaf = requestAnimationFrame(() => {
                    djSyncRaf = 0;
                    syncDjState();
                });
            });
            app.djObserver.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["class", "src", "href", "srcset", "style"],
            });
            window.addEventListener(
                "beforeunload",
                () => { app.djObserver?.disconnect(); },
                { once: true }
            );
        }
    }

    const style = `#spotui-tui {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 4.75rem;
    width: 100vw;
    background: #000;
    color: #ddd;
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 15px;
    padding: 40px;
    box-sizing: border-box;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    overflow-x: hidden;
    user-select: text;
    cursor: text;
}

/* Keep TUI content above the wallpaper layer (replaces a per-swap DOM crawl
   that also missed late-created nodes). The absolute overlays are excluded:
   like the old crawl's static-only check, this must not relativize them. */
#spotui-tui > :not(#spotui-wallpaper):not(#spotui-logo):not(#spotui-top-fade) {
    position: relative;
    z-index: 1;
}

#spotui-logo {
    position: absolute;
    left: 50%;
    top: 41%;
    transform: translate(-50%, -50%);
    color: var(--spotui-accent, #ff8c42);
    opacity: 1;
    white-space: pre;
    text-align: center;
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 28px;
    line-height: 1.0;
    pointer-events: none;
    user-select: none;
    z-index: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: top 0.5s cubic-bezier(0.4, 0, 0.2, 1), transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

body.spotui-lyrics-panel #spotui-logo,
body.spotui-dj-panel #spotui-logo,
body.spotui-playlist-panel #spotui-logo,
body.spotui-add2list-panel #spotui-logo,
body.spotui-help-panel #spotui-logo,
body.spotui-theme-panel #spotui-logo,
body.spotui-search-panel #spotui-logo,
body.spotui-about-panel #spotui-logo,
body.spotui-boards-panel #spotui-logo,
body.spotui-saves-panel #spotui-logo,
body.spotui-onboarding-panel #spotui-logo {
    top: 12px;
    transform: translate(-50%, 0) scale(0.6);
    opacity: 0.8;
    z-index: 2;
    background-color: transparent;
}

#spotui-onboarding-panel {
    display: none;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 18px;
    padding: 30px;
    overflow-y: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    margin: 33vh 5vw 8px;
    height: 60vh;
    border: 1px solid var(--panel-border-color, rgba(var(--spotui-accent-rgb, 255, 140, 66), 0.3));
    border-radius: 6px;
    background: var(--panel-bg-color, transparent);
}

body.spotui-onboarding-panel #spotui-onboarding-panel {
    display: flex;
}

.spotui-onboarding-stage {
    display: flex;
    flex-direction: column;
    gap: 18px;
    min-height: 100%;
}

.spotui-onboarding-copy h2 {
    margin: 0 0 8px;
    color: var(--spotui-accent, #ff8c42);
    font-size: 28px;
    line-height: 1.1;
}

.spotui-onboarding-kicker {
    color: #b3b3b3;
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    margin-bottom: 8px;
}

.spotui-onboarding-copy p,
.spotui-onboarding-primer,
.spotui-onboarding-actions,
.spotui-onboarding-callout {
    color: #ddd;
}

.spotui-onboarding-copy code,
.spotui-onboarding-primer code,
.spotui-onboarding-callout code {
    color: var(--spotui-accent, #ff8c42);
    background: rgba(var(--spotui-accent-rgb, 255, 140, 66), 0.12);
    border: 1px solid rgba(var(--spotui-accent-rgb, 255, 140, 66), 0.22);
    border-radius: 4px;
    padding: 0 4px;
    font-family: "JetBrains Mono", monospace;
}

.spotui-onboarding-copy code {
    white-space: nowrap;
}

.spotui-onboarding-copy p code,
.spotui-onboarding-callout code {
    display: inline-block;
    line-height: 1.2;
}

.spotui-onboarding-primer {
    border: 1px solid rgba(var(--spotui-accent-rgb, 255, 140, 66), 0.2);
    border-radius: 6px;
    padding: 16px;
    display: grid;
    gap: 8px;
}

.spotui-onboarding-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
}

.spotui-onboarding-actions.centered {
    justify-content: center;
    margin-top: auto;
}

.spotui-onboarding-callout {
    margin-top: auto;
    align-self: flex-start;
    max-width: 280px;
    border: 1px solid rgba(var(--spotui-accent-rgb, 255, 140, 66), 0.28);
    border-radius: 6px;
    padding: 12px 14px;
    background: rgba(0, 0, 0, 0.28);
}

.spotui-onboarding-callout .arrow {
    color: var(--spotui-accent, #ff8c42);
    font-size: 24px;
    line-height: 1;
    margin-bottom: 6px;
}

.spotui-onboarding-grid {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    padding: 0;
}

.spotui-onboarding-theme {
    border: 1px solid rgba(var(--spotui-accent-rgb, 255, 140, 66), 0.35);
    border-radius: 6px;
    background: rgba(0,0,0,0.35);
    color: #ddd;
    padding: 0;
    overflow: hidden;
    text-align: left;
    display: flex;
    flex-direction: column;
    cursor: pointer;
}

.spotui-onboarding-theme img {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    display: block;
}

.spotui-onboarding-theme span {
    padding: 10px 12px;
    font-family: "JetBrains Mono", monospace;
    color: var(--spotui-accent, #ff8c42);
}

body:has(#spotui-wallpaper) body.spotui-lyrics-panel #spotui-logo,
body:has(#spotui-wallpaper) body.spotui-dj-panel #spotui-logo,
body:has(#spotui-wallpaper) body.spotui-playlist-panel #spotui-logo,
body:has(#spotui-wallpaper) body.spotui-add2list-panel #spotui-logo,
body:has(#spotui-wallpaper) body.spotui-help-panel #spotui-logo,
body:has(#spotui-wallpaper) body.spotui-theme-panel #spotui-logo,
body:has(#spotui-wallpaper) body.spotui-about-panel #spotui-logo,
body:has(#spotui-wallpaper) body.spotui-boards-panel #spotui-logo,
body:has(#spotui-wallpaper) body.spotui-saves-panel #spotui-logo {
    background-color: #000;
}

#spotui-top-fade {
    display: block;
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 120px;
    background: linear-gradient(to bottom, rgba(0,0,0,1) 30%, rgba(0,0,0,0));
    pointer-events: none;
    z-index: 2;
}


.spotui-ascii-canvas {
    display: block;
    padding: 0;
    margin: 0;
    user-select: none;
    pointer-events: none;
    contain: layout style paint;
}

#spotui-help-panel::-webkit-scrollbar,
#spotui-about-panel::-webkit-scrollbar,
#spotui-theme-panel::-webkit-scrollbar,
#spotui-boards-panel::-webkit-scrollbar,
#spotui-saves-panel::-webkit-scrollbar,
#spotui-playlist-list::-webkit-scrollbar,
#spotui-add2list-list::-webkit-scrollbar,
#spotui-song-list::-webkit-scrollbar,
.spotui-lyrics-lines::-webkit-scrollbar {
    width: 0;
    height: 0;
}

#spotui-visualizer {
    display: none;
    width: 100%;
    height: 56px;
    flex: 0 0 56px;
    margin-top: auto;
    pointer-events: none;
}

body.spotui-visualizer-on #spotui-visualizer {
    display: block;
}

body.spotui-visualizer-on #spotui-footer {
    margin-top: 0;
}

#spotui-footer {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-top: 12px;
    margin-top: auto;
    border-top: 1px solid var(--input-border-color, rgba(var(--spotui-accent-rgb, 255, 140, 66), 0.18));
    position: relative;
    z-index: 1;
    transition: opacity 260ms ease, transform 260ms ease;
}

#spotui-input {
    background: transparent;
    border: none;
    outline: none;
    color: var(--input-text-color, var(--spotui-accent, #ff8c42));
    font-family: inherit;
    font-size: inherit;
    flex: 1 1 auto;
    min-width: 0;
}

.prompt { color: var(--input-text-color, var(--spotui-accent, #ff8c42)); }
.cl-line, .result { margin-bottom: 8px; user-select: text; }
.result { padding: 5px; }
.selected { background: var(--spotui-accent, #ff8c42); color: var(--spotui-on-accent, #000); }

body.spotui-lyrics-panel #spotui-logo,
body.spotui-dj-panel #spotui-logo {
    display: flex !important;
}

body.logo-off #spotui-logo {
    display: none !important;
}

body.logo-on.spotui-lyrics-panel #spotui-lyrics,
body.logo-on.spotui-dj-panel #spotui-dj {
    height: 80vh !important;
    margin-top: 15vh !important;
}

#spotui-lyrics {
    display: none;
    flex: 1 1 auto;
    min-height: 0;
    flex-direction: column;
    position: relative;
    z-index: 1;
    margin: 0 0 8px;
    border: none;
    background: transparent;
    overflow: hidden;
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

body.spotui-lyrics-panel #spotui-lyrics.spotui-lyrics-active {
    display: flex;
    opacity: 1;
    transform: translateY(0);
    transition-delay: 0.6s;
}

#spotui-dj {
    display: none;
    flex: 1 1 auto;
    min-height: 0;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 1;
    margin: 0 0 8px;
    overflow: visible;
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

body.spotui-dj-panel #spotui-dj.spotui-dj-active {
    display: flex;
    opacity: 1;
    transform: translateY(0);
    transition-delay: 0.6s;
}

.spotui-dj-logo {
    width: min(42vw, 42vh);
    height: auto;
    overflow: visible;
    fill: none;
    stroke: var(--player-bar-border-color, var(--spotui-accent, #ff8c42));
    stroke-width: 0.45;
    stroke-linejoin: round;
    stroke-linecap: round;
    transform-origin: center;
    animation: spotui-dj-pulse 2.4s ease-in-out infinite;
}

@keyframes spotui-dj-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(0.78); }
}

body.spotui-dj-mode .XTtlZOmdtscvhPLr,
body.spotui-dj-mode .dj-button,
body.spotui-dj-mode .DHOpYzKPUqobiHLW {
    background: var(--player-bar-background, #000) !important;
    outline: none !important;
    box-shadow: none !important;
    border: none !important;
}

body.spotui-dj-mode .XTtlZOmdtscvhPLr svg,
body.spotui-dj-mode .dj-button svg {
    color: var(--player-bar-text-color, var(--spotui-accent, #ff8c42)) !important;
    fill: var(--player-bar-text-color, var(--spotui-accent, #ff8c42)) !important;
}

.spotui-lyrics-header {
    flex: 0 0 auto;
    padding: 16px 22px 12px;
    border-bottom: 1px solid rgba(var(--spotui-accent-rgb, 255, 140, 66), 0.18);
}

.spotui-lyrics-kicker {
    color: var(--spotui-accent, #ff8c42);
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    margin-bottom: 6px;
}

.spotui-lyrics-track {
    color: #ddd;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.spotui-lyrics-meta {
    margin-top: 4px;
    color: #b3b3b3;
    font-size: 12px;
    letter-spacing: 0.02em;
}

.spotui-lyrics-viewport {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
}

.spotui-lyrics-lines {
    height: 100%;
    overflow-y: auto;
    padding: 10vh 28px;
    scroll-behavior: smooth;
    scrollbar-width: none;
    -ms-overflow-style: none;
    text-align: center;
}

.spotui-lyrics-fade {
    pointer-events: none;
    position: absolute;
    left: 0; right: 0;
    height: 72px;
    z-index: 2;
}

    top: 0;
    background: linear-gradient(180deg, #000, transparent);
}

.spotui-lyrics-fade-bottom {
    bottom: 0;
    background: linear-gradient(0deg, #000, transparent);
}

.spotui-lyrics-line {
    color: var(--lyrics-color-inactive, #777);
    font-size: 17px;
    line-height: 1.45;
    padding: var(--lyrics-line-spacing, 10px) 8px;
    opacity: 0.45;
    transform: scale(0.96);
    transition:
        color 220ms ease,
        opacity 220ms ease,
        transform 220ms ease,
        text-shadow 220ms ease;
}

.spotui-lyrics-line.near {
    color: var(--lyrics-color-light-inactive, #b3b3b3);
    opacity: 0.72;
    transform: scale(0.98);
}

.spotui-lyrics-line.active {
    color: var(--lyrics-color-active, var(--spotui-accent, #ff8c42));
    opacity: 1;
    transform: scale(1.06);
    font-weight: 600;
}

.spotui-lyrics-loader {
    height: 27px;
    aspect-ratio: 5;
    --c: var(--lyrics-color-inactive, #777) 90deg, #0000 0;
    background:
        conic-gradient(from 135deg at top, var(--c)),
        conic-gradient(from -45deg at bottom, var(--c)) 12.5% 100%;
    background-size: 20% 50%;
    background-repeat: repeat-x;
    -webkit-mask: repeating-linear-gradient(90deg, #000 0 15%, #0000 0 50%) 0 0/200%;
    mask: repeating-linear-gradient(90deg, #000 0 15%, #0000 0 50%) 0 0/200%;
    margin: 20px auto;
    opacity: 0.45;
    transform: scale(0.96);
    transition: opacity 220ms ease, transform 220ms ease;
}

body:not(.spotui-lyrics-animation-on) .spotui-lyrics-loader {
    display: none !important;
}

body.spotui-lyrics-animation-on .spotui-lyrics-loader {
    animation: spotui-loader-anim 0.8s infinite linear;
}

.spotui-lyrics-loader.active {
    --c: var(--lyrics-color-active, var(--spotui-accent, #ff8c42)) 90deg, #0000 0;
    opacity: 1;
    transform: scale(1);
}

@keyframes spotui-loader-anim {
    to { 
        -webkit-mask-position: -100% 0;
        mask-position: -100% 0;
    }
}

#spotui-playlist-panel {
    display: none;
    flex: 1 1 auto;
    min-height: 0;
    flex-direction: row;
    position: relative;
    z-index: 1;
    margin: 33vh 5vw 8px;
    height: 60vh;
    border: none;
    background: transparent;
    overflow: hidden;
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    gap: 10px;
}

body.spotui-playlist-panel #spotui-playlist-panel {
    display: flex;
    opacity: 1;
    transform: translateY(0);
    transition-delay: 0.6s;
}

#spotui-playlist-sort {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 6;
    min-width: 180px;
    padding: 10px;
    border: 1px solid var(--panel-border-color, #ff8c42);
    border-radius: 4px;
    background: #000;
}

#spotui-playlist-sort.songs {
    left: auto;
    right: 12px;
}

#spotui-playlist-find {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 6;
    width: 220px;
    padding: 8px 10px;
    border: 1px solid var(--panel-border-color, #ff8c42);
    border-radius: 4px;
    background: #000;
    color: #ddd;
    font-family: "JetBrains Mono", monospace;
    font-size: 14px;
    outline: none;
}

#spotui-playlist-find.songs {
    left: auto;
    right: 12px;
}

#spotui-playlist-info {
    position: absolute;
    bottom: 10px;
    right: 10px;
    z-index: 7;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--panel-text-color, #ff8c42);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    pointer-events: auto;
    opacity: 0.7;
}

#spotui-playlist-info:hover {
    opacity: 1;
}

#spotui-playlist-info svg {
    display: block;
}

#spotui-playlist-info-popup {
    position: absolute;
    bottom: 36px;
    right: 10px;
    z-index: 7;
    padding: 8px 12px;
    border: 1px solid var(--panel-border-color, #ff8c42);
    border-radius: 4px;
    background: #000;
    color: #ddd;
    font-size: 13px;
    white-space: nowrap;
    pointer-events: auto;
}

#spotui-playlist-info-popup span {
    color: var(--panel-text-color, #ff8c42);
}

#spotui-add2list-panel {
    display: none;
    flex: 1 1 auto;
    min-height: 0;
    flex-direction: row;
    justify-content: center;
    position: relative;
    z-index: 1;
    margin: 33vh auto 8px;
    height: 60vh;
    width: 40vw;
    max-width: calc(100% - 4px);
    border: none;
    background: transparent;
    overflow: visible;
    box-sizing: border-box;
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

body.spotui-add2list-panel #spotui-add2list-panel {
    display: flex;
    opacity: 1;
    transform: translateY(0);
    transition-delay: 0.6s;
}

#spotui-help-panel, #spotui-about-panel, #spotui-theme-panel, #spotui-boards-panel, #spotui-saves-panel {
    display: none;
    flex: 1 1 auto;
    flex-direction: column;
    padding: 30px;
    overflow-y: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    margin: 33vh 5vw 8px;
    height: 60vh;
    border: 1px solid var(--panel-border-color, rgba(var(--spotui-accent-rgb, 255, 140, 66), 0.3));
    border-radius: 6px;
    background: var(--panel-bg-color, transparent);
}

#spotui-help-panel {
    border: none;
    padding: 0;
    margin: 33vh 5vw 8px;
}

#spotui-boards-panel, #spotui-saves-panel {
    border: none;
    padding: 0;
}

.spotui-help-fieldset {
    border: 1px solid var(--panel-border-color, rgba(var(--spotui-accent-rgb, 255, 140, 66), 0.3));
    border-radius: 6px;
    padding: 30px;
    height: 100%;
    overflow-y: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    background: var(--panel-bg-color, transparent);
}

body.spotui-help-panel #spotui-help-panel,
body.spotui-about-panel #spotui-about-panel,
body.spotui-theme-panel #spotui-theme-panel,
body.spotui-boards-panel #spotui-boards-panel,
body.spotui-saves-panel #spotui-saves-panel {
    display: flex;
}

.spotui-help-legend {
    float: right;
    color: var(--panel-text-color, var(--spotui-accent, #ff8c42));
    padding: 0 5px;
}

/* Menu rows start below the floated legend: the legend keeps the first
   line to itself instead of sharing it with the first theme/board. */
.spotui-boards-content, .spotui-saves-content {
    clear: both;
}

.spotui-theme-loading {
    display: flex;
    justify-content: center;
    align-items: center;
    flex: 1;
    min-height: 0;
    height: 100%;
}

#spotui-theme-panel .spotui-lyrics-loader {
    display: block !important;
    animation: spotui-loader-anim 0.8s infinite linear;
}

.theme-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 24px;
    padding: 12px;
}

.theme-card {
    border: 1px solid var(--panel-border-color, var(--spotui-accent, #ff8c42));
    border-radius: 4px;
    padding: 10px;
    background: rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.theme-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 15px rgba(0,0,0,0.2);
}

.theme-card img {
    width: 100%;
    height: auto;
    border-radius: 4px;
    object-fit: cover;
    aspect-ratio: 16/9;
}

.theme-card h3 {
    margin: 10px 0 10px;
    color: var(--panel-text-color, var(--spotui-accent, #ff8c42));
    font-weight: 600;
}

.theme-card button {
    background: var(--panel-text-color, var(--spotui-accent, #ff8c42));
    color: #000;
    border: none;
    padding: 8px 12px;
    font-family: "JetBrains Mono", monospace;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    border-radius: 4px;
    margin-top: auto;
    width: 100%;
    transition: background-color 0.2s ease;
}

.theme-card button:hover {
    background-color: var(--panel-text-hover-color, color-mix(in srgb, var(--spotui-accent, #ff8c42) 88%, black));
}
.help-item {
    padding: 4px 0;
    display: flex;
    justify-content: space-between;
}

.help-item .command {
    color: var(--panel-text-color, var(--spotui-accent, #ff8c42));
    flex-basis: 30%;
}

.help-item .description {
    flex-basis: 70%;
    color: #b3b3b3;
}

.help-item.selected .command, .help-item.selected .description {
    color: var(--spotui-on-accent, #000);
}

#spotui-playlist-list, #spotui-song-list, #spotui-add2list-list {
    width: 50%;
    overflow-y: auto;
    scroll-behavior: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding: 10px;
    border: 1px solid var(--panel-border-color, var(--spotui-accent, #ff8c42));
    border-radius: 4px;
    background: var(--panel-bg-color, transparent);
}

#spotui-add2list-list {
    width: 100%;
    box-sizing: border-box;
    min-width: 0;
}

#spotui-playlist-list legend, #spotui-song-list legend, #spotui-add2list-list legend {
    color: var(--panel-text-color, var(--spotui-accent, #ff8c42));
    padding: 0 5px;
}

.playlist-item, .song-item {
    padding: 4px 6px;
    cursor: pointer;
}

.playlist-item, .song-item {
    height: 26px;
    box-sizing: border-box;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

#spotui-playlist-list, #spotui-song-list, #spotui-add2list-list {
    position: relative;
}

.playlist-item.selected, .song-item.selected {
    background: var(--panel-text-color, var(--spotui-accent, #ff8c42));
    color: #000;
}

.spotui-lyrics-lines.unsynced .spotui-lyrics-line {
    color: #b3b3b3;
    opacity: 0.9;
    transform: none;
    text-align: center;
}

.spotui-lyrics-empty {
    color: #b3b3b3;
    font-size: 3em;
    line-height: 1.6;
    padding: 18vh 24px;
    text-align: center;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    opacity: 0.5;
}

.spotui-lyrics-empty strong {
    display: block;
    color: var(--spotui-accent, #ff8c42);
    font-size: 16px;
    margin-bottom: 8px;
    font-weight: 600;
}

.spotui-lyrics-loading {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    padding: 18vh 24px;
}

.spotui-lyrics-lines.spotui-lyrics-exit-active {
    transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease;
    transform: translateY(-40px);
    opacity: 0;
}

.spotui-lyrics-lines.spotui-lyrics-enter {
    transition: none;
    transform: translateY(40px);
    opacity: 0;
}

.spotui-lyrics-lines.spotui-lyrics-enter-active {
    transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease;
    transform: translateY(0);
    opacity: 1;
}

.spotui-lyrics-fetch-loader {
    --color-1: var(--lyrics-color-active, var(--spotui-accent, #ff8c42));
    --size: 1px;
    width: calc(8 * var(--size));
    height: calc(40 * var(--size));
    border-radius: calc(4 * var(--size));
    display: block;
    position: relative;
    background: currentColor;
    color: var(--color-1);
    box-sizing: border-box;
    animation: spotui-fetch-loader-anim 0.3s 0.3s linear infinite alternate;
}
.spotui-lyrics-fetch-loader::after,
.spotui-lyrics-fetch-loader::before {
    content: '';
    width: calc(8 * var(--size));
    height: calc(40 * var(--size));
    border-radius: calc(4 * var(--size));
    background: currentColor;
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    left: calc(20 * var(--size));
    box-sizing: border-box;
    animation: spotui-fetch-loader-anim 0.3s 0.45s linear infinite alternate;
}
.spotui-lyrics-fetch-loader::before {
    left: calc(-20 * var(--size));
    animation-delay: 0s;
}
@keyframes spotui-fetch-loader-anim {
    0% {
        height: calc(48 * var(--size));
    }
    100% {
        height: calc(4 * var(--size));
    }
}

#spotui-sposync-status {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    flex: 0 0 40px;
    margin-right: 4px;
    color: currentColor;
    pointer-events: auto;
    cursor: default;
}

#spotui-sposync-status svg {
    width: 22px;
    height: 22px;
    display: block;
}

#spotui-sposync-tip {
    position: fixed;
    transform: translateX(-50%);
    z-index: 10000;
    background: rgba(0, 0, 0, 0.92);
    border: 1px solid var(--spotui-accent, #ff8c42);
    border-radius: 6px;
    padding: 8px 10px;
    color: var(--spotui-accent, #ff8c42);
    font-family: "JetBrains Mono", monospace;
    font-size: 12px;
    line-height: 1.35;
    white-space: pre-line;
    pointer-events: none;
}

#spotui-controls {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-left: auto;
}

.spotui-control-btn {
    background: var(--input-bg-color, var(--spotui-accent, #ff8c42));
    color: var(--input-text-color, #000);
    border: none;
    padding: 6px 12px;
    font-family: "JetBrains Mono", monospace;
    font-size: 13px;
    cursor: pointer;
    border-radius: 4px;
}

.spotui-control-btn:hover {
    background: var(--input-bg-hover-color, color-mix(in srgb, var(--spotui-accent, #ff8c42) 88%, black));
}

.spotui-standby-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 8px;
}

.spotui-standby-btn svg {
    display: block;
}

body.spotui-tui-hidden #spotui-tui {
			    display: none !important;
			}

			body:not(.spotui-tui-hidden) .main-topBar-container,
			body:not(.spotui-tui-hidden) header {
			    display: none !important;
			}

			body.spotui-bar-off #spotui-tui {
			    bottom: 0 !important;
			}

#spotui-update-banner {
    position: fixed;
    top: 70px;
    right: 20px;
    background: #000;
    color: #ddd;
    border: 1px solid var(--spotui-accent, #ff8c42);
    border-radius: 6px;
    padding: 20px;
    max-width: 360px;
    z-index: 10001;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    font-family: "JetBrains Mono", monospace;
}

.spotui-banner-header {
    display: flex;
    align-items: center;
    gap: 12px;
}

.spotui-banner-icon {
    width: 36px;
    height: 36px;
    object-fit: contain;
    border-radius: 4px;
}

#spotui-update-banner h3 {
    margin: 0;
    color: var(--spotui-accent, #ff8c42);
    font-size: 15px;
}

#spotui-update-banner p {
    margin: 0;
    font-size: 12px;
    line-height: 1.4;
    color: #b3b3b3;
}

.spotui-update-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 4px;
}

#banner-join-btn {
    flex: 1;
    text-align: center;
    padding: 8px 16px;
    font-weight: 600;
}

.spotui-banner-secondary-actions {
    position: absolute;
    top: 12px;
    right: 12px;
    display: flex;
    gap: 6px;
}

.spotui-banner-link-btn {
    background: transparent;
    border: none;
    color: #888;
    font-family: "JetBrains Mono", monospace;
    font-size: 10px;
    cursor: pointer;
    padding: 2px 4px;
}

.spotui-banner-link-btn:hover {
    color: var(--spotui-accent, #ff8c42);
    text-decoration: underline;
}

#spotui-jam-tags,
#spotui-dj-tags {
    position: fixed;
    top: 70px;
    left: 20px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 6px;
    pointer-events: none;
}

.spotui-jam-tag {
    background: rgba(0,0,0,0.85);
    border: 1px solid var(--spotui-accent, #ff8c42);
    color: var(--spotui-accent, #ff8c42);
    border-radius: 4px;
    padding: 4px 10px;
    font-family: "JetBrains Mono", monospace;
    font-size: 12px;
    white-space: nowrap;
    box-shadow: 0 4px 12px rgba(0,0,0,0.35);
}

#spotui-search-panel {
    display: none;
    flex: 1 1 auto;
    flex-direction: column;
    margin: 33vh 5vw 8px;
    height: 60vh;
    padding: 20px;
    box-sizing: border-box;
    border: 1px solid var(--panel-border-color, rgba(var(--spotui-accent-rgb, 255, 140, 66), 0.3));
    border-radius: 6px;
    background: var(--panel-bg-color, transparent);
    overflow: hidden;
}

body.spotui-search-panel #spotui-search-panel {
    display: flex;
}

#spotui-search-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 0 0 auto;
    position: relative;
    padding: 8px 12px;
    border: 1px solid var(--panel-border-color, rgba(var(--spotui-accent-rgb, 255, 140, 66), 0.3));
    border-radius: 4px;
    background: rgba(0,0,0,0.5);
}

#spotui-search-bar.focused {
    border-color: var(--spotui-accent, #ff8c42);
}

.spotui-search-prompt {
    color: var(--panel-text-color, var(--spotui-accent, #ff8c42));
}

#spotui-search-input {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: none;
    outline: none;
    color: var(--panel-text-color, var(--spotui-accent, #ff8c42));
    font-family: inherit;
    font-size: 15px;
    caret-color: var(--spotui-accent, #ff8c42);
}

#spotui-search-input::placeholder {
    color: #777;
}

#spotui-search-ghost {
    position: absolute;
    display: flex;
    align-items: center;
    pointer-events: none;
    overflow: hidden;
    white-space: nowrap;
    font-family: inherit;
    font-size: 15px;
    color: #777;
}

/* Command-bar fill suggestion: dimmed accent ghost over the input. */
#spotui-cmd-ghost {
    position: absolute;
    display: flex;
    align-items: center;
    pointer-events: none;
    overflow: hidden;
    white-space: nowrap;
    margin: 0;
    padding: 0;
    border: 0;
    color: color-mix(in srgb, var(--spotui-accent, #ff8c42) 60%, transparent);
}

#spotui-search-results {
    flex: 1 1 auto;
    min-height: 0;
    margin-top: 12px;
    overflow-y: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
}

#spotui-search-results::-webkit-scrollbar {
    display: none;
}

.spotui-search-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border-radius: 4px;
    color: #ddd;
    cursor: pointer;
}

.spotui-search-item.selected {
    background: var(--spotui-accent, #ff8c42);
    color: var(--spotui-on-accent, #000);
}

.spotui-search-type {
    flex: 0 0 auto;
    min-width: 70px;
    font-size: 11px;
    text-transform: uppercase;
    opacity: 0.7;
    color: var(--panel-text-color, var(--spotui-accent, #ff8c42));
}

.spotui-search-item.selected .spotui-search-type {
    color: var(--spotui-on-accent, #000);
    opacity: 1;
}

.spotui-search-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.spotui-search-empty {
    padding: 10px;
    color: #777;
}

#spotui-standby-overlay {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    z-index: 2147483647 !important;
    background: #000;
    overflow: hidden;
}

#spotui-standby-overlay iframe {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
    pointer-events: none;
}

#spotui-standby-catcher {
    position: absolute;
    inset: 0;
    z-index: 1;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    outline: none;
    color: transparent;
    caret-color: transparent;
    opacity: 0;
}

body.spotui-standby #spotui-tui,
body.spotui-standby #spotui-controls,
body.spotui-standby #spotui-custom-bar,
body.spotui-standby #spotui-back-btn,
body.spotui-standby #spotui-update-banner,
body.spotui-standby #spotui-jam-tags,
body.spotui-standby #spotui-dj-tags,
body.spotui-standby #spotui-popup,
body.spotui-standby .Root__now-playing-bar {
    display: none !important;
}
`;
    // Inject theme CSS into document head
    function injectStyle() {
        const s = document.createElement("style");
        s.textContent = style;
        document.head.appendChild(s);
    }

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

    function cssVar(name, fallback) {
        return toHex(getComputedStyle(document.documentElement).getPropertyValue(name), fallback);
    }

    function getColors() {
        return {
            active: cssVar("--lyrics-color-active", "#ff8c42"),
            inactive: cssVar("--lyrics-color-inactive", "#777777"),
            near: cssVar("--lyrics-color-light-inactive", "#b3b3b3"),
            accent: cssVar("--spotui-accent", "#ff8c42"),
            panel_bg: cssVar("--panel-bg-color", "#000000"),
            panel_border: cssVar("--panel-border-color", "#ff8c42"),
            panel_text: cssVar("--panel-text-color", "#ff8c42"),
            bar_bg: cssVar("--player-bar-background", "#000000"),
            bar_text: cssVar("--player-bar-text-color", "#ff8c42"),
            visualizer: cssVar("--visualizer-color", "#ff8c42"),
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

    function getTrackPayload() {
        const data = Spicetify.Player.data;
        const item = data?.item ?? data?.track;
        if (!item) return null;
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
            progress_style: storageGet(CUSTOM_BAR_PROGRESS_STYLE) || "classic-block",
            progress_chars: PROGRESS_STYLES[storageGet(CUSTOM_BAR_PROGRESS_STYLE) || "classic-block"] || PROGRESS_STYLES["classic-block"],
            visualizer: app.visualizerOpen,
        };
    }

    function sendJson(obj) {
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify(obj));
    }

    function send() {
        const payload = getTrackPayload();
        if (payload) sendJson(payload);
        else sendJson({ type: "update", visualizer: app.visualizerOpen, colors: getColors(), lyrics: lyricsCache });
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
                Spicetify.Player.playUri(match[0].uri);
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
        if (context) Spicetify.Player.playUri(context, {}, { skipTo: { uri } });
        else Spicetify.Player.playUri(uri);
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

    function initSync() {
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
            refreshLyrics();
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

    // Inject styles, set up event listeners, and restore saved state
    injectStyle();
    document.addEventListener("keydown", handleKeybindKeydown, true);
    setTimeout(createControlButtons, 500);
    setTimeout(initLyricsBridge, 1000);
    setTimeout(initDjBridge, 1000);
    setTimeout(initSync, 1000);

    // Apply stored logo visibility preference
    if (storageGet("spotui:logo-visible") === "off") {
        document.body.classList.add("logo-off");
    } else {
        document.body.classList.add("logo-on");
    }

    // Apply stored lyrics animation preference
    if (storageGet(LYRICS_ANIMATION_KEY) === "off") {
        document.body.classList.remove("spotui-lyrics-animation-on");
    } else {
        document.body.classList.add("spotui-lyrics-animation-on");
    }

    // Create terminal when Spicetify API is ready
    if (Spicetify?.Platform) createTerminal();
    else setTimeout(createTerminal, 1500);

    // Initialize update banner after first boot onboarding is complete
    if (!isFirstBoot()) {
        setTimeout(initUpdateBanner, 1600);
    }

    // Restore restart popup message across page reloads if present
    try {
        const restartMessage = sessionStorage.getItem("spotui:restart-popup");
        if (restartMessage) {
            showRestartPopup(restartMessage, false);
        }
    } catch (e) {}

    // Launch first-boot onboarding for new users
    setTimeout(() => { launchFirstBootIfNeeded().catch(() => {}); }, 2000);

    // Restore saved state: lyrics panel, wallpaper, colors, jam session
    try {
        if (storageGet(LYRICS_STORAGE_KEY) === "1") {
            waitForPlayerReadyThen(() => {
                if (storageGet(LYRICS_STORAGE_KEY) === "1") openLyricsPanel();
            });
        }
        if (storageGet(WP_URL_KEY)) {
            dbg("[SpoTUI-dbg] boot: restoring saved wallpaper:", storageGet(WP_URL_KEY), "opacity:", storageGet(WP_OPACITY_KEY) || "1", "(clear with tui -wp off)");
            setTimeout(() => setWallpaper(storageGet(WP_URL_KEY), storageGet(WP_OPACITY_KEY) || "1", false, {
                fit: storageGet(WP_FIT_KEY) || undefined,
                pos: storageGet(WP_POS_KEY) || undefined,
                rich: storageGet(WP_RICH_KEY) || undefined,
            }), 1500);
        } else {
            dbg("[SpoTUI-dbg] boot: no saved wallpaper. Set one with: tui -wp <url> -o 0.5 (video needs .webm — .mp4/H.264 is blocked in some builds)");
        }
        // Restore UI shade (retries once; terminal may still be booting).
        setTimeout(() => { if (!applyShade()) setTimeout(applyShade, 2000); }, 2600);
        if (isPostersEnabled()) {
            dbg("[SpoTUI-pin] boot: wall ON,", getPosterImages().length, "stored image(s), boards:", getBoardCounts());
            setTimeout(() => { maybeAutoshuffle(); renderPosters(); startRotateTimer(); }, 2200);
        } else {
            dbg("[SpoTUI-pin] boot: wall OFF,", getPosterImages().length, "stored image(s) (enable with tui -posters on).");
        }
        applyLyricColors();
        applyLyricLineSpacing();
        applyVisualizerColor();
        restoreVisualizer();
        applyPlayerBarColors();
        applyPlayerBarVisibility();
        applyCustomBarState();
        applyProgressBarColors();
        applyInputColors();
        applyInputButtonsVisibility();
        applyPanelColors();
        resumeJamFromStorage();
    } catch { }

})();
