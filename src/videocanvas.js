// Video mode, pure core: Spotify Canvas parsing, profile choice, item
// classification, an LRU byte cache and the timer-driven controller.
// Self-contained: no dependencies, no DOM, no Spicetify. Everything
// environmental arrives through `deps`, so the whole module runs under Node.
// Every input is untrusted: each function returns null (or undefined where
// documented) on a shape mismatch and never throws.

export const VIDEO_TIMING = Object.freeze({
    PAUSE_GRACE_MS: 1500,
    SWAP_WAIT_MS: 1500,
    POLL_MS: 2000,
    FADE_IN_MS: 600,
    CROSSFADE_MS: 600,
    FADE_OUT_MS: 800,
    MANIFEST_TIMEOUT_MS: 8000,
    SEGMENTS_TIMEOUT_MS: 15000,
    LOOKUP_TIMEOUT_MS: 8000,
    RETRY_DELAY_MS: 2000,
    FAILED_RETRY_AFTER_MS: 10 * 60 * 1000,
    DEGRADE_MS: 30 * 60 * 1000,
    PRELOAD_DELAY_MS: 3000,
    QUALITY_SAMPLE_MS: 10000,
});

export const VIDEO_LIMITS = Object.freeze({
    MAX_PROFILE_SHORT_SIDE: 720,
    MAX_SEGMENTS: 8,
    MAX_TRACK_BYTES: 12 * 1024 * 1024,
    CACHE_TRACKS: 3,
    CACHE_BYTES: 24 * 1024 * 1024,
    NEGATIVE_CACHE: 300,
    FAIL_LIMIT: 4,
    MAX_PENALTY: 2,
    DROP_RATIO: 0.1,
    FREEZE_DROP_RATIO: 0.2,
    MIN_FRAMES: 100,
});

export const VIDEO_DIM = 0.6;
export const CANVAS_MANIFEST_BASE = "https://spclient.wg.spotify.com/manifests/v9/json/sources/";
export const VP9_MIME = 'video/webm; codecs="vp9"';

// video-fa.scdn.co, i.scdn.co, canvaz.scdn.co and the second CDN video-cf.spotifycdn.com
const MEDIA_HOST_REGEX = /^(?:[a-z0-9-]+\.)*(?:scdn\.co|spotifycdn\.com)$/i;
const FILE_ID_REGEX = /^[A-Za-z0-9_-]{8,128}$/;
const IMAGE_ID_REGEX = /^[0-9a-f]{40}$/i;
const FILE_TYPE_REGEX = /^[a-z0-9]{1,8}$/i;
const MAX_URL_LENGTH = 2000;
const MAX_TEMPLATE_LENGTH = 1000;
const MAX_PROFILE_ENTRIES = 256;
const MAX_BASE_URLS = 16;
const MAX_SEGMENT_LENGTH_SEC = 60;
const MAX_DIMENSION = 16384;
const MAX_PROFILE_ID = 9999;
// image_url (300 px) first: plenty behind a 32 px blur and the lightest download.
const ART_KEYS = ["image_url", "image_large_url", "image_xlarge_url", "image_small_url"];
const VIDEO_TYPES = ["VIDEO", "VIDEO_LOOPING", "VIDEO_LOOPING_RANDOM"];
const IMAGE_TYPES = ["IMAGE", "GIF"];

// Own, non-inherited property read: a polluted Object.prototype or a JSON
// "__proto__" key can never feed a field we look up by name.
function own(o, key) {
    if (o === null || typeof o !== "object") return undefined;
    return Object.prototype.hasOwnProperty.call(o, key) ? o[key] : undefined;
}

function isPlainObject(o) {
    return o !== null && typeof o === "object" && !Array.isArray(o);
}

// Parsed URL or null. Only https on a Spotify CDN host, no credentials, no
// custom port, no whitespace/quote/angle/backslash characters.
function checkUrl(s) {
    if (typeof s !== "string" || s.length === 0 || s.length > MAX_URL_LENGTH) return null;
    if (/[\u0000- "<>\\\u007f]/.test(s)) return null;
    let u;
    try {
        u = new URL(s);
    } catch (e) {
        return null;
    }
    if (u.protocol !== "https:") return null;
    if (u.username || u.password || u.port) return null;
    if (!MEDIA_HOST_REGEX.test(u.hostname)) return null;
    return u;
}

export function safeMediaUrl(s) {
    const u = checkUrl(s);
    if (!u) return null;
    const href = u.href;
    return href.length <= MAX_URL_LENGTH ? href : null;
}

export function spotifyImageToUrl(v) {
    if (typeof v !== "string") return null;
    if (v.startsWith("spotify:image:")) {
        const id = v.slice("spotify:image:".length);
        return IMAGE_ID_REGEX.test(id) ? "https://i.scdn.co/image/" + id : null;
    }
    const u = checkUrl(v);
    if (!u || u.hostname.toLowerCase() !== "i.scdn.co" || u.search || u.hash) return null;
    return /^\/image\/[0-9a-f]{40}$/i.test(u.pathname) ? u.href : null;
}

export function artUrlFromMetadata(meta) {
    if (!isPlainObject(meta)) return null;
    for (const key of ART_KEYS) {
        const url = spotifyImageToUrl(own(meta, key));
        if (url) return url;
    }
    return null;
}

// "none" | "ad" | "episode" | "local" | "track" | "other"
export function classifyItem(item) {
    if (!isPlainObject(item)) return "none";
    const meta = isPlainObject(own(item, "metadata")) ? own(item, "metadata") : {};
    const uri = typeof own(item, "uri") === "string" ? own(item, "uri") : "";
    const type = own(item, "type");
    const mediaType = own(item, "mediaType");
    if (type === "ad" || own(meta, "is_advertisement") === "true" || uri.startsWith("spotify:ad:")) return "ad";
    if (
        type === "episode" ||
        (typeof mediaType === "string" && mediaType !== "audio") ||
        uri.startsWith("spotify:episode:")
    ) {
        return "episode";
    }
    if (uri.startsWith("spotify:local:")) return "local";
    if (uri.startsWith("spotify:track:")) return "track";
    return "other";
}

// Canvas shape: { kind: "video", fileId, artUrl } | { kind: "image", imageUrl, artUrl }.
export function normalizeCanvas(raw, artUrl) {
    if (!isPlainObject(raw)) return null;
    const type = own(raw, "type");
    if (typeof type !== "string") return null;
    const art = typeof artUrl === "string" ? safeMediaUrl(artUrl) : null;
    if (VIDEO_TYPES.includes(type)) {
        const fileId = own(raw, "fileId");
        // The .cnvs.mp4 `url` is ignored on purpose: it is H.264 and cannot be played here.
        if (typeof fileId !== "string" || !FILE_ID_REGEX.test(fileId)) return null;
        return { kind: "video", fileId, artUrl: art };
    }
    if (IMAGE_TYPES.includes(type)) {
        const imageUrl = safeMediaUrl(own(raw, "url"));
        if (!imageUrl) return null;
        return { kind: "image", imageUrl, artUrl: art };
    }
    return null;
}

// Reads the flat `canvas.*` keys of a player item's metadata.
// undefined: no `canvas.url` key (unknown, ask GraphQL). null: keys present but invalid.
export function canvasFromMetadata(meta) {
    if (!isPlainObject(meta)) return undefined;
    if (own(meta, "canvas.url") === undefined) return undefined;
    return normalizeCanvas(
        { type: own(meta, "canvas.type"), url: own(meta, "canvas.url"), fileId: own(meta, "canvas.fileId") },
        artUrlFromMetadata(meta)
    );
}

// resp = { data: { trackUnion: { canvas: { fileId, type, uri, url } | null } } }
export function canvasFromGraphQL(resp, artUrl) {
    const canvas = own(own(own(resp, "data"), "trackUnion"), "canvas");
    if (!canvas) return null;
    return normalizeCanvas(canvas, artUrl);
}

function posInt(n, max) {
    return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= max ? n : null;
}

function isVp9Webm(p) {
    const fileType = own(p, "file_type");
    const mime = own(p, "mime_type");
    const codec = own(p, "video_codec");
    const webm =
        (typeof fileType === "string" && fileType.toLowerCase() === "webm") ||
        (typeof mime === "string" && mime.toLowerCase() === "video/webm");
    const vp9 = typeof codec === "string" && /^vp0?9(\.|$)/i.test(codec);
    return webm && vp9;
}

function nonEmpty(v) {
    if (v === undefined || v === null || v === false) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.keys(v).length > 0;
    return true;
}

// Real shape (verified against live manifests):
//   { contents: [{ segment_length, end_time_millis, encryption_infos, profiles: [
//       { id, file_type, mime_type, video_codec, video_width, video_height, ... }] }],
//     end_time_millis, base_urls: [..], initialization_template, segment_template }
// Returns { profiles: [{ id, width, height, fileType }] (VP9 WebM, height ascending),
// segLenSec, endMs, baseUrls (every valid CDN base, in order), initTpl, segTpl } or null.
export function parseCanvasManifest(json) {
    try {
        if (!isPlainObject(json)) return null;
        const contents = own(json, "contents");
        const c = Array.isArray(contents) ? contents[0] : json;
        if (!isPlainObject(c)) return null;
        if (nonEmpty(own(c, "encryption_infos")) || nonEmpty(own(json, "encryption_infos"))) return null;

        const segLenSec = posInt(own(c, "segment_length") ?? own(json, "segment_length"), MAX_SEGMENT_LENGTH_SEC);
        const endRaw = own(json, "end_time_millis") ?? own(c, "end_time_millis");
        if (segLenSec === null || typeof endRaw !== "number" || !Number.isFinite(endRaw) || endRaw <= 0) return null;
        const endMs = endRaw;
        if (Math.ceil(endMs / 1000 / segLenSec) > VIDEO_LIMITS.MAX_SEGMENTS) return null;

        const rawProfiles = own(c, "profiles") ?? own(json, "profiles");
        if (!Array.isArray(rawProfiles) || rawProfiles.length > MAX_PROFILE_ENTRIES) return null;
        const profiles = [];
        for (const p of rawProfiles) {
            if (!isPlainObject(p) || !isVp9Webm(p)) continue;
            if (own(p, "encrypted") === true || nonEmpty(own(p, "encryption_info")) || nonEmpty(own(p, "encryption_infos"))) {
                return null;
            }
            const id = own(p, "id");
            const width = own(p, "video_width");
            const height = own(p, "video_height");
            const fileType = own(p, "file_type");
            if (typeof id !== "number" || !Number.isInteger(id) || id < 0 || id > MAX_PROFILE_ID) continue;
            if (!posInt(width, MAX_DIMENSION) || !posInt(height, MAX_DIMENSION)) continue;
            if (typeof fileType !== "string" || !FILE_TYPE_REGEX.test(fileType)) continue;
            profiles.push({ id, width, height, fileType: fileType.toLowerCase() });
        }
        if (profiles.length === 0) return null;
        profiles.sort((a, b) => a.height - b.height || a.width - b.width || a.id - b.id);

        const initTpl = own(json, "initialization_template") ?? own(c, "initialization_template");
        const segTpl = own(json, "segment_template") ?? own(c, "segment_template");
        if (typeof initTpl !== "string" || initTpl.length === 0 || initTpl.length > MAX_TEMPLATE_LENGTH) return null;
        if (typeof segTpl !== "string" || segTpl.length === 0 || segTpl.length > MAX_TEMPLATE_LENGTH) return null;
        if (!segTpl.includes("{{segment_timestamp}}")) return null;

        // Fixtures list two CDN hosts (video-fa.scdn.co, video-cf.spotifycdn.com):
        // keep every valid one, in order; the loader falls back to the next.
        const bases = own(json, "base_urls") ?? own(c, "base_urls");
        if (!Array.isArray(bases)) return null;
        const baseUrls = [];
        for (const b of bases.slice(0, MAX_BASE_URLS)) {
            const href = safeMediaUrl(b);
            if (!href) continue;
            const withSlash = href.endsWith("/") ? href : href + "/";
            if (!baseUrls.includes(withSlash)) baseUrls.push(withSlash);
        }
        if (baseUrls.length === 0) return null;
        return { profiles, segLenSec, endMs, baseUrls, initTpl, segTpl };
    } catch (e) {
        return null;
    }
}

// { init, segments: [url...] } or null. The signed query string inside the
// templates is kept byte for byte: only the {{...}} placeholders change, and the
// result is validated for protocol, host, length and leftover "{{".
export function segmentUrls(manifest, profile, baseIndex = 0) {
    try {
        if (!isPlainObject(manifest) || !isPlainObject(profile)) return null;
        const { segLenSec, endMs, baseUrls, initTpl, segTpl } = manifest;
        if (!Array.isArray(baseUrls) || !Number.isInteger(baseIndex) || baseIndex < 0 || baseIndex >= baseUrls.length) return null;
        const baseUrl = baseUrls[baseIndex];
        const id = profile.id;
        const fileType = profile.fileType;
        if (typeof id !== "number" || !Number.isInteger(id) || id < 0 || id > MAX_PROFILE_ID) return null;
        if (typeof fileType !== "string" || !FILE_TYPE_REGEX.test(fileType)) return null;
        if (posInt(segLenSec, MAX_SEGMENT_LENGTH_SEC) === null) return null;
        if (typeof endMs !== "number" || !Number.isFinite(endMs) || endMs <= 0) return null;
        if (typeof initTpl !== "string" || typeof segTpl !== "string" || typeof baseUrl !== "string") return null;
        const base = checkUrl(baseUrl);
        if (!base) return null;
        const prefix = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";

        const fill = (tpl, ts) => {
            const path = tpl
                .split("{{profile_id}}")
                .join(String(id))
                .split("{{file_type}}")
                .join(fileType)
                .split("{{segment_timestamp}}")
                .join(String(ts))
                .replace(/^\/+/, "");
            if (path.includes("{{")) return null;
            const full = prefix + path;
            const u = checkUrl(full);
            if (!u || u.hostname !== base.hostname) return null;
            return full;
        };

        const count = Math.ceil(endMs / 1000 / segLenSec);
        if (count < 1 || count > VIDEO_LIMITS.MAX_SEGMENTS) return null;
        const init = fill(initTpl, 0);
        if (init === null) return null;
        const segments = [];
        // Whole-second timestamps 0, L, 2L, ... while t * 1000 < endMs.
        for (let t = 0; t * 1000 < endMs; t += segLenSec) {
            if (segments.length >= VIDEO_LIMITS.MAX_SEGMENTS) return null;
            const url = fill(segTpl, t);
            if (url === null) return null;
            segments.push(url);
        }
        return { init, segments };
    } catch (e) {
        return null;
    }
}

// Height in CSS px a clip of clipW x clipH is displayed at inside a layerW x layerH
// box with object-fit: contain. Any invalid input falls back to layerH (and to 0
// when the layer itself is invalid).
export function displayedHeight(layerW, layerH, clipW, clipH) {
    const ok = (n) => typeof n === "number" && Number.isFinite(n) && n > 0;
    if (!ok(layerH)) return 0;
    if (!ok(layerW) || !ok(clipW) || !ok(clipH)) return layerH;
    const aspect = clipW / clipH;
    return Math.min(layerH, layerW / aspect);
}

// profiles: [{ id, width, height, fileType }]. Drops profiles whose SHORT side is
// over the cap (orientation-neutral: 1080x720 and 720x1080 weigh the same),
// takes the first with height >= targetHeight (else the largest left), then
// steps down `penalty` positions.
export function chooseProfile(profiles, opts) {
    try {
        if (!Array.isArray(profiles)) return null;
        const target = opts && Number.isFinite(opts.targetHeight) ? opts.targetHeight : 0;
        const rawPenalty = opts && Number.isFinite(opts.penalty) ? Math.floor(opts.penalty) : 0;
        const penalty = Math.max(0, rawPenalty);
        const usable = profiles
            .filter(
                (p) =>
                    isPlainObject(p) &&
                    Number.isFinite(p.width) &&
                    Number.isFinite(p.height) &&
                    Math.min(p.width, p.height) <= VIDEO_LIMITS.MAX_PROFILE_SHORT_SIDE
            )
            .slice(0, MAX_PROFILE_ENTRIES)
            .sort((a, b) => a.height - b.height);
        if (usable.length === 0) return null;
        let idx = usable.findIndex((p) => p.height >= target);
        if (idx < 0) idx = usable.length - 1;
        return usable[Math.max(0, idx - penalty)];
    } catch (e) {
        return null;
    }
}

// Time allowed for all segments of one clip: the base budget up to a 480 short
// side, half again for the 720 profile (about twice the bytes).
export function segmentsTimeoutMs(profile) {
    const w = profile && Number.isFinite(profile.width) ? profile.width : 0;
    const h = profile && Number.isFinite(profile.height) ? profile.height : 0;
    const short = Math.min(w, h);
    return short > 480 ? Math.round(VIDEO_TIMING.SEGMENTS_TIMEOUT_MS * 1.5) : VIDEO_TIMING.SEGMENTS_TIMEOUT_MS;
}

// Byte-bounded LRU. get() refreshes recency; set() evicts the oldest entries
// until both caps hold. A value larger than maxBytes (or an invalid size) is
// rejected: set() returns false and nothing is evicted or replaced.
export function createLru(maxItems, maxBytes) {
    const map = new Map(); // key -> { value, bytes }, insertion order = recency
    let total = 0;
    const itemCap = Number.isFinite(maxItems) ? maxItems : 0;
    const byteCap = Number.isFinite(maxBytes) ? maxBytes : 0;
    return {
        get(key) {
            const e = map.get(key);
            if (!e) return undefined;
            map.delete(key);
            map.set(key, e);
            return e.value;
        },
        set(key, value, bytes) {
            if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return false;
            if (bytes > byteCap || itemCap < 1) return false;
            const old = map.get(key);
            if (old) {
                total -= old.bytes;
                map.delete(key);
            }
            map.set(key, { value, bytes });
            total += bytes;
            while (map.size > itemCap || total > byteCap) {
                const oldest = map.keys().next();
                if (oldest.done) break;
                total -= map.get(oldest.value).bytes;
                map.delete(oldest.value);
            }
            return true;
        },
        delete(key) {
            const e = map.get(key);
            if (!e) return false;
            total -= e.bytes;
            return map.delete(key);
        },
        clear() {
            map.clear();
            total = 0;
        },
        bytes() {
            return total;
        },
        size() {
            return map.size;
        },
    };
}

// Controller. deps: { now, setTimeout, clearTimeout, readPlayer, resolve, load,
// show, hide, resume, release, log }. See the state table in the build plan.
// Phases: off | idle | resolving | loading | showing | fading.
// Reasons: waiting | unsupported | no-canvas | loading | showing | error | hidden.
export function createController(deps) {
    const T = VIDEO_TIMING;
    let enabled = false;
    let phase = "off";
    let reason = "waiting";
    let targetUri = null;
    let shown = null; // { uri, media }
    let kept = null; // { uri, media }: hidden but alive, for a resume without reload
    const settled = new Map(); // uri -> { result: "none" | "error", at }
    let gen = 0;
    let inflight = false;
    let abort = null;
    let graceTimer = null;
    let swapTimer = null;
    let fadeTimer = null;
    const timers = new Map(); // timer id -> cancel callback (or null)

    function call(name, ...args) {
        try {
            return deps[name](...args);
        } catch (e) {
            try {
                deps.log("dep-error", { name, message: String((e && e.message) || e).slice(0, 200) });
            } catch (e2) {
                // nothing left to report to
            }
            return undefined;
        }
    }

    function later(ms, fn, onCancel) {
        const id = deps.setTimeout(() => {
            timers.delete(id);
            fn();
        }, ms);
        timers.set(id, onCancel || null);
        return id;
    }

    function cancelTimer(id) {
        if (id === null) return;
        if (timers.has(id)) {
            timers.delete(id);
            call("clearTimeout", id);
        }
    }

    function newAbort() {
        if (typeof AbortController === "function") return new AbortController();
        const signal = { aborted: false };
        return {
            signal,
            abort() {
                signal.aborted = true;
            },
        };
    }

    function cancelInflight() {
        gen++;
        inflight = false;
        if (abort) {
            try {
                abort.abort();
            } catch (e) {
                // already aborted
            }
            abort = null;
        }
    }

    // Reduced motion: the CSS transitions are off, so nothing waits for a fade.
    function instant() {
        try {
            return Boolean(deps.instant && deps.instant());
        } catch (e) {
            return false;
        }
    }

    function releaseLater(media, ms) {
        if (instant()) {
            call("release", media);
            return;
        }
        later(ms, () => call("release", media), () => call("release", media));
    }

    // until: epoch ms after which a "none" is asked again (a transient "none",
    // e.g. video Canvases switched off by the circuit breaker). 0 = for good.
    function setSettled(uri, result, until = 0) {
        settled.delete(uri);
        settled.set(uri, { result, at: deps.now(), until });
        while (settled.size > VIDEO_LIMITS.NEGATIVE_CACHE) {
            const oldest = settled.keys().next();
            if (oldest.done) break;
            settled.delete(oldest.value);
        }
    }

    function readNow() {
        let p = null;
        try {
            p = deps.readPlayer();
        } catch (e) {
            p = null;
        }
        const item = p && p.item ? p.item : null;
        const cls = classifyItem(item);
        const visible = Boolean(p && p.visible);
        const paused = p ? Boolean(p.isPaused) : true;
        const uri = item && typeof item.uri === "string" ? item.uri : null;
        const want = visible && !paused && cls === "track" && uri ? uri : null;
        let idleReason = "waiting";
        if (!visible) idleReason = "hidden";
        else if (cls === "ad" || cls === "episode" || cls === "local" || cls === "other") idleReason = "unsupported";
        return { want, idleReason };
    }

    // Fade the shown media away. keep: hidden but resumable (pause / hidden window);
    // otherwise it is released once the fade-out is over.
    function fadeAway(keep, why) {
        if (!shown) return;
        const old = shown;
        shown = null;
        call("hide");
        if (keep) {
            if (kept && kept.media !== old.media) call("release", kept.media);
            kept = old;
        } else {
            releaseLater(old.media, T.FADE_OUT_MS);
        }
        reason = why;
        cancelTimer(fadeTimer);
        fadeTimer = null;
        if (instant()) {
            phase = inflight ? "resolving" : "idle";
            return;
        }
        phase = "fading";
        fadeTimer = later(T.FADE_OUT_MS, () => {
            fadeTimer = null;
            if (phase === "fading") phase = inflight ? "resolving" : "idle";
        });
    }

    function onGrace() {
        graceTimer = null;
        if (!enabled) return;
        const { want, idleReason } = readNow();
        if (want !== null) {
            poke();
            return;
        }
        if (shown) fadeAway(true, idleReason);
        if (idleReason === "unsupported" && inflight) {
            cancelInflight();
            targetUri = null;
        }
    }

    function onSwapWait() {
        swapTimer = null;
        if (!enabled || !shown) return;
        if (targetUri !== null && shown.uri !== targetUri) fadeAway(false, "loading");
    }

    // The wanted track's clip is already alive in `kept` (it loaded while the
    // player had moved on): use it, no resolve and no load. The adapter answers
    // `false` when the media is gone (its slot was removed): then it is released
    // and the caller loads the track the normal way.
    function useKept() {
        const k = kept;
        kept = null;
        const old = shown;
        const done = old ? call("show", k.media, { crossfade: true }) : call("resume", k.media);
        if (done === false) {
            call("release", k.media);
            return false;
        }
        if (old) releaseLater(old.media, T.CROSSFADE_MS);
        shown = k;
        targetUri = k.uri;
        phase = "showing";
        reason = "showing";
        return true;
    }

    function onLoaded(uri, media) {
        cancelTimer(swapTimer);
        swapTimer = null;
        const { want, idleReason } = readNow();
        if (want === uri) {
            const old = shown;
            if (call("show", media, { crossfade: Boolean(old) }) === false) {
                // The slot vanished under us: not "showing". The next poke loads it again.
                call("release", media);
                reason = "loading";
                phase = shown ? "showing" : "idle";
                return;
            }
            if (old) releaseLater(old.media, T.CROSSFADE_MS);
            if (kept) {
                call("release", kept.media);
                kept = null;
            }
            shown = { uri, media };
            cancelTimer(graceTimer);
            graceTimer = null;
            phase = "showing";
            reason = "showing";
            return;
        }
        // The player moved on (pause, hidden window, another track): keep it paused.
        if (kept && kept.media !== media) call("release", kept.media);
        kept = { uri, media };
        phase = shown ? "showing" : "idle";
        if (!shown) reason = idleReason;
        poke();
    }

    async function run(myGen, uri, signal) {
        try {
            const canvas = await deps.resolve(uri, signal);
            if (myGen !== gen) return;
            if (!canvas) {
                inflight = false;
                const until = deps.transientNone ? Number(call("transientNone", uri)) : 0;
                setSettled(uri, "none", Number.isFinite(until) && until > 0 ? until : 0);
                cancelTimer(swapTimer);
                swapTimer = null;
                reason = "no-canvas";
                phase = "idle";
                if (shown) fadeAway(false, "no-canvas");
                return;
            }
            phase = "loading";
            const media = await deps.load(canvas, uri, signal);
            if (myGen !== gen) {
                if (media) call("release", media);
                return;
            }
            inflight = false;
            if (!media) throw new Error("empty-media");
            onLoaded(uri, media);
        } catch (e) {
            if (myGen !== gen || (signal && signal.aborted)) return;
            inflight = false;
            if (e && e.retryLater) {
                // Not this track's fault (no free slot): no error entry, the next poke asks again.
                call("log", "load-deferred", { uri, message: String(e.message || e).slice(0, 200) });
                cancelTimer(swapTimer);
                swapTimer = null;
                reason = "loading";
                phase = shown ? "showing" : "idle";
                return;
            }
            setSettled(uri, "error");
            call("log", "load-failed", { uri, message: String((e && e.message) || e).slice(0, 200) });
            cancelTimer(swapTimer);
            swapTimer = null;
            reason = "error";
            phase = "idle";
            if (shown) fadeAway(false, "error");
        }
    }

    function start(want) {
        cancelInflight();
        abort = newAbort();
        inflight = true;
        const myGen = gen;
        // A kept clip of the wanted track never gets here (poke uses it); any other is dead weight.
        if (kept) {
            call("release", kept.media);
            kept = null;
        }
        cancelTimer(swapTimer);
        swapTimer = null;
        if (shown) swapTimer = later(T.SWAP_WAIT_MS, onSwapWait);
        targetUri = want;
        phase = "resolving";
        reason = "loading";
        run(myGen, want, abort.signal).catch(() => {});
    }

    function poke() {
        if (!enabled) return;
        const { want, idleReason } = readNow();

        if (want === null) {
            if (shown) {
                if (graceTimer === null) graceTimer = later(T.PAUSE_GRACE_MS, onGrace);
                return;
            }
            reason = idleReason;
            if (idleReason === "unsupported" && inflight) {
                cancelInflight();
                targetUri = null;
            }
            if (!inflight && phase !== "fading") phase = "idle";
            return;
        }

        cancelTimer(graceTimer);
        graceTimer = null;

        if (shown && shown.uri === want) {
            if (inflight) cancelInflight();
            cancelTimer(swapTimer);
            swapTimer = null;
            targetUri = want;
            phase = "showing";
            reason = "showing";
            return;
        }

        if (kept && kept.uri === want) {
            if (inflight) cancelInflight();
            cancelTimer(swapTimer);
            swapTimer = null;
            if (useKept()) return;
            // The kept media was gone: fall through to a normal load of this track.
        }

        const s = settled.get(want);
        const retry = s && ((s.result === "error" && deps.now() - s.at >= T.FAILED_RETRY_AFTER_MS) || (s.until > 0 && deps.now() >= s.until));
        if (retry) {
            settled.delete(want);
        } else if (s) {
            if (inflight && targetUri !== want) cancelInflight();
            targetUri = want;
            cancelTimer(swapTimer);
            swapTimer = null;
            if (shown) fadeAway(false, s.result === "none" ? "no-canvas" : "error");
            else {
                reason = s.result === "none" ? "no-canvas" : "error";
                if (!inflight && phase !== "fading") phase = "idle";
            }
            return;
        }

        if (inflight && targetUri === want) return;
        start(want);
    }

    function enable() {
        if (enabled) return;
        enabled = true;
        phase = "idle";
        reason = "waiting";
        poke();
    }

    function disable() {
        const wasShown = shown;
        const wasKept = kept;
        enabled = false;
        cancelInflight();
        for (const [id, onCancel] of Array.from(timers.entries())) {
            timers.delete(id);
            call("clearTimeout", id);
            if (onCancel) onCancel();
        }
        graceTimer = null;
        swapTimer = null;
        fadeTimer = null;
        shown = null;
        kept = null;
        if (wasShown) {
            call("hide");
            call("release", wasShown.media);
        }
        if (wasKept) call("release", wasKept.media);
        settled.clear();
        targetUri = null;
        phase = "off";
        reason = "waiting";
    }

    function status() {
        return { enabled, phase, reason, uri: targetUri };
    }

    return { enable, disable, poke, status };
}
