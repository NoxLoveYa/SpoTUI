import { DEBUG_KEY } from "./constants.js";
import { storageGet } from "./storage.js";

export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// randomizing animation sequences - fisher-yates
export function shuffleArray(array) {
    for (let index = array.length - 1; index > 0; index -= 1) {
        const j = Math.floor(Math.random() * (index + 1));
        [array[index], array[j]] = [array[j], array[index]];
    }
    return array;
}
export function createButton(id, className, text, onClick) {
    const btn = document.createElement("button");
    btn.id = id;
    btn.className = className;
    btn.textContent = text;
    btn.addEventListener("click", onClick);
    return btn;
}

// Verbose troubleshooting logs. Off by default — toggle with `tui -debug on`.
// Warnings/errors always print; only info-level chatter goes through here.
export function isDebug() {
    try { return storageGet(DEBUG_KEY) === "1"; } catch (e) { return false; }
}

export function dbg(tag, ...args) {
    if (isDebug()) console.log(tag, ...args);
}

// Shared toast skeleton: fixed bottom-center single instance, auto-remove
// after ms (null = sticky). Callers pass their exact visuals as cssText so
// unifying here changes no pixels.
export function toastBase(id, text, ms, cssText) {
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
export function setStatusTag(id, lines) {
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
export function pinToast(text, ms = 7000) {
    // Border follows --spotui-accent (what -shade re-points) with the panel
    // border as fallback. The toast lives on document.body, outside the
    // TUI container, so the var reads as the exact target color.
    toastBase("spotui-pin-toast", text, ms, "position:fixed;left:50%;bottom:120px;transform:translateX(-50%);z-index:10000;background:rgba(10,14,18,.45);background:color-mix(in srgb, var(--panel-bg-color,#0a0e12) 45%, transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);color:var(--panel-text-color,var(--text-base,#e8e2d4));border:1px solid var(--spotui-accent,var(--panel-border-color,var(--essential-base,#7fd4d4)));padding:10px 16px;font-family:'JetBrains Mono',monospace;font-size:12px;max-width:70vw;white-space:pre-wrap;text-align:center;pointer-events:none;");
}
