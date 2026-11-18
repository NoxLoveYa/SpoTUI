(function () {
    'use strict';

    // Theme feed host for pulling community themes
    const THEME_HOST = "https://spotui.root.sx/";

    const THEME_CHANNELS = {
        stable: "https://cdn.jsdelivr.net/gh/SkenSMasteR/SpoTUI@aux/Themes/themes.js",
        live: `${THEME_HOST}themes.js`,
    };

    // Feeds are fetched as data. A channel listed here whose fetch is blocked
    // (no Access-Control-Allow-Origin, so the page cannot read it) is retried in a
    // sandboxed frame; feed code never runs in the Spotify page. The result is
    // validated the same way either way.
    // live: spotui.root.sx sends no CORS header (checked with curl); stable on
    // jsDelivr sends `access-control-allow-origin: *`. Drop "live" from this set
    // once the server allows the Spotify origin and the frame loader can go.
    const THEME_FRAME_CHANNELS = new Set(["live"]);

    // LocalStorage keys for user preferences
    const ANIMATION_KEY = "spotui:ascii-animation";
    const LYRICS_STORAGE_KEY = "spotui:lyrics-open";
    const LYRICS_ANIMATION_KEY = "spotui:lyrics-animation";
    const WP_URL_KEY = "spotui:wp-url";
    const WP_FIT_KEY = "spotui:wp-fit";
    const WP_POS_KEY = "spotui:wp-pos";
    const WP_RICH_KEY = "spotui:wp-rich";
    // Hosts the user approved for wallpapers that come from a feed theme: a
    // JSON array of lowercase hostnames. Personal config, not a look.
    const WP_HOSTS_KEY = "spotui:wp-hosts";
    const SHADE_KEY = "spotui:shade";
    // Video mode (Spotify Canvas as background): a look key, "1" = on, absent = off.
    const VIDEO_MODE_KEY = "spotui:video-mode";
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
    const VISUALIZER_GAP = "spotui:visualizer-gap";
    const VISUALIZER_BARS = "spotui:visualizer-bars";
    const VISUALIZER_SMOOTH = "spotui:visualizer-smooth";
    const VISUALIZER_MODE = "spotui:visualizer-mode";
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
    const SPOSYNC_GUIDE_URL = "https://github.com/NoxLoveYa/SpoTUI/tree/live#sposync";
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
    // Commands a remote theme (feed or theme panel) may run: look commands only.
    // Everything else (theme management, secrets, keybinds, actions, restore,
    // debug, jam, playback, search...) is skipped. Keep in sync with the
    // first-position branches of executeInner in commands.js.
    const THEME_ALLOWED_COMMANDS = new Set(["lyrics", "visualizer"]);
    const THEME_ALLOWED_TUI_SUBS = new Set([
        "-l", "-a", "-wp", "-shade", "-video", "-ly", "-viz", "-bar", "-progress", "-panel", "-inputs", "-posters", "-poster",
    ]);
    // Poster-wall words a theme may not use: they add remote images or delete the user's pins.
    const THEME_BLOCKED_POSTER_WORDS = new Set(["add", "clear"]);
    // Wallpaper-host consent forms (tui -wp -allow/-deny/-hosts): user only. A theme
    // must not approve a host or read the list, wherever in its command the word is.
    const WP_HOST_FLAGS = new Set(["-allow", "-deny", "-hosts"]);

    // Pinterest API token: a secret, personal config rather than a look.
    const PIN_TOKEN_KEY = "spotui:pin-token";
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
        { cmd: "tui -wp -allow [&lt;host&gt;] | tui -wp -deny &lt;host&gt; | tui -wp -hosts", desc: "Wallpapers from a feed theme load only from hosts you approved, otherwise the theme applies without its wallpaper. -allow approves the host of the wallpaper that was just skipped (or the host you name) and loads it, -deny removes a host, -hosts lists them. A wallpaper you set yourself with tui -wp &lt;url&gt; approves its host" },
        { cmd: "tui -shade &lt;#hex|off&gt;", desc: "Set the UI accent to any hex color (exact hue, saturation, lightness — even gray/white/black); video + posters stay true; bare tui -shade shows current" },
        { cmd: "tui -video &lt;on/off/toggle&gt;", desc: "Video mode: while a song plays, its Spotify Canvas (the short looping clip) replaces your background; paused, stopped, ads, podcasts or songs without a Canvas bring your wallpaper/posters back. Off by default, saved with your look; bare tui -video shows what it is doing" },
        { cmd: "tui -debug &lt;on/off&gt;", desc: "Verbose wallpaper/poster/shade logging for troubleshooting (warnings always print)" },
        { cmd: "tui -t pull &lt;theme_id&gt; [-live]", desc: "Apply a theme by its ID from the stable feed, or the live feed with -live (find IDs on our website)" },
        { cmd: "tui -t &lt;save &lt;name&gt;|list|apply &lt;name&gt;|delete &lt;name&gt;&gt;", desc: "Snapshot the current look locally (incl. poster wall layout); list opens the themes menu (Enter applies, Del/D fills in the delete command); restore/delete snapshots" },
        { cmd: 'tui bind "&lt;Letter&gt;" "&lt;command&gt;"', desc: "Bind Alt+&lt;Letter&gt; to run a TUI command (e.g. tui bind &quot;T&quot; &quot;tui -t list&quot; opens the themes menu on Alt+T; Ctrl combos never reach the page)" },
        { cmd: 'tui unbind "&lt;Letter&gt;"', desc: "Remove the Alt+&lt;Letter&gt; keybind" },
        { cmd: "tui bind clear", desc: "Remove all keybinds" },
        { cmd: "tui restore [-full]", desc: "Reset SpoTUI's own settings to defaults and reload (keeps history, keybinds, actions, your pin token, approved wallpaper hosts, saved themes and the onboarding and banner flags; -full removes every SpoTUI setting stored in Spotify). Spotify's own settings and other extensions' data are never touched" },
        { cmd: "Ctrl+R", desc: "Reverse-search persistent command history (typing filters, Ctrl+R cycles older matches, Enter fills the bar, Esc aborts; unknown commands stay session-only)" },
        { cmd: "Tab", desc: "Accept the ghost fill suggestion in the command bar (repeat to cycle matches); also completes the last word of any known command, e.g. tui -viz -ga + Tab → tui -viz -gap" },
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
        { cmd: "tui -viz -gap &lt;px&gt;", desc: "Set gap between visualizer bars (0 = touching)" },
        { cmd: "tui -viz -gap off", desc: "Reset visualizer bar gap" },
        { cmd: "tui -viz -bars &lt;count&gt;", desc: "Set how many visualizer bars to show" },
        { cmd: "tui -viz -bars off", desc: "Reset visualizer bar count" },
        { cmd: "tui -viz -smooth &lt;1-100&gt;", desc: "Set visualizer bar smoothing" },
        { cmd: "tui -viz -smooth off", desc: "Reset visualizer bar smoothing" },
        { cmd: "tui -viz -mode &lt;adaptive/global&gt;", desc: "Set visualizer reaction mode" },
        { cmd: "tui -viz -mode off", desc: "Reset visualizer reaction mode" },
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
        { cmd: "queue", desc: "View and reorder the play queue" },
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

    // Word vocabulary for ghost-text completion, derived from COMMAND_LIST:
    // alternatives ("a | b", "a / b") become separate names, each name stops at
    // its first placeholder or optional part, and key-binding rows (Ctrl+R,
    // Tab, Esc) are not commands.
    const KEY_ROW_REGEX = /\+|^(?:tab|esc|enter|up|down|left|right)$/i;
    const COMMAND_NAMES = [...new Set(COMMAND_LIST.flatMap(({ cmd }) =>
        cmd.split(/\s+[|/]\s+/)
            .map((name) => name.replace(/(?:&lt;|<|\[).*$/, "").replace(/["\s]+$/, ""))
            .filter((name) => name && !KEY_ROW_REGEX.test(name))
    ))].sort();

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

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function playFresh(uri, context) {
        if (!uri && !context) return;
        try {
            await Spicetify.Platform.PlayerAPI.clearQueue();
        } catch {}
        if (context) Spicetify.Player.playUri(context, {}, { skipTo: { uri } });
        else Spicetify.Player.playUri(uri);
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
    // unifying here changes no pixels. Returns the toast element, or null if it
    // could not be built.
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
            return t;
        } catch (e) {
            return null;
        }
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

    // Border follows --spotui-accent (what -shade re-points) with the panel
    // border as fallback. The toast lives on document.body, outside the
    // TUI container, so the var reads as the exact target color.
    const PIN_TOAST_CSS = "position:fixed;left:50%;bottom:120px;transform:translateX(-50%);z-index:10000;background:rgba(10,14,18,.45);background:color-mix(in srgb, var(--panel-bg-color,#0a0e12) 45%, transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);color:var(--panel-text-color,var(--text-base,#e8e2d4));border:1px solid var(--spotui-accent,var(--panel-border-color,var(--essential-base,#7fd4d4)));padding:10px 16px;font-family:'JetBrains Mono',monospace;font-size:12px;max-width:70vw;white-space:pre-wrap;text-align:center;pointer-events:none;";

    // Small non-blocking toast (console.log alone is invisible without DevTools).
    function pinToast(text, ms = 7000) {
        toastBase("spotui-pin-toast", text, ms, PIN_TOAST_CSS);
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
        // SpoSync window visibility: null = unknown, false = hidden, true = visible.
        sposyncUi: null,
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
        add2listTrackUri: null,
        queuePanelOpen: false,
        queueTracks: [],
        selectedQueue: 0,
        queueGrab: -1,
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

    Object.keys(app).filter(k => k.endsWith("PanelOpen") && k !== "lyricsPanelOpen");

    // Panels with their own inputs or key handling: the command bar yields to them.
    // Read-only panels (help, about) leave the command input usable.
    function isInputBlockingPanelOpen() {
        return app.standbyOpen || app.playlistPanelOpen || app.add2listPanelOpen || app.queuePanelOpen || app.searchPanelOpen ||
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
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        const chars = app.asciiCharData;
        for (let i = 0; i < chars.length; i += 1) {
            const { el, row, col } = chars[i];
            const ch = el.textContent;
            if (!ch || ch === " ") continue;
            const color = el.style.color;
            ctx.fillStyle = color;
            ctx.shadowColor = color;
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
    const PIN_TOKEN = PIN_TOKEN_KEY;

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
        const popup = toastBase("spotui-restart-popup", message, null, "position:fixed;left:50%;bottom:120px;transform:translateX(-50%);z-index:10000;background:rgba(0,0,0,0.92);border:1px solid var(--spotui-accent,#ff8c42);border-radius:6px;padding:12px 16px;color:var(--spotui-accent,#ff8c42);font-family:\"JetBrains Mono\",monospace;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,0.35);");
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

    // Get current theme accent color from CSS variables. Read from <body>: the
    // shade rule defines --spotui-accent there, and inheritance only goes down, so
    // <html> never sees it (root inline vars still inherit into <body>).
    function getSpotuiAccentColor() {
        try {
            const accent = getComputedStyle(document.body).getPropertyValue("--spotui-accent").trim();
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

    // Remote themes (feed submissions) may only run look commands: allowlist.
    // Tokenizes exactly like executeInner (same prefix strip, same whitespace
    // split, case-insensitive), so what is checked is what would be dispatched.
    function isRestrictedThemeCommand(cmd) {
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

    // Too powerful for remote/store-and-fire paths: meta commands, secrets,
    // destructive theme ops, and tracking/defacement URLs. Local bar authoring
    // stays unrestricted — this gates the relay ingress (sync.js) only.
    // It must match what executeInner dispatches: those subs act in FIRST position
    // only, except `-wp`, which executeInner reaches from ANY position (it tests
    // the whole argument list), so `-wp` is matched as a whole token anywhere
    // after `tui`. `-poster` is an alias of `-posters` there.
    const SENSITIVE_CMD_REGEX = /^(?:tui\s+(?:bind|unbind|actions|restore)\b|jam\b|tui\s+-(?:pin-token|pin-board|pin-feed|pin-refresh)\b|tui\s+-t\b|tui\s+-posters?\s+(?:add|clear)\b|tui\s(?:[\s\S]*\s)?-wp(?!\S))/;

    // Lowercased first: executeInner lowercases with toLowerCase(), which maps
    // characters (e.g. KELVIN SIGN for "k") that a /i regex without the u flag does
    // not fold, so a "-pin-token" spelled with one must not slip past.
    function isSensitiveCommand(cmd) {
        return SENSITIVE_CMD_REGEX.test(stripCommandPrefix(cmd).trim().toLowerCase());
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
            activeEl.tagName === "SELECT" ||
            (activeEl.tagName === "INPUT" && activeEl.type !== "button")
        );
        if (isTypingField && !hasModifier) return;

        e.preventDefault();
        e.stopPropagation();
        execute(cmd);
    }

    let bars = [];
    let raf = 0;

    function getGap() {
        const stored = storageGet(VISUALIZER_GAP);
        if (stored === null) return 2;
        const value = Number(stored);
        return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 2;
    }

    function getBarCount() {
        const stored = storageGet(VISUALIZER_BARS);
        if (stored === null) return 48;
        const value = Number(stored);
        return Number.isFinite(value) ? Math.min(256, Math.max(1, Math.floor(value))) : 48;
    }

    function resample(source, count) {
        if (!source.length || count === source.length) return source;
        const out = new Array(count);
        for (let i = 0; i < count; i++) {
            const start = Math.floor((i * source.length) / count);
            const end = Math.max(start + 1, Math.floor(((i + 1) * source.length) / count));
            let sum = 0;
            for (let j = start; j < end && j < source.length; j++) sum += source[j];
            out[i] = sum / (end - start);
        }
        return out;
    }

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
        if (!bars.length || !w || !h) return;
        const data = resample(bars, Math.min(getBarCount(), Math.max(1, Math.floor(w))));
        const n = data.length;
        const gap = n > 1 ? Math.min(getGap(), Math.max(0, Math.floor((w - n) / (n - 1)))) : 0;
        const bw = Math.max(1, (w - gap * (n - 1)) / n);
        const step = bw + gap;
        // One computed-style read per frame, on <body> (where the shade rule
        // defines the accent; <html> would never see it).
        const style = getComputedStyle(document.body);
        ctx.fillStyle = style.getPropertyValue("--visualizer-color").trim()
            || style.getPropertyValue("--spotui-accent").trim()
            || "#ff8c42";
        for (let i = 0; i < n; i++) {
            const bh = data[i] * h;
            if (bh <= 0) continue;
            const left = Math.round(i * step);
            const right = Math.round(i * step + bw);
            ctx.fillRect(left, h - bh, Math.max(1, right - left), bh);
        }
    }

    function setVisualizerBars(next) {
        bars = next || [];
        refreshVisualizer();
    }

    function refreshVisualizer() {
        if (app.visualizerOpen && !raf) raf = requestAnimationFrame(paint);
    }

    function handleVisualizerCommand(arg, silent) {
        const mode = String(arg || "").trim().toLowerCase();
        const on = () => {
            if (!app.sposyncConnected) {
                if (silent) return;
                const popup = showRestartPopup("");
                if (!popup) return;
                const accent = getSpotuiAccentColor();
                popup.style.border = `1px solid ${accent}`;
                popup.style.color = accent;
                popup.style.maxWidth = "420px";
                popup.style.lineHeight = "1.45";
                popup.style.display = "flex";
                popup.style.flexDirection = "column";
                popup.style.gap = "12px";
                popup.innerHTML = `<div>Unable to enable the visualizer: SpoSync is not running.<br><br>SpoSync is a small helper that feeds SpoTUI live audio. Install it with the SpoTUI installer's optional SpoSync step; it then starts with your computer.<br><br>Already installed? It starts at sign-in, or run it once from<br><code>%LOCALAPPDATA%\\SpoTUI\\sposync\\sposync.exe</code> (Windows) or <code>~/.local/share/sposync/sposync --headless</code> (Linux).<br><br>Guide: <a href="${SPOSYNC_GUIDE_URL}" target="_blank" rel="noopener" style="color:inherit">${SPOSYNC_GUIDE_URL}</a><br>Discord: <a href="${DISCORD_INVITE_URL}" target="_blank" rel="noopener" style="color:inherit">${DISCORD_INVITE_URL}</a></div>`;
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
                const uri = app.add2listTrackUri || Spicetify.Player.data?.item?.uri || Spicetify.Player.data?.track?.uri;
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
                    await playFresh(p.uri);
                    dbg("[SpoTUI] playing playlist:", p.name);
                    closePlaylistPanel();
                }
            } else {
                const song = app.playlistSongs[app.selectedSong];
                const context = app.playlists[app.selectedPlaylist];
                if (song && context) {
                    await playFresh(song.uri, context.uri);
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

    function isQueueEndMarker(item) {
        if (item.artist) return false;
        return /^Track\s+\d+$/i.test(item.name || "");
    }

    function loadQueue() {
        const q = Spicetify.Queue || {};
        const cur = q.track;
        const tracks = [];
        if (cur) {
            const item = { ...normalizeTrackItem(cur, 0), uid: cur.uid, current: true };
            if (!isQueueEndMarker(item)) tracks.push(item);
        }
        let ended = false;
        (q.nextTracks || []).forEach((t, i) => {
            if (ended) return;
            const item = { ...normalizeTrackItem(t, i + 1), uid: t.uid, current: false };
            if (isQueueEndMarker(item)) {
                tracks.push({ uri: "", uid: "", name: "End of queue", artist: "", current: false, endOfQueue: true });
                ended = true;
                return;
            }
            tracks.push(item);
        });
        app.queueTracks = tracks;
        app.selectedQueue = 0;
    }

    function onSongChange() {
        if (!app.queuePanelOpen || app.queueGrab >= 0) return;
        const sel = app.queueTracks[app.selectedQueue];
        loadQueue();
        if (sel) {
            const i = app.queueTracks.findIndex((t) => (sel.uid && t.uid === sel.uid) || t.uri === sel.uri);
            if (i >= 0) app.selectedQueue = i;
        }
        renderQueueList();
    }

    function renderQueueList() {
        const el = document.getElementById("spotui-queue-list");
        if (!el) return;
        const legend = document.createElement("legend");
        legend.textContent = "Queue";
        const nodes = app.queueTracks.map((t, i) => {
            const d = document.createElement("div");
            d.className = "playlist-item" + (t.endOfQueue ? " queue-end" : "") + (i === app.selectedQueue ? " selected" : "");
            d.textContent = t.endOfQueue
                ? (app.queueGrab === i ? "> " : "") + "End of queue"
                : (app.queueGrab === i ? "> " : "") + (t.current ? "\u25B6 " : "") + t.name + (t.artist ? " - " + t.artist : "");
            return d;
        });
        el.replaceChildren(legend, ...nodes);
        el.children[app.selectedQueue + 1]?.scrollIntoView({ block: "nearest" });
    }

    async function applyQueueOrder() {
        const i = app.queueTracks.findIndex((t) => t.current);
        const next = app.queueTracks.slice(i < 0 ? 0 : i + 1).filter((t) => !t.endOfQueue && t.uri).map((t) => ({ uri: t.uri, uid: t.uid }));
        await Spicetify.Platform.PlayerAPI.clearQueue();
        if (next.length) await Spicetify.addToQueue(next);
    }

    function handleQueueKeydown(e) {
        if (!app.queuePanelOpen) return;
        e.stopPropagation();
        if (e.key === "Escape") {
            e.preventDefault();
            closeQueuePanel();
            return;
        }
        if (e.key === "Tab") {
            e.preventDefault();
            if (app.queueGrab < 0) {
                const t = app.queueTracks[app.selectedQueue];
                if (app.selectedQueue && t && !t.endOfQueue) app.queueGrab = app.selectedQueue;
            }
            else {
                app.queueGrab = -1;
                applyQueueOrder();
            }
            renderQueueList();
            return;
        }
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const dir = e.key === "ArrowUp" ? -1 : 1;
            const n = app.queueTracks.length;
            if (!n) return;
            const to = app.selectedQueue + dir;
            if (to < 0 || to >= n) return;
            if (app.queueGrab >= 0) {
                if (!to) return;
                if (app.queueTracks[to]?.endOfQueue || app.queueTracks[app.selectedQueue]?.endOfQueue) return;
                const a = app.queueTracks;
                [a[app.selectedQueue], a[to]] = [a[to], a[app.selectedQueue]];
                app.selectedQueue = app.queueGrab = to;
            } else app.selectedQueue = to;
            renderQueueList();
            return;
        }
        if (e.key === "Enter") {
            e.preventDefault();
            const t = app.queueTracks[app.selectedQueue];
            if (!app.selectedQueue || !t || t.endOfQueue) return;
            for (let i = app.selectedQueue; i--;) Spicetify.Player.next();
            closeQueuePanel();
            return;
        }
        if ((e.key === "r" || e.key === "R") && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            const t = app.queueTracks[app.selectedQueue];
            if (!t || t.current || t.endOfQueue) return;
            app.queueGrab = -1;
            app.queueTracks.splice(app.selectedQueue, 1);
            if (app.selectedQueue >= app.queueTracks.length) app.selectedQueue = Math.max(0, app.queueTracks.length - 1);
            applyQueueOrder();
            renderQueueList();
        }
    }

    function closeQueuePanel() {
        const wasOpen = app.queuePanelOpen;
        app.queuePanelOpen = false;
        app.queueGrab = -1;
        document.body.classList.remove("spotui-queue-panel");
        const infoPopup = document.getElementById("spotui-queue-info-popup");
        if (infoPopup) infoPopup.hidden = true;
        const panel = document.getElementById("spotui-queue-panel");
        if (panel) panel.hidden = true;
        const input = document.getElementById("spotui-input");
        if (input) input.focus();
        document.removeEventListener("keydown", handleQueueKeydown, true);
        Spicetify.Player.removeEventListener("songchange", onSongChange);
        if (wasOpen) emitPaneClose("queue");
    }

    function openQueuePanel() {
        loadQueue();
        app.queueGrab = -1;
        app.queuePanelOpen = true;
        document.body.classList.add("spotui-queue-panel");
        const panel = document.getElementById("spotui-queue-panel");
        if (panel) panel.hidden = false;
        const input = document.getElementById("spotui-input");
        if (input) input.blur();
        renderQueueList();
        document.addEventListener("keydown", handleQueueKeydown, true);
        Spicetify.Player.addEventListener("songchange", onSongChange);
    }

    const SEARCH_DEBOUNCE_MS = 250;
    const AUTOCOMPLETE_TYPE_RE = /autocomplete/i;

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
        return types.some((type) => typeof type === "string" && AUTOCOMPLETE_TYPE_RE.test(type));
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
        // Start where the input's text starts (its left padding), like the command bar ghost.
        let padLeft = 0;
        try { padLeft = parseFloat(getComputedStyle(input).paddingLeft) || 0; } catch (e) {}
        ghost.style.left = `${input.offsetLeft + padLeft}px`;
        ghost.style.top = `${input.offsetTop}px`;
        ghost.style.width = `${Math.max(0, input.offsetWidth - padLeft)}px`;
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

    async function playSearchResult(idx) {
        const item = app.searchResults[idx];
        if (!item || !item.uri) return;
        await playFresh(item.uri);
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

    async function handleSearchPanelKeydown(e) {
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
            return;
        }
        if (app.searchFocus !== "results" || e.ctrlKey || e.altKey || e.metaKey) return;
        const item = app.searchResults[app.searchSelected];
        if ((e.key === "a" || e.key === "A") && item?.uri) {
            e.preventDefault();
            await openAdd2listPanel(item.uri);
            return;
        }
        if ((e.key === "q" || e.key === "Q") && item?.uri) {
            e.preventDefault();
            try {
                await Spicetify.addToQueue([{ uri: item.uri }]);
                jamSay("Added to queue");
            } catch (err) {
                jamSay("Queue error: " + (err.message || err));
            }
        }
    }

    function closeSearchPanel(opts = {}) {
        const wasOpen = app.searchPanelOpen;
        app.searchPanelOpen = false;
        app.searchAutocomplete = "";
        const ghost = document.getElementById("spotui-search-ghost");
        if (ghost) {
            ghost.hidden = true;
            ghost.textContent = "";
        }
        document.body.classList.remove("spotui-search-panel");
        const infoPopup = document.getElementById("spotui-search-info-popup");
        if (infoPopup) infoPopup.hidden = true;
        const panel = document.getElementById("spotui-search-panel");
        if (panel) panel.hidden = true;
        document.removeEventListener("keydown", handleSearchPanelKeydown, true);
        if (app.searchDebounce) {
            clearTimeout(app.searchDebounce);
            app.searchDebounce = null;
        }
        const input = document.getElementById("spotui-input");
        if (input) input.focus();
        if (wasOpen && !opts.silent) emitPaneClose("search");
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

    // Video mode, pure core: Spotify Canvas parsing, profile choice, item
    // classification, an LRU byte cache and the timer-driven controller.
    // Self-contained: no dependencies, no DOM, no Spicetify. Everything
    // environmental arrives through `deps`, so the whole module runs under Node.
    // Every input is untrusted: each function returns null (or undefined where
    // documented) on a shape mismatch and never throws.

    const VIDEO_TIMING = Object.freeze({
        PAUSE_GRACE_MS: 1500,
        SWAP_WAIT_MS: 1500,
        POLL_MS: 2000,
        FADE_IN_MS: 600,
        CROSSFADE_MS: 600,
        FADE_OUT_MS: 800,
        MANIFEST_TIMEOUT_MS: 8000,
        SEGMENTS_TIMEOUT_MS: 15000,
        LOOKUP_TIMEOUT_MS: 8000,
        RETRY_DELAY_MS: 2000,
        FAILED_RETRY_AFTER_MS: 10 * 60 * 1000,
        DEGRADE_MS: 30 * 60 * 1000,
        PRELOAD_DELAY_MS: 3000,
        QUALITY_SAMPLE_MS: 10000,
    });

    const VIDEO_LIMITS = Object.freeze({
        MAX_PROFILE_SHORT_SIDE: 720,
        MAX_SEGMENTS: 8,
        MAX_TRACK_BYTES: 12 * 1024 * 1024,
        CACHE_TRACKS: 3,
        CACHE_BYTES: 24 * 1024 * 1024,
        NEGATIVE_CACHE: 300,
        FAIL_LIMIT: 4,
        MAX_PENALTY: 2,
        DROP_RATIO: 0.1,
        FREEZE_DROP_RATIO: 0.2,
        MIN_FRAMES: 100,
    });
    const CANVAS_MANIFEST_BASE = "https://spclient.wg.spotify.com/manifests/v9/json/sources/";
    const VP9_MIME = 'video/webm; codecs="vp9"';

    // video-fa.scdn.co, i.scdn.co, canvaz.scdn.co and the second CDN video-cf.spotifycdn.com
    const MEDIA_HOST_REGEX = /^(?:[a-z0-9-]+\.)*(?:scdn\.co|spotifycdn\.com)$/i;
    const FILE_ID_REGEX = /^[A-Za-z0-9_-]{8,128}$/;
    const IMAGE_ID_REGEX = /^[0-9a-f]{40}$/i;
    const FILE_TYPE_REGEX = /^[a-z0-9]{1,8}$/i;
    // The templates end in a signed query string that is long on a live manifest (the
    // recorded fixtures have it cut to ?sig=REDACTED): these caps only bound untrusted input.
    const MAX_URL_LENGTH = 8400;
    const MAX_TEMPLATE_LENGTH = 8192;
    const MAX_PROFILE_ENTRIES = 256;
    const MAX_BASE_URLS = 16;
    const MAX_SEGMENT_LENGTH_SEC = 60;
    const MAX_DIMENSION = 16384;
    const MAX_PROFILE_ID = 9999;
    // image_url (300 px) first: plenty behind a 32 px blur and the lightest download.
    const ART_KEYS = ["image_url", "image_large_url", "image_xlarge_url", "image_small_url"];
    const VIDEO_TYPES = ["VIDEO", "VIDEO_LOOPING", "VIDEO_LOOPING_RANDOM"];
    const IMAGE_TYPES = ["IMAGE", "GIF"];

    // Own, non-inherited property read: a polluted Object.prototype or a JSON
    // "__proto__" key can never feed a field we look up by name.
    function own(o, key) {
        if (o === null || typeof o !== "object") return undefined;
        return Object.prototype.hasOwnProperty.call(o, key) ? o[key] : undefined;
    }

    function isPlainObject$1(o) {
        return o !== null && typeof o === "object" && !Array.isArray(o);
    }

    // Parsed URL or null. Only https on a Spotify CDN host, no credentials, no
    // custom port, no whitespace/quote/angle/backslash characters.
    function checkUrl(s) {
        if (typeof s !== "string" || s.length === 0 || s.length > MAX_URL_LENGTH) return null;
        if (/[\u0000- "<>\\\u007f]/.test(s)) return null;
        let u;
        try {
            u = new URL(s);
        } catch (e) {
            return null;
        }
        if (u.protocol !== "https:") return null;
        if (u.username || u.password || u.port) return null;
        if (!MEDIA_HOST_REGEX.test(u.hostname)) return null;
        return u;
    }

    function safeMediaUrl(s) {
        const u = checkUrl(s);
        if (!u) return null;
        const href = u.href;
        return href.length <= MAX_URL_LENGTH ? href : null;
    }

    function spotifyImageToUrl(v) {
        if (typeof v !== "string") return null;
        if (v.startsWith("spotify:image:")) {
            const id = v.slice("spotify:image:".length);
            return IMAGE_ID_REGEX.test(id) ? "https://i.scdn.co/image/" + id : null;
        }
        const u = checkUrl(v);
        if (!u || u.hostname.toLowerCase() !== "i.scdn.co" || u.search || u.hash) return null;
        return /^\/image\/[0-9a-f]{40}$/i.test(u.pathname) ? u.href : null;
    }

    function artUrlFromMetadata(meta) {
        if (!isPlainObject$1(meta)) return null;
        for (const key of ART_KEYS) {
            const url = spotifyImageToUrl(own(meta, key));
            if (url) return url;
        }
        return null;
    }

    // "none" | "ad" | "episode" | "local" | "track" | "other"
    function classifyItem(item) {
        if (!isPlainObject$1(item)) return "none";
        const meta = isPlainObject$1(own(item, "metadata")) ? own(item, "metadata") : {};
        const uri = typeof own(item, "uri") === "string" ? own(item, "uri") : "";
        const type = own(item, "type");
        const mediaType = own(item, "mediaType");
        if (type === "ad" || own(meta, "is_advertisement") === "true" || uri.startsWith("spotify:ad:")) return "ad";
        if (
            type === "episode" ||
            (typeof mediaType === "string" && mediaType !== "audio") ||
            uri.startsWith("spotify:episode:")
        ) {
            return "episode";
        }
        if (uri.startsWith("spotify:local:")) return "local";
        if (uri.startsWith("spotify:track:")) return "track";
        return "other";
    }

    // Canvas shape: { kind: "video", fileId, artUrl } | { kind: "image", imageUrl, artUrl }.
    function normalizeCanvas(raw, artUrl) {
        if (!isPlainObject$1(raw)) return null;
        const type = own(raw, "type");
        if (typeof type !== "string") return null;
        const art = typeof artUrl === "string" ? safeMediaUrl(artUrl) : null;
        if (VIDEO_TYPES.includes(type)) {
            const fileId = own(raw, "fileId");
            // The .cnvs.mp4 `url` is ignored on purpose: it is H.264 and cannot be played here.
            if (typeof fileId !== "string" || !FILE_ID_REGEX.test(fileId)) return null;
            return { kind: "video", fileId, artUrl: art };
        }
        if (IMAGE_TYPES.includes(type)) {
            const imageUrl = safeMediaUrl(own(raw, "url"));
            if (!imageUrl) return null;
            return { kind: "image", imageUrl, artUrl: art };
        }
        return null;
    }

    // Reads the flat `canvas.*` keys of a player item's metadata.
    // undefined: no `canvas.url` key (unknown, ask GraphQL). null: keys present but invalid.
    function canvasFromMetadata(meta) {
        if (!isPlainObject$1(meta)) return undefined;
        if (own(meta, "canvas.url") === undefined) return undefined;
        return normalizeCanvas(
            { type: own(meta, "canvas.type"), url: own(meta, "canvas.url"), fileId: own(meta, "canvas.fileId") },
            artUrlFromMetadata(meta)
        );
    }

    // resp = { data: { trackUnion: { canvas: { fileId, type, uri, url } | null } } }
    function canvasFromGraphQL(resp, artUrl) {
        const canvas = own(own(own(resp, "data"), "trackUnion"), "canvas");
        if (!canvas) return null;
        return normalizeCanvas(canvas, artUrl);
    }

    function posInt(n, max) {
        return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= max ? n : null;
    }

    function isVp9Webm(p) {
        const fileType = own(p, "file_type");
        const mime = own(p, "mime_type");
        const codec = own(p, "video_codec");
        const webm =
            (typeof fileType === "string" && fileType.toLowerCase() === "webm") ||
            (typeof mime === "string" && mime.toLowerCase() === "video/webm");
        const vp9 = typeof codec === "string" && /^vp0?9(\.|$)/i.test(codec);
        return webm && vp9;
    }

    function nonEmpty(v) {
        if (v === undefined || v === null || v === false) return false;
        if (Array.isArray(v)) return v.length > 0;
        if (typeof v === "object") return Object.keys(v).length > 0;
        return true;
    }

    // Real shape (verified against live manifests):
    //   { contents: [{ segment_length, end_time_millis, encryption_infos, profiles: [
    //       { id, file_type, mime_type, video_codec, video_width, video_height, ... }] }],
    //     end_time_millis, base_urls: [..], initialization_template, segment_template }
    // Returns { profiles: [{ id, width, height, fileType }] (VP9 WebM, height ascending),
    // segLenSec, endMs, baseUrls (every valid CDN base, in order), initTpl, segTpl } or null.
    function parseCanvasManifest(json) {
        try {
            if (!isPlainObject$1(json)) return null;
            const contents = own(json, "contents");
            const c = Array.isArray(contents) ? contents[0] : json;
            if (!isPlainObject$1(c)) return null;
            if (nonEmpty(own(c, "encryption_infos")) || nonEmpty(own(json, "encryption_infos"))) return null;

            const segLenSec = posInt(own(c, "segment_length") ?? own(json, "segment_length"), MAX_SEGMENT_LENGTH_SEC);
            const endRaw = own(json, "end_time_millis") ?? own(c, "end_time_millis");
            if (segLenSec === null || typeof endRaw !== "number" || !Number.isFinite(endRaw) || endRaw <= 0) return null;
            const endMs = endRaw;
            if (Math.ceil(endMs / 1000 / segLenSec) > VIDEO_LIMITS.MAX_SEGMENTS) return null;

            const rawProfiles = own(c, "profiles") ?? own(json, "profiles");
            if (!Array.isArray(rawProfiles) || rawProfiles.length > MAX_PROFILE_ENTRIES) return null;
            const profiles = [];
            for (const p of rawProfiles) {
                if (!isPlainObject$1(p) || !isVp9Webm(p)) continue;
                if (own(p, "encrypted") === true || nonEmpty(own(p, "encryption_info")) || nonEmpty(own(p, "encryption_infos"))) {
                    return null;
                }
                const id = own(p, "id");
                const width = own(p, "video_width");
                const height = own(p, "video_height");
                const fileType = own(p, "file_type");
                if (typeof id !== "number" || !Number.isInteger(id) || id < 0 || id > MAX_PROFILE_ID) continue;
                if (!posInt(width, MAX_DIMENSION) || !posInt(height, MAX_DIMENSION)) continue;
                if (typeof fileType !== "string" || !FILE_TYPE_REGEX.test(fileType)) continue;
                profiles.push({ id, width, height, fileType: fileType.toLowerCase() });
            }
            if (profiles.length === 0) return null;
            profiles.sort((a, b) => a.height - b.height || a.width - b.width || a.id - b.id);

            const initTpl = own(json, "initialization_template") ?? own(c, "initialization_template");
            const segTpl = own(json, "segment_template") ?? own(c, "segment_template");
            if (typeof initTpl !== "string" || initTpl.length === 0 || initTpl.length > MAX_TEMPLATE_LENGTH) return null;
            if (typeof segTpl !== "string" || segTpl.length === 0 || segTpl.length > MAX_TEMPLATE_LENGTH) return null;
            if (!segTpl.includes("{{segment_timestamp}}")) return null;

            // Fixtures list two CDN hosts (video-fa.scdn.co, video-cf.spotifycdn.com):
            // keep every valid one, in order; the loader falls back to the next.
            const bases = own(json, "base_urls") ?? own(c, "base_urls");
            if (!Array.isArray(bases)) return null;
            const baseUrls = [];
            for (const b of bases.slice(0, MAX_BASE_URLS)) {
                const href = safeMediaUrl(b);
                if (!href) continue;
                const withSlash = href.endsWith("/") ? href : href + "/";
                if (!baseUrls.includes(withSlash)) baseUrls.push(withSlash);
            }
            if (baseUrls.length === 0) return null;
            return { profiles, segLenSec, endMs, baseUrls, initTpl, segTpl };
        } catch (e) {
            return null;
        }
    }

    // { init, segments: [url...] } or null. The signed query string inside the
    // templates is kept byte for byte: only the {{...}} placeholders change, and the
    // result is validated for protocol, host, length and leftover "{{".
    function segmentUrls(manifest, profile, baseIndex = 0) {
        try {
            if (!isPlainObject$1(manifest) || !isPlainObject$1(profile)) return null;
            const { segLenSec, endMs, baseUrls, initTpl, segTpl } = manifest;
            if (!Array.isArray(baseUrls) || !Number.isInteger(baseIndex) || baseIndex < 0 || baseIndex >= baseUrls.length) return null;
            const baseUrl = baseUrls[baseIndex];
            const id = profile.id;
            const fileType = profile.fileType;
            if (typeof id !== "number" || !Number.isInteger(id) || id < 0 || id > MAX_PROFILE_ID) return null;
            if (typeof fileType !== "string" || !FILE_TYPE_REGEX.test(fileType)) return null;
            if (posInt(segLenSec, MAX_SEGMENT_LENGTH_SEC) === null) return null;
            if (typeof endMs !== "number" || !Number.isFinite(endMs) || endMs <= 0) return null;
            if (typeof initTpl !== "string" || typeof segTpl !== "string" || typeof baseUrl !== "string") return null;
            const base = checkUrl(baseUrl);
            if (!base) return null;
            const prefix = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";

            const fill = (tpl, ts) => {
                const path = tpl
                    .split("{{profile_id}}")
                    .join(String(id))
                    .split("{{file_type}}")
                    .join(fileType)
                    .split("{{segment_timestamp}}")
                    .join(String(ts))
                    .replace(/^\/+/, "");
                if (path.includes("{{")) return null;
                const full = prefix + path;
                const u = checkUrl(full);
                if (!u || u.hostname !== base.hostname) return null;
                return full;
            };

            const count = Math.ceil(endMs / 1000 / segLenSec);
            if (count < 1 || count > VIDEO_LIMITS.MAX_SEGMENTS) return null;
            const init = fill(initTpl, 0);
            if (init === null) return null;
            const segments = [];
            // Whole-second timestamps 0, L, 2L, ... while t * 1000 < endMs.
            for (let t = 0; t * 1000 < endMs; t += segLenSec) {
                if (segments.length >= VIDEO_LIMITS.MAX_SEGMENTS) return null;
                const url = fill(segTpl, t);
                if (url === null) return null;
                segments.push(url);
            }
            return { init, segments };
        } catch (e) {
            return null;
        }
    }

    // Height in CSS px a clip of clipW x clipH is displayed at inside a layerW x layerH
    // box with object-fit: contain. Any invalid input falls back to layerH (and to 0
    // when the layer itself is invalid).
    function displayedHeight(layerW, layerH, clipW, clipH) {
        const ok = (n) => typeof n === "number" && Number.isFinite(n) && n > 0;
        if (!ok(layerH)) return 0;
        if (!ok(layerW) || !ok(clipW) || !ok(clipH)) return layerH;
        const aspect = clipW / clipH;
        return Math.min(layerH, layerW / aspect);
    }

    // profiles: [{ id, width, height, fileType }]. Drops profiles whose SHORT side is
    // over the cap (orientation-neutral: 1080x720 and 720x1080 weigh the same),
    // takes the first with height >= targetHeight (else the largest left), then
    // steps down `penalty` positions.
    function chooseProfile(profiles, opts) {
        try {
            if (!Array.isArray(profiles)) return null;
            const target = opts && Number.isFinite(opts.targetHeight) ? opts.targetHeight : 0;
            const rawPenalty = opts && Number.isFinite(opts.penalty) ? Math.floor(opts.penalty) : 0;
            const penalty = Math.max(0, rawPenalty);
            const usable = profiles
                .filter(
                    (p) =>
                        isPlainObject$1(p) &&
                        Number.isFinite(p.width) &&
                        Number.isFinite(p.height) &&
                        Math.min(p.width, p.height) <= VIDEO_LIMITS.MAX_PROFILE_SHORT_SIDE
                )
                .slice(0, MAX_PROFILE_ENTRIES)
                .sort((a, b) => a.height - b.height);
            if (usable.length === 0) return null;
            let idx = usable.findIndex((p) => p.height >= target);
            if (idx < 0) idx = usable.length - 1;
            return usable[Math.max(0, idx - penalty)];
        } catch (e) {
            return null;
        }
    }

    // Time allowed for all segments of one clip: the base budget up to a 480 short
    // side, half again for the 720 profile (about twice the bytes).
    function segmentsTimeoutMs(profile) {
        const w = profile && Number.isFinite(profile.width) ? profile.width : 0;
        const h = profile && Number.isFinite(profile.height) ? profile.height : 0;
        const short = Math.min(w, h);
        return short > 480 ? Math.round(VIDEO_TIMING.SEGMENTS_TIMEOUT_MS * 1.5) : VIDEO_TIMING.SEGMENTS_TIMEOUT_MS;
    }

    // Byte-bounded LRU. get() refreshes recency; set() evicts the oldest entries
    // until both caps hold. A value larger than maxBytes (or an invalid size) is
    // rejected: set() returns false and nothing is evicted or replaced.
    function createLru(maxItems, maxBytes) {
        const map = new Map(); // key -> { value, bytes }, insertion order = recency
        let total = 0;
        const itemCap = Number.isFinite(maxItems) ? maxItems : 0;
        const byteCap = Number.isFinite(maxBytes) ? maxBytes : 0;
        return {
            get(key) {
                const e = map.get(key);
                if (!e) return undefined;
                map.delete(key);
                map.set(key, e);
                return e.value;
            },
            set(key, value, bytes) {
                if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return false;
                if (bytes > byteCap || itemCap < 1) return false;
                const old = map.get(key);
                if (old) {
                    total -= old.bytes;
                    map.delete(key);
                }
                map.set(key, { value, bytes });
                total += bytes;
                while (map.size > itemCap || total > byteCap) {
                    const oldest = map.keys().next();
                    if (oldest.done) break;
                    total -= map.get(oldest.value).bytes;
                    map.delete(oldest.value);
                }
                return true;
            },
            delete(key) {
                const e = map.get(key);
                if (!e) return false;
                total -= e.bytes;
                return map.delete(key);
            },
            clear() {
                map.clear();
                total = 0;
            },
            bytes() {
                return total;
            },
            size() {
                return map.size;
            },
        };
    }

    // Controller. deps: { now, setTimeout, clearTimeout, readPlayer, resolve, load,
    // show, hide, resume, release, log }. See the state table in the build plan.
    // Phases: off | idle | resolving | loading | showing | fading.
    // Reasons: waiting | unsupported | no-canvas | loading | showing | error | hidden.
    function createController(deps) {
        const T = VIDEO_TIMING;
        let enabled = false;
        let phase = "off";
        let reason = "waiting";
        let targetUri = null;
        let shown = null; // { uri, media }
        let kept = null; // { uri, media }: hidden but alive, for a resume without reload
        const settled = new Map(); // uri -> { result: "none" | "error", at }
        let gen = 0;
        let inflight = false;
        let abort = null;
        let graceTimer = null;
        let swapTimer = null;
        let fadeTimer = null;
        const timers = new Map(); // timer id -> cancel callback (or null)

        function call(name, ...args) {
            try {
                return deps[name](...args);
            } catch (e) {
                try {
                    deps.log("dep-error", { name, message: String((e && e.message) || e).slice(0, 200) });
                } catch (e2) {
                    // nothing left to report to
                }
                return undefined;
            }
        }

        function later(ms, fn, onCancel) {
            const id = deps.setTimeout(() => {
                timers.delete(id);
                fn();
            }, ms);
            timers.set(id, onCancel || null);
            return id;
        }

        function cancelTimer(id) {
            if (id === null) return;
            if (timers.has(id)) {
                timers.delete(id);
                call("clearTimeout", id);
            }
        }

        function newAbort() {
            if (typeof AbortController === "function") return new AbortController();
            const signal = { aborted: false };
            return {
                signal,
                abort() {
                    signal.aborted = true;
                },
            };
        }

        function cancelInflight() {
            gen++;
            inflight = false;
            if (abort) {
                try {
                    abort.abort();
                } catch (e) {
                    // already aborted
                }
                abort = null;
            }
        }

        // Reduced motion: the CSS transitions are off, so nothing waits for a fade.
        function instant() {
            try {
                return Boolean(deps.instant && deps.instant());
            } catch (e) {
                return false;
            }
        }

        function releaseLater(media, ms) {
            if (instant()) {
                call("release", media);
                return;
            }
            later(ms, () => call("release", media), () => call("release", media));
        }

        // until: epoch ms after which a "none" is asked again (a transient "none",
        // e.g. video Canvases switched off by the circuit breaker). 0 = for good.
        function setSettled(uri, result, until = 0) {
            settled.delete(uri);
            settled.set(uri, { result, at: deps.now(), until });
            while (settled.size > VIDEO_LIMITS.NEGATIVE_CACHE) {
                const oldest = settled.keys().next();
                if (oldest.done) break;
                settled.delete(oldest.value);
            }
        }

        function readNow() {
            let p = null;
            try {
                p = deps.readPlayer();
            } catch (e) {
                p = null;
            }
            const item = p && p.item ? p.item : null;
            const cls = classifyItem(item);
            const visible = Boolean(p && p.visible);
            const paused = p ? Boolean(p.isPaused) : true;
            const uri = item && typeof item.uri === "string" ? item.uri : null;
            const want = visible && !paused && cls === "track" && uri ? uri : null;
            let idleReason = "waiting";
            if (!visible) idleReason = "hidden";
            else if (cls === "ad" || cls === "episode" || cls === "local" || cls === "other") idleReason = "unsupported";
            return { want, idleReason };
        }

        // Fade the shown media away. keep: hidden but resumable (pause / hidden window);
        // otherwise it is released once the fade-out is over.
        function fadeAway(keep, why) {
            if (!shown) return;
            const old = shown;
            shown = null;
            call("hide");
            if (keep) {
                if (kept && kept.media !== old.media) call("release", kept.media);
                kept = old;
            } else {
                releaseLater(old.media, T.FADE_OUT_MS);
            }
            reason = why;
            cancelTimer(fadeTimer);
            fadeTimer = null;
            if (instant()) {
                phase = inflight ? "resolving" : "idle";
                return;
            }
            phase = "fading";
            fadeTimer = later(T.FADE_OUT_MS, () => {
                fadeTimer = null;
                if (phase === "fading") phase = inflight ? "resolving" : "idle";
            });
        }

        function onGrace() {
            graceTimer = null;
            if (!enabled) return;
            const { want, idleReason } = readNow();
            if (want !== null) {
                poke();
                return;
            }
            if (shown) fadeAway(true, idleReason);
            if (idleReason === "unsupported" && inflight) {
                cancelInflight();
                targetUri = null;
            }
        }

        function onSwapWait() {
            swapTimer = null;
            if (!enabled || !shown) return;
            if (targetUri !== null && shown.uri !== targetUri) fadeAway(false, "loading");
        }

        // The wanted track's clip is already alive in `kept` (it loaded while the
        // player had moved on): use it, no resolve and no load. The adapter answers
        // `false` when the media is gone (its slot was removed): then it is released
        // and the caller loads the track the normal way.
        function useKept() {
            const k = kept;
            kept = null;
            const old = shown;
            const done = old ? call("show", k.media, { crossfade: true }) : call("resume", k.media);
            if (done === false) {
                call("release", k.media);
                return false;
            }
            if (old) releaseLater(old.media, T.CROSSFADE_MS);
            shown = k;
            targetUri = k.uri;
            phase = "showing";
            reason = "showing";
            return true;
        }

        function onLoaded(uri, media) {
            cancelTimer(swapTimer);
            swapTimer = null;
            const { want, idleReason } = readNow();
            if (want === uri) {
                const old = shown;
                if (call("show", media, { crossfade: Boolean(old) }) === false) {
                    // The slot vanished under us: not "showing". The next poke loads it again.
                    call("release", media);
                    reason = "loading";
                    phase = shown ? "showing" : "idle";
                    return;
                }
                if (old) releaseLater(old.media, T.CROSSFADE_MS);
                if (kept) {
                    call("release", kept.media);
                    kept = null;
                }
                shown = { uri, media };
                cancelTimer(graceTimer);
                graceTimer = null;
                phase = "showing";
                reason = "showing";
                return;
            }
            // The player moved on (pause, hidden window, another track): keep it paused.
            if (kept && kept.media !== media) call("release", kept.media);
            kept = { uri, media };
            phase = shown ? "showing" : "idle";
            if (!shown) reason = idleReason;
            poke();
        }

        async function run(myGen, uri, signal) {
            try {
                const canvas = await deps.resolve(uri, signal);
                if (myGen !== gen) return;
                if (!canvas) {
                    inflight = false;
                    const until = deps.transientNone ? Number(call("transientNone", uri)) : 0;
                    setSettled(uri, "none", Number.isFinite(until) && until > 0 ? until : 0);
                    cancelTimer(swapTimer);
                    swapTimer = null;
                    reason = "no-canvas";
                    phase = "idle";
                    if (shown) fadeAway(false, "no-canvas");
                    return;
                }
                phase = "loading";
                const media = await deps.load(canvas, uri, signal);
                if (myGen !== gen) {
                    if (media) call("release", media);
                    return;
                }
                inflight = false;
                if (!media) throw new Error("empty-media");
                onLoaded(uri, media);
            } catch (e) {
                if (myGen !== gen || (signal && signal.aborted)) return;
                inflight = false;
                if (e && e.retryLater) {
                    // Not this track's fault (no free slot): no error entry, the next poke asks again.
                    call("log", "load-deferred", { uri, message: String(e.message || e).slice(0, 200) });
                    cancelTimer(swapTimer);
                    swapTimer = null;
                    reason = "loading";
                    phase = shown ? "showing" : "idle";
                    return;
                }
                setSettled(uri, "error");
                call("log", "load-failed", { uri, message: String((e && e.message) || e).slice(0, 200) });
                cancelTimer(swapTimer);
                swapTimer = null;
                reason = "error";
                phase = "idle";
                if (shown) fadeAway(false, "error");
            }
        }

        function start(want) {
            cancelInflight();
            abort = newAbort();
            inflight = true;
            const myGen = gen;
            // A kept clip of the wanted track never gets here (poke uses it); any other is dead weight.
            if (kept) {
                call("release", kept.media);
                kept = null;
            }
            cancelTimer(swapTimer);
            swapTimer = null;
            if (shown) swapTimer = later(T.SWAP_WAIT_MS, onSwapWait);
            targetUri = want;
            phase = "resolving";
            reason = "loading";
            run(myGen, want, abort.signal).catch(() => {});
        }

        function poke() {
            if (!enabled) return;
            const { want, idleReason } = readNow();

            if (want === null) {
                if (shown) {
                    if (graceTimer === null) graceTimer = later(T.PAUSE_GRACE_MS, onGrace);
                    return;
                }
                reason = idleReason;
                if (idleReason === "unsupported" && inflight) {
                    cancelInflight();
                    targetUri = null;
                }
                if (!inflight && phase !== "fading") phase = "idle";
                return;
            }

            cancelTimer(graceTimer);
            graceTimer = null;

            if (shown && shown.uri === want) {
                if (inflight) cancelInflight();
                cancelTimer(swapTimer);
                swapTimer = null;
                targetUri = want;
                phase = "showing";
                reason = "showing";
                return;
            }

            if (kept && kept.uri === want) {
                if (inflight) cancelInflight();
                cancelTimer(swapTimer);
                swapTimer = null;
                if (useKept()) return;
                // The kept media was gone: fall through to a normal load of this track.
            }

            const s = settled.get(want);
            const retry = s && ((s.result === "error" && deps.now() - s.at >= T.FAILED_RETRY_AFTER_MS) || (s.until > 0 && deps.now() >= s.until));
            if (retry) {
                settled.delete(want);
            } else if (s) {
                if (inflight && targetUri !== want) cancelInflight();
                targetUri = want;
                cancelTimer(swapTimer);
                swapTimer = null;
                if (shown) fadeAway(false, s.result === "none" ? "no-canvas" : "error");
                else {
                    reason = s.result === "none" ? "no-canvas" : "error";
                    if (!inflight && phase !== "fading") phase = "idle";
                }
                return;
            }

            if (inflight && targetUri === want) return;
            start(want);
        }

        function enable() {
            if (enabled) return;
            enabled = true;
            phase = "idle";
            reason = "waiting";
            poke();
        }

        function disable() {
            const wasShown = shown;
            const wasKept = kept;
            enabled = false;
            cancelInflight();
            for (const [id, onCancel] of Array.from(timers.entries())) {
                timers.delete(id);
                call("clearTimeout", id);
                if (onCancel) onCancel();
            }
            graceTimer = null;
            swapTimer = null;
            fadeTimer = null;
            shown = null;
            kept = null;
            if (wasShown) {
                call("hide");
                call("release", wasShown.media);
            }
            if (wasKept) call("release", wasKept.media);
            settled.clear();
            targetUri = null;
            phase = "off";
            reason = "waiting";
        }

        function status() {
            return { enabled, phase, reason, uri: targetUri };
        }

        return { enable, disable, poke, status };
    }

    // Video mode: while a song plays, its Spotify Canvas replaces the theme
    // background (layer #spotui-video). TUI mode: inside #spotui-tui, same z as the
    // wallpaper but later in the DOM. Spotify mode (the native UI, #spotui-tui is
    // display: none and the page is plain black): a fixed layer on <body> behind
    // the native UI, whose containers turn transparent while a clip shows (CSS
    // scoped by body.spotui-video-showing). The layer follows the mode.
    // The state machine lives in videocanvas.js; this file is the adapters:
    // Spicetify player, DOM, fetch and MediaSource. Look key "spotui:video-mode":
    // "1" = on, absent = off. Off means zero work: no listeners, timers, observers
    // or DOM. Nothing here reads or sends the Spotify access token: the manifest is
    // requested through Spicetify's own request layer, the segments with no
    // credentials. Logs carry hosts, codes and profile heights, never full URLs.

    const LAYER_ID = "spotui-video";
    const BODY_SHOWING_CLASS = "spotui-video-showing";
    const BODY_ON_CLASS = "spotui-video-on"; // video mode is enabled (scopes the poster transition)
    const ENABLE_WAIT_MS = 500;
    const ENABLE_MAX_TRIES = 20;
    const T = VIDEO_TIMING;

    // ---- module state ----------------------------------------------------------
    let controller = null;
    let layer = null;
    let running = false; // listeners, poll and layer are live
    let starting = false; // waiting for #spotui-tui / Spicetify.Player
    let gaveUp = false; // the 20 start attempts failed: the interface never appeared
    let startTries = 0;
    let startTimer = null;
    let pollTimer = null;
    let classObserver = null;
    let lastVisible = true;
    let current = null; // media being shown (the controller's `shown`)
    let zTop = 0;
    let wpTimer = null;
    let wallpaperFaded = false; // current slot's fade-in is complete
    let pausedWallpaper = false; // we paused the wallpaper <video>
    const slots = new Set(); // every media whose slot is in the DOM
    const timers = new Set(); // adapter timers, all cleared on disable
    const cache = createLru(VIDEO_LIMITS.CACHE_TRACKS, VIDEO_LIMITS.CACHE_BYTES); // uri -> download
    const negCache = new Map(); // uri -> true: GraphQL said "no Canvas" (insertion order = age)
    const MAX_SLOTS = 2; // a crossfade needs two; never more in the DOM
    // Quality guard (session only, reset on disable).
    let penalty = 0; // profile steps down for the NEXT load
    let frozen = false; // video Canvases shown as a still: the machine cannot keep up
    let qualityTimer = null;
    let qualitySample = null; // { video, total, dropped }
    // MSE: the segments of this stream carry timestamps relative to their own start
    // (found out once per session by comparing the buffered end with the manifest length).
    let offsetMode = false;
    // Circuit breaker (session only, reset on disable).
    let failStreak = 0; // consecutive video-load failures on different tracks
    const failUris = new Set();
    let degradedUntil = 0; // epoch ms; video Canvases resolve to none until then
    let halfOpen = false; // window over: the next failure re-arms it at once
    let degradedSkip = null; // { uri, until }: last track whose video Canvas the breaker skipped
    // Reduced motion.
    let motionQuery = null;
    let reducedMotion = false;
    // Preload of the next song's clip (bytes only, into the LRU).
    let preloadTimer = null;
    let preloadJob = null; // { uri, ac, promise }
    const preloadFailed = new Set(); // uris whose preload failed: not retried (the real load still is)
    let lastUri = null; // playing uri seen by the last poke, to spot a track change

    // ---- small helpers ---------------------------------------------------------

    function after(ms, fn) {
        const id = setTimeout(() => {
            timers.delete(id);
            try {
                fn();
            } catch (e) {
                dbg("[SpoTUI-video]", "timer-error", describeError(e));
            }
        }, ms);
        timers.add(id);
        return id;
    }

    function cancel(id) {
        if (id !== null && timers.delete(id)) clearTimeout(id);
    }

    function cancelAll() {
        for (const id of timers) clearTimeout(id);
        timers.clear();
    }

    // Errors this module throws carry a short code as message and vm = true. Foreign
    // errors (fetch, Spicetify, MSE) are reduced to name + status: their messages
    // can echo URLs with signed queries.
    function vmError(code, extra, retry) {
        const e = new Error(extra ? `${code} ${extra}` : code);
        e.vm = true;
        e.retry = Boolean(retry);
        return e;
    }

    function abortError() {
        const e = new Error("aborted");
        e.name = "AbortError";
        e.vm = true;
        return e;
    }

    function describeError(e) {
        if (e && e.vm) return e.message;
        const name = e && typeof e.name === "string" ? e.name.slice(0, 40) : "error";
        const status = e && Number.isFinite(e.status) ? ` ${e.status}` : "";
        return name + status;
    }

    function throwIfAborted(signal) {
        if (signal && signal.aborted) throw abortError();
    }

    function hostOf(url) {
        try {
            return new URL(url).hostname;
        } catch (e) {
            return "?";
        }
    }

    function isOn() {
        return storageGet(VIDEO_MODE_KEY) === "1";
    }

    function vp9Supported() {
        try {
            return typeof MediaSource === "function" && MediaSource.isTypeSupported(VP9_MIME);
        } catch (e) {
            return false;
        }
    }

    // Both modes show a Canvas; a minimised or fully covered window (document.hidden)
    // and standby do not.
    function isVisible() {
        return !document.hidden && !document.body.classList.contains("spotui-standby");
    }

    function inSpotifyMode() {
        const cls = document.body.classList;
        return cls.contains("spotui-spotify-enabled") || cls.contains("spotui-tui-hidden");
    }

    // Where the layer lives now: <body> in Spotify mode, #spotui-tui otherwise (null
    // while the TUI is not built yet).
    function layerHost() {
        return inSpotifyMode() ? document.body : document.getElementById("spotui-tui");
    }

    // Put the layer into the host of the current mode. A move removes the media
    // from the document, which pauses it: moveBefore keeps it playing where the
    // engine has it, else the current clip is played again.
    function syncHost() {
        if (!layer) return false;
        const host = layerHost();
        if (!host) return false;
        if (layer.parentNode === host && layer.isConnected) return true;
        let moved = false;
        if (layer.isConnected && typeof host.moveBefore === "function") {
            try {
                host.moveBefore(layer, null);
                moved = true;
            } catch (e) {}
        }
        if (!moved) {
            host.appendChild(layer);
            if (current && current.video && !stillMode() && isVisible()) playVideo(current.video);
        }
        return true;
    }

    // Video Canvases shown as a still (frame 0, never play()): reduced motion, or
    // the quality guard gave up on this machine.
    function stillMode() {
        return reducedMotion || frozen;
    }

    // ---- circuit breaker -------------------------------------------------------

    // True while video Canvases are off. When the window runs out the breaker goes
    // half-open: the next video Canvas is tried, one failure re-arms the window.
    function isDegraded() {
        if (degradedUntil === 0) return false;
        if (Date.now() < degradedUntil) return true;
        degradedUntil = 0;
        halfOpen = true;
        return false;
    }

    function armDegrade() {
        degradedUntil = Date.now() + T.DEGRADE_MS;
        halfOpen = false;
        failStreak = 0;
        failUris.clear();
        dbg("[SpoTUI-video] degraded: video Canvases off for 30 min");
    }

    // Only video loads that really failed (not aborts, not "no Canvas") reach this.
    // Several failures on one uri count once.
    function noteLoadFailure(uri) {
        if (degradedUntil !== 0 && Date.now() < degradedUntil) return;
        if (halfOpen) {
            armDegrade();
            return;
        }
        if (failUris.has(uri)) return;
        failUris.add(uri);
        failStreak += 1;
        if (failStreak >= VIDEO_LIMITS.FAIL_LIMIT) armDegrade();
    }

    function noteLoadSuccess() {
        failStreak = 0;
        failUris.clear();
        halfOpen = false;
    }

    // Controller hook: a "none" that is really "video Canvases off for now" is asked
    // again once the window is over (epoch ms), not remembered for the whole session.
    function transientNone(uri) {
        return degradedSkip && degradedSkip.uri === uri ? degradedSkip.until : 0;
    }

    // True when `uri` shows "none" only because the breaker switched video Canvases off.
    function skippedByBreaker(uri) {
        return Boolean(degradedSkip && degradedSkip.uri === uri && Date.now() < degradedSkip.until);
    }

    // An AbortSignal that follows `signal`, aborts after `ms` too, and says which.
    function scoped(signal, ms) {
        const ac = new AbortController();
        let timedOut = false;
        let timer = null;
        const relay = () => ac.abort();
        if (signal) {
            if (signal.aborted) ac.abort();
            else if (signal.addEventListener) signal.addEventListener("abort", relay, { once: true });
        }
        if (ms > 0) {
            timer = after(ms, () => {
                timedOut = true;
                ac.abort();
            });
        }
        return {
            signal: ac.signal,
            timedOut: () => timedOut,
            abort: () => ac.abort(),
            done() {
                cancel(timer);
                if (signal && signal.removeEventListener) signal.removeEventListener("abort", relay);
            },
        };
    }

    // Race a promise we cannot abort (Spicetify calls) against a scope.
    function guard(promise, scope) {
        return new Promise((resolve, reject) => {
            const s = scope.signal;
            const settle = Promise.resolve(promise);
            const fail = () => reject(scope.timedOut() ? vmError("timeout", "", true) : abortError());
            if (s.aborted) {
                settle.catch(() => {});
                fail();
                return;
            }
            const onAbort = () => fail();
            s.addEventListener("abort", onAbort, { once: true });
            settle.then(
                (v) => {
                    s.removeEventListener("abort", onAbort);
                    resolve(v);
                },
                (err) => {
                    s.removeEventListener("abort", onAbort);
                    reject(err);
                }
            );
        });
    }

    // Resolve on `ev`; reject on `failEv` or when the scope aborts.
    function once(target, ev, scope, failEv) {
        return new Promise((resolve, reject) => {
            const s = scope.signal;
            const cleanup = () => {
                target.removeEventListener(ev, onOk);
                if (failEv) target.removeEventListener(failEv, onBad);
                s.removeEventListener("abort", onAbort);
            };
            const onOk = () => {
                cleanup();
                resolve();
            };
            const onBad = () => {
                cleanup();
                reject(vmError(`${failEv}-event`));
            };
            const onAbort = () => {
                cleanup();
                reject(scope.timedOut() ? vmError("timeout", "", true) : abortError());
            };
            if (s.aborted) {
                onAbort();
                return;
            }
            target.addEventListener(ev, onOk);
            if (failEv) target.addEventListener(failEv, onBad);
            s.addEventListener("abort", onAbort, { once: true });
        });
    }

    function delay(ms, signal) {
        return new Promise((resolve, reject) => {
            throwIfAborted(signal);
            let id = null;
            const onAbort = () => {
                cancel(id);
                reject(abortError());
            };
            id = after(ms, () => {
                if (signal && signal.removeEventListener) signal.removeEventListener("abort", onAbort);
                resolve();
            });
            if (signal && signal.addEventListener) signal.addEventListener("abort", onAbort, { once: true });
        });
    }

    function rememberNone(uri) {
        negCache.delete(uri);
        negCache.set(uri, true);
        while (negCache.size > VIDEO_LIMITS.NEGATIVE_CACHE) {
            const oldest = negCache.keys().next();
            if (oldest.done) break;
            negCache.delete(oldest.value);
        }
    }

    // ---- resolve: which Canvas does this track have? ---------------------------

    function findItem(uri) {
        const d = Spicetify.Player && Spicetify.Player.data;
        if (!d) return null;
        if (d.item && d.item.uri === uri) return d.item;
        const queue = Array.isArray(d.nextItems) ? d.nextItems : [];
        return queue.find((i) => i && i.uri === uri) || null;
    }

    async function lookupGraphQL(uri, meta, signal) {
        const gql = Spicetify.GraphQL;
        if (!gql || typeof gql.Request !== "function" || !gql.Definitions || !gql.Definitions.canvas) throw vmError("no-graphql");
        const scope = scoped(signal, T.LOOKUP_TIMEOUT_MS);
        try {
            const resp = await guard(gql.Request(gql.Definitions.canvas, { trackUri: uri }), scope);
            if (resp && Array.isArray(resp.errors) && resp.errors.length && !resp.data) throw vmError("graphql-error");
            return canvasFromGraphQL(resp, artUrlFromMetadata(meta));
        } finally {
            scope.done();
        }
    }

    // Item metadata first (free). Its absence on a playing item means "unknown",
    // never "no Canvas": GraphQL decides, and only its null is remembered.
    async function resolveCanvas(uri, signal) {
        const item = findItem(uri);
        const meta = item && item.metadata;
        let canvas = canvasFromMetadata(meta);
        let source = "metadata";
        if (canvas === undefined) {
            source = "graphql";
            if (negCache.has(uri)) {
                rememberNone(uri);
                return null;
            }
            canvas = await lookupGraphQL(uri, meta, signal);
            if (canvas === null) rememberNone(uri);
        }
        throwIfAborted(signal);
        if (canvas && canvas.kind === "video" && !vp9Supported()) canvas = null;
        if (canvas && canvas.kind === "video" && isDegraded()) {
            // Breaker open: no manifest or segment request at all; still Canvases keep working.
            degradedSkip = { uri, until: degradedUntil };
            canvas = null;
        }
        dbg("[SpoTUI-video]", "resolved", { uri, source, kind: canvas ? canvas.kind : "none" });
        return canvas;
    }

    async function resolveAdapter(uri, signal) {
        try {
            return await resolveCanvas(uri, signal);
        } catch (e) {
            if (signal && signal.aborted) throw e;
            throw e && e.vm ? e : vmError(describeError(e));
        }
    }

    // ---- load: manifest, bytes, MediaSource ------------------------------------

    async function fetchManifest(fileId, signal) {
        const cosmos = Spicetify.CosmosAsync;
        if (!cosmos || typeof cosmos.get !== "function") throw vmError("no-cosmos");
        const url = CANVAS_MANIFEST_BASE + encodeURIComponent(fileId) + "/options/supports_drm";
        for (let attempt = 0; ; attempt++) {
            const scope = scoped(signal, T.MANIFEST_TIMEOUT_MS);
            try {
                const res = await guard(cosmos.get(url), scope);
                return typeof res === "string" ? JSON.parse(res) : res;
            } catch (e) {
                throwIfAborted(signal);
                if (attempt >= 1) throw vmError("manifest-failed", describeError(e));
            } finally {
                scope.done();
            }
            await delay(T.RETRY_DELAY_MS, signal);
        }
    }

    async function fetchOne(url, scope, budget) {
        let res;
        try {
            res = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer", signal: scope.signal });
        } catch (e) {
            throwIfAborted(scope.signal);
            throw vmError("network", hostOf(url), true);
        }
        if (!res.ok) throw vmError(`http-${res.status}`, hostOf(url), res.status >= 500);
        const declared = Number(res.headers && res.headers.get && res.headers.get("content-length"));
        if (Number.isFinite(declared) && declared > VIDEO_LIMITS.MAX_TRACK_BYTES - budget.used) throw vmError("too-big");
        const body = res.body;
        if (!body || typeof body.getReader !== "function") {
            const buf = await res.arrayBuffer();
            budget.used += buf.byteLength;
            if (budget.used > VIDEO_LIMITS.MAX_TRACK_BYTES) throw vmError("too-big");
            return buf;
        }
        // Streamed: the running total is shared by every fetch of the track, so a
        // body without Content-Length (or all of them together) stops at the cap
        // instead of being read whole first.
        const reader = body.getReader();
        const chunks = [];
        let size = 0;
        try {
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                if (!value || !value.byteLength) continue;
                budget.used += value.byteLength;
                if (budget.used > VIDEO_LIMITS.MAX_TRACK_BYTES) throw vmError("too-big");
                size += value.byteLength;
                chunks.push(value);
            }
        } catch (e) {
            chunks.length = 0;
            try {
                const c = reader.cancel();
                if (c && typeof c.catch === "function") c.catch(() => {});
            } catch (e2) {}
            throw e;
        }
        const out = new Uint8Array(size);
        let at = 0;
        for (const c of chunks) {
            out.set(c, at);
            at += c.byteLength;
        }
        return out.buffer;
    }

    async function fetchAll(urls, signal, timeoutMs) {
        const scope = scoped(signal, timeoutMs);
        const budget = { used: 0 };
        try {
            const buffers = await Promise.all([urls.init, ...urls.segments].map((u) => fetchOne(u, scope, budget)));
            return { buffers, bytes: budget.used };
        } catch (e) {
            scope.abort(); // cancel the siblings
            throw scope.timedOut() ? vmError("timeout", "", true) : e;
        } finally {
            scope.done();
        }
    }

    // One retry in total, only for a network error, a timeout or a 5xx: on the
    // second CDN host when the manifest lists one, else on the same host after a
    // pause. A 4xx or an oversized file fails at once.
    async function downloadSet(manifest, profile, signal, timeoutMs) {
        for (let attempt = 0; ; attempt++) {
            const baseIndex = manifest.baseUrls.length > 1 ? attempt : 0;
            const urls = segmentUrls(manifest, profile, baseIndex);
            if (!urls) throw vmError("bad-urls");
            try {
                return await fetchAll(urls, signal, timeoutMs);
            } catch (e) {
                throwIfAborted(signal);
                if (!(e && e.vm && e.retry) || attempt >= 1) throw e;
            }
            if (manifest.baseUrls.length <= 1) await delay(T.RETRY_DELAY_MS, signal);
        }
    }

    async function downloadVideo(canvas, signal) {
        const manifest = parseCanvasManifest(await fetchManifest(canvas.fileId, signal));
        if (!manifest) throw vmError("bad-manifest");
        throwIfAborted(signal);
        // Every profile of a clip shares one aspect ratio. With object-fit: contain
        // the clip is shown min(layerH, layerW / aspect) tall: pick the profile for that.
        const top = manifest.profiles[manifest.profiles.length - 1];
        const usedPenalty = penalty;
        const targetHeight = Math.ceil(displayedHeight(...layerSize(), top.width, top.height) * deviceRatio());
        const profile = chooseProfile(manifest.profiles, { targetHeight, penalty: usedPenalty });
        if (!profile) throw vmError("no-profile");
        let got;
        try {
            got = await downloadSet(manifest, profile, signal, segmentsTimeoutMs(profile));
        } catch (e) {
            // A timeout means "too slow", not "broken": the next load takes a smaller
            // profile and the breaker stays out of it until the lowest step timed out too.
            if (e && e.vm && e.message === "timeout" && !(signal && signal.aborted)) {
                const lowest = penalty >= VIDEO_LIMITS.MAX_PENALTY;
                penalty = Math.min(penalty + 1, VIDEO_LIMITS.MAX_PENALTY);
                dbg("[SpoTUI-video]", "slow link", { penalty });
                if (!lowest) e.noBreaker = true;
            }
            throw e;
        }
        return {
            fileId: canvas.fileId,
            buffers: got.buffers,
            bytes: got.bytes,
            durationSec: manifest.endMs / 1000,
            segLenSec: manifest.segLenSec,
            profileH: profile.height,
            profileShort: Math.min(profile.width, profile.height),
            penalty: usedPenalty,
        };
    }

    function deviceRatio() {
        const dpr = Number(window.devicePixelRatio);
        return dpr > 0 && Number.isFinite(dpr) ? dpr : 1;
    }

    // [w, h] in CSS px of the box the clip is shown in, read once per load. A layer
    // that is not laid out yet (0x0: TUI hidden mid-load) falls back to the window,
    // then to a typical 1080p window: never 0, which would lock in the smallest profile.
    function layerSize() {
        const pos = (n) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0);
        const w = pos(layer && layer.clientWidth) || pos(window.innerWidth) || 1920;
        const h = pos(layer && layer.clientHeight) || pos(window.innerHeight) || 1080;
        return [w, h];
    }

    // At most MAX_SLOTS media in the DOM. Before a third one is appended drop, in
    // this order: a slot whose load was cancelled but has not released it yet (its
    // load is stale), then the oldest slot that is neither on screen nor loading
    // (an outgoing crossfade slot). If every slot is on screen or loads for real,
    // this load fails with a "retry later" error: not an error of the track, so
    // neither the controller nor the breaker records it.
    function enforceSlotCap() {
        while (slots.size >= MAX_SLOTS) {
            let victim = null;
            for (const media of slots) {
                if (media !== current && media.loading && media.signal && media.signal.aborted) {
                    victim = media;
                    break;
                }
            }
            if (!victim) {
                for (const media of slots) {
                    if (media !== current && !media.loading) {
                        victim = media;
                        break;
                    }
                }
            }
            if (!victim) {
                const e = vmError("no-free-slot");
                e.retryLater = true;
                e.noBreaker = true;
                throw e;
            }
            release(victim);
        }
    }

    function buildSlot(kind, artUrl) {
        if (!layer) throw vmError("no-layer");
        if (!syncHost()) throw vmError("no-tui");
        enforceSlotCap();
        const slot = document.createElement("div");
        slot.className = "spotui-video-slot";
        const backdrop = document.createElement("div");
        backdrop.className = "spotui-video-backdrop";
        if (artUrl) backdrop.style.backgroundImage = `url("${artUrl}")`;
        let media;
        let video = null;
        if (kind === "video") {
            video = document.createElement("video");
            video.muted = true;
            video.defaultMuted = true;
            video.playsInline = true;
            video.preload = "auto";
            video.loop = true;
            video.disablePictureInPicture = true;
            video.disableRemotePlayback = true;
            video.tabIndex = -1;
            video.setAttribute("muted", "");
            video.setAttribute("playsinline", "");
            video.setAttribute("loop", "");
            video.setAttribute("aria-hidden", "true");
            // Fallback for a stream that reports `ended` instead of looping.
            video.addEventListener("ended", () => {
                video.currentTime = 0;
                if (!stillMode()) playVideo(video);
            });
            media = video;
        } else {
            media = document.createElement("div");
        }
        media.className = "spotui-video-media";
        slot.appendChild(backdrop);
        slot.appendChild(media);
        layer.appendChild(slot);
        return { slot, media, video };
    }

    // End (s) of the last buffered range; null when the build exposes no ranges.
    function bufferedEnd(sb) {
        try {
            const b = sb.buffered;
            if (!b || typeof b.length !== "number") return null;
            return b.length > 0 ? b.end(b.length - 1) : 0;
        } catch (e) {
            return null;
        }
    }

    // buffers[0] is the init segment, the rest the media segments in order. With
    // offsets every media segment i is placed at i * segLenSec: for a stream whose
    // segments carry timestamps relative to their own start.
    async function appendSegments(sb, buffers, segLenSec, withOffsets, scope) {
        for (let i = 0; i < buffers.length; i++) {
            throwIfAborted(scope.signal);
            if (withOffsets) sb.timestampOffset = i === 0 ? 0 : (i - 1) * segLenSec;
            sb.appendBuffer(buffers[i]);
            await once(sb, "updateend", scope, "error");
        }
    }

    // Clear the buffer and append again with offsets.
    async function rebuildWithOffsets(ms, sb, buffers, segLenSec, durationSec, scope) {
        sb.abort();
        try {
            ms.duration = durationSec; // remove() needs a duration
        } catch (e) {}
        const b = sb.buffered;
        if (b && b.length > 0) {
            sb.remove(b.start(0), b.end(b.length - 1));
            await once(sb, "updateend", scope, "error");
        }
        await appendSegments(sb, buffers, segLenSec, true, scope);
    }

    const round2 = (n) => (typeof n === "number" && Number.isFinite(n) ? Math.round(n * 100) / 100 : null);

    // Returns { bufferedEnd, duration } (s) for the log. If the buffered end falls
    // short of the manifest length by more than half a segment with 2+ segments,
    // the segments overwrote each other (relative timestamps): rebuild once with
    // offsets and keep that mode for the session. Still short: use what is there.
    async function attachMse(video, entry, signal) {
        const { buffers, durationSec, segLenSec } = entry;
        const scope = scoped(signal, T.SEGMENTS_TIMEOUT_MS);
        try {
            const ms = new MediaSource();
            const url = URL.createObjectURL(ms);
            video.src = url;
            try {
                await once(ms, "sourceopen", scope);
            } finally {
                URL.revokeObjectURL(url);
            }
            const sb = ms.addSourceBuffer(VP9_MIME);
            await appendSegments(sb, buffers, segLenSec, offsetMode, scope);
            const segments = buffers.length - 1;
            const short = (end) => end !== null && segments >= 2 && end < durationSec - segLenSec / 2;
            let end = bufferedEnd(sb);
            if (!offsetMode && short(end)) {
                let rebuilt = null;
                try {
                    await rebuildWithOffsets(ms, sb, buffers, segLenSec, durationSec, scope);
                    rebuilt = bufferedEnd(sb);
                } catch (e) {
                    if (scope.timedOut()) throw vmError("timeout", "", true);
                    throwIfAborted(scope.signal);
                }
                if (rebuilt !== null && rebuilt > end) {
                    offsetMode = true;
                    dbg("[SpoTUI-video] mse offset mode");
                }
                if (rebuilt !== null) end = rebuilt;
            }
            // Trims the stream to the manifest length; a clip whose last frame ends a
            // hair later keeps the buffered end instead (endOfStream sets it). A clip
            // that is still short plays what is buffered rather than failing.
            try {
                ms.duration = short(end) && end > 0 ? end : durationSec;
            } catch (e) {}
            ms.endOfStream();
            if (!(video.readyState >= 3)) await once(video, "canplay", scope, "error");
            return { bufferedEnd: round2(end), duration: round2(ms.duration) };
        } finally {
            scope.done();
        }
    }

    function isAbort(e, signal) {
        return Boolean((signal && signal.aborted) || (e && e.name === "AbortError"));
    }

    function cachedEntry(uri, canvas) {
        const entry = cache.get(uri);
        if (entry && entry.fileId !== canvas.fileId) {
            cache.delete(uri);
            return undefined;
        }
        return entry;
    }

    // The next song's preload is still running when its turn comes: wait for it
    // instead of downloading the same clip twice. Its failure is not ours.
    async function joinPreload(job, signal) {
        const scope = scoped(signal, 0);
        try {
            await guard(job.promise, scope);
        } catch (e) {
            throwIfAborted(signal);
        } finally {
            scope.done();
        }
    }

    async function loadVideo(canvas, uri, signal) {
        let media = null;
        try {
            let entry = cachedEntry(uri, canvas);
            if (!entry && preloadJob && preloadJob.uri === uri) {
                await joinPreload(preloadJob, signal);
                entry = cachedEntry(uri, canvas);
            }
            if (!entry) {
                entry = await downloadVideo(canvas, signal);
                cache.set(uri, entry, entry.bytes);
            }
            throwIfAborted(signal);
            const built = buildSlot("video", canvas.artUrl);
            media = {
                kind: "video",
                uri,
                slot: built.slot,
                video: built.video,
                profileH: entry.profileH,
                profileShort: entry.profileShort,
                penalty: entry.penalty,
                loading: true,
                released: false,
                signal,
                mse: null,
            };
            slots.add(media);
            media.mse = await attachMse(built.video, entry, signal);
            throwIfAborted(signal);
            media.loading = false;
            noteLoadSuccess();
            return media;
        } catch (e) {
            if (media) release(media);
            if (!isAbort(e, signal) && !(e && e.noBreaker)) noteLoadFailure(uri);
            throw e;
        }
    }

    async function loadImage(canvas, signal) {
        throwIfAborted(signal);
        const built = buildSlot("image", canvas.artUrl);
        const media = { kind: "image", uri: null, slot: built.slot, video: null, profileH: 0, profileShort: 0, penalty: 0, loading: true, released: false, signal, mse: null };
        slots.add(media);
        const scope = scoped(signal, T.SEGMENTS_TIMEOUT_MS);
        try {
            built.media.style.backgroundImage = `url("${canvas.imageUrl}")`;
            const probe = new Image();
            probe.referrerPolicy = "no-referrer";
            const loaded = once(probe, "load", scope, "error").catch((e) => {
                throw e && e.vm && e.message === "error-event" ? vmError("image-failed", hostOf(canvas.imageUrl)) : e;
            });
            probe.src = canvas.imageUrl;
            await loaded;
            throwIfAborted(signal);
            media.loading = false;
            return media;
        } catch (e) {
            release(media);
            throw e;
        } finally {
            scope.done();
        }
    }

    async function loadAdapter(canvas, uri, signal) {
        try {
            return canvas.kind === "image" ? await loadImage(canvas, signal) : await loadVideo(canvas, uri, signal);
        } catch (e) {
            if (signal && signal.aborted) throw e;
            throw e && e.vm ? e : vmError(describeError(e));
        }
    }

    // ---- show / hide / resume / release ---------------------------------------

    function playVideo(video) {
        if (!video) return;
        try {
            const p = video.play();
            if (p && typeof p.catch === "function") p.catch(() => {});
        } catch (e) {}
    }

    function pauseVideo(video) {
        if (!video) return;
        try {
            video.pause();
        } catch (e) {}
    }

    function setShowingClass(on) {
        if (!document.body) return;
        if (on) document.body.classList.add(BODY_SHOWING_CLASS);
        else document.body.classList.remove(BODY_SHOWING_CLASS);
    }

    function pauseWallpaper() {
        const wp = document.getElementById("spotui-wallpaper");
        if (wp && wp.tagName === "VIDEO" && !wp.paused) {
            pauseVideo(wp);
            pausedWallpaper = true;
        }
    }

    function resumeWallpaper() {
        if (!pausedWallpaper) return;
        pausedWallpaper = false;
        const wp = document.getElementById("spotui-wallpaper");
        if (wp && wp.tagName === "VIDEO") playVideo(wp);
    }

    // A still: the first frame, never play() (reduced motion, or the quality guard froze it).
    function showStill(video) {
        if (!video) return;
        pauseVideo(video);
        try {
            video.currentTime = 0;
        } catch (e) {}
    }

    // The wallpaper <video> stops once it is fully covered: after the fade-in, at
    // once when there is no fade (reduced motion).
    function coverWallpaper(media) {
        cancel(wpTimer);
        wpTimer = null;
        if (reducedMotion) {
            wallpaperFaded = true;
            pauseWallpaper();
            return;
        }
        wpTimer = after(T.FADE_IN_MS, () => {
            wpTimer = null;
            if (current !== media) return;
            wallpaperFaded = true;
            pauseWallpaper();
        });
    }

    // Fade a slot in (show and resume are the same thing for the DOM). Returns
    // false when the media is gone (released, e.g. by the slot cap): the controller
    // then loads the track again instead of believing it is on screen.
    function present(media) {
        if (!media || media.released || !slots.has(media)) return false;
        zTop += 1;
        media.slot.style.zIndex = String(zTop);
        void media.slot.offsetWidth; // flush, so a just-built slot still transitions
        media.slot.classList.remove("is-out");
        media.slot.classList.add("is-in");
        if (stillMode()) showStill(media.video);
        else playVideo(media.video);
        current = media;
        wallpaperFaded = false;
        setShowingClass(true);
        coverWallpaper(media);
        schedulePreload();
        startQualitySampler();
        return true;
    }

    function show(media) {
        const shown = present(media);
        // What the owner reads with tui -debug on: a buffered end well under the
        // duration means the clip loops short.
        if (shown && media.mse) dbg("[SpoTUI-video]", "shown", { buffered: media.mse.bufferedEnd, duration: media.mse.duration, offset: offsetMode });
        return shown;
    }

    function resume(media) {
        return present(media);
    }

    // Fade out everything on screen. Media stays alive (the controller decides
    // whether to keep or release it); its video pauses once the fade is over.
    function hide() {
        cancel(wpTimer);
        wpTimer = null;
        wallpaperFaded = false;
        current = null;
        setShowingClass(false);
        resumeWallpaper();
        stopQualitySampler();
        cancel(preloadTimer);
        preloadTimer = null;
        // The preload for the track now wanted survives: a swap-wait fade-out must not
        // throw away the download the new track's load is joining. Any other is stale.
        if (preloadJob && preloadJob.uri !== playingUri()) abortPreload();
        for (const media of slots) {
            if (!media.slot.classList.contains("is-in")) continue;
            media.slot.classList.remove("is-in");
            media.slot.classList.add("is-out");
            if (reducedMotion) pauseVideo(media.video); // no fade to wait for
            else {
                after(T.FADE_OUT_MS, () => {
                    if (current !== media) pauseVideo(media.video);
                });
            }
        }
    }

    function release(media) {
        if (!media) return;
        media.released = true;
        if (!slots.delete(media)) return;
        if (current === media) {
            current = null;
            cancel(wpTimer);
            wpTimer = null;
            stopQualitySampler();
        }
        const v = media.video;
        if (v) {
            pauseVideo(v);
            try {
                v.removeAttribute("src");
                v.load();
            } catch (e) {}
        }
        media.slot.remove();
    }

    // setWallpaper re-plays a wallpaper <video> on every refresh: keep a covered one paused.
    function notifyWallpaperChanged() {
        if (current && wallpaperFaded) pauseWallpaper();
    }

    // ---- quality guard ---------------------------------------------------------

    function readQuality(video) {
        try {
            const q = video && typeof video.getVideoPlaybackQuality === "function" ? video.getVideoPlaybackQuality() : null;
            const total = q && q.totalVideoFrames;
            const dropped = q && q.droppedVideoFrames;
            if (!Number.isFinite(total) || !Number.isFinite(dropped)) return null;
            return { video, total, dropped };
        } catch (e) {
            return null;
        }
    }

    function stopQualitySampler() {
        cancel(qualityTimer);
        qualityTimer = null;
        qualitySample = null;
    }

    // Every QUALITY_SAMPLE_MS while a video slot shows and is visible: diff the
    // dropped/total frame counters. Too many drops lower the profile of the NEXT
    // load (penalty); still too many at the lowest step freezes video Canvases on
    // their first frame for the rest of the session. Image slots are never sampled.
    function startQualitySampler() {
        stopQualitySampler();
        if (!running || stillMode() || !current || !current.video || !isVisible()) return;
        qualitySample = readQuality(current.video);
        if (!qualitySample) return; // no frame counters in this build: nothing to measure
        qualityTimer = after(T.QUALITY_SAMPLE_MS, sampleQuality);
    }

    function freezeVideo(why) {
        frozen = true;
        stopQualitySampler();
        dbg("[SpoTUI-video]", "frozen", { reason: why, penalty });
        for (const media of slots) showStill(media.video);
    }

    function sampleQuality() {
        qualityTimer = null;
        const media = current;
        if (!running || stillMode() || !media || !media.video || !isVisible()) {
            qualitySample = null;
            return;
        }
        const q = readQuality(media.video);
        const prev = qualitySample;
        qualitySample = q;
        if (q && prev && prev.video === q.video) {
            const total = q.total - prev.total;
            const dropped = q.dropped - prev.dropped;
            if (total >= VIDEO_LIMITS.MIN_FRAMES && dropped / total > VIDEO_LIMITS.DROP_RATIO) {
                const ratio = dropped / total;
                penalty = Math.min(penalty + 1, VIDEO_LIMITS.MAX_PENALTY);
                dbg("[SpoTUI-video]", "dropping frames", { ratio: Math.round(ratio * 100) / 100, penalty });
                // Frozen only when this clip already played at the lowest step and still drops.
                if (media.penalty >= VIDEO_LIMITS.MAX_PENALTY && ratio > VIDEO_LIMITS.FREEZE_DROP_RATIO) {
                    freezeVideo("drops at the lowest step");
                    return;
                }
            }
        }
        qualityTimer = after(T.QUALITY_SAMPLE_MS, sampleQuality);
    }

    // ---- preload ---------------------------------------------------------------

    function abortPreload() {
        if (!preloadJob) return;
        const job = preloadJob;
        preloadJob = null;
        try {
            job.ac.abort();
        } catch (e) {}
    }

    // After a Canvas has shown for PRELOAD_DELAY_MS: fetch the next song's clip
    // into the LRU (bytes only: no slot, no MSE). One at a time, own AbortController.
    // Its failure is silent: no toast, no breaker count, the track is not poisoned.
    function schedulePreload() {
        cancel(preloadTimer);
        preloadTimer = null;
        if (!running) return;
        preloadTimer = after(T.PRELOAD_DELAY_MS, runPreload);
    }

    function runPreload() {
        preloadTimer = null;
        if (!running || !current || preloadJob || !isVisible()) return;
        const d = Spicetify.Player && Spicetify.Player.data;
        if (!d || d.isPaused) return;
        if (typeof navigator !== "undefined" && navigator && navigator.onLine === false) return;
        if (isDegraded() || !vp9Supported()) return;
        const next = Array.isArray(d.nextItems) ? d.nextItems[0] : null;
        if (!next || classifyItem(next) !== "track") return;
        // Metadata only, never GraphQL: undefined (unknown), null, IMAGE: nothing to preload.
        const canvas = canvasFromMetadata(next.metadata);
        if (!canvas || canvas.kind !== "video") return;
        const uri = next.uri;
        if (uri === (d.item && d.item.uri) || preloadFailed.has(uri)) return;
        const hit = cache.get(uri);
        if (hit && hit.fileId === canvas.fileId) return;
        const ac = new AbortController();
        const job = { uri, ac, promise: null };
        job.promise = downloadVideo(canvas, ac.signal)
            .then(
                (entry) => {
                    if (ac.signal.aborted) return;
                    cache.set(uri, entry, entry.bytes);
                    dbg("[SpoTUI-video]", "preloaded", { uri, profile: entry.profileH, bytes: entry.bytes });
                },
                (e) => {
                    if (isAbort(e, ac.signal)) return;
                    preloadFailed.add(uri);
                    while (preloadFailed.size > VIDEO_LIMITS.CACHE_TRACKS * 4) preloadFailed.delete(preloadFailed.values().next().value);
                    dbg("[SpoTUI-video]", "preload-failed", { uri, message: describeError(e) });
                }
            )
            .then(() => {
                if (preloadJob === job) preloadJob = null;
            });
        preloadJob = job;
    }

    // ---- reduced motion --------------------------------------------------------

    function onMotionChange(ev) {
        const next = Boolean(ev && typeof ev.matches === "boolean" ? ev.matches : motionQuery && motionQuery.matches);
        if (next === reducedMotion) return;
        reducedMotion = next;
        if (!running) return;
        if (stillMode()) {
            stopQualitySampler();
            for (const media of slots) showStill(media.video);
            if (current && !wallpaperFaded) coverWallpaper(current); // no fade left to wait for
        } else if (current && current.video && isVisible()) {
            playVideo(current.video);
            startQualitySampler();
        }
    }

    function watchMotion() {
        reducedMotion = false;
        motionQuery = null;
        try {
            if (typeof window.matchMedia !== "function") return;
            const q = window.matchMedia("(prefers-reduced-motion: reduce)");
            if (!q) return;
            reducedMotion = Boolean(q.matches);
            if (typeof q.addEventListener === "function") q.addEventListener("change", onMotionChange);
            else if (typeof q.addListener === "function") q.addListener(onMotionChange);
            motionQuery = q;
        } catch (e) {
            motionQuery = null;
        }
    }

    function unwatchMotion() {
        try {
            if (motionQuery) {
                if (typeof motionQuery.removeEventListener === "function") motionQuery.removeEventListener("change", onMotionChange);
                else if (typeof motionQuery.removeListener === "function") motionQuery.removeListener(onMotionChange);
            }
        } catch (e) {}
        motionQuery = null;
        reducedMotion = false;
    }

    // ---- player + visibility ---------------------------------------------------

    function readPlayer() {
        const d = Spicetify.Player && Spicetify.Player.data;
        return {
            item: (d && d.item) || null,
            isPaused: d ? Boolean(d.isPaused) : true, // never isBuffering
            visible: isVisible(),
        };
    }

    function playingUri() {
        const d = Spicetify.Player && Spicetify.Player.data;
        return d && d.item && typeof d.item.uri === "string" ? d.item.uri : null;
    }

    // A skip to another track aborts a preload that is not for it; the natural
    // advance to the preloaded track lets it finish (the load joins it).
    function onTrackChange(uri) {
        cancel(preloadTimer);
        preloadTimer = null;
        if (preloadJob && preloadJob.uri !== uri) abortPreload();
    }

    function onPoke() {
        if (!controller) return;
        const uri = playingUri();
        if (uri !== lastUri) {
            lastUri = uri;
            onTrackChange(uri);
        }
        controller.poke();
    }

    function onVisibility() {
        if (!running) return;
        syncHost(); // a mode switch (Enable Spotify / Back) moves the layer
        const v = isVisible();
        if (v === lastVisible) return;
        lastVisible = v;
        if (!v) {
            for (const media of slots) pauseVideo(media.video);
            stopQualitySampler();
            cancel(preloadTimer);
            preloadTimer = null;
            abortPreload();
        } else if (current) {
            if (!stillMode()) playVideo(current.video);
            schedulePreload();
            startQualitySampler();
        }
        onPoke();
    }

    function makeController() {
        return createController({
            now: () => Date.now(),
            setTimeout: (fn, ms) => setTimeout(fn, ms),
            clearTimeout: (id) => clearTimeout(id),
            readPlayer,
            resolve: resolveAdapter,
            load: loadAdapter,
            show,
            hide,
            resume,
            release,
            instant: () => reducedMotion,
            transientNone,
            log: (code, detail) => dbg("[SpoTUI-video]", code, detail),
        });
    }

    // ---- enable / disable ------------------------------------------------------

    function mountLayer(tui) {
        const stale = document.getElementById(LAYER_ID);
        if (stale) stale.remove();
        layer = document.createElement("div");
        layer.id = LAYER_ID;
        layer.setAttribute("aria-hidden", "true");
        // TUI mode: after #spotui-wallpaper (always prepended) at the same z, so it
        // paints over it. Spotify mode: on <body>, behind the native UI.
        (layerHost() || tui).appendChild(layer);
    }

    function start(tui) {
        starting = false;
        mountLayer(tui);
        controller = makeController();
        lastVisible = isVisible();
        lastUri = playingUri();
        watchMotion();
        Spicetify.Player.addEventListener("songchange", onPoke);
        Spicetify.Player.addEventListener("onplaypause", onPoke);
        pollTimer = setInterval(onPoke, T.POLL_MS); // boot with empty Player.data, restored paused sessions
        document.addEventListener("visibilitychange", onVisibility);
        if (typeof MutationObserver === "function") {
            classObserver = new MutationObserver(onVisibility);
            classObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
        }
        running = true;
        controller.enable();
        controller.poke();
        dbg("[SpoTUI-video]", "enabled", { vp9: vp9Supported() });
    }

    function attemptStart() {
        startTimer = null;
        if (!starting) return;
        const tui = document.getElementById("spotui-tui");
        const player = window.Spicetify && Spicetify.Player;
        if (tui && player && typeof player.addEventListener === "function") {
            start(tui);
            return;
        }
        if (++startTries >= ENABLE_MAX_TRIES) {
            starting = false;
            gaveUp = true;
            dbg("[SpoTUI-video]", "gave up waiting for the interface (retry with tui -video on)");
            return;
        }
        startTimer = after(ENABLE_WAIT_MS, attemptStart);
    }

    function setOnClass(on) {
        if (!document.body) return;
        if (on) document.body.classList.add(BODY_ON_CLASS);
        else document.body.classList.remove(BODY_ON_CLASS);
    }

    // A later enable (tui -video on, or any refresh while the key is on) starts from scratch.
    function enable() {
        if (running || starting) return;
        starting = true;
        gaveUp = false;
        startTries = 0;
        setOnClass(true);
        attemptStart();
    }

    function disable() {
        starting = false;
        gaveUp = false;
        setOnClass(false);
        cancel(startTimer);
        startTimer = null;
        if (running) {
            running = false;
            try {
                Spicetify.Player.removeEventListener("songchange", onPoke);
                Spicetify.Player.removeEventListener("onplaypause", onPoke);
            } catch (e) {}
            clearInterval(pollTimer);
            pollTimer = null;
            document.removeEventListener("visibilitychange", onVisibility);
            if (classObserver) classObserver.disconnect();
            classObserver = null;
            if (controller) controller.disable(); // aborts in-flight work, hides, releases
            controller = null;
        }
        abortPreload();
        unwatchMotion();
        cancelAll();
        preloadTimer = null;
        qualityTimer = null;
        qualitySample = null;
        for (const media of Array.from(slots)) release(media);
        current = null;
        wpTimer = null;
        wallpaperFaded = false;
        setShowingClass(false);
        resumeWallpaper();
        if (layer) layer.remove();
        layer = null;
        cache.clear();
        negCache.clear();
        preloadFailed.clear();
        // Session state (quality guard, circuit breaker) starts over with the next enable.
        penalty = 0;
        frozen = false;
        failStreak = 0;
        failUris.clear();
        degradedUntil = 0;
        halfOpen = false;
        degradedSkip = null;
        lastUri = null;
        offsetMode = false;
    }

    // ---- public API ------------------------------------------------------------

    // Boot: does nothing unless the saved look has video mode on.
    function initVideoMode() {
        if (window.__spotuiVideoInit) return;
        window.__spotuiVideoInit = true;
        refreshVideoMode();
    }

    // Make the running state follow the stored key. Idempotent.
    function refreshVideoMode() {
        if (isOn()) enable();
        else disable();
    }

    function setVideoMode(arg) {
        const a = String(arg || "").toLowerCase();
        if (a !== "on" && a !== "off" && a !== "toggle") return false;
        const on = a === "toggle" ? !isOn() : a === "on";
        if (on) {
            if (!storageSet(VIDEO_MODE_KEY, "1")) {
                pinToast("video mode: could not save the setting (storage full?)");
                return false;
            }
        } else {
            storageRemove(VIDEO_MODE_KEY);
        }
        refreshVideoMode();
        if (on) {
            pinToast(
                "video mode on — while a song plays, its Spotify Canvas replaces your background" +
                    (vp9Supported() ? "" : "\n(video Canvases can't play in this Spotify build — still Canvases only)")
            );
        } else {
            pinToast("video mode off — your background is back");
        }
        return true;
    }

    function videoModeStatus() {
        if (!isOn()) return "video mode off (tui -video on)";
        if (!running || !controller) {
            return gaveUp ? "video mode ON · interface not found — run tui -video on again" : "video mode ON · starting…";
        }
        const s = controller.status();
        let why;
        switch (s.reason) {
            case "showing":
                if (!current) why = "loading Canvas…";
                else if (current.kind === "image") why = "showing this song's still Canvas";
                else if (reducedMotion) why = "showing this song's Canvas as a still (reduced motion)";
                else if (frozen) why = "showing this song's Canvas as a still (performance)";
                else why = `showing this song's Canvas (${current.profileShort || current.profileH}p)`;
                break;
            case "loading":
                why = "loading Canvas…";
                break;
            case "no-canvas":
                if (skippedByBreaker(s.uri)) why = "video Canvases unavailable right now — still Canvases only";
                else {
                    why = vp9Supported()
                        ? "this song has no Canvas — your background stays"
                        : "video Canvases can't play in this Spotify build — still Canvases only";
                }
                break;
            case "unsupported":
                why = "ads, podcasts and local files have no Canvas";
                break;
            case "hidden":
                why = "hidden (standby, or the Spotify window is minimised or covered)";
                break;
            case "error":
                why = "Canvas failed to load — background stays (tui -debug on for details)";
                break;
            default:
                why = "paused — your background is back";
        }
        return `video mode ON · ${why}`;
    }

    function reportVideoMode() {
        const line = videoModeStatus();
        pinToast(line);
        console.log("[SpoTUI] " + line);
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
        // A wallpaper <video> was just (re)played: keep it paused while a Canvas covers it.
        try { notifyWallpaperChanged(); } catch (e) {}
        if (save) {
            storageSet(WP_URL_KEY, url);
            storageSet(WP_OPACITY_KEY, opacity);
            storageSet(WP_FIT_KEY, fit);
            storageSet(WP_POS_KEY, pos);
            storageSet(WP_RICH_KEY, String(rich));
            dbg("[SpoTUI-dbg] saved to storage. Clear anytime with: tui -wp off");
        }
    }

    // Host consent for wallpapers that come from a feed theme. A wallpaper is
    // persistent: its host sees the user's IP and every Spotify start. A theme
    // may therefore only load one from a host the user approved; any other host
    // is skipped and offered to the user. The user's own `tui -wp <url>` is never
    // restricted (it approves its own host). Nothing here runs a command a theme
    // wrote except through the user's own Allow click / `tui -wp -allow`.

    const URL_MAX$1 = 2000;
    const TOAST_ID = "spotui-wp-consent";
    const TOAST_MS = 30000;
    // Private or local names: never offered, always refused for themes.
    const LOCAL_SUFFIXES = ["local", "lan", "internal", "home.arpa", "localhost"];

    // A hostname (as URL.hostname gives it: lowercase, punycode) a theme
    // wallpaper may ever load from. No IP literals, no single-label or local names.
    function isOfferableHost(host) {
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
    function checkWallpaperUrl(raw) {
        const text = String(raw ?? "");
        if (!text || text.length > URL_MAX$1) return null;
        let u;
        try { u = new URL(text); } catch (e) { return null; }
        if (u.protocol !== "https:" || u.username || u.password) return null;
        if (!isOfferableHost(u.hostname) || u.href.length > URL_MAX$1) return null;
        return { host: u.hostname, href: u.href };
    }

    // `tui -wp -allow/-deny <host>` argument: a bare hostname or a full https URL.
    function parseHostInput(raw) {
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
    function getWpHosts() {
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
        return storageSet(WP_HOSTS_KEY, JSON.stringify([...new Set(list)].slice(-200)));
    }

    function isHostApproved(host) {
        return getWpHosts().includes(String(host || "").toLowerCase());
    }

    function approveHost(host) {
        const list = getWpHosts();
        if (list.includes(host)) return true;
        list.push(host);
        return saveHosts(list);
    }

    // First run without the key: the wallpaper already stored keeps working if a
    // theme re-uses its host. The key is always written (an empty list marks
    // "migrated"), so this never runs twice and never approves a URL that gets
    // stored later.
    function migrateWpHosts() {
        try {
            if (storageGet(WP_HOSTS_KEY) !== null) return;
            const stored = storageGet(WP_URL_KEY);
            const c = stored ? checkWallpaperUrl(stored) : null;
            saveHosts(c ? [c.host] : []);
        } catch (e) {}
    }

    // The user typed `tui -wp <url>` themself: they chose that host.
    function noteUserWallpaper(url) {
        const c = checkWallpaperUrl(url);
        if (c && !approveHost(c.host)) dbg("[SpoTUI] wallpaper host not remembered: storage full");
    }

    // Forms only the user may run. A theme must not approve hosts or read the
    // list, wherever in the command the word sits.
    function isHostMgmtToken(word) {
        return WP_HOST_FLAGS.has(word);
    }

    function hasHostMgmtToken(argsLower) {
        return argsLower.some(isHostMgmtToken);
    }

    // ---- pending theme wallpaper + consent toast ----

    // One at a time, memory only: { host, cmd, run }. `cmd` is the theme's own
    // command with the URL replaced by its normalised form.
    let pending = null;
    // An onboarding panel is open: show the toast once it closes.
    let deferred = false;

    function removeToast() {
        try {
            const t = document.getElementById(TOAST_ID);
            if (t) t.remove();
        } catch (e) {}
    }

    // A new theme apply starts clean: the previous offer and its toast go.
    function beginThemeApply() {
        clearPendingWallpaper();
    }

    // The offer is void: the user chose a wallpaper themself (tui -wp, a saved
    // theme, tui restore) or dismissed it. A later `tui -wp -allow` (history,
    // keybind) must not replace that choice with an old theme's wallpaper.
    function clearPendingWallpaper() {
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
    function appendOnboardingConsent(parent) {
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
    function flushDeferredConsent() {
        if (deferred && pending) showConsentToast();
    }

    function offerThemeWallpaper(offer) {
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
    function gateThemeWallpaper(url, buildCmd, run) {
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
    function handleWpHostCommand(sub, arg) {
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

    // Local theme snapshots: everything a Spotify restart preserves, saved
    // under one name — except personal config and secrets (history, keybinds,
    // actions, pin token) and app/UI state, which are not a look. storage.js has no key enumeration, so this
    // module touches localStorage directly (guarded) for the snapshot/restore
    // loops only.
    const SAVES_KEY = "spotui:theme-saves";

    // Cap: every save duplicates the whole poster library + layout, so the blob
    // would otherwise grow without bound (and readSaves re-parses all of it).
    const MAX_SAVES = 100;

    // Parsed-blob memo: menus call savedThemeDetails() per keypress, so cache
    // until the next local mutation (save/delete are the only writers).
    let savesCache = null;

    // Personal config and secrets, not a look: never snapshotted, never wiped,
    // and never restored over live values (old snapshots may still carry these
    // keys, e.g. the Pinterest token). The approved wallpaper hosts are the
    // user's consent, so a snapshot or a theme must never carry or change them.
    const PERSONAL_KEYS = new Set([HISTORY_KEY, KEYBIND_STORAGE_KEY, ACTIONS_STORAGE_KEY, PIN_TOKEN_KEY, WP_HOSTS_KEY]);

    // App or UI state, not a look either: never snapshotted, never wiped, never
    // restored from an old snapshot (wiping launched re-triggers onboarding,
    // wiping the banner flag resurrects a dismissed banner, a stale jam-state
    // would try to rejoin a dead jam).
    const NEVER_WIPE_KEYS = new Set([LAUNCHED_KEY, UPDATE_BANNER_KEY, JAM_STATE_KEY, DEBUG_KEY, VISUALIZER_STORAGE_KEY, LYRICS_STORAGE_KEY]);

    // What a plain `tui restore` leaves in place: personal config and secrets,
    // the saved-themes library (and its corrupt-blob backup; saved themes are the
    // user's data, not a look) and the launched/banner flags (wiping them would
    // replay onboarding and resurrect a dismissed banner). Everything else
    // spotui:* is a look or transient state and is removed.
    const RESTORE_KEEP_KEYS = new Set([...PERSONAL_KEYS, SAVES_KEY, SAVES_KEY + ".corrupt", LAUNCHED_KEY, UPDATE_BANNER_KEY]);

    // Only spotui:* keys that are actually a look take part in snapshots. The
    // library itself and its corrupt-blob backup are internal, not a look.
    function isLookKey(k) {
        return Boolean(k) && k.startsWith("spotui:")
            && k !== SAVES_KEY && k !== SAVES_KEY + ".corrupt"
            && !PERSONAL_KEYS.has(k) && !NEVER_WIPE_KEYS.has(k);
    }

    // Old snapshots may still hold keys that are not a look (e.g. the Pinterest
    // token). They are never restored, but would stay duplicated in storage:
    // drop them in place. Returns true when something was removed.
    function stripNonLookKeys(saves) {
        let changed = false;
        for (const snap of Object.values(saves)) {
            if (!snap || typeof snap.settings !== "object" || !snap.settings) continue;
            for (const k of Object.keys(snap.settings)) {
                if (!isLookKey(k)) {
                    delete snap.settings[k];
                    changed = true;
                }
            }
        }
        return changed;
    }

    function readSaves() {
        if (savesCache) return savesCache;
        try {
            const raw = storageGet(SAVES_KEY);
            const obj = raw ? JSON.parse(raw) : {};
            savesCache = obj && typeof obj === "object" ? obj : {};
            if (stripNonLookKeys(savesCache)) storageSet(SAVES_KEY, JSON.stringify(savesCache));
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

    // tui restore: remove SpoTUI's own localStorage keys (spotui:*) and nothing
    // else, because the origin is shared with Spotify and other extensions. With
    // `full` every spotui:* key goes; otherwise RESTORE_KEEP_KEYS survive.
    function wipeSpotuiStorage(full = false) {
        try {
            const doomed = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith("spotui:") && (full || !RESTORE_KEEP_KEYS.has(k))) doomed.push(k);
            }
            for (const k of doomed) {
                try { localStorage.removeItem(k); } catch (e) {}
            }
        } catch (e) {}
        invalidateSavesCache();
    }

    function snapshotSettings() {
        const out = {};
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (isLookKey(k)) out[k] = localStorage.getItem(k);
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
        if (settings[VIDEO_MODE_KEY] === "1") parts.push("video mode");
        return parts.join(" · ");
    }

    // Re-run the boot look-restore against current storage (mirrors main.js:
    // appearance everywhere, wallpaper, wall, shade, video mode — no session resume).
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
        refreshVisualizer();
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
        refreshVideoMode();
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
        if (n === "__proto__") {
            console.warn("[SpoTUI] \"__proto__\" is a reserved name, pick another theme name.");
            return;
        }
        const saves = readSaves();
        const existed = Object.hasOwn(saves, n);
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
        if (!Object.hasOwn(saves, n)) {
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
        const saves = readSaves();
        const snap = Object.hasOwn(saves, n) ? saves[n] : null;
        if (!snap || typeof snap.settings !== "object") {
            console.warn(`[SpoTUI] no saved theme "${n}". See: tui -t list`);
            return;
        }
        try {
            const keep = new Set(Object.keys(snap.settings));
            for (const [k, v] of Object.entries(snap.settings)) {
                if (!isLookKey(k)) continue;
                localStorage.setItem(k, v);
            }
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const k = localStorage.key(i);
                if (isLookKey(k) && !keep.has(k)) localStorage.removeItem(k);
            }
        } catch (e) {
            console.error("[SpoTUI] theme apply failed:", e.message);
            return;
        }
        // The saved look replaced the wallpaper keys: an older feed theme's offer is void.
        clearPendingWallpaper();
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
        "tui -wp -allow",
        "tui -wp -deny ",
        "tui -wp -hosts",
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
<div id="spotui-queue-panel" hidden>
    <fieldset id="spotui-queue-list">
        <legend>Queue</legend>
    </fieldset>
    <button id="spotui-queue-info" type="button"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/><path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/></svg></button>
    <div id="spotui-queue-info-popup" hidden>Play: press <span>Enter</span><br>Reorder: press <span>Tab</span><br>Remove: press <span>r</span></div>
</div>
<div id="spotui-help-panel" hidden><fieldset class="spotui-help-fieldset"><legend class="spotui-help-legend">Exit - Esc</legend><div class="spotui-help-content"></div></fieldset></div>
<div id="spotui-about-panel" hidden></div>
<div id="spotui-search-panel" hidden>
    <div id="spotui-search-bar">
        <span class="spotui-search-prompt">></span>
        <input id="spotui-search-input" autocomplete="off" spellcheck="false" placeholder="type to search...">
    </div>
    <div id="spotui-search-results"></div>
    <button id="spotui-search-info" type="button"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/><path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/></svg></button>
    <div id="spotui-search-info-popup" hidden>Play: press <span>Enter</span><br>Add to playlist: press <span>a</span><br>Add to queue: press <span>q</span></div>
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
        [["spotui-playlist-info", "spotui-playlist-info-popup"], ["spotui-queue-info", "spotui-queue-info-popup"], ["spotui-search-info", "spotui-search-info-popup"]].forEach(([btnId, popId]) => {
            const btn = document.getElementById(btnId);
            const pop = document.getElementById(popId);
            if (btn && pop) btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); pop.hidden = !pop.hidden; });
        });

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

    // Theme feed as DATA: fetched as text, parsed without executing anything and
    // validated into fresh objects. No imports on purpose, so the parsing stays
    // pure and testable on its own.

    const FEED_MAX_BYTES = 2 * 1024 * 1024;
    const FEED_TIMEOUT_MS = 8000;
    const FEED_MAX_THEMES = 1000;
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
    function safeHttpsUrl(value) {
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
    function validateThemeFeed(data) {
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
    function parseThemeFeedText(text) {
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
    function loadThemeFeedInFrame(url, deps = {}) {
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
    async function fetchThemeFeed(url) {
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

    const FEED_ERROR = "Failed to load themes";
    const channelCache = {};
    const channelInflight = {};

    // One feed -> validated themes: fetched as data; a fetch the browser blocks
    // (TypeError: CORS or network) on a frame channel is retried in a sandboxed
    // frame, never as a script in this page. Any failure surfaces as the same
    // "Failed to load themes" error.
    // Per channel, for this session: the time the plain fetch was last blocked
    // (TypeError). A blocked channel goes straight to the frame instead of
    // paying a doomed request on every load; a forced refresh may retry the fetch
    // once per FETCH_RETRY_MS, and a fetch that works forgets the entry.
    const FETCH_RETRY_MS = 10 * 60 * 1000;
    const fetchBlockedAt = {};

    async function fetchChannel(key, force = false) {
        const src = `${THEME_CHANNELS[key]}?_=${Math.floor(Date.now() / 1000)}`;
        let result;
        try {
            const blockedAt = fetchBlockedAt[key];
            const skipFetch = blockedAt !== undefined && !(force && Date.now() - blockedAt >= FETCH_RETRY_MS);
            if (skipFetch) {
                result = await loadThemeFeedInFrame(src);
            } else {
                try {
                    result = await fetchThemeFeed(src);
                    delete fetchBlockedAt[key];
                } catch (err) {
                    if (!(THEME_FRAME_CHANNELS.has(key) && err instanceof TypeError)) throw err;
                    fetchBlockedAt[key] = Date.now();
                    dbg(`[SpoTUI] theme feed (${key}) fetch blocked, trying sandboxed frame:`, err.message);
                    result = await loadThemeFeedInFrame(src);
                }
            }
        } catch (err) {
            dbg(`[SpoTUI] theme feed (${key}) failed:`, err && err.message);
            throw new Error(FEED_ERROR, { cause: err });
        }
        if (result.dropped) {
            dbg(`[SpoTUI] theme feed (${key}): dropped ${result.dropped} invalid theme(s)`, JSON.stringify(result.reasons || {}));
        }
        if (!result.themes.length) throw new Error("Theme feed loaded but empty");
        return result.themes;
    }

    function loadThemeChannel(channel, force = false) {
        const key = THEME_CHANNELS[channel] ? channel : "live";
        if (!force && channelCache[key]) return Promise.resolve(channelCache[key].slice());
        if (!force && channelInflight[key]) return channelInflight[key].then((themes) => themes.slice());
        const promise = fetchChannel(key, force).then((themes) => {
            channelCache[key] = themes;
            return themes;
        });
        channelInflight[key] = promise;
        const settled = () => { if (channelInflight[key] === promise) delete channelInflight[key]; };
        promise.then(settled, settled);
        return promise.then((themes) => themes.slice());
    }

    // Validated themes already loaded for a channel ([] when none yet).
    function getCachedThemes(channel) {
        return (channelCache[channel] || []).slice();
    }

    function createAddThemeCard(imgUrl, channel) {
        const stable = channel === "stable";
        const label = stable ? "Contribute" : "Add yours";
        const url = stable ? "https://github.com/SkenSMasteR/SpoTUI/blob/aux/Themes/themes.json" : THEME_HOST;
        const card = document.createElement("div");
        card.className = "theme-card";
        card.innerHTML = `
        <h3>${label}</h3>
        <img src="${imgUrl}" alt="${label}" referrerpolicy="no-referrer" loading="lazy" decoding="async">
        <button>${stable ? "Contribute" : "Add"}</button>
    `;
        card.querySelector("button").addEventListener("click", () => {
            window.open(url, "_blank");
        });
        return card;
    }

    function createThemeCard(theme) {
        const card = document.createElement("div");
        card.className = "theme-card";
        const title = document.createElement("h3");
        title.textContent = theme.name || "";
        const img = document.createElement("img");
        img.referrerPolicy = "no-referrer";
        img.loading = "lazy";
        img.decoding = "async";
        img.src = safeHttpsUrl(theme.screenshot_url);
        img.alt = `${theme.name || ""} screenshot`;
        const btn = document.createElement("button");
        btn.textContent = "Apply";
        btn.dataset.commands = JSON.stringify(theme.commands || []);
        card.appendChild(title);
        card.appendChild(img);
        card.appendChild(btn);
        return card;
    }
    // Apply community theme by name. The theme is looked up before anything is
    // reset, so an unknown name (or a feed that fails to load) leaves the user's
    // look untouched and resolves to null.
    function applyThemeByName(themeName, opts = {}) {
        const skipNonTui = Boolean(opts.skipNonTui);
        const apply = async (themes) => {
            const theme = (themes || []).find((t) => (opts.id && t.id === opts.id) || t.name === themeName);
            if (!theme) {
                if (opts.channel) {
                    pinToast(`theme not found on ${opts.channel}${opts.channel === "live" ? "" : " (try -live)"}`);
                }
                return null;
            }
            beginThemeApply();
            resetAllSettings();
            if (theme.commands) {
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
            return theme;
        };
        // Without a channel (onboarding) the stable list is the one that was shown.
        return loadThemeChannel(opts.channel || "stable").then((themes) => apply(themes));
    }

    // Encode theme name for theme ID generation
    function encodeThemeName(name) {
        try {
            return btoa(unescape(encodeURIComponent(String(name || ""))));
        } catch (e) {
            return "";
        }
    }

    // Exact inverse of encodeThemeName: UTF-8 base64 -> name. Also takes
    // unpadded and URL-safe base64. Returns null for an invalid id.
    function decodeThemeId(id) {
        try {
            let b64 = String(id || "").replace(/-/g, "+").replace(/_/g, "/");
            while (b64.length % 4) b64 += "=";
            const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        } catch (e) {
            return null;
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
        if (app.queuePanelOpen) closeQueuePanel();
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
        app.add2listTrackUri = null;
        document.body.classList.remove("spotui-add2list-panel");
        const panel = document.getElementById("spotui-add2list-panel");
        if (panel) panel.hidden = true;
        const input = document.getElementById("spotui-input");
        if (input) input.focus();
        document.removeEventListener("keydown", handlePlaylistPanelKeydown);
        if (wasOpen) emitPaneClose("add2list");
    }

    async function openAdd2listPanel(trackUri = null) {
        if (app.add2listPanelOpen) { closeAdd2listPanel(); return; }
        // When triggering add2list from search, the panes switch. And we dont want something like autolyrics to trigger at the same time as the add2list pane.
        if (app.searchPanelOpen) closeSearchPanel({ silent: true });
        else closeActivePanel();

        try {
            app.playlists = (await getPlaylists()).filter((p) => p.name !== "DJ" && !p.isLikedSongs);
        } catch (err) {
            pinToast("Playlist error: " + err.message);
            return;
        }

        app.add2listPanelOpen = true;
        app.add2listTrackUri = trackUri;
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

    // Open theme browser panel
    async function openThemePanel() {
        if (app.themePanelOpen) { closeThemePanel(); return; }
        closeActivePanel();

        setPanelState("spotui-theme-panel", "spotui-theme-panel", "themePanelOpen", true);
        const panel = document.getElementById("spotui-theme-panel");
        if (!panel) return;

        panel.innerHTML = `
        <div class="spotui-theme-controls">
            <input id="spotui-theme-search" class="spotui-theme-search" placeholder="Search themes...">
            <select id="spotui-theme-channel" class="spotui-theme-channel">
                <option value="stable">Stable</option>
                <option value="live">Live</option>
            </select>
            <button id="spotui-theme-refresh" class="spotui-theme-refresh" title="Refresh" aria-label="Refresh">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-clockwise" viewBox="0 0 16 16">
                    <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/>
                    <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/>
                </svg>
            </button>
        </div>
        <div class="theme-grid"></div>
    `;

        const grid = panel.querySelector(".theme-grid");
        const searchInput = panel.querySelector("#spotui-theme-search");
        const channelSelect = panel.querySelector("#spotui-theme-channel");
        const refreshBtn = panel.querySelector("#spotui-theme-refresh");

        const applyFilter = () => {
            const term = searchInput.value.toLowerCase();
            grid.querySelectorAll(".theme-card").forEach((card) => {
                const title = card.querySelector("h3")?.textContent.toLowerCase();
                if (title) card.style.display = title.includes(term) ? "" : "none";
            });
        };

        searchInput.addEventListener("input", applyFilter);

        grid.addEventListener("click", (e) => {
            if (e.target.tagName === "BUTTON" && e.target.dataset.commands) {
                beginThemeApply();
                resetAllSettings();
                const commands = JSON.parse(e.target.dataset.commands);
                commands.forEach((cmd) => {
                    if (!isRestrictedThemeCommand(cmd)) execute(cmd, { fromTheme: true }).catch((err) => dbg("[SpoTUI] theme command failed:", cmd, err));
                });
                closeThemePanel();
            }
        });

        const load = (channel, force = false) => {
            grid.innerHTML = `<div class="spotui-theme-loading"><div class="spotui-lyrics-loader active"></div></div>`;
            loadThemeChannel(channel, force).then(
                (themes) => {
                    grid.innerHTML = "";
                    grid.appendChild(createAddThemeCard(ADD_THEME_IMG_OK, channel));
                    themes.forEach((theme) => grid.appendChild(createThemeCard(theme)));
                    applyFilter();
                },
                () => {
                    grid.innerHTML = "";
                    grid.appendChild(createAddThemeCard(ADD_THEME_IMG_ERR, channel));
                    const msg = document.createElement("p");
                    msg.textContent = "Error loading themes. The server may be down or you are rate-limited. Please wait and try again.";
                    grid.appendChild(msg);
                }
            );
        };

        channelSelect.value = "stable";
        channelSelect.addEventListener("change", () => load(channelSelect.value));
        refreshBtn.addEventListener("click", () => {
            if (refreshBtn.disabled) return;
            refreshBtn.disabled = true;
            refreshBtn.classList.add("spinning");
            load(channelSelect.value, true);
            setTimeout(() => { refreshBtn.disabled = false; }, 3000);
        });
        refreshBtn.querySelector("svg").addEventListener("animationend", () => refreshBtn.classList.remove("spinning"));
        load("stable");
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
        // A theme wallpaper skipped during onboarding is offered now, not under the dialog.
        flushDeferredConsent();
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
        img.referrerPolicy = "no-referrer";
        img.loading = "lazy";
        img.decoding = "async";
        img.src = safeHttpsUrl(theme.screenshot_url);
        img.alt = `${theme.name || ""} screenshot`;
        const label = document.createElement("span");
        label.textContent = theme.name || "";
        button.appendChild(img);
        button.appendChild(label);
        return button;
    }

    // Render current onboarding stage content
    function renderOnboardingStage(panel) {
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
            const themes = getThemeSelectionList(getCachedThemes("stable"), app.onboardingShowAllThemes);
            const themeCards = themes.map(onboardingThemeCard);
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
            // The theme's wallpaper was skipped (no approved host yet): offer it here.
            const copy = panel.querySelector(".spotui-onboarding-copy");
            if (copy) appendOnboardingConsent(copy);
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

        if (getCachedThemes("stable").length) {
            renderOnboardingStage(panel);
            return;
        }

        panel.innerHTML = "<p>Loading first boot...</p>";

        loadThemeChannel("stable")
            .then(() => renderOnboardingStage(panel))
            .catch(() => renderOnboardingFeedError(panel));
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

    const playerMap = {
        play: { fn: () => { if (!Spicetify.Player.isPlaying()) Spicetify.Player.togglePlay(); }, name: "Play" },
        pause: { fn: () => { if (Spicetify.Player.isPlaying()) Spicetify.Player.togglePlay(); }, name: "Pause" },
        p: { fn: () => { const p = Spicetify.Player.isPlaying(); Spicetify.Player.togglePlay(); return p; }, name: "Play/PauseToggle" },
        skip: { fn: () => Spicetify.Player.next(), name: "Skip" },
        back: { fn: () => Spicetify.Player.back(), name: "Back" },
        shuffle: { fn: () => { const s = Spicetify.Player.getShuffle(); Spicetify.Player.setShuffle(!s); return s; }, name: "Shuffle" },
        like: { fn: async () => { const h = await Spicetify.Player.getHeart(); await Spicetify.Player.toggleHeart(); return h; }, name: "Like" }
    };

    // A skipped theme wallpaper the user allowed: runs as the user's own command.
    function runPendingWallpaper(cmd) {
        return execute(cmd, { bypassOnboarding: true });
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
        "tui", "standby", "help", "about", "playlist", "list", "add2list", "queue", "theme",
        "discord", "search", "seek", "s", "volume", "v", "loop", "superloop",
        "lyrics", "visualizer", "dj", "echo", "jam",
        "play", "pause", "p", "skip", "back", "shuffle", "like",
    ]);
    const KNOWN_TUI_SUBS = new Set([
        "-l", "-a", "-debug", "-shade", "-video", "-wp", "-t", "bind", "unbind",
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

    // `tui -t pull <id> [-live]`: the id is the first word after "pull" that is
    // not a flag, and -live may sit anywhere (args = words after "tui").
    function parsePullArgs(args) {
        const rest = args.slice(2);
        return {
            id: rest.find((a) => !a.startsWith("-")) || "",
            channel: rest.some((a) => a.toLowerCase() === "-live") ? "live" : "stable",
        };
    }

    async function executeInner(cmd, opts = {}) {
        const cleanedCmd = stripCommandPrefix(cmd);
        const [rawCommand, ...args] = cleanedCmd.split(/\s+/);
        const command = (rawCommand || "").toLowerCase();
        const argText = args.join(" ").trim();
        // Remote themes run look commands only. Checked on the same normalized
        // text that is dispatched below, so prefixes/case/spacing cannot dodge it.
        if (opts.fromTheme && isRestrictedThemeCommand(cleanedCmd)) {
            dbg("[SpoTUI] theme command skipped:", cleanedCmd);
            return;
        }

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
            if (argsLower[0] === "-video") {
                const v = (args[1] || "").toLowerCase();
                if (!v) reportVideoMode();
                else if (v === "on" || v === "off" || v === "toggle") setVideoMode(v);
                else pinToast("usage: tui -video <on|off|toggle>  (bare tui -video shows the state)");
                return;
            }
            if (argsLower.includes("-wp")) {
                // Defence in depth behind isSensitiveCommand: a wallpaper loads
                // from a host that sees the user's IP and never comes from the
                // relay, whatever the filter let through.
                if (opts.fromRemote) {
                    dbg("[SpoTUI] remote wallpaper command refused:", cleanedCmd.slice(0, 200));
                    return;
                }
                // Only the user's own typed/keybound/action commands (no origin
                // flag) may change a wallpaper; a theme goes through the gate below.
                const byUser = !opts.fromTheme;
                dbg("[SpoTUI-dbg] -wp raw:", JSON.stringify(cleanedCmd), "args:", JSON.stringify(args));
                // Wallpaper-host consent forms are the user's alone: a theme that
                // carries one (anywhere in the command) is dropped whole.
                if (opts.fromTheme && hasHostMgmtToken(argsLower)) {
                    dbg("[SpoTUI] theme wallpaper-host command skipped:", cleanedCmd);
                    return;
                }
                // Only right after the leading -wp: other subs reach this branch
                // too (it matches -wp anywhere) and must not approve hosts.
                if (argsLower[0] === "-wp" && isHostMgmtToken(argsLower[1])) {
                    handleWpHostCommand(argsLower[1], args[2]);
                    return;
                }
                const urlIdx = argsLower.indexOf("-wp") + 1;
                const url = args[urlIdx];
                if ((url || "").toLowerCase() === "off") {
                    dbg("[SpoTUI-dbg] -wp off: removing wallpaper + clearing storage");
                    if (byUser) clearPendingWallpaper();
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
                    if (byUser) clearPendingWallpaper();
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
                    let wpUrl = url;
                    if (opts.fromTheme) {
                        // Feed theme: only an approved https host, loaded in its
                        // normalised form; anything else is skipped and offered.
                        wpUrl = gateThemeWallpaper(url, (href) => [rawCommand, ...args.map((a, i) => (i === urlIdx ? href : a))].join(" "), runPendingWallpaper);
                        if (wpUrl === null) return;
                    } else {
                        // The user chose this wallpaper: an older theme's offer is void.
                        clearPendingWallpaper();
                        if (argsLower[0] === "-wp") noteUserWallpaper(url);
                    }
                    setWallpaper(wpUrl, opacity, true, { fit: flag("-fit"), pos: flag("-pos"), rich: flag("-rich") });
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
                if (tSub === "pull") {
                    const { id, channel } = parsePullArgs(args);
                    if (!id) {
                        pinToast("usage: tui -t pull <theme_id> [-live]");
                        return;
                    }
                    const themeName = decodeThemeId(id);
                    if (themeName === null) {
                        pinToast("invalid theme id");
                        return;
                    }
                    applyThemeByName(themeName, { channel, id }).catch((e) => pinToast(`theme pull failed (${channel} feed): ${e.message}`));
                } else {
                    console.warn("[SpoTUI] usage: tui -t <save <name>|list|apply <name>|delete <name>|pull <theme_id> [-live]>");
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
                const filteredArgs = [];
                for (let i = 0; i < args.length; i++) {
                    if (argsLower[i] === "-gap") {
                        const value = (args[i + 1] || "").toLowerCase();
                        if (value === "off") {
                            storageRemove(VISUALIZER_GAP);
                        } else if (/^\d+$/.test(value)) {
                            storageSet(VISUALIZER_GAP, String(Math.min(Number(value), 100)));
                        }
                        i++;
                    } else if (argsLower[i] === "-bars") {
                        const value = (args[i + 1] || "").toLowerCase();
                        if (value === "off") {
                            storageRemove(VISUALIZER_BARS);
                        } else if (/^\d+$/.test(value)) {
                            storageSet(VISUALIZER_BARS, String(Math.min(Math.max(Number(value), 1), 256)));
                        }
                        i++;
                    } else if (argsLower[i] === "-smooth") {
                        const value = (args[i + 1] || "").toLowerCase();
                        if (value === "off") {
                            storageRemove(VISUALIZER_SMOOTH);
                        } else if (/^\d+$/.test(value)) {
                            storageSet(VISUALIZER_SMOOTH, String(Math.min(Math.max(Number(value), 1), 100)));
                        }
                        i++;
                    } else if (argsLower[i] === "-mode") {
                        const value = (args[i + 1] || "").toLowerCase();
                        if (value === "off") {
                            storageRemove(VISUALIZER_MODE);
                        } else if (value === "global" || value === "adaptive") {
                            storageSet(VISUALIZER_MODE, value);
                        }
                        i++;
                    } else {
                        filteredArgs.push(args[i]);
                    }
                }
                if (filteredArgs.length > 1 || (filteredArgs.length === 1 && filteredArgs[0].toLowerCase() === "off")) {
                    handleColorArgs(filteredArgs, { "-color": VISUALIZER_COLOR });
                    applyVisualizerColor();
                }
                refreshVisualizer();
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
                } else if (isValidLineSpacing(value)) {
                    if (!isNaN(value)) {
                        value = value + "px";
                    }
                    storageSet(LYRICS_LINE_SPACING, value);
                } else {
                    pinToast("usage: tui -ly -spacing <number[px|em|rem]|off>");
                    return;
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
                        if (styleId && Object.hasOwn(PROGRESS_STYLES, styleId)) {
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
                clearPendingWallpaper();
                wipeSpotuiStorage(argsLower[1] === "-full");
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
                    await playFresh(match[0].uri);
                    return;
                } else if (match.length > 1) {
                    jamSay("Multiple matches: " + match.map(p => p.name).join(", "));
                    return;
                }
            }

            openPlaylistPanel(); return; 
        }
        if (command === "add2list") { openAdd2listPanel(); return; }
        if (command === "queue") {
            if (app.queuePanelOpen) { closeQueuePanel(); return; }
            closeActivePanel();
            openQueuePanel();
            return;
        }
        if (command === "theme") { openThemePanel(); return; }
        if (command === "discord") {
            storageRemove(UPDATE_BANNER_KEY);
            const existingBanner = document.getElementById("spotui-update-banner");
            if (existingBanner) existingBanner.remove();
            initUpdateBanner();
            return;
        }

        if (Object.hasOwn(playerMap, command)) {
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
                await playFresh(match.uri);
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
    const RESERVED_NAMES = new Set(["create", "list", "enable", "disable", "delete", "__proto__"]);
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
            if (Object.hasOwn(actions, name)) {
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
            if (!Object.hasOwn(actions, name)) {
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
            if (!Object.hasOwn(actions, name)) {
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
            const prev = Object.hasOwn(actions, name) ? actions[name] : { enabled: true};
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
        const artistName = info.artist.split(",")[0].trim();
        const exactParams = new URLSearchParams({
            track_name: info.title,
            artist_name: artistName,
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
                artist_name: artistName,
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

    const SPOLYRC_TIMEOUT_MS = 4000;

    async function fetchSpolyrcLyrics(info) {
        const params = new URLSearchParams({
            title: info.title,
            artist: info.artist.split(",")[0].trim(),
        });
        if (info.album) params.set("album", info.album);
        if (info.durationSec) params.set("duration", String(info.durationSec));
        if (info.uri) params.set("spotify_id", info.uri);
        const url = `https://spolyrc-spotui.root.sx/lyrics?${params}`;
        // One shared deadline for the whole spolyrc attempt: a hung host must not
        // block the Spotify/lrclib fallbacks.
        const deadline = Date.now() + SPOLYRC_TIMEOUT_MS;
        let data = null;
        if (Spicetify.CosmosAsync?.get) {
            let timer;
            try {
                data = await Promise.race([
                    Spicetify.CosmosAsync.get(url),
                    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("spolyrc timeout")), SPOLYRC_TIMEOUT_MS); }),
                ]);
                if (typeof data === "string") {
                    try { data = JSON.parse(data); } catch { data = null; }
                }
            } catch { data = null; }
            clearTimeout(timer);
        }
        if (!data || typeof data !== "object") {
            const left = deadline - Date.now();
            if (left <= 0) return null;
            try {
                const res = await fetch(url, { signal: AbortSignal.timeout(left) });
                if (!res.ok) return null;
                data = await res.json();
            } catch { return null; }
        }
        if (!data || typeof data !== "object") return null;
        if (data.instrumental) return { lines: [], synced: false, provider: "spolyrc", instrumental: true };
        const syncedLines = Array.isArray(data.synced)
            ? data.synced
                .map(line => ({ startTime: Number(line.start_ms) || 0, text: String(line.text || "").trim() }))
                .filter(line => line.text && line.text !== "♪")
            : [];
        if (syncedLines.length) return { lines: syncedLines, synced: true, provider: "spolyrc", instrumental: false };
        const plainLines = plainLyricsToLines(data.unsynced);
        if (plainLines.length) return { lines: plainLines, synced: false, provider: "spolyrc", instrumental: false };
        return null;
    }

    // Fetch lyrics from all available sources
    // Tries spolyrc first, then Spotify, then lrclib as fallback
    async function resolveTrackLyrics(info) {
        const spolyrc = await fetchSpolyrcLyrics(info);
        if (spolyrc) return spolyrc;
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

        if (synced && lines[0].startTime > 3000) {
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

        if (synced) {
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

    // Lyric line spacing: a plain number with an optional px/em/rem unit.
    function isValidLineSpacing(value) {
        return /^\d+(\.\d+)?(px|em|rem)?$/.test(String(value ?? ""));
    }

    function applyLyricLineSpacing() {
    	try {
    		// A stored value that is not a valid spacing (e.g. "undefined" from an
    		// older build) is ignored, not applied.
    		if (isValidLineSpacing(storageGet(LYRICS_LINE_SPACING))) applyCssVar(LYRICS_LINE_SPACING, "--lyrics-line-spacing");
    		else document.documentElement.style.removeProperty("--lyrics-line-spacing");
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
        const style = Object.hasOwn(PROGRESS_STYLES, styleId) ? PROGRESS_STYLES[styleId] : PROGRESS_STYLES["classic-block"];
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

        storageRemove(VISUALIZER_GAP);

        storageRemove(VISUALIZER_BARS);
        storageRemove(VISUALIZER_SMOOTH);
        storageRemove(VISUALIZER_MODE);

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

        storageRemove(VIDEO_MODE_KEY);
        refreshVideoMode();

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

    // these are hidden when spotui pane is on and shown when its off.
    const SPOTUI_HIDDEN_UI = [
        "Root__main-view",
        "main-view-container",
        "Root__nav-bar",
        "bQsutxbyIOatthweRHfK",
        "main-topBar-container",
        "main-yourLibraryX-libraryRootlist",
        "main-yourLibraryX-entryPoints",
        "WWTxshVPO07BZLrdUL3h",
        "YourLibraryX",
        "main-buddy-list",
        "main-trackList-trackList",
        "main-card-card",
        "main-gridContainer-gridContainer",
        "main-entityHeader-container",
        "Zh3rQRncNEHrT9Zvp61n",
        "xg2bGi5tcuelbx14UC28",
        "Clgyk1V8iQGkU1G6m5Lo",
        "zLbWoHarv2xIIoERVTb9",
        "uf2x5WzM1lLLCLSQdMFB",
        "tDwxpCRHu3TEG0d_5KfE",
        "SW7Ebfzvld30ve5zrter",
        "vVF0gCDG9l8RCOK3_2kw",
        "Root__globalNav",
    ];

    const HIDDEN_UI_MARKER = "spotui-hidden-ui";

    const CLASS_MAP = {
        "ABsPxBFldURR4hbFY38Y": [], // device-picker control
        "dj-button": ["uddqO1SkevkDEtqc7mQP", "FrqTR9ccUqvGA9UZRf9H", "Nv04LEC5GMu3msfbzG0z", "Gf9V3C4X_WPPfvjwXujC"],
        "centered-layout": [],
        "collection-collection-header": [],
        "collection-searchBar-searchBar": [],
        "DHOpYzKPUqobiHLW": ["uddqO1SkevkDEtqc7mQP"], // DJ button
        "e-10451-box--interactive": [],
        "e-10860-card-title": [],
        "encore-announcement-set": [],
        "encore-bright-accent-set": [], 
        "global-nav": [],
        "HqUgEQOPyVcDu2NW": [], // (styled with the same hover colors as tracklist rows)
        "lyrics-config-button": [],
        "lyrics-config-button-container": [],
        "lyrics-lyrics-background": [],
        "lyrics-lyrics-container": [],
        "lyrics-lyrics-contentContainer": [],
        "lyrics-lyrics-contentWrapper": [],
        "lyrics-lyricsContainer-Karaoke-WordActive": [],
        "lyrics-lyricsContainer-LyricsBackground": [],
        "lyrics-lyricsContainer-LyricsContainer": [],
        "lyrics-lyricsContainer-LyricsLine": [],
        "lyrics-lyricsContainer-LyricsLine-active": [],
        "lyrics-lyricsContainer-LyricsLine-past": [],
        "lyrics-lyricsContainer-Provider": [],
        "lyrics-lyricsContent-active": [],
        "lyrics-lyricsContent-lyric": [],
        "lyrics-lyricsContent-previous": [],
        "lyrics-lyricsContent-provider": [],
        "lyrics-lyricsContent-text": [],
        "lyrics-lyricsContent-upcoming": [],
        "main-actionBarBackground-background": [],
        "main-card-cardMetadata": [],
        "main-cardHeader-link": [],
        "main-cardHeader-text": [],
        "main-cardImage-image": [],
        "main-cardImage-imageWrapper": [],
        "main-connectBar-connectBar": [],
        "main-devicePicker-button": [],
        "main-devicePicker-controlButton": [],
        "main-devicePicker-moreButton": [],
        "main-devicePicker-tooltip": [],
        "main-entityHeader-background": [],
        "main-entityHeader-overlay": [],
        "main-globalNav-browseButtonWrapper": [],
        "main-globalNav-contentRight": ["J69QIsElFMg5kJWeEOxw", "fOO2fIo3u1dllKA1PpsE"],
        "main-globalNav-historyButtons": ["ie2Qo9PCf8p3rBbip9Hv", "Tpe_EXbFoHioEukq1L3y"],
        "main-globalNav-historyButtonsWrapper": ["AwxHJjdqrlr_clQipYln", "GwGB43JbSV5e0q7q_6sj"],
        "main-globalNav-navLink": ["oGrojYscaY3uU8Hy86FD", "T_cPbNTFfdOMoMku2Wc_", "tJNs6e3G6zxX78DnJY6T"],
        "main-globalNav-searchInputContainer": [],
        "main-globalNav-searchInputText": [],
        "main-globalNav-searchInputWrapper": [],
        "main-home-content": [],
        "main-home-home": [],
        "main-home-homeHeader": [],
        "main-lyricsCinema-container": [],
        "main-lyricsCinema-content": [],
        "main-nowPlayingBar-center": ["rSRNVahRTJPSREItfKbj", "g1JESJMcieNsGs8YA91M"],
        "main-nowPlayingBar-container": ["main-nowPlayingBar-nowPlayingBar", "cW4mdx7MbdsSDVOh4yFl", "qEDMggbdvFQOvRAwmrIT"],
        "main-nowPlayingBar-extraControls": ["oqNKUl1wM7vavZeQ2s1V", "vQrn40NmmpeUfmOfgxeo"],
        "main-nowPlayingBar-left": ["hvPltcX1Of4QRX6ymIPO", "Xaz3TDhhjakUcSaES5TR"],
        "main-nowPlayingBar-lyricsButton": ["Tc4NZwap8qQOlHonxDWz", "OCDVdnseqXwal5Tk2fM8", "NmfW_y2jYByYTRtCmPaB"],
        "main-nowPlayingBar-nowPlayingBar": ["cW4mdx7MbdsSDVOh4yFl", "iuUVHEu5S9rRkc0zz0Hq"],
        "main-nowPlayingBar-right": ["P7V7BLPw5oupbrDHSbT_", "kUn_OZBjLN9zTu7bcgSg"],
        "main-nowPlayingView-lyricsContent": [],
        "main-nowPlayingView-lyricsControls": [],
        "main-nowPlayingView-lyricsGradient": [],
        "main-nowPlayingView-lyricsTitle": [],
        "main-nowPlayingView-section": ["oA2xvck_WSZn6mRFcZ2J","RdD6POf8qaaGutBtUyMh", "iHJ6_yPvPOWhaNcXElNZ"],
        "main-shelf-shelfGrid": [],
        "main-topBar-background": [],
        "main-topBar-overlay": [],
        "main-topBar-searchBar": [],
        "main-topBar-withBackgroundBlur": [],
        "main-trackInfo-artists": ["iQ71jAm3u73Al0XZj90v", "yPuQIWyOhCzYrdC7hhfw", "pJWbyyFi7zAnwrlWlNr8"],
        "main-trackInfo-container": ["main-nowPlayingWidget-nowPlaying", "XQslIrb_llPUT81TqFnT", "nH2R2U626Rdlv05YEt09"],
        "main-trackInfo-contentContainer": ["_HN_yndimvPzsIkzzSvo", "nuY09VyDMngWeD4AGX2H", "tUoHgXvEUCxKvXSJQmH9"],
        "main-trackInfo-contentWrapper": ["_HN_yndimvPzsIkzzSvo", "nuY09VyDMngWeD4AGX2H", "tUoHgXvEUCxKvXSJQmH9"],
        "main-trackInfo-name": ["iSkZ_HES6ks1CnyZfh46", "UxJZcpiOpOv5I0B1Tjdw", "d3jICfEdIPzHv0kyDFHZ"],
        "main-trackList-trackListRow": [],
        "main-view-container__scroll-node": [],
        "main-yourLibraryX-libraryContainer": [],
        "main-yourLibraryX-listItem": [],
        "marketplace-card--app": [],
        "marketplace-card--extension": [],
        "marketplace-card--snippet": [],
        "marketplace-card--theme": [],
        "marketplace-card-desc": [],
        "marketplace-card-type-heading": [],
        "marketplace-cardSubHeader": [],
        "marketplace-card__author": [],
        "marketplace-card__authors": [],
        "marketplace-card__bottom-meta": [],
        "marketplace-card__tag": [],
        "marketplace-card__tags-container": [],
        "marketplace-footer": [],
        "marketplace-grid": [],
        "marketplace-header": [],
        "marketplace-header-icon-button": [],
        "marketplace-header__label": [],
        "marketplace-installButton": [],
        "marketplace-tabBar-active": [],
        "marketplace-tabBar-headerItemLink": [],
        "MZd_PqzVQOdrbpd6ircZ": [], // device-picker control (hidden)
        "n6LsTkKvpO88xeRyRTdw": [], // page header (styled like the queue page header)
        "nav-ylx": [],
        "notistack-CollapseWrapper": [],
        "notistack-Snackbar": [],
        "notistack-SnackbarContainer": [],
        "os-viewport": [],
        "playlist-playlist-playlistContent": [],
        "progress-bar": ["Nd6cUzZDlHX30QzhnExg", "f42lbbUT05gjuREF86Hw"],
        "queue-queuePage-header": [],
        "Root": [],
        "Root__now-playing-bar": ["z0qdvwslOFVOAihShLIq", "L5dM7nzQpMJtRkvZZBZL", "XvuTwlgQRqJ5NnVLN9ZH"], // If the play/pause button clips out of the playbar, this mapping needs to be updated
        "Root__top-container": [],
        "search-modal-searchBar": [],
        "searchbar-bar": [],
        "uFQUpbITgGovaKRr6I_g": [], // page header
        "volume-bar": ["main-nowPlayingBar-volumeBar", "VIXZppPJeWhMxFseNCgy", "w6STr1NJYa2jHvg2wfCa"],
        "volume-bar__icon-button": ["vM_Y7OPWespPewrOb1uN", "w1XCHDijYLIJuVCEkQID", "pBXkugh_Qs4OAeaVaTi9"],
        "volume-bar__slider-container": ["d2AW7kxQkljoKbqyHvHC", "GN9SlMTfgQeqy7opGRSA", "GRePaldGFb3UeyjULrVd"],
        "x-progressBar-fillColor": ["aZtKYi6r4EG1_WHGpmn9", "ISEJ4fISQcRgNTF5dVAA"],
        "x-progressBar-handle": ["pKZTLhZq37S3mH2TFw4X", "GQiIgNkmZw4cDZnpvnGN", "dvBeolJPafPPVKB6Bj2F"],
        "x-progressBar-progressBar": ["progress-bar", "Nd6cUzZDlHX30QzhnExg", "f42lbbUT05gjuREF86Hw"],
        "x-progressBar-progressBarBg": ["SKxg0dANYkUKs2sk0q6e", "a5aI123LVia29JOBdk0K"],
        "x-progressBar-progressFillColor": [],
        "x-progressBar-sliderArea": ["PLraRYLMXymk2zPhyNnL", "wDpjbPLJt_10QvIanfC0"],
        "x-searchInput-searchInputClearButton": [],
        "x-searchInput-searchInputClearIcon": [],
        "x-searchInput-searchInputInput": [],
        "x-searchInput-searchInputSearchIcon": [],
        "x-settings-header": [],
        "x-settings-headerContainer": [],
        "XTtlZOmdtscvhPLr": [], // DJ button
        "YourLibraryX": [],
    };

    const HIDDEN_UI_SET = new Set(SPOTUI_HIDDEN_UI);

    function injectHiddenUiCss() {
        if (document.getElementById("spotui-hidden-ui-style")) return;
        const style = document.createElement("style");
        style.id = "spotui-hidden-ui-style";
        // [data-spotui-keep] (tagged by appearance.js) exempts the native player bar chain.
        style.textContent = `body:not(.spotui-spotify-enabled) .${HIDDEN_UI_MARKER}:not([data-spotui-keep]) { display: none !important; }`;
        (document.head || document.documentElement).appendChild(style);
    }

    function tagElement(el, aliases) {
        const names = el.getAttribute("class");
        if (!names) return;
        const tokens = names.split(/\s+/);
        let add;
        for (const token of tokens) {
            const canonical = aliases.get(token);
            if (!canonical) continue;
            for (const name of canonical) {
                if (name === token || el.classList.contains(name)) continue;
                (add || (add = [])).push(name);
            }
        }
        if (add) el.classList.add(...add);
        if (!el.classList.contains(HIDDEN_UI_MARKER)) {
            for (const token of tokens) {
                if (HIDDEN_UI_SET.has(token)) {
                    el.classList.add(HIDDEN_UI_MARKER);
                    break;
                }
            }
        }
    }

    function scanTree(root, aliases) {
        if (root.hasAttribute && root.hasAttribute("class")) tagElement(root, aliases);
        for (const el of root.querySelectorAll("[class]")) tagElement(el, aliases);
    }

    function initClassMap() {
        const aliases = new Map();
        for (const [canonical, names] of Object.entries(CLASS_MAP)) {
            for (const name of names) {
                if (aliases.has(name)) aliases.get(name).push(canonical);
                else aliases.set(name, [canonical]);
            }
        }

        const start = () => {
            injectHiddenUiCss();
            scanTree(document.body, aliases);
            new MutationObserver((records) => {
                for (const record of records) {
                    if (record.type === "attributes") tagElement(record.target, aliases);
                    else
                        for (const node of record.addedNodes)
                            if (node.nodeType === 1) scanTree(node, aliases);
                }
            }).observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["class"]
            });
        };

        if (document.body) start();
        else document.addEventListener("DOMContentLoaded", start, { once: true });
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
#spotui-tui > :not(#spotui-wallpaper):not(#spotui-video):not(#spotui-logo):not(#spotui-top-fade) {
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
body.spotui-queue-panel #spotui-logo,
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
body:has(#spotui-wallpaper) body.spotui-queue-panel #spotui-logo,
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
#spotui-queue-list::-webkit-scrollbar,
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
    border: 1px solid var(--panel-border-color, var(--spotui-accent, #ff8c42));
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
    border: 1px solid var(--panel-border-color, var(--spotui-accent, #ff8c42));
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

#spotui-playlist-info, #spotui-queue-info, #spotui-search-info {
    position: absolute;
    bottom: 10px;
    right: 10px;
    z-index: 7;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--panel-text-color, var(--spotui-accent, #ff8c42));
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    pointer-events: auto;
    opacity: 0.7;
}

#spotui-playlist-info:hover, #spotui-queue-info:hover, #spotui-search-info:hover {
    opacity: 1;
}

#spotui-playlist-info svg, #spotui-queue-info svg, #spotui-search-info svg {
    display: block;
}

#spotui-playlist-info-popup, #spotui-queue-info-popup, #spotui-search-info-popup {
    position: absolute;
    bottom: 36px;
    right: 10px;
    z-index: 7;
    padding: 8px 12px;
    border: 1px solid var(--panel-border-color, var(--spotui-accent, #ff8c42));
    border-radius: 4px;
    background: #000;
    color: #ddd;
    font-size: 13px;
    white-space: nowrap;
    pointer-events: auto;
}

#spotui-queue-info-popup, #spotui-search-info-popup {
    white-space: normal;
}

#spotui-playlist-info-popup span, #spotui-queue-info-popup span, #spotui-search-info-popup span {
    color: var(--panel-text-color, var(--spotui-accent, #ff8c42));
}

#spotui-add2list-panel, #spotui-queue-panel {
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

body.spotui-add2list-panel #spotui-add2list-panel,
body.spotui-queue-panel #spotui-queue-panel {
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

.spotui-theme-controls {
    margin-bottom: 20px;
    display: flex;
    gap: 8px;
}

.spotui-theme-search,
.spotui-theme-channel {
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid var(--panel-border-color, var(--spotui-accent, #ff8c42));
    border-radius: 4px;
    color: var(--panel-text-color, var(--spotui-accent, #ff8c42));
    padding: 8px 12px;
    font-family: "JetBrains Mono", monospace;
    font-size: 14px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.spotui-theme-search {
    flex: 1;
}

.spotui-theme-search::placeholder {
    color: var(--panel-text-color, var(--spotui-accent, #ff8c42));
    opacity: 0.5;
}

.spotui-theme-channel {
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    padding-right: 32px;
    background-image:
        linear-gradient(45deg, transparent 50%, var(--panel-text-color, var(--spotui-accent, #ff8c42)) 50%),
        linear-gradient(135deg, var(--panel-text-color, var(--spotui-accent, #ff8c42)) 50%, transparent 50%);
    background-position:
        calc(100% - 18px) calc(50% + 1px),
        calc(100% - 13px) calc(50% + 1px);
    background-size: 5px 5px, 5px 5px;
    background-repeat: no-repeat;
}

.spotui-theme-search:hover,
.spotui-theme-channel:hover {
    border-color: var(--panel-text-color, var(--spotui-accent, #ff8c42));
}

.spotui-theme-search:focus,
.spotui-theme-channel:focus {
    outline: none;
    border-color: var(--panel-text-color, var(--spotui-accent, #ff8c42));
    box-shadow: 0 0 0 1px var(--panel-text-color, var(--spotui-accent, #ff8c42));
}

.spotui-theme-channel option {
    background: var(--panel-bg-color, #121212);
    color: var(--panel-text-color, var(--spotui-accent, #ff8c42));
}

.spotui-theme-refresh {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    padding: 8px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid var(--panel-border-color, var(--spotui-accent, #ff8c42));
    border-radius: 4px;
    color: var(--panel-text-color, var(--spotui-accent, #ff8c42));
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.spotui-theme-refresh svg {
    display: block;
}

.spotui-theme-refresh.spinning svg {
    animation: spotui-theme-refresh-spin 0.6s ease;
}

.spotui-theme-refresh:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

@keyframes spotui-theme-refresh-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.spotui-theme-refresh:hover:not(:disabled) {
    border-color: var(--panel-text-color, var(--spotui-accent, #ff8c42));
}

.spotui-theme-refresh:focus:not(:disabled) {
    outline: none;
    border-color: var(--panel-text-color, var(--spotui-accent, #ff8c42));
    box-shadow: 0 0 0 1px var(--panel-text-color, var(--spotui-accent, #ff8c42));
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

#spotui-playlist-list, #spotui-song-list, #spotui-add2list-list, #spotui-queue-list {
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

#spotui-add2list-list, #spotui-queue-list {
    width: 100%;
    box-sizing: border-box;
    min-width: 0;
}

#spotui-playlist-list legend, #spotui-song-list legend, #spotui-add2list-list legend, #spotui-queue-list legend {
    color: var(--panel-text-color, var(--spotui-accent, #ff8c42));
    padding: 0 5px;
}

.playlist-item, .song-item {
    padding: 4px 6px;
    cursor: pointer;
}

.playlist-item.queue-end {
    text-align: center;
    border: 1px solid var(--panel-text-color, var(--spotui-accent, #ff8c42));
    border-radius: 4px;
    margin-top: 8px;
    opacity: 0.85;
}

.playlist-item, .song-item {
    height: 26px;
    box-sizing: border-box;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

#spotui-playlist-list, #spotui-song-list, #spotui-add2list-list, #spotui-queue-list {
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
    position: relative;
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
    white-space: pre;
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
    /* pre, not nowrap: flex items collapse the space at the join of the two spans */
    white-space: pre;
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

/* Video mode: Spotify Canvas layer. Same z as the wallpaper (-1) but later
   in the DOM, so it paints over it; posters (z 0) fade out by body class;
   logo (z 0), panels/footer/visualizer (z 1) and top fade (z 2) stay above. */
#spotui-video {
    position: absolute;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    pointer-events: none;
}

.spotui-video-slot {
    position: absolute;
    inset: 0;
    background: #000;
    opacity: 0;
    transition: opacity 600ms ease;
}

.spotui-video-slot.is-in {
    opacity: 1;
}

.spotui-video-slot.is-out {
    opacity: 0;
    transition-duration: 800ms;
}

.spotui-video-backdrop {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    filter: blur(32px);
    transform: scale(1.15);
    opacity: 0.35;
}

.spotui-video-media {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    background-size: contain;
    background-position: center;
    background-repeat: no-repeat;
    opacity: 0.6;
}

/* Only while video mode is on: other poster opacity changes (tui -posters) stay
   instant, and turning video mode off drops the transition in the same style
   change that drops the override, so the posters are back at once. */
body.spotui-video-on #spotui-posters {
    transition: opacity 600ms ease;
}

body.spotui-video-showing #spotui-posters {
    opacity: 0 !important;
}

/* Spotify mode: #spotui-tui is display: none and the layer sits on <body>, behind
   the native UI (z -1 paints over the root background but under .Root). user.css
   paints the whole page black there, so while a clip shows the containers that
   do it go transparent (body too: html keeps the black, so body paints itself),
   the side panels translucent, and the clip is dimmer so text stays readable.
   Extra classes beat the !important black rules in user.css by specificity. */
body > #spotui-video {
    position: fixed;
}

body > #spotui-video .spotui-video-media {
    opacity: 0.4;
}

body.spotui-spotify-enabled.spotui-video-showing,
body.spotui-spotify-enabled.spotui-video-showing #main,
body.spotui-spotify-enabled.spotui-video-showing .Root,
body.spotui-spotify-enabled.spotui-video-showing .Root__top-container,
body.spotui-spotify-enabled.spotui-video-showing .Root__main-view,
body.spotui-spotify-enabled.spotui-video-showing .main-view-container,
body.spotui-spotify-enabled.spotui-video-showing .main-view-container__scroll-node,
body.spotui-spotify-enabled.spotui-video-showing .os-viewport {
    background: transparent !important;
    background-color: transparent !important;
}

/* Inner content blocks of the main view: Spotify paints them with
   var(--background-base) (black here) and user.css forces some of them black,
   so the outer containers alone leave the main view opaque. Transparent here;
   cards stay opaque on purpose (user.css), as do the top bar, the player bar,
   the native lyrics page and the now-playing panel. */
body.spotui-spotify-enabled.spotui-video-showing .playlist-playlist-playlistContent,
body.spotui-spotify-enabled.spotui-video-showing .playlist-playlist-concertsFooter,
body.spotui-spotify-enabled.spotui-video-showing .main-entityHeader-backgroundColor,
body.spotui-spotify-enabled.spotui-video-showing .main-entityHeader-overlay,
body.spotui-spotify-enabled.spotui-video-showing .main-home-homeHeader,
body.spotui-spotify-enabled.spotui-video-showing .main-view-container__mh-footer-container {
    background: transparent !important;
    background-color: transparent !important;
    background-image: none !important;
}

/* Sticky or banded bars: translucent, not transparent, so scrolled content
   under their text stays out of the way. */
body.spotui-spotify-enabled.spotui-video-showing .main-actionBarBackground-background,
body.spotui-spotify-enabled.spotui-video-showing .main-home-filterChipsSection,
body.spotui-spotify-enabled.spotui-video-showing .artist-artistDiscography-headerContainer,
body.spotui-spotify-enabled.spotui-video-showing .e-101111-table-container--sticky-header .e-101111-table-header-cell {
    background: rgba(0, 0, 0, 0.55) !important;
    background-color: rgba(0, 0, 0, 0.55) !important;
    background-image: none !important;
}

/* Side panels: only the two OUTER panels are translucent. The blocks nested in
   them are transparent, otherwise the 0.55 would stack (0.8, 0.9) and the
   entry points keep Spotify's solid background. */
body.spotui-spotify-enabled.spotui-video-showing .Root__nav-bar,
body.spotui-spotify-enabled.spotui-video-showing .Root__right-sidebar {
    background: rgba(0, 0, 0, 0.55) !important;
    background-color: rgba(0, 0, 0, 0.55) !important;
}

body.spotui-spotify-enabled.spotui-video-showing .main-yourLibraryX-libraryContainer,
body.spotui-spotify-enabled.spotui-video-showing .YourLibraryX,
body.spotui-spotify-enabled.spotui-video-showing .main-yourLibraryX-entryPoints,
body.spotui-spotify-enabled.spotui-video-showing .main-buddy-list {
    background: transparent !important;
    background-color: transparent !important;
}

/* Fade the page black back in with the clip (only while video mode is on).
   :where() keeps the class list at the specificity of the scope; #main gets its
   own rule. The right sidebar keeps Spotify's margin transition (it slides). */
body.spotui-spotify-enabled.spotui-video-on,
body.spotui-spotify-enabled.spotui-video-on #main,
body.spotui-spotify-enabled.spotui-video-on :where(.Root, .Root__top-container, .Root__main-view, .main-view-container, .main-view-container__scroll-node, .os-viewport, .Root__nav-bar, .main-yourLibraryX-libraryContainer, .YourLibraryX, .main-yourLibraryX-entryPoints, .main-buddy-list) {
    transition: background-color 600ms ease;
}

body.spotui-spotify-enabled.spotui-video-on .Root__right-sidebar {
    transition: margin 0.3s ease-in-out, background-color 600ms ease;
}

@media (prefers-reduced-motion: reduce) {
    .spotui-video-slot,
    body.spotui-video-on #spotui-posters,
    body.spotui-spotify-enabled.spotui-video-on,
    body.spotui-spotify-enabled.spotui-video-on #main,
    body.spotui-spotify-enabled.spotui-video-on :where(.Root, .Root__top-container, .Root__main-view, .main-view-container, .main-view-container__scroll-node, .os-viewport, .Root__nav-bar, .main-yourLibraryX-libraryContainer, .YourLibraryX, .main-yourLibraryX-entryPoints, .main-buddy-list) {
        transition: none;
    }

    body.spotui-spotify-enabled.spotui-video-on .Root__right-sidebar {
        transition: margin 0.3s ease-in-out;
    }
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
    const STATUS_WAIT_MS = 1000;
    const SYNC_ICON_OFF = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path><circle cx="18.5" cy="18.5" r="4.5" fill="#ef4444" stroke="none"></circle><path d="m16.8 16.8 3.4 3.4m0-3.4-3.4 3.4" stroke="#fff" stroke-width="1.5"></path></svg>`;
    const SYNC_ICON_ON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path><circle cx="18.5" cy="18.5" r="4.5" fill="#22c55e" stroke="none"></circle><path d="m16.3 18.5 1.4 1.4 3-3" stroke="#fff" stroke-width="1.5"></path></svg>`;

    let reconnectDelay = RECONNECT_MS;

    let socket = null;
    let reconnectTimer = null;
    let heartbeatTimer = null;
    let statusTimer = null;
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

    function cssVar(style, name, fallback) {
        return toHex(style.getPropertyValue(name), fallback);
    }

    function getColors() {
        // <body>, not <html>: the shade rule defines --spotui-accent on body, and
        // custom properties only inherit downward. Root inline vars reach body too.
        const style = getComputedStyle(document.body);
        // Same chains as the CSS: lyrics active, panel border/text, bar text and
        // the visualizer fall back to the accent. Inactive/near lyrics and the
        // backgrounds have fixed CSS fallbacks, so they keep fixed values here.
        const accent = cssVar(style, "--spotui-accent", "#ff8c42");
        return {
            active: cssVar(style, "--lyrics-color-active", accent),
            inactive: cssVar(style, "--lyrics-color-inactive", "#777777"),
            near: cssVar(style, "--lyrics-color-light-inactive", "#b3b3b3"),
            accent,
            panel_bg: cssVar(style, "--panel-bg-color", "#000000"),
            panel_border: cssVar(style, "--panel-border-color", accent),
            panel_text: cssVar(style, "--panel-text-color", accent),
            bar_bg: cssVar(style, "--player-bar-background", "#000000"),
            bar_text: cssVar(style, "--player-bar-text-color", accent),
            visualizer: cssVar(style, "--visualizer-color", accent),
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

    function getVisualizerBars() {
        const stored = storageGet(VISUALIZER_BARS);
        if (stored === null) return 48;
        const value = Number(stored);
        return Number.isFinite(value) ? Math.min(256, Math.max(1, Math.floor(value))) : 48;
    }

    function getVisualizerSmooth() {
        const stored = storageGet(VISUALIZER_SMOOTH);
        if (stored === null) return 45;
        const value = Number(stored);
        return Number.isFinite(value) ? Math.min(100, Math.max(1, Math.floor(value))) : 45;
    }

    function getVisualizerMode() {
        const stored = storageGet(VISUALIZER_MODE);
        return stored === "global" ? "global" : "adaptive";
    }

    function getTrackPayload() {
        const data = Spicetify.Player.data;
        const item = data?.item ?? data?.track;
        if (!item) return null;
        const storedStyle = storageGet(CUSTOM_BAR_PROGRESS_STYLE);
        const progressStyle = Object.hasOwn(PROGRESS_STYLES, storedStyle) ? storedStyle : "classic-block";
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
            progress_style: progressStyle,
            progress_chars: PROGRESS_STYLES[progressStyle],
            visualizer: app.visualizerOpen,
            visualizer_bars: getVisualizerBars(),
            visualizer_smoothing: getVisualizerSmooth(),
            visualizer_mode: getVisualizerMode(),
        };
    }

    function sendJson(obj) {
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify(obj));
    }

    function send() {
        const payload = getTrackPayload();
        if (payload) sendJson(payload);
        else sendJson({ type: "update", visualizer: app.visualizerOpen, visualizer_bars: getVisualizerBars(), visualizer_smoothing: getVisualizerSmooth(), visualizer_mode: getVisualizerMode(), colors: getCachedColors(), lyrics: lyricsCache });
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
                playFresh(match[0].uri);
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
        playFresh(uri, context);
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
        let ws;
        try {
            ws = new WebSocket(WS_URL);
        } catch {
            scheduleReconnect();
            return;
        }
        socket = ws;
        // A replaced socket still fires its events: only the live one may act.
        ws.onopen = () => {
            if (ws !== socket) return;
            reconnectDelay = RECONNECT_MS;
            app.sposyncConnected = true;
            paintSyncIcon();
            // Lyrics are fetched only while the helper's window is visible, which
            // its "status" message reports. A helper that never sends one (older
            // versions) is treated as visible after a short wait.
            app.sposyncUi = null;
            clearTimeout(statusTimer);
            statusTimer = setTimeout(() => {
                if (app.sposyncUi !== null) return;
                app.sposyncUi = true;
                refreshLyrics();
            }, STATUS_WAIT_MS);
            // A helper that connects after boot turns the saved visualizer back on
            // (the boot restore ran while it was still offline). Before send() so
            // the first update already carries the flag.
            restoreVisualizer();
            send();
        };
        ws.onclose = () => {
            if (ws !== socket) return;
            clearTimeout(statusTimer);
            app.sposyncUi = null;
            app.sposyncConnected = false;
            paintSyncIcon();
            scheduleReconnect();
        };
        ws.onerror = () => {
            if (ws !== socket) return;
            try { ws.close(); } catch {}
        };
        ws.onmessage = (event) => {
            if (ws !== socket) return;
            let data;
            try { data = JSON.parse(event.data); } catch { return; }
            // The relay is an unauthenticated localhost socket: playback stays,
            // but guests keep their restrictions and sensitive commands
            // (binds, secrets, destructive/theme-defacing ops) never run remote.
            const guestAllowed = getAllowedJamGuestCommands();
            if (data?.type === "status") {
                clearTimeout(statusTimer);
                const was = app.sposyncUi;
                app.sposyncUi = data.ui === true;
                if (app.sposyncUi && was !== true) refreshLyrics();
                return;
            }
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
                execute(cleaned, { fromRemote: true }).then(send);
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
            // refreshLyrics only feeds the SpoSync relay (the in-app lyrics panel
            // loads its own via lyrics.js), so without a connection nothing
            // consumes the result and no lyric request should leave the app. The
            // helper may also stay connected all day, so lyrics for it are fetched
            // only while its window is visible (app.sposyncUi). When it becomes
            // visible, the status handler fetches for the current track.
            if (app.sposyncConnected && app.sposyncUi === true) refreshLyrics();
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
    initClassMap();
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

    // Existing wallpaper host counts as approved (first run only; never throws).
    migrateWpHosts();

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
        // Video mode (saved look): starts only when its key is "1"; retries until the TUI exists.
        setTimeout(initVideoMode, 2400);
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
