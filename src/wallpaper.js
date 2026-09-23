import { WP_FIT_KEY, WP_OPACITY_KEY, WP_POS_KEY, WP_RICH_KEY, WP_URL_KEY } from "./constants.js";
import { reassertPosterLayer } from "./posters.js";
import { storageSet } from "./storage.js";

// Check if URL points to video file
export function isVideoWallpaperUrl(url) {
    try {
        const clean = String(url).split("?")[0].split("#")[0];
        return /\.(mp4|webm)$/i.test(clean);
    } catch (e) {
        return false;
    }
}

function dbgState(tag, wp, url) {
    try {
        console.log(`[SpoTUI-dbg] ${tag}`, {
            url,
            tag: wp && wp.tagName,
            src: wp && (wp.currentSrc || wp.src || wp.style.backgroundImage),
            networkState: wp && wp.networkState,
            readyState: wp && wp.readyState,
            videoSize: wp && wp.tagName === "VIDEO" ? `${wp.videoWidth}x${wp.videoHeight}` : "n/a",
            error: wp && wp.error ? { code: wp.error.code, message: wp.error.message } : null,
            canPlayWebm: document.createElement("video").canPlayType('video/webm; codecs="vp9, opus"'),
            canPlayMp4: document.createElement("video").canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"'),
        });
    } catch (e) {}
}

function explainFailure(url, wp) {
    const u = String(url);
    const hints = [];
    if (/^[A-Za-z]:\\/.test(u) || u.includes("\\")) hints.push("Windows path with backslashes will NOT load. Use file:///D:/path/file.webm with forward slashes, or better the same-origin URL below.");
    if (/\s/.test(u) && !/%20/.test(u)) hints.push("URL contains raw spaces. Encode as %20 or rename file to dashes.");
    if (/^file:\/\//i.test(u)) hints.push("file:// is often blocked by Spotify (Not allowed to load local resource). Prefer https://xpui.app.spotify.com/videos/lake-golden-hour.webm (already bundled on your machine).");
    if (/^http:\/\/(?!localhost|127\.0\.0\.1)/i.test(u)) hints.push("http:// (non-localhost) from Spotify's https:// origin is mixed-content and gets blocked. Use https:// URLs.");
    if (/\.mp4$/i.test(u.split("?")[0].split("#")[0])) hints.push(".mp4/H.264 is blocked in some Spotify builds. .webm/VP9 (like shimmer.webm) always works.");
    if (wp && wp.error) {
        const codes = { 1: "MEDIA_ERR_ABORTED", 2: "MEDIA_ERR_NETWORK (404/CORS/blocked)", 3: "MEDIA_ERR_DECODE (bad codec)", 4: "MEDIA_ERR_SRC_NOT_SUPPORTED (codec/URL blocked)" };
        hints.push(`MediaError ${wp.error.code} = ${codes[wp.error.code] || "unknown"}.`);
    }
    if (wp && wp.tagName === "VIDEO" && !wp.videoWidth) hints.push("No video frames decoded yet. If networkState=3 and readyState=0 after 4s, the src never loaded (blocked/404).");
    console.warn("[SpoTUI-dbg] likely cause(s):\n - " + (hints.length ? hints.join("\n - ") : "unknown, see state dump above."));
}

// Set background wallpaper (image or video) — debug instrumented.
// opts: { fit: cover|contain|fill|none, pos: css position, rich: 0-200 }.
export function setWallpaper(url, opacity, save = true, opts = {}) {
    console.log("[SpoTUI-dbg] setWallpaper called:", { url, opacity, save, ...opts });
    let tui = document.getElementById("spotui-tui");
    if (!tui) {
        console.warn("[SpoTUI-dbg] abort: #spotui-tui not found yet (Spotify still loading). Retry the command in a few seconds.");
        return;
    }

    const clean = String(url).split("?")[0].split("#")[0];
    const isVideo = isVideoWallpaperUrl(url);
    console.log("[SpoTUI-dbg] detect:", { clean, isVideo });
    if (!isVideo && /\.(mp4|webm)/i.test(String(url))) {
        console.warn("[SpoTUI-dbg] URL has video extension but with ?# suffix confusing detection. Clean:", clean);
    }
    if (/^[A-Za-z]:\\/.test(String(url))) {
        console.warn('[SpoTUI-dbg] Got a raw Windows path (C:\\...). The <video> src needs a URL. Use file:///D:/Ressources/Wallpapers/lake-golden-hour.webm or https://xpui.app.spotify.com/videos/lake-golden-hour.webm');
    }

    let wp = document.getElementById("spotui-wallpaper");

    if (wp && ((isVideo && wp.tagName !== "VIDEO") || (!isVideo && wp.tagName === "VIDEO"))) {
        console.log(`[SpoTUI-dbg] swapping element ${wp.tagName} -> ${isVideo ? "VIDEO" : "DIV"}`);
        wp.remove();
        wp = null;
    }

    if (!wp) {
        wp = document.createElement(isVideo ? "video" : "div");
        wp.id = "spotui-wallpaper";
        wp.style.position = "absolute";
        wp.style.top = "0";
        wp.style.left = "0";
        wp.style.width = "100%";
        wp.style.height = "100%";
        wp.style.zIndex = "-1";
        if (isVideo) {
            wp.muted = true;
            wp.autoplay = true;
            wp.loop = true;
            wp.playsInline = true;
            wp.controls = false;
            wp.referrerPolicy = "no-referrer";
            wp.setAttribute("muted", "");
            wp.setAttribute("autoplay", "");
            wp.setAttribute("loop", "");
            wp.setAttribute("playsinline", "");
            wp.setAttribute("referrerpolicy", "no-referrer");
            ["loadstart", "loadedmetadata", "loadeddata", "canplay", "canplaythrough", "playing", "waiting", "stalled", "suspend", "abort", "emptied"].forEach((ev) =>
                wp.addEventListener(ev, () => dbgState("video event: " + ev, wp, url))
            );
        }
        tui.prepend(wp);
        console.log(`[SpoTUI-dbg] created <${wp.tagName} id=spotui-wallpaper>`);
    } else {
        console.log("[SpoTUI-dbg] reusing existing element:", wp.tagName);
    }

    // Fit / position / richness — applied on create AND reuse so changes take
    // effect without clearing first. rich 100 = default lift, 0 = filter off.
    const fit = ["cover", "contain", "fill", "none"].includes(String(opts.fit || "").toLowerCase())
        ? String(opts.fit).toLowerCase() : "cover";
    const posWords = String(opts.pos || "center").toLowerCase().split(/\s+/).filter(Boolean);
    const posOk = posWords.length >= 1 && posWords.length <= 2 &&
        posWords.every((w) => ["center", "top", "bottom", "left", "right"].includes(w));
    const pos = posOk ? posWords.join(" ") : "center";
    if (!posOk && opts.pos) console.warn('[SpoTUI-dbg] bad -pos, use e.g. center, top, "top left". Got:', opts.pos);
    let rich = parseInt(opts.rich ?? "100", 10);
    if (isNaN(rich)) rich = 100;
    rich = Math.max(0, Math.min(200, rich));
    const r = rich / 100;
    wp.style.objectFit = fit;
    wp.style.objectPosition = pos;
    wp.style.backgroundSize = fit === "fill" ? "100% 100%" : fit;
    wp.style.backgroundPosition = pos;
    wp.style.filter = rich === 0 ? "" : `saturate(${(1 + 0.1 * r).toFixed(3)}) contrast(${(1 + 0.04 * r).toFixed(3)})`;
    console.log("[SpoTUI-dbg] applied:", { fit, pos, rich });

    if (isVideo) {
        if (wp.getAttribute("src") !== url) {
            console.log("[SpoTUI-dbg] setting video src:", url);
            wp.src = url;
            wp.onerror = () => {
                console.error("[SpoTUI-dbg] wallpaper video FAILED:", url);
                dbgState("onerror", wp, url);
                explainFailure(url, wp);
            };
        } else {
            console.log("[SpoTUI-dbg] src unchanged, re-playing");
        }
        dbgState("before play()", wp, url);
        wp.muted = true;
        const playPromise = wp.play();
        if (playPromise && playPromise.catch) {
            playPromise.catch((err) => {
                console.error("[SpoTUI-dbg] play() rejected:", err && err.name, err && err.message);
                dbgState("play rejected", wp, url);
            });
        }
        setTimeout(() => {
            dbgState("4s health-check", wp, url);
            if (wp.readyState < 2 || !wp.videoWidth) explainFailure(url, wp);
            else console.log("[SpoTUI-dbg] OK: video is rendering.");
        }, 4000);
    } else {
        console.log("[SpoTUI-dbg] setting image background:", url);
        wp.style.backgroundImage = `url("${url}")`;
        const probe = new Image();
        probe.onload = () => console.log("[SpoTUI-dbg] image probe OK:", url);
        probe.onerror = () => console.error("[SpoTUI-dbg] image probe FAILED (404/blocked/CORS):", url);
        probe.src = url;
    }
    wp.style.opacity = opacity;
    tui.style.backgroundColor = "transparent";
    const children = tui.querySelectorAll(':not(#spotui-wallpaper)');
    children.forEach(c => {
        if (window.getComputedStyle(c).position === 'static') c.style.position = 'relative';
        c.style.zIndex = '1';
    });
    try { reassertPosterLayer(); } catch (e) {}
    if (save) {
        storageSet(WP_URL_KEY, url);
        storageSet(WP_OPACITY_KEY, opacity);
        storageSet(WP_FIT_KEY, fit);
        storageSet(WP_POS_KEY, pos);
        storageSet(WP_RICH_KEY, String(rich));
        console.log("[SpoTUI-dbg] saved to storage. Clear anytime with: tui -wp off");
    }
}
