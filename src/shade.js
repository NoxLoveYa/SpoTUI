import { HEX_COLOR_REGEX, SHADE_KEY } from "./constants.js";
import { pinToast } from "./posters.js";
import { storageGet, storageRemove, storageSet } from "./storage.js";

// SpoTUI's house orange. Every orange shade in the UI is rotated away from
// this hue by the same delta, so shade steps are preserved exactly.
const BASE_HEX = "#ff8c42";

function hexToHsl(hex) {
    const m = hex.replace("#", "");
    const full = (m.length === 3 || m.length === 4)
        ? [...m.slice(0, 3)].map((c) => c + c).join("")
        : m.slice(0, 6);
    const r = parseInt(full.slice(0, 2), 16) / 255;
    const g = parseInt(full.slice(2, 4), 16) / 255;
    const b = parseInt(full.slice(4, 6), 16) / 255;
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

function shadeDelta() {
    const target = storageGet(SHADE_KEY);
    if (!target) return 0;
    return (((hexToHsl(target).h - hexToHsl(BASE_HEX).h) % 360) + 360) % 360;
}

// Counter-filter for wallpaper/poster layers: they sit inside #spotui-tui
// so they inherit the UI rotation — this cancels it back to true colors.
export function shadeCounterFilter() {
    const delta = shadeDelta();
    return delta < 0.5 ? "" : `hue-rotate(${(-delta).toFixed(1)}deg)`;
}

function hexToRgb(hex) {
    const m = hex.replace("#", "");
    const full = (m.length === 3 || m.length === 4)
        ? [...m.slice(0, 3)].map((c) => c + c).join("")
        : m.slice(0, 6);
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
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

export function applyShade() {
    const tui = document.getElementById("spotui-tui");
    if (!tui) return false;
    const target = storageGet(SHADE_KEY);
    const st = shadeStyleEl();
    if (!target) {
        tui.style.filter = "";
        st.textContent = "";
        const wp = document.getElementById("spotui-wallpaper");
        if (wp) wp.style.filter = wp.style.filter.replace(/hue-rotate\([^)]*\)/g, "").trim();
        const posters = document.getElementById("spotui-posters");
        if (posters) posters.style.filter = "";
        return true;
    }
    const delta = shadeDelta();
    tui.style.filter = delta < 0.5 ? "" : `hue-rotate(${delta.toFixed(1)}deg)`;
    // Native Spotify chrome follows --spotui-accent (no filter out there).
    // Overlay bits that also consume the var are pinned to base orange so
    // the container filter lands them on target instead of double-rotating.
    const [r, g, b] = hexToRgb(target);
    st.textContent = `
body.spotui-spotify-enabled, body {
    --spotui-accent: ${target} !important;
    --spotui-accent-rgb: ${r}, ${g}, ${b} !important;
}
#spotui-tui .spotui-dj-logo { stroke: ${BASE_HEX} !important; }
#spotui-tui #spotui-search-bar.focused { border-color: ${BASE_HEX} !important; }
#spotui-tui #spotui-search-input { caret-color: ${BASE_HEX} !important; }
#spotui-tui .spotui-search-item.selected { background: ${BASE_HEX} !important; }
#spotui-tui .spotui-jam-tag { border-color: ${BASE_HEX} !important; }`;
    const wp = document.getElementById("spotui-wallpaper");
    if (wp) wp.style.filter = [wp.style.filter.replace(/hue-rotate\([^)]*\)/g, "").trim(), shadeCounterFilter()].filter(Boolean).join(" ");
    const posters = document.getElementById("spotui-posters");
    if (posters) posters.style.filter = shadeCounterFilter();
    return true;
}

export function setShade(arg) {
    const v = String(arg || "").trim();
    if (v.toLowerCase() === "off") {
        storageRemove(SHADE_KEY);
        applyShade();
        pinToast("shade off — back to orange");
        console.log("[SpoTUI-shade] off, orange restored.");
        return;
    }
    if (!HEX_COLOR_REGEX.test(v)) {
        console.warn("[SpoTUI-shade] usage: tui -shade <#hex|off>  (e.g. tui -shade #7fd4d4)");
        return;
    }
    if (hexToHsl(v).s < 0.15) {
        console.warn("[SpoTUI-shade] that hex is near-gray (no hue to rotate to) — pick something colorful.");
        return;
    }
    storageSet(SHADE_KEY, v);
    applyShade();
    pinToast(`UI shade ${v} (video + posters untouched)`);
    console.log("[SpoTUI-shade] applied:", v);
}

export function reportShade() {
    const cur = storageGet(SHADE_KEY);
    pinToast(cur ? `UI shade ${cur}` : "UI shade: orange (default)");
    console.log("[SpoTUI-shade] current:", cur || "orange (default)");
}
