import { HEX_COLOR_REGEX, SHADE_KEY } from "./constants.js";
import { storageGet, storageRemove, storageSet } from "./storage.js";
import { dbg, pinToast } from "./utils.js";
// Static cycle with ascii.js (it imports the palette helpers below); safe
// because both sides only call across at event time, never during eval.
import { refreshLogoColors } from "./ascii.js";

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

export function parseHexToRgb255(hex) {
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
export function onAccentFor(hex) {
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

export function hexToHsl01(hex) {
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
export function accentHue() {
    try {
        const target = storageGet(SHADE_KEY);
        if (!isValidShade(target)) return null;
        return hexToHsl01(target).h;
    } catch (e) { return null; }
}

// Logo gradient re-tinted: each palette step keeps its lightness, but takes
// the accent's hue and saturation (grays stay gray, pastels stay pastel).
// Returns null when no shade is set so callers keep the orange palette.
export function accentLogoPalette(base) {
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
export function isValidShade(v) {
    return typeof v === "string" && HEX_COLOR_REGEX.test(v.trim());
}

export function applyShade() {
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

export function setShade(arg) {
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

export function reportShade() {
    const cur = storageGet(SHADE_KEY);
    if (cur && !isValidShade(cur)) {
        pinToast(`shade ${cur} is not a valid hex — ignored (back to orange)`);
        dbg("[SpoTUI-shade] stored value invalid:", cur);
        return;
    }
    pinToast(cur ? `UI shade ${cur}` : "UI shade: orange (default)");
    dbg("[SpoTUI-shade] current:", cur || "orange (default)");
}
