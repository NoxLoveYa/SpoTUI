import { VISUALIZER_BARS, VISUALIZER_GAP, VISUALIZER_STORAGE_KEY } from "./constants.js";
import { jamSay } from "./jam.js";
import { app } from "./state.js";
import { storageGet, storageSet } from "./storage.js";

let bars = [];
let raf = 0;

function getGap() {
    const stored = storageGet(VISUALIZER_GAP);
    if (stored === null) return 2;
    const value = Number(stored);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 2;
}

function getBarCount() {
    const stored = storageGet(VISUALIZER_BARS);
    if (stored === null) return 48;
    const value = Number(stored);
    return Number.isFinite(value) ? Math.min(256, Math.max(1, Math.floor(value))) : 48;
}

function resample(source, count) {
    if (!source.length || count === source.length) return source;
    const out = new Array(count);
    for (let i = 0; i < count; i++) {
        const start = Math.floor((i * source.length) / count);
        const end = Math.max(start + 1, Math.floor(((i + 1) * source.length) / count));
        let sum = 0;
        for (let j = start; j < end && j < source.length; j++) sum += source[j];
        out[i] = sum / (end - start);
    }
    return out;
}

function paint() {
    raf = 0;
    const c = document.getElementById("spotui-visualizer");
    if (!c || !app.visualizerOpen) return;
    const ctx = c.getContext("2d");
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (c.width !== w) c.width = w;
    if (c.height !== h) c.height = h;
    ctx.clearRect(0, 0, w, h);
    if (!bars.length || !w || !h) return;
    const data = resample(bars, Math.min(getBarCount(), Math.max(1, Math.floor(w))));
    const n = data.length;
    const gap = n > 1 ? Math.min(getGap(), Math.max(0, Math.floor((w - n) / (n - 1)))) : 0;
    const bw = Math.max(1, (w - gap * (n - 1)) / n);
    const step = bw + gap;
    // One computed-style read per frame, on <body> (where the shade rule
    // defines the accent; <html> would never see it).
    const style = getComputedStyle(document.body);
    ctx.fillStyle = style.getPropertyValue("--visualizer-color").trim()
        || style.getPropertyValue("--spotui-accent").trim()
        || "#ff8c42";
    for (let i = 0; i < n; i++) {
        const bh = data[i] * h;
        if (bh <= 0) continue;
        const left = Math.round(i * step);
        const right = Math.round(i * step + bw);
        ctx.fillRect(left, h - bh, Math.max(1, right - left), bh);
    }
}

// Nothing feeds the bars right now. While false, "on" is a no-op that says so
// instead of opening an empty strip. Flip it where setVisualizerBars gets a
// real source.
const hasSource = false;

export function setVisualizerBars(next) {
    bars = next || [];
    refreshVisualizer();
}

export function refreshVisualizer() {
    if (app.visualizerOpen && !raf) raf = requestAnimationFrame(paint);
}

export function handleVisualizerCommand(arg) {
    const mode = String(arg || "").trim().toLowerCase();
    const on = () => {
        if (!hasSource) {
            jamSay("visualizer: no audio source available");
            return;
        }
        app.visualizerOpen = true;
        storageSet(VISUALIZER_STORAGE_KEY, "1");
        document.body.classList.add("spotui-visualizer-on");
        setVisualizerBars(bars);
    };
    const off = () => {
        app.visualizerOpen = false;
        storageSet(VISUALIZER_STORAGE_KEY, "0");
        document.body.classList.remove("spotui-visualizer-on");
    };
    if (mode === "on" || mode === "open") { if (!app.visualizerOpen) on(); return; }
    if (mode === "off" || mode === "close") { off(); return; }
    if (mode && mode !== "toggle") return;
    if (app.visualizerOpen) off();
    else on();
}

// The saved "1" stays untouched; it just is not applied without a source.
export function restoreVisualizer() {
    if (hasSource && storageGet(VISUALIZER_STORAGE_KEY) === "1") handleVisualizerCommand("on");
}
