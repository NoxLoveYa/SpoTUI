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

export function storageClear() {
    try {
        localStorage.clear();
    } catch (e) {}
}
