import { DISCORD_INVITE_URL, UPDATE_BANNER_KEY } from "./constants.js";
import { storageGet, storageSet } from "./storage.js";
import { toastBase } from "./utils.js";

// Display restart notification popup
// persistSession - to survive the reload after all settings get reset.
// Sticky (no auto-remove): it must survive until the reload happens.
export function showRestartPopup(message = "Wait 5 seconds and relaunch Spotify", persistSession = false) {
    toastBase("spotui-restart-popup", message, null, "position:fixed;left:50%;bottom:120px;transform:translateX(-50%);z-index:10000;background:rgba(0,0,0,0.92);border:1px solid var(--spotui-accent,#ff8c42);border-radius:6px;padding:12px 16px;color:var(--spotui-accent,#ff8c42);font-family:\"JetBrains Mono\",monospace;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,0.35);");
    if (persistSession) {
        try { sessionStorage.setItem("spotui:restart-popup", message); } catch (e) {}
    }
}
// Initialize Discord community update banner
// Shows unless user has dismissed with "never show again"
export function initUpdateBanner() {
    if (document.getElementById("spotui-update-banner")) return;
    if (storageGet(UPDATE_BANNER_KEY) === "never") return;

    const banner = document.createElement("div");
    banner.id = "spotui-update-banner";
    banner.innerHTML = `
        <div class="spotui-banner-secondary-actions">
            <button id="banner-dismiss-btn" class="spotui-banner-link-btn" title="Dismiss">Dismiss</button>
            <button id="banner-never-btn" class="spotui-banner-link-btn" title="Never show again">Never show</button>
        </div>
        <div class="spotui-banner-header">
            <img class="spotui-banner-icon" src="https://raw.githubusercontent.com/SkenSMasteR/SpoTUI/refs/heads/master/assets/logo.png" alt="SpoTUI Logo">
            <div>
                <h3>Updates & Community</h3>
            </div>
        </div>
        <p>Did you know that SpoTUI gets new updates almost every day?</p>
        <p>Join the SpoTUI Discord server to get breakdowns of every new feature, and notifications when new updates arrive.</p>
        <div class="spotui-update-actions">
            <button id="banner-join-btn" class="spotui-control-btn">Join Discord</button>
        </div>
    `;
    document.body.appendChild(banner);

    document.getElementById("banner-join-btn").onclick = () => {
        window.open(DISCORD_INVITE_URL, "_blank");
    };

    document.getElementById("banner-dismiss-btn").onclick = () => {
        banner.remove();
    };

    document.getElementById("banner-never-btn").onclick = () => {
        storageSet(UPDATE_BANNER_KEY, "never");
        banner.remove();
    };
}
