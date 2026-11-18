import { VIDEO_MODE_KEY } from "./constants.js";
import { storageGet, storageRemove, storageSet } from "./storage.js";
import { dbg, pinToast } from "./utils.js";
import {
    CANVAS_MANIFEST_BASE,
    VIDEO_LIMITS,
    VIDEO_TIMING,
    VP9_MIME,
    artUrlFromMetadata,
    canvasFromGraphQL,
    canvasFromMetadata,
    chooseProfile,
    classifyItem,
    createController,
    createLru,
    displayedHeight,
    parseCanvasManifest,
    segmentUrls,
    segmentsTimeoutMs,
} from "./videocanvas.js";

// Video mode: while a song plays, its Spotify Canvas replaces the theme
// background (layer #spotui-video, same z as the wallpaper but later in the
// DOM). The state machine lives in videocanvas.js; this file is the adapters:
// Spicetify player, DOM, fetch and MediaSource. Look key "spotui:video-mode":
// "1" = on, absent = off. Off means zero work: no listeners, timers, observers
// or DOM. Nothing here reads or sends the Spotify access token: the manifest is
// requested through Spicetify's own request layer, the segments with no
// credentials. Logs carry hosts, codes and profile heights, never full URLs.

const LAYER_ID = "spotui-video";
const BODY_SHOWING_CLASS = "spotui-video-showing";
const BODY_ON_CLASS = "spotui-video-on"; // video mode is enabled (scopes the poster transition)
const ENABLE_WAIT_MS = 500;
const ENABLE_MAX_TRIES = 20;
const T = VIDEO_TIMING;

// ---- module state ----------------------------------------------------------
let controller = null;
let layer = null;
let running = false; // listeners, poll and layer are live
let starting = false; // waiting for #spotui-tui / Spicetify.Player
let gaveUp = false; // the 20 start attempts failed: the interface never appeared
let startTries = 0;
let startTimer = null;
let pollTimer = null;
let classObserver = null;
let lastVisible = true;
let current = null; // media being shown (the controller's `shown`)
let zTop = 0;
let wpTimer = null;
let wallpaperFaded = false; // current slot's fade-in is complete
let pausedWallpaper = false; // we paused the wallpaper <video>
const slots = new Set(); // every media whose slot is in the DOM
const timers = new Set(); // adapter timers, all cleared on disable
const cache = createLru(VIDEO_LIMITS.CACHE_TRACKS, VIDEO_LIMITS.CACHE_BYTES); // uri -> download
const negCache = new Map(); // uri -> true: GraphQL said "no Canvas" (insertion order = age)
const MAX_SLOTS = 2; // a crossfade needs two; never more in the DOM
// Quality guard (session only, reset on disable).
let penalty = 0; // profile steps down for the NEXT load
let frozen = false; // video Canvases shown as a still: the machine cannot keep up
let qualityTimer = null;
let qualitySample = null; // { video, total, dropped }
// MSE: the segments of this stream carry timestamps relative to their own start
// (found out once per session by comparing the buffered end with the manifest length).
let offsetMode = false;
// Circuit breaker (session only, reset on disable).
let failStreak = 0; // consecutive video-load failures on different tracks
const failUris = new Set();
let degradedUntil = 0; // epoch ms; video Canvases resolve to none until then
let halfOpen = false; // window over: the next failure re-arms it at once
let degradedSkip = null; // { uri, until }: last track whose video Canvas the breaker skipped
// Reduced motion.
let motionQuery = null;
let reducedMotion = false;
// Preload of the next song's clip (bytes only, into the LRU).
let preloadTimer = null;
let preloadJob = null; // { uri, ac, promise }
const preloadFailed = new Set(); // uris whose preload failed: not retried (the real load still is)
let lastUri = null; // playing uri seen by the last poke, to spot a track change

// ---- small helpers ---------------------------------------------------------

function after(ms, fn) {
    const id = setTimeout(() => {
        timers.delete(id);
        try {
            fn();
        } catch (e) {
            dbg("[SpoTUI-video]", "timer-error", describeError(e));
        }
    }, ms);
    timers.add(id);
    return id;
}

function cancel(id) {
    if (id !== null && timers.delete(id)) clearTimeout(id);
}

function cancelAll() {
    for (const id of timers) clearTimeout(id);
    timers.clear();
}

// Errors this module throws carry a short code as message and vm = true. Foreign
// errors (fetch, Spicetify, MSE) are reduced to name + status: their messages
// can echo URLs with signed queries.
function vmError(code, extra, retry) {
    const e = new Error(extra ? `${code} ${extra}` : code);
    e.vm = true;
    e.retry = Boolean(retry);
    return e;
}

function abortError() {
    const e = new Error("aborted");
    e.name = "AbortError";
    e.vm = true;
    return e;
}

function describeError(e) {
    if (e && e.vm) return e.message;
    const name = e && typeof e.name === "string" ? e.name.slice(0, 40) : "error";
    const status = e && Number.isFinite(e.status) ? ` ${e.status}` : "";
    return name + status;
}

function throwIfAborted(signal) {
    if (signal && signal.aborted) throw abortError();
}

function hostOf(url) {
    try {
        return new URL(url).hostname;
    } catch (e) {
        return "?";
    }
}

function isOn() {
    return storageGet(VIDEO_MODE_KEY) === "1";
}

function vp9Supported() {
    try {
        return typeof MediaSource === "function" && MediaSource.isTypeSupported(VP9_MIME);
    } catch (e) {
        return false;
    }
}

function isVisible() {
    const cls = document.body.classList;
    return !document.hidden && !cls.contains("spotui-tui-hidden") && !cls.contains("spotui-standby");
}

// Video Canvases shown as a still (frame 0, never play()): reduced motion, or
// the quality guard gave up on this machine.
function stillMode() {
    return reducedMotion || frozen;
}

// ---- circuit breaker -------------------------------------------------------

// True while video Canvases are off. When the window runs out the breaker goes
// half-open: the next video Canvas is tried, one failure re-arms the window.
function isDegraded() {
    if (degradedUntil === 0) return false;
    if (Date.now() < degradedUntil) return true;
    degradedUntil = 0;
    halfOpen = true;
    return false;
}

function armDegrade() {
    degradedUntil = Date.now() + T.DEGRADE_MS;
    halfOpen = false;
    failStreak = 0;
    failUris.clear();
    dbg("[SpoTUI-video] degraded: video Canvases off for 30 min");
}

// Only video loads that really failed (not aborts, not "no Canvas") reach this.
// Several failures on one uri count once.
function noteLoadFailure(uri) {
    if (degradedUntil !== 0 && Date.now() < degradedUntil) return;
    if (halfOpen) {
        armDegrade();
        return;
    }
    if (failUris.has(uri)) return;
    failUris.add(uri);
    failStreak += 1;
    if (failStreak >= VIDEO_LIMITS.FAIL_LIMIT) armDegrade();
}

function noteLoadSuccess() {
    failStreak = 0;
    failUris.clear();
    halfOpen = false;
}

// Controller hook: a "none" that is really "video Canvases off for now" is asked
// again once the window is over (epoch ms), not remembered for the whole session.
function transientNone(uri) {
    return degradedSkip && degradedSkip.uri === uri ? degradedSkip.until : 0;
}

// True when `uri` shows "none" only because the breaker switched video Canvases off.
function skippedByBreaker(uri) {
    return Boolean(degradedSkip && degradedSkip.uri === uri && Date.now() < degradedSkip.until);
}

// An AbortSignal that follows `signal`, aborts after `ms` too, and says which.
function scoped(signal, ms) {
    const ac = new AbortController();
    let timedOut = false;
    let timer = null;
    const relay = () => ac.abort();
    if (signal) {
        if (signal.aborted) ac.abort();
        else if (signal.addEventListener) signal.addEventListener("abort", relay, { once: true });
    }
    if (ms > 0) {
        timer = after(ms, () => {
            timedOut = true;
            ac.abort();
        });
    }
    return {
        signal: ac.signal,
        timedOut: () => timedOut,
        abort: () => ac.abort(),
        done() {
            cancel(timer);
            if (signal && signal.removeEventListener) signal.removeEventListener("abort", relay);
        },
    };
}

// Race a promise we cannot abort (Spicetify calls) against a scope.
function guard(promise, scope) {
    return new Promise((resolve, reject) => {
        const s = scope.signal;
        const settle = Promise.resolve(promise);
        const fail = () => reject(scope.timedOut() ? vmError("timeout", "", true) : abortError());
        if (s.aborted) {
            settle.catch(() => {});
            fail();
            return;
        }
        const onAbort = () => fail();
        s.addEventListener("abort", onAbort, { once: true });
        settle.then(
            (v) => {
                s.removeEventListener("abort", onAbort);
                resolve(v);
            },
            (err) => {
                s.removeEventListener("abort", onAbort);
                reject(err);
            }
        );
    });
}

// Resolve on `ev`; reject on `failEv` or when the scope aborts.
function once(target, ev, scope, failEv) {
    return new Promise((resolve, reject) => {
        const s = scope.signal;
        const cleanup = () => {
            target.removeEventListener(ev, onOk);
            if (failEv) target.removeEventListener(failEv, onBad);
            s.removeEventListener("abort", onAbort);
        };
        const onOk = () => {
            cleanup();
            resolve();
        };
        const onBad = () => {
            cleanup();
            reject(vmError(`${failEv}-event`));
        };
        const onAbort = () => {
            cleanup();
            reject(scope.timedOut() ? vmError("timeout", "", true) : abortError());
        };
        if (s.aborted) {
            onAbort();
            return;
        }
        target.addEventListener(ev, onOk);
        if (failEv) target.addEventListener(failEv, onBad);
        s.addEventListener("abort", onAbort, { once: true });
    });
}

function delay(ms, signal) {
    return new Promise((resolve, reject) => {
        throwIfAborted(signal);
        let id = null;
        const onAbort = () => {
            cancel(id);
            reject(abortError());
        };
        id = after(ms, () => {
            if (signal && signal.removeEventListener) signal.removeEventListener("abort", onAbort);
            resolve();
        });
        if (signal && signal.addEventListener) signal.addEventListener("abort", onAbort, { once: true });
    });
}

function rememberNone(uri) {
    negCache.delete(uri);
    negCache.set(uri, true);
    while (negCache.size > VIDEO_LIMITS.NEGATIVE_CACHE) {
        const oldest = negCache.keys().next();
        if (oldest.done) break;
        negCache.delete(oldest.value);
    }
}

// ---- resolve: which Canvas does this track have? ---------------------------

function findItem(uri) {
    const d = Spicetify.Player && Spicetify.Player.data;
    if (!d) return null;
    if (d.item && d.item.uri === uri) return d.item;
    const queue = Array.isArray(d.nextItems) ? d.nextItems : [];
    return queue.find((i) => i && i.uri === uri) || null;
}

async function lookupGraphQL(uri, meta, signal) {
    const gql = Spicetify.GraphQL;
    if (!gql || typeof gql.Request !== "function" || !gql.Definitions || !gql.Definitions.canvas) throw vmError("no-graphql");
    const scope = scoped(signal, T.LOOKUP_TIMEOUT_MS);
    try {
        const resp = await guard(gql.Request(gql.Definitions.canvas, { trackUri: uri }), scope);
        if (resp && Array.isArray(resp.errors) && resp.errors.length && !resp.data) throw vmError("graphql-error");
        return canvasFromGraphQL(resp, artUrlFromMetadata(meta));
    } finally {
        scope.done();
    }
}

// Item metadata first (free). Its absence on a playing item means "unknown",
// never "no Canvas": GraphQL decides, and only its null is remembered.
async function resolveCanvas(uri, signal) {
    const item = findItem(uri);
    const meta = item && item.metadata;
    let canvas = canvasFromMetadata(meta);
    let source = "metadata";
    if (canvas === undefined) {
        source = "graphql";
        if (negCache.has(uri)) {
            rememberNone(uri);
            return null;
        }
        canvas = await lookupGraphQL(uri, meta, signal);
        if (canvas === null) rememberNone(uri);
    }
    throwIfAborted(signal);
    if (canvas && canvas.kind === "video" && !vp9Supported()) canvas = null;
    if (canvas && canvas.kind === "video" && isDegraded()) {
        // Breaker open: no manifest or segment request at all; still Canvases keep working.
        degradedSkip = { uri, until: degradedUntil };
        canvas = null;
    }
    dbg("[SpoTUI-video]", "resolved", { uri, source, kind: canvas ? canvas.kind : "none" });
    return canvas;
}

async function resolveAdapter(uri, signal) {
    try {
        return await resolveCanvas(uri, signal);
    } catch (e) {
        if (signal && signal.aborted) throw e;
        throw e && e.vm ? e : vmError(describeError(e));
    }
}

// ---- load: manifest, bytes, MediaSource ------------------------------------

async function fetchManifest(fileId, signal) {
    const cosmos = Spicetify.CosmosAsync;
    if (!cosmos || typeof cosmos.get !== "function") throw vmError("no-cosmos");
    const url = CANVAS_MANIFEST_BASE + encodeURIComponent(fileId) + "/options/supports_drm";
    for (let attempt = 0; ; attempt++) {
        const scope = scoped(signal, T.MANIFEST_TIMEOUT_MS);
        try {
            const res = await guard(cosmos.get(url), scope);
            return typeof res === "string" ? JSON.parse(res) : res;
        } catch (e) {
            throwIfAborted(signal);
            if (attempt >= 1) throw vmError("manifest-failed", describeError(e));
        } finally {
            scope.done();
        }
        await delay(T.RETRY_DELAY_MS, signal);
    }
}

async function fetchOne(url, scope, budget) {
    let res;
    try {
        res = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer", signal: scope.signal });
    } catch (e) {
        throwIfAborted(scope.signal);
        throw vmError("network", hostOf(url), true);
    }
    if (!res.ok) throw vmError(`http-${res.status}`, hostOf(url), res.status >= 500);
    const declared = Number(res.headers && res.headers.get && res.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > VIDEO_LIMITS.MAX_TRACK_BYTES - budget.used) throw vmError("too-big");
    const body = res.body;
    if (!body || typeof body.getReader !== "function") {
        const buf = await res.arrayBuffer();
        budget.used += buf.byteLength;
        if (budget.used > VIDEO_LIMITS.MAX_TRACK_BYTES) throw vmError("too-big");
        return buf;
    }
    // Streamed: the running total is shared by every fetch of the track, so a
    // body without Content-Length (or all of them together) stops at the cap
    // instead of being read whole first.
    const reader = body.getReader();
    const chunks = [];
    let size = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value || !value.byteLength) continue;
            budget.used += value.byteLength;
            if (budget.used > VIDEO_LIMITS.MAX_TRACK_BYTES) throw vmError("too-big");
            size += value.byteLength;
            chunks.push(value);
        }
    } catch (e) {
        chunks.length = 0;
        try {
            const c = reader.cancel();
            if (c && typeof c.catch === "function") c.catch(() => {});
        } catch (e2) {}
        throw e;
    }
    const out = new Uint8Array(size);
    let at = 0;
    for (const c of chunks) {
        out.set(c, at);
        at += c.byteLength;
    }
    return out.buffer;
}

async function fetchAll(urls, signal, timeoutMs) {
    const scope = scoped(signal, timeoutMs);
    const budget = { used: 0 };
    try {
        const buffers = await Promise.all([urls.init, ...urls.segments].map((u) => fetchOne(u, scope, budget)));
        return { buffers, bytes: budget.used };
    } catch (e) {
        scope.abort(); // cancel the siblings
        throw scope.timedOut() ? vmError("timeout", "", true) : e;
    } finally {
        scope.done();
    }
}

// One retry in total, only for a network error, a timeout or a 5xx: on the
// second CDN host when the manifest lists one, else on the same host after a
// pause. A 4xx or an oversized file fails at once.
async function downloadSet(manifest, profile, signal, timeoutMs) {
    for (let attempt = 0; ; attempt++) {
        const baseIndex = manifest.baseUrls.length > 1 ? attempt : 0;
        const urls = segmentUrls(manifest, profile, baseIndex);
        if (!urls) throw vmError("bad-urls");
        try {
            return await fetchAll(urls, signal, timeoutMs);
        } catch (e) {
            throwIfAborted(signal);
            if (!(e && e.vm && e.retry) || attempt >= 1) throw e;
        }
        if (manifest.baseUrls.length <= 1) await delay(T.RETRY_DELAY_MS, signal);
    }
}

async function downloadVideo(canvas, signal) {
    const manifest = parseCanvasManifest(await fetchManifest(canvas.fileId, signal));
    if (!manifest) throw vmError("bad-manifest");
    throwIfAborted(signal);
    // Every profile of a clip shares one aspect ratio. With object-fit: contain
    // the clip is shown min(layerH, layerW / aspect) tall: pick the profile for that.
    const top = manifest.profiles[manifest.profiles.length - 1];
    const usedPenalty = penalty;
    const targetHeight = Math.ceil(displayedHeight(...layerSize(), top.width, top.height) * deviceRatio());
    const profile = chooseProfile(manifest.profiles, { targetHeight, penalty: usedPenalty });
    if (!profile) throw vmError("no-profile");
    let got;
    try {
        got = await downloadSet(manifest, profile, signal, segmentsTimeoutMs(profile));
    } catch (e) {
        // A timeout means "too slow", not "broken": the next load takes a smaller
        // profile and the breaker stays out of it until the lowest step timed out too.
        if (e && e.vm && e.message === "timeout" && !(signal && signal.aborted)) {
            const lowest = penalty >= VIDEO_LIMITS.MAX_PENALTY;
            penalty = Math.min(penalty + 1, VIDEO_LIMITS.MAX_PENALTY);
            dbg("[SpoTUI-video]", "slow link", { penalty });
            if (!lowest) e.noBreaker = true;
        }
        throw e;
    }
    return {
        fileId: canvas.fileId,
        buffers: got.buffers,
        bytes: got.bytes,
        durationSec: manifest.endMs / 1000,
        segLenSec: manifest.segLenSec,
        profileH: profile.height,
        profileShort: Math.min(profile.width, profile.height),
        penalty: usedPenalty,
    };
}

function deviceRatio() {
    const dpr = Number(window.devicePixelRatio);
    return dpr > 0 && Number.isFinite(dpr) ? dpr : 1;
}

// [w, h] in CSS px of the box the clip is shown in, read once per load. A layer
// that is not laid out yet (0x0: TUI hidden mid-load) falls back to the window,
// then to a typical 1080p window: never 0, which would lock in the smallest profile.
function layerSize() {
    const pos = (n) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0);
    const w = pos(layer && layer.clientWidth) || pos(window.innerWidth) || 1920;
    const h = pos(layer && layer.clientHeight) || pos(window.innerHeight) || 1080;
    return [w, h];
}

// At most MAX_SLOTS media in the DOM. Before a third one is appended drop, in
// this order: a slot whose load was cancelled but has not released it yet (its
// load is stale), then the oldest slot that is neither on screen nor loading
// (an outgoing crossfade slot). If every slot is on screen or loads for real,
// this load fails with a "retry later" error: not an error of the track, so
// neither the controller nor the breaker records it.
function enforceSlotCap() {
    while (slots.size >= MAX_SLOTS) {
        let victim = null;
        for (const media of slots) {
            if (media !== current && media.loading && media.signal && media.signal.aborted) {
                victim = media;
                break;
            }
        }
        if (!victim) {
            for (const media of slots) {
                if (media !== current && !media.loading) {
                    victim = media;
                    break;
                }
            }
        }
        if (!victim) {
            const e = vmError("no-free-slot");
            e.retryLater = true;
            e.noBreaker = true;
            throw e;
        }
        release(victim);
    }
}

function buildSlot(kind, artUrl) {
    if (!layer) throw vmError("no-layer");
    if (!layer.isConnected) {
        const tui = document.getElementById("spotui-tui");
        if (!tui) throw vmError("no-tui");
        tui.appendChild(layer);
    }
    enforceSlotCap();
    const slot = document.createElement("div");
    slot.className = "spotui-video-slot";
    const backdrop = document.createElement("div");
    backdrop.className = "spotui-video-backdrop";
    if (artUrl) backdrop.style.backgroundImage = `url("${artUrl}")`;
    let media;
    let video = null;
    if (kind === "video") {
        video = document.createElement("video");
        video.muted = true;
        video.defaultMuted = true;
        video.playsInline = true;
        video.preload = "auto";
        video.loop = true;
        video.disablePictureInPicture = true;
        video.disableRemotePlayback = true;
        video.tabIndex = -1;
        video.setAttribute("muted", "");
        video.setAttribute("playsinline", "");
        video.setAttribute("loop", "");
        video.setAttribute("aria-hidden", "true");
        // Fallback for a stream that reports `ended` instead of looping.
        video.addEventListener("ended", () => {
            video.currentTime = 0;
            if (!stillMode()) playVideo(video);
        });
        media = video;
    } else {
        media = document.createElement("div");
    }
    media.className = "spotui-video-media";
    slot.appendChild(backdrop);
    slot.appendChild(media);
    layer.appendChild(slot);
    return { slot, media, video };
}

// End (s) of the last buffered range; null when the build exposes no ranges.
function bufferedEnd(sb) {
    try {
        const b = sb.buffered;
        if (!b || typeof b.length !== "number") return null;
        return b.length > 0 ? b.end(b.length - 1) : 0;
    } catch (e) {
        return null;
    }
}

// buffers[0] is the init segment, the rest the media segments in order. With
// offsets every media segment i is placed at i * segLenSec: for a stream whose
// segments carry timestamps relative to their own start.
async function appendSegments(sb, buffers, segLenSec, withOffsets, scope) {
    for (let i = 0; i < buffers.length; i++) {
        throwIfAborted(scope.signal);
        if (withOffsets) sb.timestampOffset = i === 0 ? 0 : (i - 1) * segLenSec;
        sb.appendBuffer(buffers[i]);
        await once(sb, "updateend", scope, "error");
    }
}

// Clear the buffer and append again with offsets.
async function rebuildWithOffsets(ms, sb, buffers, segLenSec, durationSec, scope) {
    sb.abort();
    try {
        ms.duration = durationSec; // remove() needs a duration
    } catch (e) {}
    const b = sb.buffered;
    if (b && b.length > 0) {
        sb.remove(b.start(0), b.end(b.length - 1));
        await once(sb, "updateend", scope, "error");
    }
    await appendSegments(sb, buffers, segLenSec, true, scope);
}

const round2 = (n) => (typeof n === "number" && Number.isFinite(n) ? Math.round(n * 100) / 100 : null);

// Returns { bufferedEnd, duration } (s) for the log. If the buffered end falls
// short of the manifest length by more than half a segment with 2+ segments,
// the segments overwrote each other (relative timestamps): rebuild once with
// offsets and keep that mode for the session. Still short: use what is there.
async function attachMse(video, entry, signal) {
    const { buffers, durationSec, segLenSec } = entry;
    const scope = scoped(signal, T.SEGMENTS_TIMEOUT_MS);
    try {
        const ms = new MediaSource();
        const url = URL.createObjectURL(ms);
        video.src = url;
        try {
            await once(ms, "sourceopen", scope);
        } finally {
            URL.revokeObjectURL(url);
        }
        const sb = ms.addSourceBuffer(VP9_MIME);
        await appendSegments(sb, buffers, segLenSec, offsetMode, scope);
        const segments = buffers.length - 1;
        const short = (end) => end !== null && segments >= 2 && end < durationSec - segLenSec / 2;
        let end = bufferedEnd(sb);
        if (!offsetMode && short(end)) {
            let rebuilt = null;
            try {
                await rebuildWithOffsets(ms, sb, buffers, segLenSec, durationSec, scope);
                rebuilt = bufferedEnd(sb);
            } catch (e) {
                if (scope.timedOut()) throw vmError("timeout", "", true);
                throwIfAborted(scope.signal);
            }
            if (rebuilt !== null && rebuilt > end) {
                offsetMode = true;
                dbg("[SpoTUI-video] mse offset mode");
            }
            if (rebuilt !== null) end = rebuilt;
        }
        // Trims the stream to the manifest length; a clip whose last frame ends a
        // hair later keeps the buffered end instead (endOfStream sets it). A clip
        // that is still short plays what is buffered rather than failing.
        try {
            ms.duration = short(end) && end > 0 ? end : durationSec;
        } catch (e) {}
        ms.endOfStream();
        if (!(video.readyState >= 3)) await once(video, "canplay", scope, "error");
        return { bufferedEnd: round2(end), duration: round2(ms.duration) };
    } finally {
        scope.done();
    }
}

function isAbort(e, signal) {
    return Boolean((signal && signal.aborted) || (e && e.name === "AbortError"));
}

function cachedEntry(uri, canvas) {
    const entry = cache.get(uri);
    if (entry && entry.fileId !== canvas.fileId) {
        cache.delete(uri);
        return undefined;
    }
    return entry;
}

// The next song's preload is still running when its turn comes: wait for it
// instead of downloading the same clip twice. Its failure is not ours.
async function joinPreload(job, signal) {
    const scope = scoped(signal, 0);
    try {
        await guard(job.promise, scope);
    } catch (e) {
        throwIfAborted(signal);
    } finally {
        scope.done();
    }
}

async function loadVideo(canvas, uri, signal) {
    let media = null;
    try {
        let entry = cachedEntry(uri, canvas);
        if (!entry && preloadJob && preloadJob.uri === uri) {
            await joinPreload(preloadJob, signal);
            entry = cachedEntry(uri, canvas);
        }
        if (!entry) {
            entry = await downloadVideo(canvas, signal);
            cache.set(uri, entry, entry.bytes);
        }
        throwIfAborted(signal);
        const built = buildSlot("video", canvas.artUrl);
        media = {
            kind: "video",
            uri,
            slot: built.slot,
            video: built.video,
            profileH: entry.profileH,
            profileShort: entry.profileShort,
            penalty: entry.penalty,
            loading: true,
            released: false,
            signal,
            mse: null,
        };
        slots.add(media);
        media.mse = await attachMse(built.video, entry, signal);
        throwIfAborted(signal);
        media.loading = false;
        noteLoadSuccess();
        return media;
    } catch (e) {
        if (media) release(media);
        if (!isAbort(e, signal) && !(e && e.noBreaker)) noteLoadFailure(uri);
        throw e;
    }
}

async function loadImage(canvas, signal) {
    throwIfAborted(signal);
    const built = buildSlot("image", canvas.artUrl);
    const media = { kind: "image", uri: null, slot: built.slot, video: null, profileH: 0, profileShort: 0, penalty: 0, loading: true, released: false, signal, mse: null };
    slots.add(media);
    const scope = scoped(signal, T.SEGMENTS_TIMEOUT_MS);
    try {
        built.media.style.backgroundImage = `url("${canvas.imageUrl}")`;
        const probe = new Image();
        probe.referrerPolicy = "no-referrer";
        const loaded = once(probe, "load", scope, "error").catch((e) => {
            throw e && e.vm && e.message === "error-event" ? vmError("image-failed", hostOf(canvas.imageUrl)) : e;
        });
        probe.src = canvas.imageUrl;
        await loaded;
        throwIfAborted(signal);
        media.loading = false;
        return media;
    } catch (e) {
        release(media);
        throw e;
    } finally {
        scope.done();
    }
}

async function loadAdapter(canvas, uri, signal) {
    try {
        return canvas.kind === "image" ? await loadImage(canvas, signal) : await loadVideo(canvas, uri, signal);
    } catch (e) {
        if (signal && signal.aborted) throw e;
        throw e && e.vm ? e : vmError(describeError(e));
    }
}

// ---- show / hide / resume / release ---------------------------------------

function playVideo(video) {
    if (!video) return;
    try {
        const p = video.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (e) {}
}

function pauseVideo(video) {
    if (!video) return;
    try {
        video.pause();
    } catch (e) {}
}

function setShowingClass(on) {
    if (!document.body) return;
    if (on) document.body.classList.add(BODY_SHOWING_CLASS);
    else document.body.classList.remove(BODY_SHOWING_CLASS);
}

function pauseWallpaper() {
    const wp = document.getElementById("spotui-wallpaper");
    if (wp && wp.tagName === "VIDEO" && !wp.paused) {
        pauseVideo(wp);
        pausedWallpaper = true;
    }
}

function resumeWallpaper() {
    if (!pausedWallpaper) return;
    pausedWallpaper = false;
    const wp = document.getElementById("spotui-wallpaper");
    if (wp && wp.tagName === "VIDEO") playVideo(wp);
}

// A still: the first frame, never play() (reduced motion, or the quality guard froze it).
function showStill(video) {
    if (!video) return;
    pauseVideo(video);
    try {
        video.currentTime = 0;
    } catch (e) {}
}

// The wallpaper <video> stops once it is fully covered: after the fade-in, at
// once when there is no fade (reduced motion).
function coverWallpaper(media) {
    cancel(wpTimer);
    wpTimer = null;
    if (reducedMotion) {
        wallpaperFaded = true;
        pauseWallpaper();
        return;
    }
    wpTimer = after(T.FADE_IN_MS, () => {
        wpTimer = null;
        if (current !== media) return;
        wallpaperFaded = true;
        pauseWallpaper();
    });
}

// Fade a slot in (show and resume are the same thing for the DOM). Returns
// false when the media is gone (released, e.g. by the slot cap): the controller
// then loads the track again instead of believing it is on screen.
function present(media) {
    if (!media || media.released || !slots.has(media)) return false;
    zTop += 1;
    media.slot.style.zIndex = String(zTop);
    void media.slot.offsetWidth; // flush, so a just-built slot still transitions
    media.slot.classList.remove("is-out");
    media.slot.classList.add("is-in");
    if (stillMode()) showStill(media.video);
    else playVideo(media.video);
    current = media;
    wallpaperFaded = false;
    setShowingClass(true);
    coverWallpaper(media);
    schedulePreload();
    startQualitySampler();
    return true;
}

function show(media) {
    const shown = present(media);
    // What the owner reads with tui -debug on: a buffered end well under the
    // duration means the clip loops short.
    if (shown && media.mse) dbg("[SpoTUI-video]", "shown", { buffered: media.mse.bufferedEnd, duration: media.mse.duration, offset: offsetMode });
    return shown;
}

function resume(media) {
    return present(media);
}

// Fade out everything on screen. Media stays alive (the controller decides
// whether to keep or release it); its video pauses once the fade is over.
function hide() {
    cancel(wpTimer);
    wpTimer = null;
    wallpaperFaded = false;
    current = null;
    setShowingClass(false);
    resumeWallpaper();
    stopQualitySampler();
    cancel(preloadTimer);
    preloadTimer = null;
    // The preload for the track now wanted survives: a swap-wait fade-out must not
    // throw away the download the new track's load is joining. Any other is stale.
    if (preloadJob && preloadJob.uri !== playingUri()) abortPreload();
    for (const media of slots) {
        if (!media.slot.classList.contains("is-in")) continue;
        media.slot.classList.remove("is-in");
        media.slot.classList.add("is-out");
        if (reducedMotion) pauseVideo(media.video); // no fade to wait for
        else {
            after(T.FADE_OUT_MS, () => {
                if (current !== media) pauseVideo(media.video);
            });
        }
    }
}

function release(media) {
    if (!media) return;
    media.released = true;
    if (!slots.delete(media)) return;
    if (current === media) {
        current = null;
        cancel(wpTimer);
        wpTimer = null;
        stopQualitySampler();
    }
    const v = media.video;
    if (v) {
        pauseVideo(v);
        try {
            v.removeAttribute("src");
            v.load();
        } catch (e) {}
    }
    media.slot.remove();
}

// setWallpaper re-plays a wallpaper <video> on every refresh: keep a covered one paused.
export function notifyWallpaperChanged() {
    if (current && wallpaperFaded) pauseWallpaper();
}

// ---- quality guard ---------------------------------------------------------

function readQuality(video) {
    try {
        const q = video && typeof video.getVideoPlaybackQuality === "function" ? video.getVideoPlaybackQuality() : null;
        const total = q && q.totalVideoFrames;
        const dropped = q && q.droppedVideoFrames;
        if (!Number.isFinite(total) || !Number.isFinite(dropped)) return null;
        return { video, total, dropped };
    } catch (e) {
        return null;
    }
}

function stopQualitySampler() {
    cancel(qualityTimer);
    qualityTimer = null;
    qualitySample = null;
}

// Every QUALITY_SAMPLE_MS while a video slot shows and is visible: diff the
// dropped/total frame counters. Too many drops lower the profile of the NEXT
// load (penalty); still too many at the lowest step freezes video Canvases on
// their first frame for the rest of the session. Image slots are never sampled.
function startQualitySampler() {
    stopQualitySampler();
    if (!running || stillMode() || !current || !current.video || !isVisible()) return;
    qualitySample = readQuality(current.video);
    if (!qualitySample) return; // no frame counters in this build: nothing to measure
    qualityTimer = after(T.QUALITY_SAMPLE_MS, sampleQuality);
}

function freezeVideo(why) {
    frozen = true;
    stopQualitySampler();
    dbg("[SpoTUI-video]", "frozen", { reason: why, penalty });
    for (const media of slots) showStill(media.video);
}

function sampleQuality() {
    qualityTimer = null;
    const media = current;
    if (!running || stillMode() || !media || !media.video || !isVisible()) {
        qualitySample = null;
        return;
    }
    const q = readQuality(media.video);
    const prev = qualitySample;
    qualitySample = q;
    if (q && prev && prev.video === q.video) {
        const total = q.total - prev.total;
        const dropped = q.dropped - prev.dropped;
        if (total >= VIDEO_LIMITS.MIN_FRAMES && dropped / total > VIDEO_LIMITS.DROP_RATIO) {
            const ratio = dropped / total;
            penalty = Math.min(penalty + 1, VIDEO_LIMITS.MAX_PENALTY);
            dbg("[SpoTUI-video]", "dropping frames", { ratio: Math.round(ratio * 100) / 100, penalty });
            // Frozen only when this clip already played at the lowest step and still drops.
            if (media.penalty >= VIDEO_LIMITS.MAX_PENALTY && ratio > VIDEO_LIMITS.FREEZE_DROP_RATIO) {
                freezeVideo("drops at the lowest step");
                return;
            }
        }
    }
    qualityTimer = after(T.QUALITY_SAMPLE_MS, sampleQuality);
}

// ---- preload ---------------------------------------------------------------

function abortPreload() {
    if (!preloadJob) return;
    const job = preloadJob;
    preloadJob = null;
    try {
        job.ac.abort();
    } catch (e) {}
}

// After a Canvas has shown for PRELOAD_DELAY_MS: fetch the next song's clip
// into the LRU (bytes only: no slot, no MSE). One at a time, own AbortController.
// Its failure is silent: no toast, no breaker count, the track is not poisoned.
function schedulePreload() {
    cancel(preloadTimer);
    preloadTimer = null;
    if (!running) return;
    preloadTimer = after(T.PRELOAD_DELAY_MS, runPreload);
}

function runPreload() {
    preloadTimer = null;
    if (!running || !current || preloadJob || !isVisible()) return;
    const d = Spicetify.Player && Spicetify.Player.data;
    if (!d || d.isPaused) return;
    if (typeof navigator !== "undefined" && navigator && navigator.onLine === false) return;
    if (isDegraded() || !vp9Supported()) return;
    const next = Array.isArray(d.nextItems) ? d.nextItems[0] : null;
    if (!next || classifyItem(next) !== "track") return;
    // Metadata only, never GraphQL: undefined (unknown), null, IMAGE: nothing to preload.
    const canvas = canvasFromMetadata(next.metadata);
    if (!canvas || canvas.kind !== "video") return;
    const uri = next.uri;
    if (uri === (d.item && d.item.uri) || preloadFailed.has(uri)) return;
    const hit = cache.get(uri);
    if (hit && hit.fileId === canvas.fileId) return;
    const ac = new AbortController();
    const job = { uri, ac, promise: null };
    job.promise = downloadVideo(canvas, ac.signal)
        .then(
            (entry) => {
                if (ac.signal.aborted) return;
                cache.set(uri, entry, entry.bytes);
                dbg("[SpoTUI-video]", "preloaded", { uri, profile: entry.profileH, bytes: entry.bytes });
            },
            (e) => {
                if (isAbort(e, ac.signal)) return;
                preloadFailed.add(uri);
                while (preloadFailed.size > VIDEO_LIMITS.CACHE_TRACKS * 4) preloadFailed.delete(preloadFailed.values().next().value);
                dbg("[SpoTUI-video]", "preload-failed", { uri, message: describeError(e) });
            }
        )
        .then(() => {
            if (preloadJob === job) preloadJob = null;
        });
    preloadJob = job;
}

// ---- reduced motion --------------------------------------------------------

function onMotionChange(ev) {
    const next = Boolean(ev && typeof ev.matches === "boolean" ? ev.matches : motionQuery && motionQuery.matches);
    if (next === reducedMotion) return;
    reducedMotion = next;
    if (!running) return;
    if (stillMode()) {
        stopQualitySampler();
        for (const media of slots) showStill(media.video);
        if (current && !wallpaperFaded) coverWallpaper(current); // no fade left to wait for
    } else if (current && current.video && isVisible()) {
        playVideo(current.video);
        startQualitySampler();
    }
}

function watchMotion() {
    reducedMotion = false;
    motionQuery = null;
    try {
        if (typeof window.matchMedia !== "function") return;
        const q = window.matchMedia("(prefers-reduced-motion: reduce)");
        if (!q) return;
        reducedMotion = Boolean(q.matches);
        if (typeof q.addEventListener === "function") q.addEventListener("change", onMotionChange);
        else if (typeof q.addListener === "function") q.addListener(onMotionChange);
        motionQuery = q;
    } catch (e) {
        motionQuery = null;
    }
}

function unwatchMotion() {
    try {
        if (motionQuery) {
            if (typeof motionQuery.removeEventListener === "function") motionQuery.removeEventListener("change", onMotionChange);
            else if (typeof motionQuery.removeListener === "function") motionQuery.removeListener(onMotionChange);
        }
    } catch (e) {}
    motionQuery = null;
    reducedMotion = false;
}

// ---- player + visibility ---------------------------------------------------

function readPlayer() {
    const d = Spicetify.Player && Spicetify.Player.data;
    return {
        item: (d && d.item) || null,
        isPaused: d ? Boolean(d.isPaused) : true, // never isBuffering
        visible: isVisible(),
    };
}

function playingUri() {
    const d = Spicetify.Player && Spicetify.Player.data;
    return d && d.item && typeof d.item.uri === "string" ? d.item.uri : null;
}

// A skip to another track aborts a preload that is not for it; the natural
// advance to the preloaded track lets it finish (the load joins it).
function onTrackChange(uri) {
    cancel(preloadTimer);
    preloadTimer = null;
    if (preloadJob && preloadJob.uri !== uri) abortPreload();
}

function onPoke() {
    if (!controller) return;
    const uri = playingUri();
    if (uri !== lastUri) {
        lastUri = uri;
        onTrackChange(uri);
    }
    controller.poke();
}

function onVisibility() {
    if (!running) return;
    const v = isVisible();
    if (v === lastVisible) return;
    lastVisible = v;
    if (!v) {
        for (const media of slots) pauseVideo(media.video);
        stopQualitySampler();
        cancel(preloadTimer);
        preloadTimer = null;
        abortPreload();
    } else if (current) {
        if (!stillMode()) playVideo(current.video);
        schedulePreload();
        startQualitySampler();
    }
    onPoke();
}

function makeController() {
    return createController({
        now: () => Date.now(),
        setTimeout: (fn, ms) => setTimeout(fn, ms),
        clearTimeout: (id) => clearTimeout(id),
        readPlayer,
        resolve: resolveAdapter,
        load: loadAdapter,
        show,
        hide,
        resume,
        release,
        instant: () => reducedMotion,
        transientNone,
        log: (code, detail) => dbg("[SpoTUI-video]", code, detail),
    });
}

// ---- enable / disable ------------------------------------------------------

function mountLayer(tui) {
    const stale = document.getElementById(LAYER_ID);
    if (stale) stale.remove();
    layer = document.createElement("div");
    layer.id = LAYER_ID;
    layer.setAttribute("aria-hidden", "true");
    // After #spotui-wallpaper (always prepended) at the same z: paints over it.
    tui.appendChild(layer);
}

function start(tui) {
    starting = false;
    mountLayer(tui);
    controller = makeController();
    lastVisible = isVisible();
    lastUri = playingUri();
    watchMotion();
    Spicetify.Player.addEventListener("songchange", onPoke);
    Spicetify.Player.addEventListener("onplaypause", onPoke);
    pollTimer = setInterval(onPoke, T.POLL_MS); // boot with empty Player.data, restored paused sessions
    document.addEventListener("visibilitychange", onVisibility);
    if (typeof MutationObserver === "function") {
        classObserver = new MutationObserver(onVisibility);
        classObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }
    running = true;
    controller.enable();
    controller.poke();
    dbg("[SpoTUI-video]", "enabled", { vp9: vp9Supported() });
}

function attemptStart() {
    startTimer = null;
    if (!starting) return;
    const tui = document.getElementById("spotui-tui");
    const player = window.Spicetify && Spicetify.Player;
    if (tui && player && typeof player.addEventListener === "function") {
        start(tui);
        return;
    }
    if (++startTries >= ENABLE_MAX_TRIES) {
        starting = false;
        gaveUp = true;
        dbg("[SpoTUI-video]", "gave up waiting for the interface (retry with tui -video on)");
        return;
    }
    startTimer = after(ENABLE_WAIT_MS, attemptStart);
}

function setOnClass(on) {
    if (!document.body) return;
    if (on) document.body.classList.add(BODY_ON_CLASS);
    else document.body.classList.remove(BODY_ON_CLASS);
}

// A later enable (tui -video on, or any refresh while the key is on) starts from scratch.
function enable() {
    if (running || starting) return;
    starting = true;
    gaveUp = false;
    startTries = 0;
    setOnClass(true);
    attemptStart();
}

function disable() {
    starting = false;
    gaveUp = false;
    setOnClass(false);
    cancel(startTimer);
    startTimer = null;
    if (running) {
        running = false;
        try {
            Spicetify.Player.removeEventListener("songchange", onPoke);
            Spicetify.Player.removeEventListener("onplaypause", onPoke);
        } catch (e) {}
        clearInterval(pollTimer);
        pollTimer = null;
        document.removeEventListener("visibilitychange", onVisibility);
        if (classObserver) classObserver.disconnect();
        classObserver = null;
        if (controller) controller.disable(); // aborts in-flight work, hides, releases
        controller = null;
    }
    abortPreload();
    unwatchMotion();
    cancelAll();
    preloadTimer = null;
    qualityTimer = null;
    qualitySample = null;
    for (const media of Array.from(slots)) release(media);
    current = null;
    wpTimer = null;
    wallpaperFaded = false;
    setShowingClass(false);
    resumeWallpaper();
    if (layer) layer.remove();
    layer = null;
    cache.clear();
    negCache.clear();
    preloadFailed.clear();
    // Session state (quality guard, circuit breaker) starts over with the next enable.
    penalty = 0;
    frozen = false;
    failStreak = 0;
    failUris.clear();
    degradedUntil = 0;
    halfOpen = false;
    degradedSkip = null;
    lastUri = null;
    offsetMode = false;
}

// ---- public API ------------------------------------------------------------

// Boot: does nothing unless the saved look has video mode on.
export function initVideoMode() {
    if (window.__spotuiVideoInit) return;
    window.__spotuiVideoInit = true;
    refreshVideoMode();
}

// Make the running state follow the stored key. Idempotent.
export function refreshVideoMode() {
    if (isOn()) enable();
    else disable();
}

export function setVideoMode(arg) {
    const a = String(arg || "").toLowerCase();
    if (a !== "on" && a !== "off" && a !== "toggle") return false;
    const on = a === "toggle" ? !isOn() : a === "on";
    if (on) {
        if (!storageSet(VIDEO_MODE_KEY, "1")) {
            pinToast("video mode: could not save the setting (storage full?)");
            return false;
        }
    } else {
        storageRemove(VIDEO_MODE_KEY);
    }
    refreshVideoMode();
    if (on) {
        pinToast(
            "video mode on — while a song plays, its Spotify Canvas replaces your background" +
                (vp9Supported() ? "" : "\n(video Canvases can't play in this Spotify build — still Canvases only)")
        );
    } else {
        pinToast("video mode off — your background is back");
    }
    return true;
}

export function videoModeStatus() {
    if (!isOn()) return "video mode off (tui -video on)";
    if (!running || !controller) {
        return gaveUp ? "video mode ON · interface not found — run tui -video on again" : "video mode ON · starting…";
    }
    const s = controller.status();
    let why;
    switch (s.reason) {
        case "showing":
            if (!current) why = "loading Canvas…";
            else if (current.kind === "image") why = "showing this song's still Canvas";
            else if (reducedMotion) why = "showing this song's Canvas as a still (reduced motion)";
            else if (frozen) why = "showing this song's Canvas as a still (performance)";
            else why = `showing this song's Canvas (${current.profileShort || current.profileH}p)`;
            break;
        case "loading":
            why = "loading Canvas…";
            break;
        case "no-canvas":
            if (skippedByBreaker(s.uri)) why = "video Canvases unavailable right now — still Canvases only";
            else {
                why = vp9Supported()
                    ? "this song has no Canvas — your background stays"
                    : "video Canvases can't play in this Spotify build — still Canvases only";
            }
            break;
        case "unsupported":
            why = "ads, podcasts and local files have no Canvas";
            break;
        case "hidden":
            why = "hidden (Spotify mode / standby / minimised)";
            break;
        case "error":
            why = "Canvas failed to load — background stays (tui -debug on for details)";
            break;
        default:
            why = "paused — your background is back";
    }
    return `video mode ON · ${why}`;
}

export function reportVideoMode() {
    const line = videoModeStatus();
    pinToast(line);
    console.log("[SpoTUI] " + line);
}
