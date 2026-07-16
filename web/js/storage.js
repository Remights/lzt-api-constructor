// Постоянное хранилище: localStorage + JSON в %APPDATA% (и HTTP /api/user-storage).
(function () {
    "use strict";

    const PREFIX = "lzt_";
    let hydrated = false;
    let hydratePromise = null;
    let flushTimer = null;
    let flushing = false;
    let dirtyWhileFlush = false;

    function collect() {
        const data = {};
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(PREFIX)) {
                    const v = localStorage.getItem(k);
                    if (v != null) data[k] = v;
                }
            }
        } catch (e) { /* ignore */ }
        return data;
    }

    function applyData(data) {
        if (!data || typeof data !== "object") return;
        Object.entries(data).forEach(([k, v]) => {
            if (!k.startsWith(PREFIX) || v == null) return;
            try { localStorage.setItem(k, String(v)); } catch (e) { /* quota */ }
        });
        if (window.I18N) {
            I18N.lang = localStorage.getItem("lzt_lang") || "ru";
            I18N.apply();
        }
        if (window.THEME) {
            THEME.current = localStorage.getItem("lzt_theme") || "dark";
            THEME.apply();
        }
    }

    async function persistRemote(data) {
        const payload = data || collect();
        if (window.pywebview && window.pywebview.api && window.pywebview.api.storage_save) {
            try {
                const r = await window.pywebview.api.storage_save(payload);
                if (r && r.ok) return true;
            } catch (e) { /* fallback HTTP */ }
        }
        try {
            const res = await fetch("/api/user-storage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const j = await res.json();
            return !!(j && j.ok);
        } catch (e) {
            return false;
        }
    }

    async function loadRemote() {
        if (window.pywebview && window.pywebview.api && window.pywebview.api.storage_load) {
            try {
                const r = await window.pywebview.api.storage_load();
                if (r && r.ok && r.data) return r.data;
            } catch (e) { /* fallback */ }
        }
        try {
            const res = await fetch("/api/user-storage");
            if (!res.ok) return {};
            const data = await res.json();
            return data && typeof data === "object" ? data : {};
        } catch (e) {
            return {};
        }
    }

    async function hydrate() {
        if (hydrated) return;
        const data = await loadRemote();
        if (Object.keys(data).length) applyData(data);
        hydrated = true;
        window.dispatchEvent(new Event("lzt-storage-ready"));
    }

    function scheduleFlush() {
        clearTimeout(flushTimer);
        flushTimer = setTimeout(() => { flush().catch(() => {}); }, 350);
    }

    async function flush() {
        if (flushing) {
            dirtyWhileFlush = true;
            return;
        }
        flushing = true;
        dirtyWhileFlush = false;
        try {
            await persistRemote(collect());
        } finally {
            flushing = false;
            if (dirtyWhileFlush) {
                dirtyWhileFlush = false;
                scheduleFlush();
            }
        }
    }

    function flushSync() {
        const payload = JSON.stringify(collect());
        const blob = new Blob([payload], { type: "application/json" });
        try {
            if (navigator.sendBeacon) {
                navigator.sendBeacon("/api/user-storage", blob);
                return;
            }
        } catch (e) { /* ignore */ }
        try {
            fetch("/api/user-storage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: payload,
                keepalive: true,
            }).catch(() => {});
        } catch (e) { /* ignore */ }
    }

    function patchStorage() {
        const origSet = Storage.prototype.setItem;
        const origRemove = Storage.prototype.removeItem;
        const origClear = Storage.prototype.clear;

        Storage.prototype.setItem = function (key, value) {
            origSet.call(this, key, value);
            if (String(key).startsWith(PREFIX)) scheduleFlush();
        };
        Storage.prototype.removeItem = function (key) {
            origRemove.call(this, key);
            if (String(key).startsWith(PREFIX)) scheduleFlush();
        };
        Storage.prototype.clear = function () {
            origClear.call(this);
            scheduleFlush();
        };
    }

    patchStorage();

    hydratePromise = hydrate();
    window.addEventListener("pywebviewready", () => {
        flush().catch(() => {});
    });

    window.addEventListener("beforeunload", flushSync);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") flushSync();
    });

    window.LZTStorage = {
        ready() { return hydratePromise || Promise.resolve(); },
        flush,
        flushSync,
        collect,
    };
})();
