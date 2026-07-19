/** Webhook-воркер: pending jobs → Scenario.run → /api/hooks/complete */
(function () {
    "use strict";

    const LS_ENABLED = "lzt_hooks_enabled";
    let pollTimer = null;
    let busy = false;
    let infoCache = null;

    function hooksEnabled() {
        return localStorage.getItem(LS_ENABLED) !== "0";
    }

    async function fetchInfo() {
        try {
            const r = await fetch("/api/hooks/info");
            infoCache = await r.json();
            return infoCache;
        } catch (e) {
            return null;
        }
    }

    async function syncSettingsFromUi() {
        const en = document.getElementById("set-hooks-enabled");
        const enabled = en ? en.checked : hooksEnabled();
        localStorage.setItem(LS_ENABLED, enabled ? "1" : "0");
        try {
            await fetch("/api/hooks/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled }),
            });
        } catch (e) { /* ignore */ }
        await refreshSettingsUi();
        if (enabled) startPoller();
        else stopPoller();
    }

    async function rotateSecret() {
        try {
            await fetch("/api/hooks/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rotate_secret: true, enabled: hooksEnabled() }),
            });
        } catch (e) { /* ignore */ }
        await refreshSettingsUi();
    }

    async function refreshSettingsUi() {
        const info = await fetchInfo();
        if (!info) return;
        const urlEl = document.getElementById("set-hooks-url");
        const secEl = document.getElementById("set-hooks-secret");
        const dirEl = document.getElementById("set-hooks-dir");
        const en = document.getElementById("set-hooks-enabled");
        if (urlEl) urlEl.value = info.url || "";
        if (secEl) secEl.value = info.secret || "";
        if (dirEl) dirEl.textContent = info.hooks_dir || "";
        if (en) en.checked = info.enabled !== false && hooksEnabled();
    }

    function copyField(id) {
        const el = document.getElementById(id);
        if (!el || !el.value) return;
        navigator.clipboard.writeText(el.value).catch(() => {});
        if (window.Scenario?.flash) Scenario.flash("Скопировано", "ok");
    }

    async function loadScenarioIfNeeded(scenarioId) {
        if (!scenarioId || !window.Scenario) return;
        const list = Scenario.savedList?.() || [];
        const found = list.find(s => s.id === scenarioId);
        if (!found) return;
        if (Scenario.currentId === scenarioId) return;
        // не затираем активную вкладку — открываем в новой, если есть работа
        if (Scenario.hasMeaningfulWork?.() && window.LZTFeatures?.openScenarioInNewTab) {
            window.LZTFeatures.openScenarioInNewTab(found);
        } else if (typeof Scenario.openScenario === "function") {
            Scenario.openScenario(found, { flash: false });
        } else {
            Scenario.load(found);
        }
    }

    function hookHeaders(extra) {
        const h = Object.assign({ "Content-Type": "application/json" }, extra || {});
        const sec = infoCache?.secret || document.getElementById("set-hooks-secret")?.value || "";
        if (sec) h["X-LZT-Hook-Secret"] = sec;
        return h;
    }

    async function processJob(job) {
        if (!window.Scenario) {
            await fetch(`/api/hooks/complete/${job.id}`, {
                method: "POST",
                headers: hookHeaders(),
                body: JSON.stringify({ ok: false, error: "Scenario UI not ready" }),
            });
            return;
        }
        try {
            await loadScenarioIfNeeded(job.scenario_id);
            if (window.LZTToast) {
                LZTToast("Webhook", job.event || "event", { type: "info" });
            }
            const out = await Scenario.run({
                fromHook: true,
                hook: job.payload || {},
                hookEvent: job.event || "event",
                demo: !!Scenario._scenarioIsDemo,
            });
            await fetch(`/api/hooks/complete/${job.id}`, {
                method: "POST",
                headers: hookHeaders(),
                body: JSON.stringify({
                    ok: !!(out && out.ok),
                    result: out?.result ?? null,
                    error: out?.error || (out?.aborted ? "stopped" : "") || "",
                }),
            });
        } catch (e) {
            await fetch(`/api/hooks/complete/${job.id}`, {
                method: "POST",
                headers: hookHeaders(),
                body: JSON.stringify({ ok: false, error: String(e) }),
            });
        }
    }

    async function pollOnce() {
        if (busy || !hooksEnabled()) return;
        if (window.Scenario?._runBusy) return;
        busy = true;
        try {
            if (!infoCache?.secret) await fetchInfo();
            const r = await fetch("/api/hooks/pending", { headers: hookHeaders() });
            const data = await r.json();
            if (data?.job) await processJob(data.job);
        } catch (e) { /* offline */ }
        finally { busy = false; }
    }

    function startPoller() {
        if (pollTimer) return;
        pollTimer = setInterval(pollOnce, 800);
        pollOnce();
    }

    function stopPoller() {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;
    }

    function bindSettings() {
        document.getElementById("set-hooks-enabled")?.addEventListener("change", () => syncSettingsFromUi());
        document.getElementById("set-hooks-copy-url")?.addEventListener("click", () => copyField("set-hooks-url"));
        document.getElementById("set-hooks-copy-secret")?.addEventListener("click", () => copyField("set-hooks-secret"));
        document.getElementById("set-hooks-rotate")?.addEventListener("click", () => rotateSecret());
        document.getElementById("btn-settings")?.addEventListener("click", () => {
            setTimeout(refreshSettingsUi, 50);
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        bindSettings();
        fetch("/api/hooks/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled: hooksEnabled() }),
        }).catch(() => {});
        const startWhenReady = () => { if (hooksEnabled()) startPoller(); };
        if (window.Scenario?.nodes) startWhenReady();
        else document.addEventListener("lzt-scenario-ready", startWhenReady, { once: true });
    });

    window.LZTHooks = {
        fetchInfo,
        refreshSettingsUi,
        startPoller,
        stopPoller,
        pollOnce,
    };
})();
