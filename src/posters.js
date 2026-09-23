import { HEX_COLOR_REGEX, PINTEREST_API_BASE, PINTEREST_WIDGET_BASE, PINTEREST_WWW_BASE } from "./constants.js";
import { shadeCounterFilter } from "./shade.js";
import { storageGet, storageRemove, storageSet } from "./storage.js";
import { dbg, pinToast } from "./utils.js";

// Poster wall: Pinterest-style prints pinned on top of the video wallpaper.
// Layer order: wallpaper (z -1) < posters (z 0) < terminal content (z 1).

const POSTERS_ON = "spotui:posters-on";
const POSTERS_IMGS = "spotui:posters-imgs";
const POSTERS_COUNT = "spotui:posters-count";
const POSTERS_ROTATE = "spotui:posters-rotate";
const POSTERS_SEED = "spotui:posters-seed";
const POSTERS_DENSITY = "spotui:posters-density";
const POSTERS_THEME = "spotui:posters-theme";
const POSTERS_OPACITY = "spotui:posters-opacity";
const POSTERS_AUTOSHUFFLE = "spotui:posters-autoshuffle";
const PIN_TOKEN = "spotui:pin-token";

const MAX_STORED = 40;

// Fixed wall slots (percent coords) so posters frame the terminal, never cover it.
// Columns hug the left/right edges, top row clears the logo, bottom corners
// stop at y63 so capped posters (28vh) stay above the command bar.
const SLOTS = [
    { x: 2, y: 2, w: 12, r: -4 },
    { x: 2, y: 23, w: 12, r: 3 },
    { x: 2, y: 44, w: 12, r: -2 },
    { x: 2, y: 63, w: 12, r: 4 },
    { x: 86, y: 2, w: 12, r: 3 },
    { x: 86, y: 23, w: 12, r: -3 },
    { x: 86, y: 44, w: 12, r: 2 },
    { x: 86, y: 63, w: 12, r: -4 },
    { x: 20, y: 1, w: 11, r: 2 },
    { x: 69, y: 1, w: 11, r: -2 },
    { x: 15, y: 63, w: 11, r: -3 },
    { x: 74, y: 63, w: 11, r: 3 },
];

let rotateTimer = null;

function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Stored as [{u:url, b:boardLabel}]; legacy entries carrying retired
// video fields ({u,p,id,k}) resolve to their still thumbnail.
export function getPosterImages() {
    try {
        const raw = storageGet(POSTERS_IMGS);
        const arr = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(arr)) return [];
        return arr
            .map((e) => (typeof e === "string" ? { u: e, b: "?" } : { u: e.u || e.p, b: e.b || "?" }))
            .filter((e) => e && typeof e.u === "string" && e.u.length > 0);
    } catch (e) { return []; }
}

function savePosterImages(imgs) {
    storageSet(POSTERS_IMGS, JSON.stringify(imgs.slice(0, MAX_STORED)));
}

export function getBoardCounts() {
    const map = {};
    for (const e of getPosterImages()) map[e.b || "?"] = (map[e.b || "?"] || 0) + 1;
    return map;
}

export function showBoardList() {
    const boards = getBoardCounts();
    const names = Object.keys(boards);
    if (!names.length) {
        pinToast("no synced boards — pull one with: tui -pin-board <board-url>");
    } else {
        pinToast("synced boards:\n" + names.map((b) => `${b} (${boards[b]})`).join("\n"));
    }
    dbg("[SpoTUI-pin] synced boards:", boards);
}

export function clearBoard(ref) {
    const q = String(ref || "").toLowerCase();
    const imgs = getPosterImages();
    const kept = imgs.filter((e) => !String(e.b || "").toLowerCase().includes(q));
    const removed = imgs.length - kept.length;
    savePosterImages(kept);
    if (!kept.length) {
        // Library is empty: power the wall off so boot stays clean too.
        storageRemove(POSTERS_ON);
        stopRotateTimer();
    }
    if (isPostersEnabled()) renderPosters();
    else { const box = document.getElementById("spotui-posters"); if (box) box.innerHTML = ""; }
    dbg(`[SpoTUI-pin] forgot ${removed} image(s) matching "${ref}". Left:`, getBoardCounts());
    pinToast(`forgot ${removed} image(s).`);
}

export function isPostersEnabled() {
    return storageGet(POSTERS_ON) === "1";
}

// Shared -o/-c/-d/-t/-r flag handling for poster commands (combinable,
// works alongside subcommands and after board syncs).
export function flagArg(argsLower, args, name) {
    const i = argsLower.indexOf(name);
    return i !== -1 && args[i + 1] ? args[i + 1] : undefined;
}

export function applyPosterFlags(argsLower, args) {
    let n = 0;
    const o = flagArg(argsLower, args, "-o");
    if (o !== undefined) { setPosterOpacity(o); n++; }
    const c = flagArg(argsLower, args, "-c");
    if (c !== undefined) { setPosterCount(c); n++; }
    const d = flagArg(argsLower, args, "-d");
    if (d !== undefined) { setPosterDensity(d); n++; }
    const t = flagArg(argsLower, args, "-t");
    if (t !== undefined) { setPosterTheme(t); n++; }
    const r = flagArg(argsLower, args, "-r");
    if (r !== undefined) { setPosterRotate(r); n++; }
    return n;
}

function ensureContainer() {
    const tui = document.getElementById("spotui-tui");
    if (!tui) return null;
    let box = document.getElementById("spotui-posters");
    if (!box) {
        box = document.createElement("div");
        box.id = "spotui-posters";
        box.style.position = "absolute";
        box.style.inset = "0";
        box.style.overflow = "hidden";
        box.style.pointerEvents = "none";
        tui.appendChild(box);
    }
    // Stay above wallpaper (z -1), below terminal content (z 1).
    // setWallpaper() bumps every child to z 1, so re-assert after it runs.
    box.style.setProperty("z-index", "0", "important");
    if (window.getComputedStyle(box).position === "static") box.style.position = "absolute";
    return box;
}

// Called from setWallpaper() so a wallpaper swap never buries the posters.
export function reassertPosterLayer() {
    const box = document.getElementById("spotui-posters");
    if (box) box.style.setProperty("z-index", "0", "important");
}

export function renderPosters() {
    const box = ensureContainer();
    if (!box) return;
    box.innerHTML = "";
    const opRaw = parseFloat(storageGet(POSTERS_OPACITY) || "1");
    box.style.opacity = String(Math.max(0, Math.min(1, isNaN(opRaw) ? 1 : opRaw)));
    box.style.filter = shadeCounterFilter();
    const frame = posterFrameColor();
    if (!isPostersEnabled()) return;
    const imgs = getPosterImages();
    if (!imgs.length) {
        dbg("[SpoTUI-pin] posters on but no images yet. Add: tui -posters add <url> or tui -pin-board <board-url>");
        return;
    }
    const seed = parseInt(storageGet(POSTERS_SEED) || "7", 10) || 7;
    const rnd = mulberry32(seed);
    const [cLo, cHi] = parseCountRange();
    const count = Math.min(cLo + Math.floor(rnd() * (cHi - cLo + 1)), SLOTS.length, imgs.length);
    const [dLo, dHi] = parseDensity();
    const slotIdx = SLOTS.map((_, i) => i);
    for (let i = slotIdx.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [slotIdx[i], slotIdx[j]] = [slotIdx[j], slotIdx[i]];
    }
    const imgIdx = imgs.map((_, i) => i);
    for (let i = imgIdx.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [imgIdx[i], imgIdx[j]] = [imgIdx[j], imgIdx[i]];
    }
    for (let k = 0; k < count; k++) {
        const s = SLOTS[slotIdx[k]];
        const mult = (dLo + rnd() * (dHi - dLo)) / 5;
        const fig = document.createElement("figure");
        fig.style.margin = "0";
        fig.style.position = "absolute";
        fig.style.left = s.x + "%";
        fig.style.top = s.y + "%";
        fig.style.width = Math.min(30, s.w * mult) + "%";
        fig.style.maxHeight = "28vh";
        fig.style.overflow = "hidden";
        fig.style.transform = `rotate(${s.r}deg)`;
        fig.style.background = frame;
        fig.style.padding = "6px 6px 20px 6px";
        fig.style.boxShadow = "0 6px 18px rgba(0,0,0,.55)";
        const entry = imgs[imgIdx[k]];
        fig.appendChild(posterImg(entry.u, fig));
        box.appendChild(fig);
    }
    dbg(`[SpoTUI-pin] rendered ${count} poster(s) from ${imgs.length} saved.`);
}

function posterImg(src, fig) {
    const img = document.createElement("img");
    img.src = src || "";
    img.alt = "";
    img.draggable = false;
    img.style.width = "100%";
    img.style.display = "block";
    img.style.pointerEvents = "none";
    img.onerror = () => {
        console.warn("[SpoTUI-pin] poster image failed to load, hiding:", src);
        fig.remove();
    };
    return img;
}

export function setPostersEnabled(on) {
    if (on) {
        storageSet(POSTERS_ON, "1");
        renderPosters();
        startRotateTimer();
        dbg("[SpoTUI-pin] posters ON. Shuffle: tui -posters shuffle");
    } else {
        storageRemove(POSTERS_ON);
        stopRotateTimer();
        const box = document.getElementById("spotui-posters");
        if (box) box.innerHTML = "";
        dbg("[SpoTUI-pin] posters OFF (images kept).");
    }
}

export function addPoster(url, board) {
    const u = String(url || "").trim();
    const b = String(board || "manual");
    if (!u) return;
    if (/\s/.test(u) && !/%20/.test(u)) console.warn("[SpoTUI-pin] URL has raw spaces, encode as %20:", u);
    const imgs = getPosterImages();
    if (imgs.some((e) => e.u === u)) {
        dbg("[SpoTUI-pin] already pinned:", u);
        return;
    }
    imgs.unshift({ u, b });
    savePosterImages(imgs);
    dbg(`[SpoTUI-pin] pinned (${imgs.length} total):`, u);
    if (isPostersEnabled()) renderPosters();
}

export function clearPosters() {
    const n = getPosterImages().length;
    storageRemove(POSTERS_IMGS);
    storageRemove(POSTERS_ON);
    stopRotateTimer();
    const box = document.getElementById("spotui-posters");
    if (box) box.innerHTML = "";
    dbg(`[SpoTUI-pin] nuked ${n} image(s) and switched the wall OFF. Nothing can come back on restart. Re-enable with: tui -posters on`);
}

export function shufflePosters() {
    storageSet(POSTERS_SEED, String(Date.now() % 100000));
    renderPosters();
    dbg("[SpoTUI-pin] shuffled.");
}

export function setPosterCount(arg) {
    const [lo, hi] = parseRange(arg, SLOTS.length, 5);
    const val = lo === hi ? String(lo) : `${lo}-${hi}`;
    storageSet(POSTERS_COUNT, val);
    renderPosters();
    dbg(`[SpoTUI-pin] showing ${val} poster(s)${val.includes("-") ? " (random in range each shuffle)" : ""}.`);
}

// Parse "n" or "lo-hi" into a clamped [lo, hi] pair (single numbers pass
// through as [n, n], reversed ranges are swapped).
function parseRange(arg, max, fallback) {
    const s = String(arg ?? "").trim();
    const m = s.match(/(\d+)\s*-\s*(\d+)/);
    let lo, hi;
    if (m) { lo = parseInt(m[1], 10); hi = parseInt(m[2], 10); }
    else { lo = hi = parseInt(s, 10) || fallback; }
    lo = Math.max(1, Math.min(max, lo)); hi = Math.max(1, Math.min(max, hi));
    if (lo > hi) [lo, hi] = [hi, lo];
    return [lo, hi];
}

function parseCountRange() {
    return parseRange(storageGet(POSTERS_COUNT), SLOTS.length, 5);
}

// Frame color: any hex. Legacy "dark"/"light" presets map to their hexes.
function posterFrameColor() {
    const v = String(storageGet(POSTERS_THEME) || "").trim();
    if (v === "dark") return "#1a1e24";
    if (HEX_COLOR_REGEX.test(v)) return v;
    return "#f5f1e6";
}
export function setPosterTheme(color) {
    const v = String(color || "").trim();
    if (!HEX_COLOR_REGEX.test(v)) {
        console.warn("[SpoTUI-pin] usage: tui -posters theme <#hex>  (e.g. tui -posters theme #1a1e24)");
        return;
    }
    storageSet(POSTERS_THEME, v);
    renderPosters();
    dbg("[SpoTUI-pin] poster frames:", v);
}

export function setPosterOpacity(v) {
    const f = parseFloat(String(v));
    const op = Math.max(0, Math.min(1, isNaN(f) ? 1 : f));
    storageSet(POSTERS_OPACITY, String(op));
    renderPosters();
    dbg("[SpoTUI-pin] poster layer opacity:", op);
}

export function setPosterDensity(arg) {
    const [lo, hi] = parseRange(arg, 10, 5);
    const val = lo === hi ? String(lo) : `${lo}-${hi}`;
    storageSet(POSTERS_DENSITY, val);
    renderPosters();
    dbg(`[SpoTUI-pin] density ${val}/10 — each poster rolls a random size in that range (re-rolled on shuffle).`);
}

function parseDensity() {
    return parseRange(storageGet(POSTERS_DENSITY), 10, 5);
}

export function setPosterRotate(min) {
    const m = String(min || "").toLowerCase();
    if (m === "off" || m === "0") {
        storageRemove(POSTERS_ROTATE);
        stopRotateTimer();
        dbg("[SpoTUI-pin] auto-rotate OFF.");
        return;
    }
    const v = Math.max(1, parseInt(m, 10) || 10);
    storageSet(POSTERS_ROTATE, String(v));
    startRotateTimer();
    dbg(`[SpoTUI-pin] auto-rotate every ${v} min (new random picks).`);
}

export function setPosterAutoshuffle(state) {
    const on = String(state || "").toLowerCase() === "on";
    if (on) storageSet(POSTERS_AUTOSHUFFLE, "1");
    else storageRemove(POSTERS_AUTOSHUFFLE);
    dbg(`[SpoTUI-pin] launch shuffle ${on ? "ON (fresh layout every Spotify start)" : "OFF"}.`);
}

// Called on boot before first render when the wall is enabled.
export function maybeAutoshuffle() {
    if (storageGet(POSTERS_AUTOSHUFFLE) !== "1") return false;
    storageSet(POSTERS_SEED, String(Date.now() % 100000));
    dbg("[SpoTUI-pin] boot: launch shuffle rolled a fresh layout.");
    return true;
}

export function showPosterSettings() {
    const [cLo, cHi] = parseCountRange();
    const [dLo, dHi] = parseDensity();
    const opRaw = parseFloat(storageGet(POSTERS_OPACITY) || "1");
    const op = String(Math.max(0, Math.min(1, isNaN(opRaw) ? 1 : opRaw)));
    const theme = posterFrameColor();
    const boards = getBoardCounts();
    const boardStr = Object.keys(boards).length
        ? Object.entries(boards).map(([b, n]) => `${b} (${n})`).join(", ")
        : "none";
    const summary =
        `wall ${isPostersEnabled() ? "ON" : "OFF"} · ${getPosterImages().length} images\n` +
        `boards: ${boardStr}\n` +
        `count ${cLo === cHi ? cLo : `${cLo}-${cHi}`} · density ${dLo === dHi ? dLo : `${dLo}-${dHi}`} · ${theme} · opacity ${op}\n` +
        `rotate ${storageGet(POSTERS_ROTATE) ? `every ${storageGet(POSTERS_ROTATE)} min` : "off"} · autoshuffle ${storageGet(POSTERS_AUTOSHUFFLE) === "1" ? "on" : "off"}`;
    pinToast(summary);
    console.log("[SpoTUI-pin] current settings:\n" + summary, boards);
}

function stopRotateTimer() {
    if (rotateTimer) { clearInterval(rotateTimer); rotateTimer = null; }
}

export function startRotateTimer() {
    stopRotateTimer();
    const v = parseInt(storageGet(POSTERS_ROTATE) || "0", 10) || 0;
    if (!isPostersEnabled() || v <= 0) return;
    rotateTimer = setInterval(() => {
        if (!isPostersEnabled()) return stopRotateTimer();
        storageSet(POSTERS_SEED, String(Date.now() % 100000));
        renderPosters();
        dbg("[SpoTUI-pin] auto-rotated posters.");
    }, v * 60 * 1000);
}

// ---------- Pinterest sync ----------

// Extract the still image URL from a board pin record. Video pins resolve
// to their cover still — animation lives in wallpapers, not the wall.
function pickPidgetImage(p) {
    try {
        const im = p.images || {};
        return (im["600x"] && im["600x"].url) || (im.orig && im.orig.url) || (im["237x"] && im["237x"].url) || null;
    } catch (e) { return null; }
}

async function fetchJsonLoose(url, headers) {
    const res = await fetch(url, headers ? { headers } : undefined);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const text = await res.text();
    try { return JSON.parse(text); }
    catch (e) {
        const m = text.match(/^[^(]*\((.*)\)\s*;?\s*$/s);
        if (m) return JSON.parse(m[1]);
        throw e;
    }
}

function parseBoardRef(input) {
    const s = String(input || "").trim();
    if (/^\d+$/.test(s)) return { id: s };
    const m = s.match(/pinterest\.[a-z.]+\/([^/?#]+)\/([^/?#]+)/i);
    if (m) return { user: m[1], slug: m[2] };
    if (/^[^/?#]+\/[^/?#]+$/.test(s)) {
        const [user, slug] = s.split("/");
        return { user, slug };
    }
    return {};
}

// No-auth attempt via Pinterest's public widget endpoint. Returns still
// thumbnails — video pins resolve to their cover still, like at the start.
async function syncViaPidgets(user, slug) {
    const url = `${PINTEREST_WIDGET_BASE}/boards/${encodeURIComponent(user)}/${encodeURIComponent(slug)}/pins/`;
    dbg("[SpoTUI-pin] trying public board endpoint (no login needed)...");
    const data = await fetchJsonLoose(url);
    const pins = (data && data.data && data.data.pins) || [];
    return pins
        .map((p) => pickPidgetImage(p))
        .filter(Boolean);
}

async function pinterestV5(path, token) {
    return fetchJsonLoose(`${PINTEREST_API_BASE}${path}`, {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
    });
}

// Full account sync with a token: match board by slug across YOUR boards, pull pins.
async function syncViaV5(ref, token) {
    let boardId = ref.id;
    if (!boardId) {
        dbg("[SpoTUI-pin] listing your boards to find a match...");
        const boards = await pinterestV5("/boards?page_size=100", token);
        const items = boards.items || boards || [];
        const hit = items.find((b) => {
            const name = String(b.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
            return name.includes(String(ref.slug).toLowerCase()) || String(ref.slug).toLowerCase().includes(name);
        });
        if (!hit) throw new Error(`board "${ref.slug}" not found in your account (${items.length} boards checked)`);
        boardId = hit.id;
        dbg("[SpoTUI-pin] matched board:", hit.name, `(${boardId})`);
    }
    const pins = await pinterestV5(`/boards/${boardId}/pins?page_size=25`, token);
    return ((pins.items || pins) || []).map((p) => (p.image && p.image.original && p.image.original.url) || null).filter(Boolean);
}

// Re-pull synced boards (or only those matching `filter`), merge any new
// pins, then recreate the wall randomly with the current count/density
// ranges.
export async function refreshBoards(filter) {
    const q = String(filter || "").toLowerCase();
    const boards = Object.keys(getBoardCounts())
        .filter((b) => b && b !== "manual" && b !== "?")
        .filter((b) => !q || b.toLowerCase().includes(q));
    if (!boards.length) {
        if (q) console.warn(`[SpoTUI-pin] no synced board matches "${filter}". See: tui -pin-boards`);
        else {
            dbg("[SpoTUI-pin] nothing to re-pull (only manual pins). Sync a board first: tui -pin-board <url>");
            shufflePosters();
        }
        return;
    }
    const token = (storageGet(PIN_TOKEN) || "").trim();
    let ok = 0;
    for (const b of boards) {
        try {
            if (b === "feed-mix") await syncPinterestFeed(token);
            else if (b.startsWith("board:")) await syncPinterestBoard(b.slice(6), token);
            else await syncPinterestBoard(`${PINTEREST_WWW_BASE}/${b}/`, token);
            ok++;
        } catch (e) { console.warn("[SpoTUI-pin] re-pull failed for", b, "-", e.message); }
    }
    shufflePosters();
    pinToast(`re-pulled ${ok}/${boards.length} board(s) — wall recreated`);
    dbg(`[SpoTUI-pin] re-pulled ${ok}/${boards.length} board(s), wall recreated randomly.`);
}

export function setPinToken(token) {
    const t = String(token || "").trim();
    if (!t) {
        console.warn("[SpoTUI-pin] usage: tui -pin-token <paste-token-here>  (stored only in this machine's localStorage)");
        return;
    }
    storageSet(PIN_TOKEN, t);
    dbg("[SpoTUI-pin] token saved. Now run: tui -pin-board <board-url>");
}

export async function syncPinterestBoard(input, tokenArg) {
    const ref = parseBoardRef(input);
    const token = (tokenArg || storageGet(PIN_TOKEN) || "").trim();
    dbg("[SpoTUI-pin] syncing board:", input);
    if (!ref.user && !ref.id) {
        console.warn('[SpoTUI-pin] need a board URL like pinterest.com/<you>/<board>/ , "<you>/<board>", or a numeric board id.');
        return;
    }
    let media = [];
    // 1) public endpoint first (works for public boards, no token)
    if (ref.user) {
        try {
            media = await syncViaPidgets(ref.user, ref.slug);
            dbg(`[SpoTUI-pin] public endpoint gave ${media.length} image(s).`);
        } catch (e) {
            console.warn("[SpoTUI-pin] public endpoint failed:", e.message);
        }
    }
    // 2) authenticated API (works for private boards + your whole account)
    if (!media.length && token) {
        try {
            const urls = await syncViaV5(ref, token);
            media = urls;
            dbg(`[SpoTUI-pin] Pinterest API gave ${media.length} image(s).`);
        } catch (e) {
            console.error("[SpoTUI-pin] Pinterest API failed:", e.message);
        }
    }
    if (!media.length) {
        if (!token) {
            pinToast("nothing fetched — board may be private (save a token) or blocked");
            console.warn("[SpoTUI-pin] nothing fetched. Board may be private — save a token (tui -pin-token <token>) and retry, or paste image URLs directly: tui -posters add <url>");
        } else {
            pinToast("nothing fetched — check board URL/id and token scopes");
            console.warn("[SpoTUI-pin] nothing fetched. Check the board URL/id and token scopes (boards:read, pins:read).");
        }
        return;
    }
    const label = ref.slug ? `${ref.user}/${ref.slug}` : `board:${ref.id}`;
    const imgs = getPosterImages();
    let added = 0;
    for (const u of media) {
        if (!imgs.some((x) => x.u === u) && imgs.length < MAX_STORED) { imgs.unshift({ u, b: label }); added++; }
    }
    savePosterImages(imgs);
    if (!isPostersEnabled()) storageSet(POSTERS_ON, "1");
    startRotateTimer();
    renderPosters();
    pinToast(`synced ${added} new image(s) — wall updated`);
    dbg(`[SpoTUI-pin] synced ${added} new image(s), ${imgs.length} total. Shuffle: tui -posters shuffle`);
}

// Random mix across ALL your boards = closest thing to a "feed" the API allows.
export async function syncPinterestFeed(tokenArg) {
    const token = (tokenArg || storageGet(PIN_TOKEN) || "").trim();
    if (!token) {
        console.warn("[SpoTUI-pin] feed needs a token: tui -pin-token <token>  (get one at developers.pinterest.com, scopes boards:read pins:read)");
        return;
    }
    try {
        dbg("[SpoTUI-pin] pulling a random mix from all your boards...");
        const boards = await pinterestV5("/boards?page_size=100", token);
        const items = boards.items || [];
        if (!items.length) { console.warn("[SpoTUI-pin] no boards on this account."); return; }
        const shuffled = [...items].sort(() => Math.random() - 0.5).slice(0, 5);
        let urls = [];
        for (const b of shuffled) {
            try {
                const pins = await pinterestV5(`/boards/${b.id}/pins?page_size=10`, token);
                urls.push(...(((pins.items || [])).map((p) => (p.image && p.image.original && p.image.original.url) || null).filter(Boolean)));
            } catch (e) { console.warn("[SpoTUI-pin] skip board", b.name, "-", e.message); }
        }
        urls = urls.sort(() => Math.random() - 0.5).slice(0, 25);
        if (!urls.length) { console.warn("[SpoTUI-pin] boards gave no pin images."); return; }
        const imgs = getPosterImages();
        let added = 0;
        for (const u of urls) {
            if (!imgs.some((e) => e.u === u) && imgs.length < MAX_STORED) { imgs.unshift({ u, b: "feed-mix" }); added++; }
        }
        savePosterImages(imgs);
        if (!isPostersEnabled()) storageSet(POSTERS_ON, "1");
        startRotateTimer();
        renderPosters();
        pinToast(`feed mix: ${added} new from ${shuffled.length} board(s)`);
        dbg(`[SpoTUI-pin] feed mix: ${added} new image(s) from ${shuffled.length} board(s).`);
    } catch (e) {
        if (String(e.message || "").includes("Failed to fetch")) {
            console.error("[SpoTUI-pin] request blocked (CORS/network). Paste image URLs directly instead: tui -posters add <i.pinimg.com url>");
        } else {
            console.error("[SpoTUI-pin] feed failed:", e.message);
        }
    }
}
