import { storageGet, storageRemove, storageSet } from "./storage.js";

// Poster wall: Pinterest-style prints pinned on top of the video wallpaper.
// Layer order: wallpaper (z -1) < posters (z 0) < terminal content (z 1).

const POSTERS_ON = "spotui:posters-on";
const POSTERS_IMGS = "spotui:posters-imgs";
const POSTERS_COUNT = "spotui:posters-count";
const POSTERS_ROTATE = "spotui:posters-rotate";
const POSTERS_SEED = "spotui:posters-seed";
const PIN_TOKEN = "spotui:pin-token";

const MAX_STORED = 40;

// Fixed wall slots (percent coords) so posters frame the terminal, never cover it.
const SLOTS = [
    { x: 2, y: 5, w: 13, r: -4 },
    { x: 2, y: 37, w: 12, r: 3 },
    { x: 3, y: 68, w: 13, r: -2 },
    { x: 85, y: 5, w: 13, r: 3 },
    { x: 86, y: 37, w: 12, r: -3 },
    { x: 84, y: 68, w: 13, r: 4 },
    { x: 19, y: 3, w: 11, r: 2 },
    { x: 70, y: 3, w: 11, r: -2 },
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

export function getPosterImages() {
    try {
        const raw = storageGet(POSTERS_IMGS);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr.filter((u) => typeof u === "string") : [];
    } catch (e) { return []; }
}

function savePosterImages(imgs) {
    storageSet(POSTERS_IMGS, JSON.stringify(imgs.slice(0, MAX_STORED)));
}

export function isPostersEnabled() {
    return storageGet(POSTERS_ON) === "1";
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
    if (!isPostersEnabled()) return;
    const imgs = getPosterImages();
    if (!imgs.length) {
        console.log("[SpoTUI-pin] posters on but no images yet. Add: tui -posters add <url> or tui -pin-board <board-url>");
        return;
    }
    const count = Math.min(parseInt(storageGet(POSTERS_COUNT) || "5", 10) || 5, SLOTS.length, imgs.length);
    const seed = parseInt(storageGet(POSTERS_SEED) || "7", 10) || 7;
    const rnd = mulberry32(seed);
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
        const fig = document.createElement("figure");
        fig.style.margin = "0";
        fig.style.position = "absolute";
        fig.style.left = s.x + "%";
        fig.style.top = s.y + "%";
        fig.style.width = s.w + "%";
        fig.style.transform = `rotate(${s.r}deg)`;
        fig.style.background = "#f5f1e6";
        fig.style.padding = "6px 6px 20px 6px";
        fig.style.boxShadow = "0 6px 18px rgba(0,0,0,.55)";
        const img = document.createElement("img");
        img.src = imgs[imgIdx[k]];
        img.alt = "";
        img.draggable = false;
        img.style.width = "100%";
        img.style.display = "block";
        img.style.pointerEvents = "none";
        img.onerror = () => {
            console.warn("[SpoTUI-pin] poster failed to load (deleted/private/blocked hotlink), hiding:", img.src);
            fig.remove();
        };
        fig.appendChild(img);
        box.appendChild(fig);
    }
    console.log(`[SpoTUI-pin] rendered ${count} poster(s) from ${imgs.length} saved.`);
}

export function setPostersEnabled(on) {
    if (on) {
        storageSet(POSTERS_ON, "1");
        renderPosters();
        startRotateTimer();
        console.log("[SpoTUI-pin] posters ON. Shuffle: tui -posters shuffle");
    } else {
        storageRemove(POSTERS_ON);
        stopRotateTimer();
        const box = document.getElementById("spotui-posters");
        if (box) box.innerHTML = "";
        console.log("[SpoTUI-pin] posters OFF (images kept).");
    }
}

export function addPoster(url) {
    const u = String(url || "").trim();
    if (!u) return;
    if (/\s/.test(u) && !/%20/.test(u)) console.warn("[SpoTUI-pin] URL has raw spaces, encode as %20:", u);
    const imgs = getPosterImages();
    if (imgs.includes(u)) {
        console.log("[SpoTUI-pin] already pinned:", u);
        return;
    }
    imgs.unshift(u);
    savePosterImages(imgs);
    console.log(`[SpoTUI-pin] pinned (${imgs.length} total):`, u);
    if (isPostersEnabled()) renderPosters();
}

export function clearPosters() {
    storageRemove(POSTERS_IMGS);
    const box = document.getElementById("spotui-posters");
    if (box) box.innerHTML = "";
    console.log("[SpoTUI-pin] cleared all pinned images.");
}

export function shufflePosters() {
    storageSet(POSTERS_SEED, String(Date.now() % 100000));
    renderPosters();
    console.log("[SpoTUI-pin] shuffled.");
}

export function setPosterCount(n) {
    const v = Math.max(1, Math.min(SLOTS.length, parseInt(n, 10) || 5));
    storageSet(POSTERS_COUNT, String(v));
    renderPosters();
    console.log("[SpoTUI-pin] showing", v, "poster(s).");
}

export function setPosterRotate(min) {
    const m = String(min || "").toLowerCase();
    if (m === "off" || m === "0") {
        storageRemove(POSTERS_ROTATE);
        stopRotateTimer();
        console.log("[SpoTUI-pin] auto-rotate OFF.");
        return;
    }
    const v = Math.max(1, parseInt(m, 10) || 10);
    storageSet(POSTERS_ROTATE, String(v));
    startRotateTimer();
    console.log(`[SpoTUI-pin] auto-rotate every ${v} min (new random picks).`);
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
        console.log("[SpoTUI-pin] auto-rotated posters.");
    }, v * 60 * 1000);
}

// ---------- Pinterest sync ----------

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

// No-auth attempt via Pinterest's public widget endpoint.
async function syncViaPidgets(user, slug) {
    const url = `https://widgets.pinterest.com/v3/pidgets/boards/${encodeURIComponent(user)}/${encodeURIComponent(slug)}/pins/`;
    console.log("[SpoTUI-pin] trying public board endpoint (no login needed)...");
    const data = await fetchJsonLoose(url);
    const pins = (data && data.data && data.data.pins) || [];
    return pins.map(pickPidgetImage).filter(Boolean);
}

async function pinterestV5(path, token) {
    return fetchJsonLoose(`https://api.pinterest.com/v5${path}`, {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
    });
}

// Full account sync with a token: match board by slug across YOUR boards, pull pins.
async function syncViaV5(ref, token) {
    let boardId = ref.id;
    if (!boardId) {
        console.log("[SpoTUI-pin] listing your boards to find a match...");
        const boards = await pinterestV5("/boards?page_size=100", token);
        const items = boards.items || boards || [];
        const hit = items.find((b) => {
            const name = String(b.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
            return name.includes(String(ref.slug).toLowerCase()) || String(ref.slug).toLowerCase().includes(name);
        });
        if (!hit) throw new Error(`board "${ref.slug}" not found in your account (${items.length} boards checked)`);
        boardId = hit.id;
        console.log("[SpoTUI-pin] matched board:", hit.name, `(${boardId})`);
    }
    const pins = await pinterestV5(`/boards/${boardId}/pins?page_size=25`, token);
    return ((pins.items || pins) || []).map((p) => (p.image && p.image.original && p.image.original.url) || null).filter(Boolean);
}

export function setPinToken(token) {
    const t = String(token || "").trim();
    if (!t) {
        console.warn("[SpoTUI-pin] usage: tui -pin-token <paste-token-here>  (stored only in this machine's localStorage)");
        return;
    }
    storageSet(PIN_TOKEN, t);
    console.log("[SpoTUI-pin] token saved. Now run: tui -pin-board <board-url>");
}

export async function syncPinterestBoard(input, tokenArg) {
    const ref = parseBoardRef(input);
    const token = (tokenArg || storageGet(PIN_TOKEN) || "").trim();
    console.log("[SpoTUI-pin] syncing board:", input);
    if (!ref.user && !ref.id) {
        console.warn('[SpoTUI-pin] need a board URL like pinterest.com/<you>/<board>/ , "<you>/<board>", or a numeric board id.');
        return;
    }
    let urls = [];
    // 1) public endpoint first (works for public boards, no token)
    if (ref.user) {
        try {
            urls = await syncViaPidgets(ref.user, ref.slug);
            console.log(`[SpoTUI-pin] public endpoint gave ${urls.length} image(s).`);
        } catch (e) {
            console.warn("[SpoTUI-pin] public endpoint failed:", e.message);
        }
    }
    // 2) authenticated API (works for private boards + your whole account)
    if (!urls.length && token) {
        try {
            urls = await syncViaV5(ref, token);
            console.log(`[SpoTUI-pin] Pinterest API gave ${urls.length} image(s).`);
        } catch (e) {
            console.error("[SpoTUI-pin] Pinterest API failed:", e.message);
        }
    }
    if (!urls.length) {
        if (!token) console.warn("[SpoTUI-pin] nothing fetched. Board may be private — save a token (tui -pin-token <token>) and retry, or paste image URLs directly: tui -posters add <url>");
        else console.warn("[SpoTUI-pin] nothing fetched. Check the board URL/id and token scopes (boards:read, pins:read).");
        return;
    }
    const imgs = getPosterImages();
    let added = 0;
    for (const u of urls) {
        if (!imgs.includes(u) && imgs.length < MAX_STORED) { imgs.unshift(u); added++; }
    }
    savePosterImages(imgs);
    if (!isPostersEnabled()) storageSet(POSTERS_ON, "1");
    startRotateTimer();
    renderPosters();
    console.log(`[SpoTUI-pin] synced ${added} new image(s), ${imgs.length} total. Shuffle: tui -posters shuffle`);
}

// Random mix across ALL your boards = closest thing to a "feed" the API allows.
export async function syncPinterestFeed(tokenArg) {
    const token = (tokenArg || storageGet(PIN_TOKEN) || "").trim();
    if (!token) {
        console.warn("[SpoTUI-pin] feed needs a token: tui -pin-token <token>  (get one at developers.pinterest.com, scopes boards:read pins:read)");
        return;
    }
    try {
        console.log("[SpoTUI-pin] pulling a random mix from all your boards...");
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
            if (!imgs.includes(u) && imgs.length < MAX_STORED) { imgs.unshift(u); added++; }
        }
        savePosterImages(imgs);
        if (!isPostersEnabled()) storageSet(POSTERS_ON, "1");
        startRotateTimer();
        renderPosters();
        console.log(`[SpoTUI-pin] feed mix: ${added} new image(s) from ${shuffled.length} board(s).`);
    } catch (e) {
        if (String(e.message || "").includes("Failed to fetch")) {
            console.error("[SpoTUI-pin] request blocked (CORS/network). Paste image URLs directly instead: tui -posters add <i.pinimg.com url>");
        } else {
            console.error("[SpoTUI-pin] feed failed:", e.message);
        }
    }
}
