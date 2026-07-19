// Доп. фичи: вкладки сценариев, трекер трат, галерея/шаринг, шифрование токена, автообновление, звук.
(function () {
    "use strict";

    const APP_VERSION = "1.3.0";
    const TABS_KEY = "lzt_scenario_tabs";
    const SPEND_KEY = "lzt_profit_tracker";

    // ==================== ТРЕКЕР ТРАТ ====================
    function getProfitTotal() {
        try {
            const d = JSON.parse(localStorage.getItem(SPEND_KEY) || "{}");
            return Number(d.total) || 0;
        } catch (e) { return 0; }
    }

    function ensureProfitWidget() {
        const runBox = document.querySelector(".widget-box-run");
        if (!runBox) return null;
        let el = document.getElementById("profit-widget");
        if (el) return el;
        el = document.createElement("div");
        el.id = "profit-widget";
        el.className = "profit-widget";
        el.innerHTML = `<div class="profit-row"><span><i class="fa-solid fa-wallet"></i> <span data-i18n="profit.session">Потрачено (сессия)</span></span><b id="profit-spent">0 ₽</b></div>
            <div class="profit-row"><span><i class="fa-solid fa-chart-line"></i> <span data-i18n="profit.total">Всего (учёт)</span></span><b id="profit-total">0 ₽</b></div>
            <div class="profit-row run-dash-row"><span><i class="fa-solid fa-gauge-high"></i> Прогон</span><b id="run-dash-stats">0 req · 0×429 · 0₽</b></div>`;
        const anchor = runBox.querySelector(".run-log-section");
        if (anchor) runBox.insertBefore(el, anchor);
        else runBox.appendChild(el);
        if (window.I18N) I18N.apply();
        return el;
    }

    function updateRunDash(stats) {
        ensureProfitWidget();
        const el = document.getElementById("run-dash-stats");
        if (!el || !stats) return;
        const req = (stats.reqOk || 0) + (stats.reqErr || 0);
        const r429 = stats.rate429 || 0;
        const spent = Number(stats.spent || 0);
        el.textContent = `${req} req · ${r429}×429 · ${spent.toFixed(0)}₽`;
        const wrap = document.getElementById("profit-widget");
        if (wrap) wrap.classList.add("is-visible");
        if (r429 >= 3 && window.LZTToast) {
            const key = "_toast429";
            if (!window[key]) {
                window[key] = true;
                LZTToast("Лимит API", "Много ответов 429 — снизьте частоту запросов", { type: "warn" });
                setTimeout(() => { window[key] = false; }, 30000);
            }
        }
    }

    function refreshProfitVisibility(sessionSpent) {
        const el = document.getElementById("profit-widget");
        if (!el) return;
        let session = 0;
        if (sessionSpent != null) {
            session = sessionSpent;
        } else {
            const txt = document.getElementById("profit-spent")?.textContent || "0";
            session = parseFloat(String(txt).replace(/[^\d.]/g, "")) || 0;
        }
        const total = getProfitTotal();
        el.classList.toggle("is-visible", session > 0 || total > 0);
    }

    function loadProfitTotal() {
        const el = document.getElementById("profit-total");
        if (el) el.textContent = getProfitTotal().toFixed(0) + " ₽";
        refreshProfitVisibility();
    }

    function updateProfit(stats) {
        const spent = stats && stats.spent ? Number(stats.spent) : 0;
        if (spent <= 0 && !(stats && stats._finalize) && getProfitTotal() <= 0) return;

        ensureProfitWidget();
        const sEl = document.getElementById("profit-spent");
        if (sEl) sEl.textContent = spent.toFixed(0) + " ₽";
        try {
            if (stats && stats._finalize) {
                const d = JSON.parse(localStorage.getItem(SPEND_KEY) || "{}");
                d.total = (Number(d.total) || 0) + spent;
                localStorage.setItem(SPEND_KEY, JSON.stringify(d));
                loadProfitTotal();
            } else {
                refreshProfitVisibility(spent);
            }
        } catch (e) {
            refreshProfitVisibility(spent);
        }
    }

    function initProfitWidget() {
        if (getProfitTotal() <= 0) return;
        ensureProfitWidget();
        const sEl = document.getElementById("profit-spent");
        if (sEl) sEl.textContent = "0 ₽";
        loadProfitTotal();
    }

    // ==================== ВКЛАДКИ СЦЕНАРИЕВ ====================
    function tabsState() {
        try { return JSON.parse(localStorage.getItem(TABS_KEY) || "null") || { tabs: [], active: 0 }; }
        catch (e) { return { tabs: [], active: 0 }; }
    }

    function saveTabsState(st) {
        try {
            localStorage.setItem(TABS_KEY, JSON.stringify(st));
            if (window.LZTScenarioStore) LZTScenarioStore.saveTabs(st).catch(() => {});
        } catch (e) {}
    }

    function initScenarioTabs() {
        const center = document.getElementById("panel-center");
        if (!center || document.getElementById("scenario-tabs")) return;
        const bar = document.createElement("div");
        bar.id = "scenario-tabs";
        bar.className = "scenario-tabs";
        bar.innerHTML = `<div id="scenario-tabs-list" class="scenario-tabs-list"></div>
            <button type="button" id="btn-new-tab" class="btn-token scenario-tab-add" title="Новая вкладка"><i class="fa-solid fa-plus"></i></button>`;
        center.insertBefore(bar, center.firstChild);

        let st = tabsState();
        const S = window.Scenario;
        if (S) {
            const cur = S.serialize();
            const tabOk = (t) => t && t.data && Array.isArray(t.data.nodes) && t.data.nodes.length;
            if (!st.tabs.length || !st.tabs.some(tabOk)) {
                st = { tabs: [{ title: S.title || "Сценарий 1", data: cur }], active: 0 };
                saveTabsState(st);
            } else if (!tabOk(st.tabs[st.active])) {
                st.tabs[st.active] = { title: S.title || "Сценарий 1", data: cur };
                saveTabsState(st);
            }
        }

        const renderTabs = () => {
            const list = bar.querySelector("#scenario-tabs-list");
            list.innerHTML = st.tabs.map((t, i) =>
                `<button type="button" class="scenario-tab ${i === st.active ? "active" : ""}" data-i="${i}" title="${escapeHtml(t.title)}"><span class="scenario-tab-title">${escapeHtml(t.title)}</span><span class="tab-x" data-x="${i}" title="Закрыть">&times;</span></button>`
            ).join("");
            list.querySelectorAll(".scenario-tab").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    if (e.target.closest(".tab-x")) return;
                    switchTab(parseInt(btn.dataset.i, 10));
                });
            });
            list.querySelectorAll(".tab-x").forEach(x => {
                x.addEventListener("click", (e) => { e.stopPropagation(); closeTab(parseInt(x.dataset.x, 10)); });
            });
        };

        const persistCurrent = () => {
            if (!S || !st.tabs[st.active]) return;
            st.tabs[st.active].title = S.title;
            st.tabs[st.active].data = S.serialize();
            st.tabs[st.active].demoMode = !!S._scenarioIsDemo;
            saveTabsState(st);
        };

        const switchTab = (i) => {
            if (i === st.active || !S) return;
            persistCurrent();
            st.active = i;
            saveTabsState(st);
            S.load(st.tabs[i].data, { keepView: true, demo: !!st.tabs[i].demoMode });
            renderTabs();
        };

        const closeTab = (i) => {
            if (st.tabs.length <= 1) return;
            if (i === st.active) persistCurrent();
            st.tabs.splice(i, 1);
            if (i < st.active) st.active--;
            else if (st.active >= st.tabs.length) st.active = st.tabs.length - 1;
            saveTabsState(st);
            S.load(st.tabs[st.active].data, { keepView: true, demo: !!st.tabs[st.active].demoMode });
            renderTabs();
        };

        const addNewTab = () => {
            if (!S) return;
            persistCurrent();
            const n = st.tabs.length + 1;
            st.tabs.push({ title: S.tabTitle(n), data: null });
            st.active = st.tabs.length - 1;
            saveTabsState(st);
            S.newScenario();
            st.tabs[st.active] = { title: S.title, data: S.serialize() };
            saveTabsState(st);
            renderTabs();
        };

        const openScenarioInNewTab = (data, opts) => {
            opts = opts || {};
            if (!S || !data) return;
            persistCurrent();
            st.tabs.push({ title: data.title || S.tabTitle(st.tabs.length + 1), data: null });
            st.active = st.tabs.length - 1;
            saveTabsState(st);
            S.load(data, { keepView: !!opts.keepView, demo: !!(opts.demo || data.isDemo || data._demo) });
            st.tabs[st.active].demoMode = !!S._scenarioIsDemo;
            saveTabsState(st);
        };

        bar.querySelector("#btn-new-tab").addEventListener("click", addNewTab);

        const origCommit = S.commit.bind(S);
        S.commit = function () {
            origCommit();
            persistCurrent();
            renderTabs();
        };

        const origLoad = S.load.bind(S);
        S.load = function (data, opts) {
            origLoad(data, opts);
            persistCurrent();
            renderTabs();
        };

        const origNewScenario = S.newScenario.bind(S);
        S.newScenario = function () {
            origNewScenario();
            persistCurrent();
            renderTabs();
        };

        window.LZTFeatures = Object.assign(window.LZTFeatures || {}, {
            syncActiveTab: persistCurrent,
            addScenarioTab: addNewTab,
            openScenarioInNewTab,
        });

        renderTabs();
    }

    function escapeHtml(s) {
        return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // ==================== ГАЛЕРЕЯ / SHARE CODE ====================
    function encodeShare(data) {
        const json = JSON.stringify(data);
        const b64 = btoa(unescape(encodeURIComponent(json)));
        return "LZT1:" + b64.replace(/=+$/, "");
    }

    function decodeShare(code) {
        const c = String(code || "").trim().replace(/^LZT1:/, "");
        const pad = c.length % 4 ? "=".repeat(4 - (c.length % 4)) : "";
        const json = decodeURIComponent(escape(atob(c + pad)));
        return JSON.parse(json);
    }

    function showQrModal(code) {
        document.querySelectorAll(".qr-modal").forEach(m => m.remove());
        const ov = document.createElement("div");
        ov.className = "modal-overlay qr-modal";
        ov.innerHTML = `<div class="modal-box" style="width:340px;text-align:center;">
            <div class="modal-header"><span style="font-weight:700;color:#fff;">QR-код сценария</span>
            <button class="modal-close" id="qr-close"><i class="fa-solid fa-xmark"></i></button></div>
            <div class="modal-body"><canvas id="qr-canvas"></canvas>
            <p style="font-size:11px;color:var(--text-muted);margin-top:10px;word-break:break-all;">${escapeHtml(code.slice(0, 120))}${code.length > 120 ? "…" : ""}</p></div>
            <div class="modal-footer" style="justify-content:center;"><button class="btn-save" id="qr-ok">Закрыть</button></div></div>`;
        document.body.appendChild(ov);
        LZTUi.showOverlay(ov);
        const close = () => LZTUi.hideOverlay(ov, { remove: true });
        ov.querySelector("#qr-close").addEventListener("click", close);
        ov.querySelector("#qr-ok").addEventListener("click", close);
        ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
        const cv = ov.querySelector("#qr-canvas");
        if (typeof QRCode !== "undefined") {
            QRCode.toCanvas(cv, code, { width: 260, margin: 2, color: { dark: "#00ba78", light: "#141414" } }, (err) => {
                if (err) cv.parentNode.innerHTML = "<p style='color:#ff5555;'>QR не сгенерирован</p>";
            });
        } else {
            cv.parentNode.innerHTML = "<p style='color:var(--text-muted);'>Библиотека QR не загружена</p>";
        }
    }

    function appendShareGalleryItems() {
        const menu = document.getElementById("share-menu");
        if (!menu || menu.querySelector('[data-share="code"]')) return;
        const t = (k, fb) => (window.I18N && I18N.t(k)) || fb;
        menu.insertAdjacentHTML("beforeend", `
            <div class="add-block-cat">${t("share.cat.sharing", "Шаринг")}</div>
            <div class="add-block-item" data-share="code"><span class="add-block-ico" style="color:#9b59b6;"><i class="fa-solid fa-qrcode"></i></span><span class="add-block-txt"><b>${t("share.code.label", "Код сценария")}</b><small>${t("share.code.desc", "")}</small></span></div>
            <div class="add-block-item" data-share="qr"><span class="add-block-ico" style="color:#e67e22;"><i class="fa-solid fa-qrcode"></i></span><span class="add-block-txt"><b>${t("share.qr.label", "QR-код сценария")}</b><small>${t("share.qr.desc", "")}</small></span></div>
            <div class="add-block-item" data-share="import-code"><span class="add-block-ico" style="color:#3498db;"><i class="fa-solid fa-paste"></i></span><span class="add-block-txt"><b>${t("share.importCode.label", "Импорт по коду")}</b><small>${t("share.importCode.desc", "")}</small></span></div>
            <div class="add-block-item" data-share="import-url"><span class="add-block-ico" style="color:#1abc9c;"><i class="fa-solid fa-link"></i></span><span class="add-block-txt"><b>${t("share.importUrl.label", "Импорт по URL")}</b><small>${t("share.importUrl.desc", "JSON или LZT1 по ссылке")}</small></span></div>`);
    }

    function bindGallery() {
        const menu = document.getElementById("share-menu");
        if (!menu || menu.dataset.galleryBound === "1") {
            appendShareGalleryItems();
            return;
        }
        menu.dataset.galleryBound = "1";
        appendShareGalleryItems();
        window.appendShareGalleryItems = appendShareGalleryItems;

        menu.addEventListener("click", async (e) => {
            const it = e.target.closest(".add-block-item[data-share]");
            if (!it) return;
            const k = it.dataset.share;
            if (k === "json" || k === "png" || k === "zip") return;
            if (window.LZTUi) window.LZTUi.hideFloatingMenu(menu);
            else menu.style.display = "none";
            const S = window.Scenario;
            if (k === "code" && S) {
                const code = encodeShare(S.serialize());
                navigator.clipboard.writeText(code).catch(() => {});
                await LZTDialog.alert(code, { title: "Код сценария", okText: "Закрыть" });
                S.flash("Код сценария скопирован", "ok");
            } else if (k === "qr" && S) {
                const code = encodeShare(S.serialize());
                showQrModal(code);
                S.flash("QR-код сценария", "ok");
            } else if (k === "import-code" && S) {
                const code = await LZTDialog.prompt("Вставьте код сценария (LZT1:…):", "", { title: "Импорт по коду", okText: "Импортировать" });
                if (!code) return;
                try {
                    const data = decodeShare(code);
                    if (S.hasMeaningfulWork && S.hasMeaningfulWork() && !await LZTDialog.confirm("Заменить текущий сценарий?", { title: "Импорт сценария", okText: "Заменить", danger: true })) return;
                    S.load(data);
                    S.flash("Сценарий импортирован по коду", "ok");
                } catch (err) {
                    S.flash("Неверный код сценария", "err");
                }
            } else if (k === "import-url" && S) {
                const url = await LZTDialog.prompt("URL JSON или raw (gist/paste):", "https://", { title: "Импорт по URL", okText: "Загрузить" });
                if (!url || url === "https://") return;
                try {
                    const r = await fetch("/api/import-url", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ url }),
                    });
                    const j = await r.json();
                    if (!j.ok) throw new Error(j.error || "ошибка загрузки");
                    let data;
                    const raw = String(j.content || "").trim();
                    if (/^LZT1:/i.test(raw) || /^[A-Za-z0-9+/=_-]{20,}$/.test(raw.replace(/^LZT1:/i, ""))) {
                        data = decodeShare(raw);
                    } else {
                        data = JSON.parse(raw);
                    }
                    if (S.hasMeaningfulWork && S.hasMeaningfulWork() && !await LZTDialog.confirm("Заменить текущий сценарий?", { title: "Импорт по URL", okText: "Заменить", danger: true })) return;
                    S.load(data);
                    S.flash("Сценарий импортирован по URL", "ok");
                } catch (err) {
                    S.flash("Импорт URL: " + (err.message || err), "err");
                }
            }
        });
    }

    // ==================== ШИФРОВАНИЕ ТОКЕНА ====================
    async function deriveKey(pass) {
        const enc = new TextEncoder();
        const km = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
        return crypto.subtle.deriveKey(
            { name: "PBKDF2", salt: enc.encode("lzt-constructor-v1"), iterations: 120000, hash: "SHA-256" },
            km, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
        );
    }

    async function encryptToken(token, pass) {
        const key = await deriveKey(pass);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token));
        const buf = new Uint8Array(iv.length + ct.byteLength);
        buf.set(iv); buf.set(new Uint8Array(ct), iv.length);
        return btoa(String.fromCharCode(...buf));
    }

    async function decryptToken(stored, pass) {
        const raw = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
        const iv = raw.slice(0, 12);
        const data = raw.slice(12);
        const key = await deriveKey(pass);
        const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
        return new TextDecoder().decode(pt);
    }

    function bindTokenEncryption() {
        const settings = document.querySelector("#settings-modal .modal-body");
        if (!settings || document.getElementById("set-encrypt-token")) return;
        settings.insertAdjacentHTML("beforeend", `
            <div class="form-group" style="margin-top:14px; padding-top:14px; border-top:1px solid var(--border-color);">
                <label class="step-toggle"><input type="checkbox" id="set-encrypt-token"> <span data-i18n="settings.encryptToken">Шифровать API-токен в localStorage</span></label>
                <input type="password" id="set-encrypt-pass" class="form-control" data-i18n-ph="settings.encryptPassPh" placeholder="Пароль для шифрования" style="margin-top:8px; display:none;">
            </div>
            <div class="form-group">
                <label class="step-toggle"><input type="checkbox" id="set-sound-alerts"> <span data-i18n="settings.soundAlerts">Звук при завершении сценария</span></label>
                <label class="step-toggle"><input type="checkbox" id="set-native-notify" checked> <span data-i18n="settings.nativeNotify">Windows-уведомления</span></label>
                <label class="step-toggle"><input type="checkbox" id="set-tray-minimize"> <span data-i18n="settings.trayMinimize">Сворачивать в трей (фоновый режим)</span></label>
                <p id="set-tray-hint" style="display:none; font-size:11px; color:var(--text-muted); margin:4px 0 0 22px;" data-i18n="settings.trayHint">Трей недоступен — установите: pip install pystray Pillow</p>
            </div>`);

        const chk = document.getElementById("set-encrypt-token");
        const pass = document.getElementById("set-encrypt-pass");
        chk.checked = localStorage.getItem("lzt_token_enc") === "1";
        pass.style.display = chk.checked ? "block" : "none";
        document.getElementById("set-sound-alerts").checked = localStorage.getItem("lzt_sound") === "1";
        document.getElementById("set-native-notify").checked = localStorage.getItem("lzt_native_notify") !== "0";
        document.getElementById("set-tray-minimize").checked = localStorage.getItem("lzt_tray_minimize") === "1";

        chk.addEventListener("change", () => {
            pass.style.display = chk.checked ? "block" : "none";
            localStorage.setItem("lzt_token_enc", chk.checked ? "1" : "0");
        });
        document.getElementById("set-sound-alerts").addEventListener("change", (e) => {
            localStorage.setItem("lzt_sound", e.target.checked ? "1" : "0");
        });
        document.getElementById("set-native-notify").addEventListener("change", (e) => {
            localStorage.setItem("lzt_native_notify", e.target.checked ? "1" : "0");
        });
        document.getElementById("set-tray-minimize").addEventListener("change", (e) => {
            if (e.target.disabled) return;
            localStorage.setItem("lzt_tray_minimize", e.target.checked ? "1" : "0");
        });

        (async () => { await refreshTrayStatus(); })();

        async function tryLoadEncryptedToken() {
            const enc = localStorage.getItem("lzt_api_token_enc");
            if (localStorage.getItem("lzt_token_enc") !== "1" || !enc || !window.LZTToken) return;
            const p = pass.value || sessionStorage.getItem("lzt_token_pass") || await LZTDialog.prompt("Пароль для расшифровки API-токена:", "", { title: "Расшифровка токена", okText: "OK" });
            if (!p) return;
            sessionStorage.setItem("lzt_token_pass", p);
            try {
                const token = await decryptToken(enc, p);
                if (token) window.LZTToken.set(token);
            } catch (e) { /* неверный пароль */ }
        }
        tryLoadEncryptedToken();
        pass.addEventListener("change", tryLoadEncryptedToken);

        if (window.LZTToken) {
            let sessionPlain = null;
            const origSet = window.LZTToken.set.bind(window.LZTToken);
            const origGet = window.LZTToken.get.bind(window.LZTToken);
            window.LZTToken.set = function (token) {
                sessionPlain = token;
                if (localStorage.getItem("lzt_token_enc") === "1" && pass.value) {
                    encryptToken(token, pass.value).then(enc => {
                        localStorage.setItem("lzt_api_token_enc", enc);
                        localStorage.removeItem("lzt_api_token");
                    }).catch(() => origSet(token));
                } else origSet(token);
            };
            window.LZTToken.get = function () {
                if (sessionPlain != null) return sessionPlain;
                return origGet();
            };
            pass.addEventListener("change", async () => {
                const enc = localStorage.getItem("lzt_api_token_enc");
                if (enc && pass.value) {
                    try { sessionPlain = await decryptToken(enc, pass.value); } catch (e) {}
                }
            });
        }
    }

    // ==================== АВТООБНОВЛЕНИЕ ====================
    function parseSemver(v) {
        const m = String(v || "").replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)/);
        return m ? [+m[1], +m[2], +m[3]] : null;
    }

    function semverGt(a, b) {
        const pa = parseSemver(a), pb = parseSemver(b);
        if (!pa || !pb) return String(a) !== String(b);
        for (let i = 0; i < 3; i++) {
            if (pa[i] > pb[i]) return true;
            if (pa[i] < pb[i]) return false;
        }
        return false;
    }

    async function checkUpdates() {
        const banner = document.getElementById("update-banner");
        if (banner) banner.remove();
        try {
            const r = await fetch("/api/version");
            const d = await r.json();
            const remote = (d.latest || "").replace(/^v/, "");
            const dismissed = localStorage.getItem("lzt_dismissed_version") || "";
            if (!remote || !semverGt(remote, APP_VERSION) || !d.download_url) return;
            if (dismissed === remote) return;
            const b = document.createElement("div");
            b.id = "update-banner";
            b.className = "update-banner";
            b.innerHTML = `<span>Доступна версия <b>${remote}</b> (у вас ${APP_VERSION})</span>
                <a href="#" id="update-link">Скачать</a><button id="update-dismiss">&times;</button>`;
            document.body.appendChild(b);
            b.querySelector("#update-link").addEventListener("click", (e) => {
                e.preventDefault();
                fetch("/api/open-browser", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: d.download_url }) });
            });
            b.querySelector("#update-dismiss").addEventListener("click", () => {
                localStorage.setItem("lzt_dismissed_version", remote);
                b.remove();
            });
        } catch (e) { /* offline */ }
    }

    // ==================== ЗВУК + УВЕДОМЛЕНИЯ ПОСЛЕ RUN ====================
    function hookRunComplete() {
        const S = window.Scenario;
        if (!S || S._featuresHooked) return;
        S._featuresHooked = true;
        const origRun = S.run.bind(S);
        S.run = async function (opts) {
            const out = await origRun(opts);
            if (!out || out.error === "busy") return out;
            const spent = S._runStats?.spent || 0;
            if (S._runStats && (S._runCompleted || spent > 0)) {
                S._runStats._finalize = true;
                updateProfit(S._runStats);
            }
            if (!S._runCompleted || out.aborted) return out;
            if (localStorage.getItem("lzt_sound") === "1") {
                try {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    const o = ctx.createOscillator();
                    const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination);
                    o.frequency.value = 880; g.gain.value = 0.08;
                    o.start(); o.stop(ctx.currentTime + 0.15);
                } catch (e) {}
            }
            if (localStorage.getItem("lzt_native_notify") !== "0" && window.LZTFS) {
                const st = S._runStats || {};
                window.LZTFS.nativeNotify("Сценарий завершён", `${S.title}: ${st.reqOk || 0} OK, ${st.reqErr || 0} ошибок`);
            }
            if (window.LZTToast) {
                const st = S._runStats || {};
                const ok = (st.reqErr || 0) === 0;
                LZTToast("Сценарий завершён", `${S.title}: ${st.reqOk || 0} OK, ${st.reqErr || 0} ошибок`, { type: ok ? "success" : "warn" });
            }
            return out;
        };
    }

    // ==================== ИМПОРТ JSON ЧЕРЕЗ ДИАЛОГ ====================
    function bindImportDialog() {
        document.getElementById("btn-import-scn")?.addEventListener("click", async (e) => {
            if (!window.LZTFS || !window.LZTFS.hasNative()) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            const r = await window.LZTFS.openText(".json");
            if (r.ok && r.content && window.Scenario) {
                try {
                    const data = JSON.parse(r.content);
                    if (window.Scenario.hasMeaningfulWork && window.Scenario.hasMeaningfulWork() && !await LZTDialog.confirm("Импорт заменит текущий сценарий. Продолжить?", { title: "Импорт", okText: "Импортировать", danger: true })) return;
                    window.Scenario.load(data);
                    window.Scenario.flash("Сценарий импортирован", "ok");
                } catch (err) {
                    window.Scenario.flash("Не удалось прочитать файл", "err");
                }
            }
        }, true);
    }

    async function refreshTrayStatus() {
        const trayChk = document.getElementById("set-tray-minimize");
        const trayHint = document.getElementById("set-tray-hint");
        if (!trayChk) return;
        let ok = false;
        const probe = async () => {
            if (!window.pywebview?.api?.tray_available) return false;
            try { return await window.pywebview.api.tray_available(); } catch (e) { return false; }
        };
        for (let n = 0; n < 40; n++) {
            ok = await probe();
            if (ok) break;
            await new Promise(r => setTimeout(r, 250));
        }
        if (ok) {
            trayChk.disabled = false;
            trayChk.checked = localStorage.getItem("lzt_tray_minimize") === "1";
            if (trayHint) trayHint.style.display = "none";
        } else if (!window.pywebview?.api) {
            trayChk.disabled = true;
            trayChk.checked = false;
            if (trayHint) trayHint.style.display = "none";
        } else {
            trayChk.disabled = true;
            trayChk.checked = localStorage.getItem("lzt_tray_minimize") === "1";
            if (trayHint) trayHint.style.display = "block";
        }
    }

    function refreshSettingsI18n() {
        if (!window.I18N) return;
        document.querySelectorAll("#settings-modal [data-i18n]").forEach(el => {
            const v = I18N.t(el.getAttribute("data-i18n"));
            if (v != null) el.textContent = v;
        });
        document.querySelectorAll("#settings-modal [data-i18n-ph]").forEach(el => {
            el.placeholder = I18N.t(el.getAttribute("data-i18n-ph"));
        });
    }

    window.refreshTrayStatus = refreshTrayStatus;
    window.refreshSettingsI18n = refreshSettingsI18n;

    document.addEventListener("DOMContentLoaded", () => {
        initProfitWidget();
        bindGallery();
        bindTokenEncryption();
        if (window.I18N) I18N.apply();
        refreshSettingsI18n();
        hookRunComplete();
        bindImportDialog();
        setTimeout(checkUpdates, 5000);
    });

    // Вкладки — только после инициализации Scenario (иначе сохраняются пустые данные)
    window.addEventListener("lzt-scenario-ready", () => {
        initScenarioTabs();
    });

    window.addEventListener("pywebviewready", () => {
        refreshTrayStatus();
    });

    window.LZTFeatures = Object.assign(window.LZTFeatures || {}, {
        updateProfit,
        updateRunDash,
        encodeShare,
        decodeShare,
        APP_VERSION,
    });
})();
