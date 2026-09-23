import { applyCustomBarState, applyInputButtonsVisibility, applyInputColors, applyLyricColors, applyPanelColors, applyPlayerBarColors, applyPlayerBarVisibility, applyProgressBarColors, createControlButtons } from "./appearance.js";
import { initUpdateBanner, showRestartPopup } from "./banner.js";
import { LYRICS_ANIMATION_KEY, LYRICS_STORAGE_KEY, WP_OPACITY_KEY, WP_URL_KEY } from "./constants.js";
import { WP_FIT_KEY, WP_POS_KEY, WP_RICH_KEY } from "./constants.js";
import { resumeJamFromStorage } from "./jam.js";
import { handleKeybindKeydown } from "./keybinds.js";
import { initDjBridge } from "./dj.js";
import { initLyricsBridge, openLyricsPanel, waitForPlayerReadyThen } from "./lyrics.js";
import { isFirstBoot, launchFirstBootIfNeeded } from "./onboarding.js";
import { storageGet } from "./storage.js";
import { getBoardCounts, getPosterImages, isPostersEnabled, maybeAutoshuffle, renderPosters, startRotateTimer } from "./posters.js";
import { injectStyle } from "./styles.js";
import { initSync } from "./sync.js";
import { createTerminal } from "./terminal.js";
import { setWallpaper } from "./wallpaper.js";

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
        console.log("[SpoTUI-dbg] boot: restoring saved wallpaper:", storageGet(WP_URL_KEY), "opacity:", storageGet(WP_OPACITY_KEY) || "1", "(clear with tui -wp off)");
        setTimeout(() => setWallpaper(storageGet(WP_URL_KEY), storageGet(WP_OPACITY_KEY) || "1", false, {
            fit: storageGet(WP_FIT_KEY) || undefined,
            pos: storageGet(WP_POS_KEY) || undefined,
            rich: storageGet(WP_RICH_KEY) || undefined,
        }), 1500);
    } else {
        console.log("[SpoTUI-dbg] boot: no saved wallpaper. Set one with: tui -wp https://xpui.app.spotify.com/videos/lake-golden-hour.webm -o 0.5");
    }
    if (isPostersEnabled()) {
        console.log("[SpoTUI-pin] boot: wall ON,", getPosterImages().length, "stored image(s), boards:", getBoardCounts());
        setTimeout(() => { maybeAutoshuffle(); renderPosters(); startRotateTimer(); }, 2200);
    } else {
        console.log("[SpoTUI-pin] boot: wall OFF,", getPosterImages().length, "stored image(s) (enable with tui -posters on).");
    }
    applyLyricColors();
    applyPlayerBarColors();
    applyPlayerBarVisibility();
    applyCustomBarState();
    applyProgressBarColors();
    applyInputColors();
    applyInputButtonsVisibility();
    applyPanelColors();
    resumeJamFromStorage();
} catch { }
