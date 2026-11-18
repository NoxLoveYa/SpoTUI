import { resetAllSettings } from "./appearance.js";
import { execute } from "./commands.js";
import { FIRST_BOOT_THEME_IDS, THEME_CHANNELS, THEME_FRAME_CHANNELS, THEME_HOST } from "./constants.js";
import { isRestrictedThemeCommand } from "./keybinds.js";
import { fetchThemeFeed, loadThemeFeedInFrame, safeHttpsUrl } from "./themefeed.js";
import { dbg, pinToast } from "./utils.js";
import { beginThemeApply } from "./wpconsent.js";

const FEED_ERROR = "Failed to load themes";
const channelCache = {};
const channelInflight = {};

// One feed -> validated themes: fetched as data; a fetch the browser blocks
// (TypeError: CORS or network) on a frame channel is retried in a sandboxed
// frame, never as a script in this page. Any failure surfaces as the same
// "Failed to load themes" error.
// Per channel, for this session: the time the plain fetch was last blocked
// (TypeError). A blocked channel goes straight to the frame instead of
// paying a doomed request on every load; a forced refresh may retry the fetch
// once per FETCH_RETRY_MS, and a fetch that works forgets the entry.
const FETCH_RETRY_MS = 10 * 60 * 1000;
const fetchBlockedAt = {};

async function fetchChannel(key, force = false) {
    const src = `${THEME_CHANNELS[key]}?_=${Math.floor(Date.now() / 1000)}`;
    let result;
    try {
        const blockedAt = fetchBlockedAt[key];
        const skipFetch = blockedAt !== undefined && !(force && Date.now() - blockedAt >= FETCH_RETRY_MS);
        if (skipFetch) {
            result = await loadThemeFeedInFrame(src);
        } else {
            try {
                result = await fetchThemeFeed(src);
                delete fetchBlockedAt[key];
            } catch (err) {
                if (!(THEME_FRAME_CHANNELS.has(key) && err instanceof TypeError)) throw err;
                fetchBlockedAt[key] = Date.now();
                dbg(`[SpoTUI] theme feed (${key}) fetch blocked, trying sandboxed frame:`, err.message);
                result = await loadThemeFeedInFrame(src);
            }
        }
    } catch (err) {
        dbg(`[SpoTUI] theme feed (${key}) failed:`, err && err.message);
        throw new Error(FEED_ERROR, { cause: err });
    }
    if (result.dropped) {
        dbg(`[SpoTUI] theme feed (${key}): dropped ${result.dropped} invalid theme(s)`, JSON.stringify(result.reasons || {}));
    }
    if (!result.themes.length) throw new Error("Theme feed loaded but empty");
    return result.themes;
}

export function loadThemeChannel(channel, force = false) {
    const key = THEME_CHANNELS[channel] ? channel : "live";
    if (!force && channelCache[key]) return Promise.resolve(channelCache[key].slice());
    if (!force && channelInflight[key]) return channelInflight[key].then((themes) => themes.slice());
    const promise = fetchChannel(key, force).then((themes) => {
        channelCache[key] = themes;
        return themes;
    });
    channelInflight[key] = promise;
    const settled = () => { if (channelInflight[key] === promise) delete channelInflight[key]; };
    promise.then(settled, settled);
    return promise.then((themes) => themes.slice());
}

// Validated themes already loaded for a channel ([] when none yet).
export function getCachedThemes(channel) {
    return (channelCache[channel] || []).slice();
}

export function createAddThemeCard(imgUrl, channel) {
    const stable = channel === "stable";
    const label = stable ? "Contribute" : "Add yours";
    const url = stable ? "https://github.com/SkenSMasteR/SpoTUI/blob/aux/Themes/themes.json" : THEME_HOST;
    const card = document.createElement("div");
    card.className = "theme-card";
    card.innerHTML = `
        <h3>${label}</h3>
        <img src="${imgUrl}" alt="${label}" referrerpolicy="no-referrer" loading="lazy" decoding="async">
        <button>${stable ? "Contribute" : "Add"}</button>
    `;
    card.querySelector("button").addEventListener("click", () => {
        window.open(url, "_blank");
    });
    return card;
}

export function createThemeCard(theme) {
    const card = document.createElement("div");
    card.className = "theme-card";
    const title = document.createElement("h3");
    title.textContent = theme.name || "";
    const img = document.createElement("img");
    img.referrerPolicy = "no-referrer";
    img.loading = "lazy";
    img.decoding = "async";
    img.src = safeHttpsUrl(theme.screenshot_url);
    img.alt = `${theme.name || ""} screenshot`;
    const btn = document.createElement("button");
    btn.textContent = "Apply";
    btn.dataset.commands = JSON.stringify(theme.commands || []);
    card.appendChild(title);
    card.appendChild(img);
    card.appendChild(btn);
    return card;
}
// Apply community theme by name. The theme is looked up before anything is
// reset, so an unknown name (or a feed that fails to load) leaves the user's
// look untouched and resolves to null.
export function applyThemeByName(themeName, opts = {}) {
    const skipNonTui = Boolean(opts.skipNonTui);
    const apply = async (themes) => {
        const theme = (themes || []).find((t) => (opts.id && t.id === opts.id) || t.name === themeName);
        if (!theme) {
            if (opts.channel) {
                pinToast(`theme not found on ${opts.channel}${opts.channel === "live" ? "" : " (try -live)"}`);
            }
            return null;
        }
        beginThemeApply();
        resetAllSettings();
        if (theme.commands) {
            const pending = [];
            theme.commands.forEach((cmd, idx) => {
                const text = String(cmd || "").trim();
                if (skipNonTui && !text.startsWith("tui")) return;
                if (isRestrictedThemeCommand(text)) return;
                pending.push(
                    new Promise((res, rej) => {
                        setTimeout(() => {
                            execute(cmd, { bypassOnboarding: skipNonTui, fromTheme: true }).then(res, rej);
                        }, idx * 120);
                    })
                );
            });
            await Promise.all(pending);
        }
        return theme;
    };
    // Without a channel (onboarding) the stable list is the one that was shown.
    return loadThemeChannel(opts.channel || "stable").then((themes) => apply(themes));
}

// Encode theme name for theme ID generation
export function encodeThemeName(name) {
    try {
        return btoa(unescape(encodeURIComponent(String(name || ""))));
    } catch (e) {
        return "";
    }
}

// Exact inverse of encodeThemeName: UTF-8 base64 -> name. Also takes
// unpadded and URL-safe base64. Returns null for an invalid id.
export function decodeThemeId(id) {
    try {
        let b64 = String(id || "").replace(/-/g, "+").replace(/_/g, "/");
        while (b64.length % 4) b64 += "=";
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (e) {
        return null;
    }
}

export function getThemeSelectionList(themes, showAll = false) {
    if (showAll) return themes;

    const curated = themes.filter((theme) => {
        const themeId = String(theme?.id || "");
        const encodedName = encodeThemeName(theme?.name);
        return FIRST_BOOT_THEME_IDS.has(themeId) || FIRST_BOOT_THEME_IDS.has(encodedName);
    });

    if (curated.length) return curated;
    return themes.slice(0, 3);
}
