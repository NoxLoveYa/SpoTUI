import { emitPaneClose } from "./actions.js";
import { resetAllSettings } from "./appearance.js";
import { execute } from "./commands.js";
import { ADD_THEME_IMG_ERR, ADD_THEME_IMG_OK, COMMAND_LIST } from "./constants.js";
import { isRestrictedThemeCommand } from "./keybinds.js";
import { closeLyricsPanel } from "./lyrics.js";
import { closeOnboardingPanel } from "./onboarding.js";
import { getPlaylists, handlePlaylistPanelKeydown, renderPlaylistPanel } from "./playlists.js";
import { closeSearchPanel } from "./search.js";
import { applyTheme as applySavedTheme, savedThemeDetails } from "./saves.js";
import { clearBoard, getBoardCounts, refreshBoards } from "./posters.js";
import { app } from "./state.js";
import { print, renderCmdGhost } from "./terminal.js";
import { createAddThemeCard, createThemeCard, loadThemeFeed } from "./themes.js";

const PANE_TARGETS = {
    helpPanelOpen: "help",
    aboutPanelOpen: "about",
    themePanelOpen: "theme",
    boardsPanelOpen: "boards",
    savesPanelOpen: "saves",
};

// Global Escape key handler - closes active panels
export function handleGlobalEsc(e) {
    if (e.key !== "Escape") return;
    if (app.onboardingPanelOpen) {
        e.preventDefault();
        return;
    }
    e.preventDefault();
    closeActivePanel();
}

// Close all open panels
export function closeActivePanel() {
    if (app.helpPanelOpen) setPanelState("spotui-help-panel", "spotui-help-panel", "helpPanelOpen", false);
    if (app.aboutPanelOpen) setPanelState("spotui-about-panel", "spotui-about-panel", "aboutPanelOpen", false);
    if (app.lyricsPanelOpen) closeLyricsPanel();
    if (app.playlistPanelOpen) closePlaylistPanel();
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
export function setPanelState(panelId, className, openVarName, targetState) {
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
export function openHelpPanel() {
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
export function openAboutPanel() {
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

export function closePlaylistPanel() {
    const wasOpen = app.playlistPanelOpen;
    app.playlistPanelOpen = false;
    document.body.classList.remove("spotui-playlist-panel");
    const panel = document.getElementById("spotui-playlist-panel");
    if (panel) panel.hidden = true;
    const input = document.getElementById("spotui-input");
    if (input) input.focus();
    document.removeEventListener("keydown", handlePlaylistPanelKeydown);
    if (wasOpen) emitPaneClose("playlist");
}

// Open playlist panel and load users playlists
export async function openPlaylistPanel() {
    if (app.playlistPanelOpen) { closePlaylistPanel(); return; }
    closeActivePanel();

    try {
        app.playlists = (await getPlaylists()).filter((p) => p.name !== "DJ");
    } catch (err) {
        print("Playlist error: " + err.message);
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

export function closeThemePanel() {
    setPanelState("spotui-theme-panel", "spotui-theme-panel", "themePanelOpen", false);
}

// Open theme browser panel (with search and theme cards)
export async function openThemePanel() {
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
export function consumePendingMenu(cmd) {
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

export function openBoardsPanel() {
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

export function closeBoardsPanel() {
    document.removeEventListener("keydown", handleBoardsKeydown);
    setPanelState("spotui-boards-panel", "spotui-boards-panel", "boardsPanelOpen", false);
}

export async function handleBoardsKeydown(e) {
    const rows = boardRows();
    if (e.key === "Escape") {
        e.preventDefault();
        closeBoardsPanel();
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
    } else if (e.key === "a" || e.key === "A") {
        // preventDefault first: focusing the input below must not let this
        // same keystroke type itself into the composer after the prefill.
        e.preventDefault();
        prefillCommand("tui -pin-board ", "boards", "tui -pin-board ");
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

export function openSavesPanel() {
    if (app.savesPanelOpen) { closeSavesPanel(); return; }
    closeActivePanel();
    setPanelState("spotui-saves-panel", "spotui-saves-panel", "savesPanelOpen", true);
    app.selectedSave = 0;
    renderSavesPanel();
    // Same deferred attach as the boards menu (opening Enter must not self-activate).
    setTimeout(() => { if (app.savesPanelOpen) document.addEventListener("keydown", handleSavesKeydown); }, 0);
}

export function closeSavesPanel() {
    document.removeEventListener("keydown", handleSavesKeydown);
    setPanelState("spotui-saves-panel", "spotui-saves-panel", "savesPanelOpen", false);
}

export async function handleSavesKeydown(e) {
    const items = savedThemeDetails();
    if (e.key === "Escape") {
        e.preventDefault();
        closeSavesPanel();
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
        applySavedTheme(name);
    } else if (e.key === "Delete" || e.key === "Backspace" || e.key === "d" || e.key === "D") {
        // Fill the bar with the delete command for the hovered theme;
        // Enter confirms it and the round-trip reopens this menu.
        e.preventDefault();
        const name = items[app.selectedSave].name;
        prefillCommand(`tui -t delete ${name}`, "saves", "tui -t delete ");
    } else if (e.key === "s" || e.key === "S") {
        // Same as above: prefill focuses the bar, so swallow the keystroke.
        e.preventDefault();
        prefillCommand("tui -t save ", "saves", "tui -t save ");
    }
}
