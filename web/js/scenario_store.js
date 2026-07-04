// Сценарии на диск (%APPDATA%/LZT API Constructor/scenarios/*.json) + localStorage.
(function () {
    "use strict";

    const LIB_KEY = "lzt_scenarios";
    const AUTO_KEY = "lzt_scenario_autosave";
    const TABS_KEY = "lzt_scenario_tabs";

    async function apiJson(url, opts) {
        const res = await fetch(url, opts);
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
    }

    async function loadLibrary() {
        let fromDisk = null;
        try {
            const r = await apiJson("/api/scenarios/library");
            if (r && r.ok && Array.isArray(r.items)) fromDisk = r.items;
        } catch (e) { /* offline */ }

        let fromLs = [];
        try { fromLs = JSON.parse(localStorage.getItem(LIB_KEY) || "[]"); } catch (e) { fromLs = []; }

        if (fromDisk && fromDisk.length) {
            localStorage.setItem(LIB_KEY, JSON.stringify(fromDisk));
            return fromDisk;
        }
        if (fromLs.length) {
            await saveLibrary(fromLs);
            return fromLs;
        }
        localStorage.setItem(LIB_KEY, "[]");
        return [];
    }

    async function saveLibrary(items) {
        localStorage.setItem(LIB_KEY, JSON.stringify(items));
        try {
            await apiJson("/api/scenarios/library", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items }),
            });
        } catch (e) { /* localStorage only */ }
        if (window.LZTStorage && LZTStorage.flush) await LZTStorage.flush();
    }

    async function loadAutosave() {
        let fromDisk = null;
        try {
            const r = await apiJson("/api/scenarios/autosave");
            if (r && r.ok && r.data && typeof r.data === "object") fromDisk = r.data;
        } catch (e) { /* ignore */ }

        let fromLs = null;
        try {
            const raw = localStorage.getItem(AUTO_KEY);
            fromLs = raw ? JSON.parse(raw) : null;
        } catch (e) { fromLs = null; }

        if (fromDisk) {
            localStorage.setItem(AUTO_KEY, JSON.stringify(fromDisk));
            return fromDisk;
        }
        if (fromLs) {
            await saveAutosave(fromLs);
            return fromLs;
        }
        return null;
    }

    async function saveAutosave(data) {
        if (data) localStorage.setItem(AUTO_KEY, JSON.stringify(data));
        else localStorage.removeItem(AUTO_KEY);
        try {
            await apiJson("/api/scenarios/autosave", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data: data || null }),
            });
        } catch (e) { /* ignore */ }
        if (window.LZTStorage && LZTStorage.flushSync) LZTStorage.flushSync();
    }

    async function loadTabs() {
        let fromDisk = null;
        try {
            const r = await apiJson("/api/scenarios/tabs");
            if (r && r.ok && r.state && typeof r.state === "object") fromDisk = r.state;
        } catch (e) { /* ignore */ }

        let fromLs = null;
        try { fromLs = JSON.parse(localStorage.getItem(TABS_KEY) || "null"); } catch (e) { fromLs = null; }

        if (fromDisk && fromDisk.tabs && fromDisk.tabs.length) {
            localStorage.setItem(TABS_KEY, JSON.stringify(fromDisk));
            return fromDisk;
        }
        if (fromLs && fromLs.tabs && fromLs.tabs.length) {
            await saveTabs(fromLs);
            return fromLs;
        }
        return fromLs;
    }

    async function saveTabs(state) {
        if (!state) return;
        localStorage.setItem(TABS_KEY, JSON.stringify(state));
        try {
            await apiJson("/api/scenarios/tabs", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ state }),
            });
        } catch (e) { /* ignore */ }
        if (window.LZTStorage && LZTStorage.flushSync) LZTStorage.flushSync();
    }

    async function hydrate() {
        await Promise.all([loadLibrary(), loadAutosave(), loadTabs()]);
    }

    window.LZTScenarioStore = {
        hydrate,
        loadLibrary,
        saveLibrary,
        loadAutosave,
        saveAutosave,
        loadTabs,
        saveTabs,
    };
})();
