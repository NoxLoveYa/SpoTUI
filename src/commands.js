import { handleActionsCommand } from "./actions.js";
import { applyCustomBarState, applyInputButtonsVisibility, applyInputColors, applyLyricColors, applyPanelColors, applyPlayerBarColors, applyPlayerBarVisibility, applyProgressBarColors, handleColorArgs, toggleLogo, updateCustomBar } from "./appearance.js";
import { resetGrid } from "./ascii.js";
import { initUpdateBanner, showRestartPopup } from "./banner.js";
import { ACTIONS_STORAGE_KEY, ANIMATION_KEY, CUSTOM_BAR_ENABLED, CUSTOM_BAR_PROGRESS_STYLE, DEBUG_KEY, INPUT_BG, INPUT_BG_HOVER, INPUT_BORDER, INPUT_BUTTONS, INPUT_TEXT, KEYBIND_STORAGE_KEY, LAUNCHED_KEY, LYRICS_ANIMATION_KEY, LYRICS_COLOR_ACTIVE, LYRICS_COLOR_INACTIVE, LYRICS_COLOR_LIGHT_INACTIVE, PANEL_BG, PANEL_BORDER, PANEL_TEXT, PLAYER_BAR_BG, PLAYER_BAR_BORDER, PLAYER_BAR_TEXT, PLAYER_BAR_VISIBLE, PROGRESS_BAR_BG, PROGRESS_BAR_FG, PROGRESS_STYLES, UPDATE_BANNER_KEY, WP_FIT_KEY, WP_OPACITY_KEY, WP_POS_KEY, WP_RICH_KEY, WP_URL_KEY } from "./constants.js";
import { getAllowedJamGuestCommands, jamCreate, jamJoin, jamLeave, jamSay } from "./jam.js";
import { getKeybinds, isRestrictedThemeCommand, saveKeybinds, stripCommandPrefix } from "./keybinds.js";
import { handleLyricsCommand, syncLyricsHighlight } from "./lyrics.js";
import { getAllowedOnboardingCommands } from "./onboarding.js";
import { openAboutPanel, closeActivePanel, consumePendingMenu, openBoardsPanel, openHelpPanel, openPlaylistPanel, openSavesPanel, openThemePanel } from "./panels.js";
import { getPlaylists } from "./playlists.js";
import { openSearchPanel } from "./search.js";
import { app } from "./state.js";
import { storageClear, storageGet, storageRemove, storageSet } from "./storage.js";
import { applyThemeByName } from "./themes.js";
import { enterStandby } from "./standby.js";
import { applyTheme as applySavedTheme, deleteTheme, listThemes, saveTheme, savedThemeNames } from "./saves.js";
import { setWallpaper } from "./wallpaper.js";
import { reportShade, setShade } from "./shade.js";
import { addPoster, applyPosterFlags, clearBoard, clearPosters, flagArg, getBoardCounts, refreshBoards, setPinToken, setPosterAutoshuffle, setPosterCount, setPosterDensity, setPosterOpacity, setPosterRotate, setPosterSymmetric, setPosterTheme, setPostersEnabled, showBoardList, showPosterSettings, shufflePosters, syncPinterestBoard, syncPinterestFeed } from "./posters.js";
import { dbg, pinToast } from "./utils.js";

// All command traffic (typed, keybound, themed, synced) flows through here,
// so menu round-trips are consumed in one place: if a menu prefill armed a
// reopen and this command matches it, the menu comes back with fresh data.
export async function execute(cmd, opts = {}) {
    const out = await executeInner(cmd, opts);
    try {
        consumePendingMenu(stripCommandPrefix(cmd).trim());
    } catch (e) {}
    return out;
}

// First-token command inventory (mirrors the executeInner branches below).
// Used by history: unknown shapes stay session-only instead of persisting.
const KNOWN_COMMANDS = new Set([
    "tui", "standby", "help", "about", "playlist", "list", "theme",
    "discord", "search", "seek", "s", "volume", "v", "loop", "superloop",
    "lyrics", "dj", "echo", "jam",
    "play", "pause", "p", "skip", "back", "shuffle", "like",
]);
const KNOWN_TUI_SUBS = new Set([
    "-l", "-a", "-debug", "-shade", "-wp", "-t", "bind", "unbind",
    "actions", "restore", "-posters", "-poster", "-pin-board",
    "-pin-boards", "-pin-clear", "-pin-feed", "-pin-refresh", "-pin-token",
    "-ly", "-bar", "-progress", "-panel", "-inputs",
]);
const KNOWN_JAM_SUBS = new Set(["create", "join", "leave"]);

export function isKnownCommand(cmd) {
    const parts = stripCommandPrefix(cmd).split(/\s+/).filter(Boolean);
    const command = (parts[0] || "").toLowerCase();
    if (!KNOWN_COMMANDS.has(command)) return false;
    if (command === "tui") return KNOWN_TUI_SUBS.has((parts[1] || "").toLowerCase());
    if (command === "jam") return KNOWN_JAM_SUBS.has((parts[1] || "").toLowerCase());
    return true;
}

async function executeInner(cmd, opts = {}) {
    const cleanedCmd = stripCommandPrefix(cmd);
    const [rawCommand, ...args] = cleanedCmd.split(/\s+/);
    const command = (rawCommand || "").toLowerCase();
    const argText = args.join(" ").trim();
    if (opts.fromTheme && isRestrictedThemeCommand(cleanedCmd)) return;

    const allowedOnboardingCommands = opts.bypassOnboarding ? null : getAllowedOnboardingCommands();
    if (allowedOnboardingCommands && !allowedOnboardingCommands.has(command)) return;

    const allowedJamCommands = getAllowedJamGuestCommands();
    if (allowedJamCommands && !allowedJamCommands.has(command)) {
        jamSay("Commands limited to: `volume`, `lyrics`, `jam leave`");
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
            else clearBoard(args.slice(1).join(" "));
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
            const tName = args[2];
            if (tSub === "save") { saveTheme(tName); return; }
            if (tSub === "list") {
                if (!savedThemeNames().length) listThemes();
                else openSavesPanel();
                return;
            }
            if (tSub === "apply" || tSub === "load") { applySavedTheme(tName); return; }
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
                saveKeybinds({});
                return;
            }
            const bindMatch = cleanedCmd.match(/^tui\s+bind\s+"([A-Za-z])"\s+"([^"]+)"\s*$/i);
            if (bindMatch) {
                const combo = "Alt+" + bindMatch[1].toUpperCase();
                const binds = getKeybinds();
                binds[combo] = bindMatch[2];
                saveKeybinds(binds);
            }
            return;
        }
        if (argsLower[0] === "unbind") {
            const unbindMatch = cleanedCmd.match(/^tui\s+unbind\s+"([A-Za-z])"\s*$/i);
            if (unbindMatch) {
                const combo = "Alt+" + unbindMatch[1].toUpperCase();
                const binds = getKeybinds();
                delete binds[combo];
                saveKeybinds(binds);
            } else if (argsLower[1] === "all") {
                saveKeybinds({});
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
        if (argsLower.includes("-bar")) {
            if (argsLower.includes("-v")) {
                const idx = argsLower.indexOf("-v");
                const state = (args[idx + 1] || "").toLowerCase();
                if (state === "on" || state === "off") {
                    storageSet(PLAYER_BAR_VISIBLE, state);
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
            storageClear();
            if (!fullRestore) {
                if (launchedValue !== null) storageSet(LAUNCHED_KEY, launchedValue);
                if (bannerValue !== null) storageSet(UPDATE_BANNER_KEY, bannerValue);
                if (keybindsValue !== null) storageSet(KEYBIND_STORAGE_KEY, keybindsValue);
                if (actionsValue !== null) storageSet(ACTIONS_STORAGE_KEY, actionsValue);
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

            const match = app.playlists.filter(p => p.name.toLowerCase().includes(argText.toLowerCase()));
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
            if (parts.length !== 2 || parts.some(isNaN)) return;
            Spicetify.Player.seek((parts[0] * 60 + parts[1]) * 1000);
        } catch {}
        return;
    }

    if (command === "volume" || command === "v") {
        try {
            if (!argText) return;
            const percent = Number(argText);
            if (!Number.isFinite(percent) || percent < 0 || percent > 100) return;
            Spicetify.Player.setVolume(percent / 100);
        } catch {}
        return;
    }

    if (command === "loop") { handleRepeatCommand("loop", argText); return; }
    if (command === "superloop") { handleRepeatCommand("superloop", argText); return; }
    if (command === "lyrics") { handleLyricsCommand(argText); return; }
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
export function handleRepeatCommand(kind, arg) {
    try {
        const current = Spicetify.Player.getRepeat();
        const targetMode = kind === "loop" ? 1 : 2;
        let nextMode = targetMode;
        const normalizedArg = String(arg || "").trim().toLowerCase();

        if (normalizedArg === "on") nextMode = targetMode;
        else if (normalizedArg === "off") nextMode = 0;
        else if (normalizedArg === "") nextMode = current === targetMode ? 0 : targetMode;
        else return;

        Spicetify.Player.setRepeat(nextMode);
    } catch (err) {}
}
