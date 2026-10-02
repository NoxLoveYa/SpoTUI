import { ANIMATION_KEY, CUSTOM_BAR_ENABLED, CUSTOM_BAR_PROGRESS_STYLE, INPUT_BG, INPUT_BG_HOVER, INPUT_BORDER, INPUT_BUTTONS, INPUT_TEXT, LYRICS_ANIMATION_KEY, LYRICS_COLOR_ACTIVE, LYRICS_COLOR_INACTIVE, LYRICS_COLOR_LIGHT_INACTIVE, LYRICS_LINE_SPACING, PANEL_BG, PANEL_BORDER, PANEL_TEXT, PLAYER_BAR_BG, PLAYER_BAR_BORDER, PLAYER_BAR_TEXT, PLAYER_BAR_VISIBLE, PROGRESS_BAR_BG, PROGRESS_BAR_FG, PROGRESS_STYLES, SHADE_KEY, VISUALIZER_COLOR, WP_FIT_KEY, WP_OPACITY_KEY, WP_POS_KEY, WP_RICH_KEY, WP_URL_KEY } from "./constants.js";
import { startAsciiPaintLoop } from "./ascii.js";
import { resetPosterPrefs, setPostersEnabled } from "./posters.js";
import { applyShade, isValidShade, parseHexToRgb255 } from "./shade.js";
import { handleLyricsCommand, syncLyricsState } from "./lyrics.js";
import { enterStandby } from "./standby.js";
import { app } from "./state.js";
import { storageGet, storageRemove, storageSet } from "./storage.js";
import { createButton } from "./utils.js";

export function applyCssVar(key, cssVar) {
    const root = document.documentElement;
    const value = storageGet(key);
    if (value) root.style.setProperty(cssVar, value);
    else root.style.removeProperty(cssVar);
}

// Parse color flag arguments and save valid hex colors to storage
export function handleColorArgs(args, flagToKey) {
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
export function applyLyricColors() {
    try {
        applyCssVar(LYRICS_COLOR_ACTIVE, "--lyrics-color-active");
        applyCssVar(LYRICS_COLOR_INACTIVE, "--lyrics-color-inactive");
        applyCssVar(LYRICS_COLOR_LIGHT_INACTIVE, "--lyrics-color-light-inactive");
    } catch (e) {
        console.error("SpoTUI: Failed to apply lyric colors", e);
    }
}

export function applyLyricLineSpacing() {
	try {
		applyCssVar(LYRICS_LINE_SPACING, "--lyrics-line-spacing");
	} catch (e) {
		console.error("SpoTUI: Failed to apply line spacing", e);
	}
}

export function applyVisualizerColor() {
    applyCssVar(VISUALIZER_COLOR, "--visualizer-color");
}

// Apply stored player bar color preferences from localStorage
export function applyPlayerBarColors() {
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
export function applyPlayerBarVisibility() {
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

// Elements this module hides inline (cleared on Spotify mode).
function barTouched() { return (window.__spotuiBarNodes = window.__spotuiBarNodes || []); }

function clearBarInline() {
    try { barTouched().forEach((el) => { try { el.style.removeProperty("display"); } catch {} }); } catch {}
    window.__spotuiBarNodes = [];
    try { document.querySelectorAll("[data-spotui-keep]").forEach((el) => { try { el.removeAttribute("data-spotui-keep"); } catch {} }); } catch {}
}

function touchBarNode(el, value) {
    try { el.style.setProperty("display", value, "important"); } catch {}
    if (!barTouched().includes(el)) barTouched().push(el);
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

// Hidden nodes report zero rects, so a hidden bar is unfindable by
// geometry. Reveal via the mode class, scan, climb, restore — one task.
function isBarShaped(r) {
    const W = window.innerWidth, H = window.innerHeight;
    return r.width > W * 0.4 && r.height > 0 && r.height < 280 && r.bottom > H - 280;
}

function detectNativeBar() {
    try {
        const main = document.getElementById("main");
        if (!main) return null;
        const direct = main.querySelector('[data-testid="now-playing-bar"]');
        if (direct) return direct;
        const prev = window.__spotuiNativeBar;
        if (prev && main.contains(prev)) {
            try { if (isBarShaped(prev.getBoundingClientRect())) return prev; } catch {}
        }
        let seeds = scanBottomSeeds(main);
        for (const seed of seeds) {
            const top = climbBarShaped(seed, main);
            if (top) return top;
        }
        // Reveal via the mode class itself: every TUI-scoped hiding rule
        // (present and future) stops applying, with client layout intact.
        // Synchronous add/measure/remove = no paint, no flash. Attribute
        // observers (lyrics) only see the settled state in a microtask.
        let revealed = false;
        try {
            document.body.classList.add("spotui-spotify-enabled");
            revealed = true;
            void main.offsetHeight;
            seeds = scanBottomSeeds(main);
            let top = null;
            for (const seed of seeds) {
                top = climbBarShaped(seed, main);
                if (top) break;
            }
            if (revealed) {
                try { document.body.classList.remove("spotui-spotify-enabled"); } catch {}
            }
            return top;
        } catch {
            try { document.body.classList.remove("spotui-spotify-enabled"); } catch {}
            return null;
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
    let bar = detectNativeBar() || window.__spotuiNativeBar || null;
    if (!bar || !main || !main.contains(bar)) {
        scheduleNativeBarTag();
        return;
    }
    window.__spotuiNativeBar = bar;
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
    hookBarPlayer();
}

// Hide native bar: inline-hide the detected region root (landmark CSS
// covers the rest). Falls back to the legacy class for older clients.
function hideNativeBar() {
    clearBarInline();
    const main = document.getElementById("main");
    const bar = detectNativeBar() || window.__spotuiNativeBar || null;
    if (bar && (!main || main.contains(bar))) {
        window.__spotuiNativeBar = bar;
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
                    applyPlayerBarVisibility();
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
export function clearNativeBarOverrides() {
    clearBarInline();
}

// Render progress bar using specified style and fill percentage
export function renderProgressBar(progress, styleId, width) {
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
export function updateCustomBarWidth() {
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
            const step = (e.key === "ArrowLeft" ? -5000 : 5000);
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
export async function updateCustomBar() {
    if (customBarUpdating) return;
    customBarUpdating = true;
    try {
        const bar = document.getElementById("spotui-custom-bar");
        if (!bar) return;
        const track = (Spicetify.Player.data || {}).item || (Spicetify.Player.data || {}).track || null;
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
export function applyCustomBarState() {
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
export function applyProgressBarColors() {
    try {
        applyCssVar(PROGRESS_BAR_BG, "--progress-bar-background");
        applyCssVar(PROGRESS_BAR_FG, "--progress-bar-foreground");
    } catch (e) {
        console.error("SpoTUI: Failed to apply progress bar colors", e);
    }
}

// Apply stored input field colors
export function applyInputColors() {
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
export function darkenHexColor(hex, factor) {
    const m = String(hex || "").replace("#", "");
    const alpha = m.length === 4 ? m[3] + m[3] : (m.length === 8 ? m.slice(6, 8) : "");
    const [r, g, b] = parseHexToRgb255(hex);
    const [nr, ng, nb] = [r, g, b].map((v) => Math.max(0, Math.round(v * factor)));
    return `#${[nr, ng, nb].map((v) => v.toString(16).padStart(2, "0")).join("")}${alpha}`;
}

// Apply stored panel colors
export function applyPanelColors() {
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
export function applyInputButtonsVisibility() {
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
export function createControlButtons() {
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
            document.body.classList.remove("spotui-search-mode");
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
        document.body.classList.remove("spotui-search-mode", "spotui-spotify-enabled", "spotui-tui-hidden");
        spotifyBtn.textContent = "Enable Spotify";
        applyPlayerBarVisibility();
        applyCustomBarState();
        syncLyricsState();
    });
    backBtn.type = "button";
    document.body.appendChild(backBtn);
}
// Toggle ASCII logo visibility
export function toggleLogo(state) {
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
export function resetAllSettings() {
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
