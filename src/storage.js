export function storageGet(key) {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        return null;
    }
}

// Returns false when the write fails (e.g. quota exceeded) so callers can
// surface it instead of toasting false success.
export function storageSet(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) { return false; }
}

export function storageRemove(key) {
    try {
        localStorage.removeItem(key);
    } catch (e) {}
}

// Parse a JSON object value defensively: {} on missing/corrupt/shape-mismatch.
export function readJsonObject(key) {
    try {
        const raw = storageGet(key);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (e) { return {}; }
}

// Parse a JSON array value defensively: [] on missing/corrupt/shape-mismatch.
export function readJsonArray(key) {
    try {
        const raw = storageGet(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
}

export function storageClear() {
    try {
        localStorage.clear();
    } catch (e) {}
}
