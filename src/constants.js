// Theme feed host for pulling community themes
export const THEME_HOST = "https://spotui.root.sx/";

// LocalStorage keys for user preferences
export const ANIMATION_KEY = "spotui:ascii-animation";
export const LYRICS_STORAGE_KEY = "spotui:lyrics-open";
export const LYRICS_ANIMATION_KEY = "spotui:lyrics-animation";
export const WP_URL_KEY = "spotui:wp-url";
export const WP_FIT_KEY = "spotui:wp-fit";
export const WP_POS_KEY = "spotui:wp-pos";
export const WP_RICH_KEY = "spotui:wp-rich";
export const SHADE_KEY = "spotui:shade";
export const DEBUG_KEY = "spotui:debug";

// External endpoints used by the poster wall (kept here, not inline).
export const PINTEREST_WIDGET_BASE = "https://widgets.pinterest.com/v3/pidgets";
export const PINTEREST_API_BASE = "https://api.pinterest.com/v5";
export const PINTEREST_WWW_BASE = "https://www.pinterest.com";
export const WP_OPACITY_KEY = "spotui:wp-opacity";
export const LYRICS_COLOR_ACTIVE = "spotui:lyrics-color-active";
export const LYRICS_COLOR_INACTIVE = "spotui:lyrics-color-inactive";
export const LYRICS_COLOR_LIGHT_INACTIVE = "spotui:lyrics-color-light-inactive";
export const PLAYER_BAR_BG = "spotui:player-bar-bg";
export const PLAYER_BAR_BORDER = "spotui:player-bar-border";
export const PLAYER_BAR_TEXT = "spotui:player-bar-text";
export const PLAYER_BAR_VISIBLE = "spotui:player-bar-visible";
export const CUSTOM_BAR_ENABLED = "spotui:custom-bar-enabled";
export const CUSTOM_BAR_PROGRESS_STYLE = "spotui:custom-bar-progress-style";
export const PROGRESS_BAR_BG = "spotui:progress-bar-bg";
export const PROGRESS_BAR_FG = "spotui:progress-bar-fg";
export const INPUT_BG = "spotui:input-bg";
export const INPUT_BG_HOVER = "spotui:input-bg-hover";
export const INPUT_TEXT = "spotui:input-text";
export const INPUT_BORDER = "spotui:input-border";
export const INPUT_BUTTONS = "spotui:inputs-buttons";
export const PANEL_BG = "spotui:panel-bg";
export const PANEL_BORDER = "spotui:panel-border";
export const PANEL_TEXT = "spotui:panel-text";
export const UPDATE_BANNER_KEY = "spotui:update-banner";

// Jam configs
export const JAM_SERVER_URL = "https://relay-spotui.root.sx/";
export const JAM_STATE_KEY = "spotui:jam-state";
export const JAM_POLL_MS = 1000;
export const JAM_SEEK_DRIFT_MS = 400; // Tolerated position drift before forcing seek

export const KEYBIND_STORAGE_KEY = "spotui:keybinds";
export const HISTORY_KEY = "spotui:cmd-history";
export const HISTORY_LIMIT = 50;
export const HISTORY_ENTRY_MAX = 500;
export const ACTIONS_STORAGE_KEY = "spotui:actions";
export const DISCORD_INVITE_URL = "https://discord.gg/WTzBEKDeKg";
export const LAUNCHED_KEY = "spotui:launched";

// Theme IDs shown in first-boot onboarding
export const FIRST_BOOT_THEME_IDS = new Set([
    "U3BvVFVJIC0gRGVmYXVsdA==",
    "SGlyb2tpIEthd2FuYWJlIC0gU3RvcmU=",
    "UmVkIEF1dHVtbiBSb25pbiAtIExpdmUgV2FsbHBhcGVy",
]);
// Progress bar styles for custom player bar
export const PROGRESS_STYLES = {
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

export const SPOTUI_ASCII_ART = [
    "   ▄████████    ▄███████▄  ▄██████▄      ███     ███    █▄   ▄█  ",
    "  ███    ███   ███    ███ ███    ███ ▀█████████▄ ███    ███ ███  ",
    "  ███    █▀    ███    ███ ███    ███    ▀███▀▀██ ███    ███ ███▌ ",
    "  ███          ███    ███ ███    ███     ███   ▀ ███    ███ ███▌ ",
    "▀███████████ ▀█████████▀  ███    ███     ███     ███    ███ ███▌ ",
    "         ███   ███        ███    ███     ███     ███    ███ ███  ",
    "   ▄█    ███   ███        ███    ███     ███     ███    ███ ███  ",
    " ▄████████▀   ▄████▀       ▀██████▀     ▄████▀   ████████▀  █▀   ",
];

export const GLITCH_CHARS = "01";

// Orange-to-yellow gradient palette for logo coloring
export const ORANGE_PALETTE_RGB = [
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
export const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
export const BIND_CMD_REGEX = /^tui\s+(bind|unbind)\b/i;
export const THEME_SKIP_CMD_REGEX = /^(?:tui\s+(?:bind|unbind|actions|restore)\b|jam\b)/i;
export const F_KEY_REGEX = /^f\d{1,2}$/i; // Match F1-F12
export const LRC_STAMP_REGEX = /\[(\d{1,2}):(\d{2}(?:\.\d+)?)\]/g; // LRC timestamp [mm:ss.ms]
export const LRC_STAMP_STRIP_REGEX = /\[\d{1,2}:\d{2}(?:\.\d+)?\]/g;

// Placeholder images for "Add Theme" card in theme browser
export const ADD_THEME_IMG_OK = `https://imgs.search.brave.com/2VYp5kTKXFu84NcOgmYXQM8zyBByOalm9xwmIOX4Lp8/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9jZG4t/aWNvbnMtcG5nLmZs/YXRpY29uLmNvbS8x/MjgvOTU5Ni85NTk2/MTU2LnBuZw`;
export const ADD_THEME_IMG_ERR = `https://imgs.search.brave.com/qsWzCiBrdeOE9PQmFvp0eS0rfLyVkcm97DyHxEXGNBk/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9jZG4t/aWNvbnMtcG5nLm1h/Z25pZmljLmNvbS8y/NTYvMTAwODQvMTAw/ODQzOTAucG5nP3Nl/bXQ9YWlzX3doaXRl/X2xhYmVs`;

// Available commands shown in help panel
// This renders as innerHTML
export const COMMAND_LIST = [
    { cmd: "tui -l &lt;on/off&gt;", desc: "Toggle ASCII logo visibility" },
    { cmd: "tui -l -a &lt;on/off&gt;", desc: "Toggle ASCII animation" },
    { cmd: "tui -wp &lt;url&gt; [-o &lt;0-1&gt;] [-fit &lt;cover/contain/fill/none&gt;] [-pos &lt;center/top/bottom/left/right&gt;] [-rich &lt;0-200&gt;]", desc: "Set wallpaper — bare tui -wp shows current, flags alone tweak it: opacity, fit, position, richness (100 = default, 0 = off)" },
    { cmd: "tui -wp off", desc: "Remove wallpaper" },
    { cmd: "tui -shade &lt;#hex|off&gt;", desc: "Re-tint orange UI to any color (shades preserved); video + posters stay true; bare tui -shade shows current" },
    { cmd: "tui -debug &lt;on/off&gt;", desc: "Verbose wallpaper/poster/shade logging for troubleshooting (warnings always print)" },
    { cmd: "tui -t pull &lt;theme_id&gt;", desc: "Apply a theme by its ID (you can find the id on our website)" },
    { cmd: "tui -t &lt;save &lt;name&gt;|list|apply &lt;name&gt;|delete &lt;name&gt;&gt;", desc: "Snapshot the current look locally (incl. poster wall layout); list opens the themes menu (Enter applies, Del/D fills in the delete command); restore/delete snapshots" },
    { cmd: 'tui bind "&lt;Letter&gt;" "&lt;command&gt;"', desc: "Bind Alt+&lt;Letter&gt; to run a TUI command (e.g. tui bind &quot;T&quot; &quot;tui -t list&quot; opens the themes menu on Alt+T; Ctrl combos never reach the page)" },
    { cmd: 'tui unbind "&lt;Letter&gt;"', desc: "Remove the Alt+&lt;Letter&gt; keybind" },
    { cmd: "tui bind clear", desc: "Remove all keybinds" },
    { cmd: "Ctrl+R", desc: "Reverse-search persistent command history (typing filters, Ctrl+R cycles older matches, Enter fills the bar, Esc aborts; unknown commands stay session-only)" },
    { cmd: "tui actions create &lt;name&gt;", desc: "Create a named action" },
    { cmd: "tui actions &lt;name&gt; &lt;listener&gt; &lt;command&gt;", desc: "Bind an action to a listener" },
    { cmd: "tui actions list", desc: "List saved actions" },
    { cmd: "tui actions enable &lt;name&gt;", desc: "Enable an action" },
    { cmd: "tui actions disable &lt;name&gt;", desc: "Disable an action" },
    { cmd: "tui actions delete &lt;name&gt;", desc: "Delete an action" },
    { cmd: "tui -ly -cp -active &lt;#hex&gt; -inactive &lt;#hex&gt; -near &lt;#hex&gt;", desc: "Set lyrics colors" },
    { cmd: "tui -ly -cp off", desc: "Reset lyrics colors" },
    { cmd: "tui -ly -animation &lt;on/off&gt;", desc: "Toggle lyrics loader animation" },
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
    { cmd: "play / pause / p", desc: "Toggle playback" },
    { cmd: "skip", desc: "Next track" },
    { cmd: "back", desc: "Previous track" },
    { cmd: "s / seek <mm:ss>", desc: "Jump to a specific time" },
    { cmd: "v / volume <%>", desc: "Set volume" },
    { cmd: "shuffle", desc: "Toggle shuffle" },
    { cmd: "loop / superloop", desc: "Toggle repeat mode" },
    { cmd: "like", desc: "Like/unlike current song" },
    { cmd: "lyrics", desc: "Toggle lyrics panel" },
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
