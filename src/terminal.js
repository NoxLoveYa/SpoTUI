import { initAsciiAnimation } from "./ascii.js";
import { execute, isKnownCommand } from "./commands.js";
import { loadHistory, pushHistory, searchHistory } from "./history.js";
import { initSearchPanel } from "./search.js";
import { app, isInputBlockingPanelOpen } from "./state.js";

export function setTuiMode(mode) {
    app.tuiMode = mode === "cli" ? "cli" : "command";
    document.body.classList.toggle("spotui-cli-mode", app.tuiMode === "cli");
    document.body.classList.toggle("spotui-command-mode", app.tuiMode !== "cli");
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

export function isHistorySearching() {
    return !!app.historySearch;
}

export function renderHistorySearch(input) {
    const s = app.historySearch;
    if (!s) return;
    const prompt = searchPromptEl(input);
    if (prompt) {
        if (s.savedPrompt === undefined) s.savedPrompt = prompt.textContent;
        prompt.textContent = `(reverse-i-search)\`${s.query}': `;
    }
    input.value = s.matches.length ? (s.matches[s.matchIdx] || "") : "";
}

export function enterHistorySearch(input) {
    app.historySearch = {
        query: "",
        matches: searchHistory(""),
        matchIdx: 0,
        savedBar: input.value,
        savedPrompt: undefined,
    };
    renderHistorySearch(input);
}

export function exitHistorySearch(input, restoreBar) {
    const s = app.historySearch;
    app.historySearch = null;
    const prompt = searchPromptEl(input);
    if (prompt && s && s.savedPrompt !== undefined) prompt.textContent = s.savedPrompt;
    if (restoreBar && s) input.value = s.savedBar;
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
// Create main terminal interface
export function createTerminal() {
    const box = document.createElement("div");
    box.id = "spotui-tui";
    setTuiMode("command");
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
<div id="spotui-boards-panel" hidden><fieldset class="spotui-help-fieldset"><legend class="spotui-help-legend">Boards — Enter re-pull · Del forget · A add · Esc</legend><div class="spotui-boards-content"></div></fieldset></div>
<div id="spotui-saves-panel" hidden><fieldset class="spotui-help-fieldset"><legend class="spotui-help-legend">Themes — Enter — apply · Del — delete hovered theme · S — save · Esc</legend><div class="spotui-saves-content"></div></fieldset></div>
<div id="spotui-onboarding-panel" hidden></div>
<div id="spotui-footer">
<span class="prompt">></span>
<input id="spotui-input" autofocus placeholder="type help for a list of commands">
</div>
`;
    document.body.appendChild(box);
    initAsciiAnimation();
    initSearchPanel();

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
            e.stopImmediatePropagation();
            return;
        }
        const isCtrlR = (e.key === "r" || e.key === "R") && e.ctrlKey && !e.altKey && !e.metaKey;
        if (isCtrlR) {
            // Unix reverse search: first press enters, repeats cycle older.
            e.preventDefault();
            if (!app.historySearch) enterHistorySearch(input);
            else cycleHistorySearch(input);
            return;
        }
        if (app.historySearch) {
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
        if ((e.key === "c" || e.key === "C") && e.ctrlKey && !e.altKey && !e.metaKey) {
            // Clear the compose box. A text selection is left alone so
            // copying out of the input keeps working.
            if (input.selectionStart === input.selectionEnd) {
                e.preventDefault();
                input.value = "";
                app.commandHistoryIndex = -1;
            }
            return;
        }
        if (e.key === "Enter") {
            const cmd = input.value.trim();
            // Unknown shapes stay session-only (arrows/Ctrl+R this run).
            if (cmd) pushHistory(cmd, { persist: isKnownCommand(cmd) });
            app.commandHistoryIndex = -1;
            input.value = "";
            print("> " + cmd);
            await execute(cmd);
            return;
        }
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            if (!app.commandHistory.length) return;
            e.preventDefault();
            if (e.key === "ArrowUp") {
                if (app.commandHistoryIndex < app.commandHistory.length - 1) app.commandHistoryIndex += 1;
            } else if (app.commandHistoryIndex >= 0) {
                app.commandHistoryIndex -= 1;
            }
            input.value = app.commandHistoryIndex >= 0 ? app.commandHistory[app.commandHistoryIndex] || "" : "";
            return;
        }
        if (e.key === "ArrowDown" && app.results.length) {
            app.selected = Math.min(app.selected + 1, app.results.length - 1);
            renderResults();
        }
        if (e.key === "ArrowUp" && app.results.length) {
            app.selected = Math.max(app.selected - 1, 0);
            renderResults();
        }
    });
}

// Placeholder print function (output is handled differently now)
export function print(text) {}

export function renderResults() {
    const output = document.getElementById("spotui-output");
    output.textContent = "";
    app.results.forEach((item, idx) => {
        const line = document.createElement("div");
        line.className = "result" + (idx === app.selected ? " selected" : "");
        line.textContent = `${idx + 1}. ${item.name}${item.artist ? " - " + item.artist : ""}`;
        output.appendChild(line);
    });
}