import { openLyricsPanel } from "./lyrics.js";
import { closeActivePanel, openAboutPanel, openHelpPanel, openPlaylistPanel, openThemePanel } from "./panels.js";
import { app } from "./state.js";
import { setStatusTag } from "./utils.js";

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

export function initDjBridge() {
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
