let currentMethod = "GET";
let currentUrl = "https://prod-api.lzt.market/steam";
let currentParams = {};
let currentBody = null;
let currentHeaders = {};

function escHtml(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Хранилища — после LZTStorage.ready() (см. loadPersistedAppState)
let customTemplates = [];

function loadPersistedAppState() {
    customTemplates = JSON.parse(localStorage.getItem("lzt_custom_templates") || "[]");
    const syncedDataV2 = JSON.parse(localStorage.getItem("lzt_synced_params_v2") || "{}");
    Object.keys(syncedDataV2).forEach(k => {
        PARAM_DATA[k] = syncedDataV2[k];
    });
    const oldSynced = JSON.parse(localStorage.getItem("lzt_synced_params") || "{}");
    Object.keys(oldSynced).forEach(k => {
        if (!PARAM_DATA[k]) {
            PARAM_DATA[k] = { desc: oldSynced[k], cat: detectCategory(k) };
        }
    });
}

function detectCategory(k) {
    const key = k.toLowerCase();
    if (key.includes("steam") || key.includes("csgo") || key.includes("dota") || key === "game[]" || key.includes("hours")) return "steam";
    if (key.includes("telegram") || key === "tdata" || key === "session" || key === "two_fa") return "telegram";
    if (key.includes("discord") || key.includes("nitro") || key === "badge[]" || key === "guilds_count") return "discord";
    if (key.includes("fortnite") || key.includes("vbucks")) return "fortnite";
    if (key.includes("valorant") || key.includes("riot")) return "riot";
    if (key.includes("genshin") || key.includes("primogems")) return "genshin";
    if (key.includes("roblox") || key.includes("robux")) return "roblox";
    if (key.includes("gta") || key.includes("social")) return "gta5";
    if (key.includes("user_id") || key.includes("thread") || key.includes("post") || key.includes("forum") || key === "comment" || key === "amount" || key === "secret_answer" || key === "hold_time" || key === "recipient_id") return "forum";
    return "market_general";
}

document.addEventListener("DOMContentLoaded", async () => {
    if (window.LZTStorage) await LZTStorage.ready();
    loadPersistedAppState();

    initAccordions();
    renderTemplates();
    renderCustomTemplates();

    // Конструктор: загрузка OpenAPI-каталога и привязка UI (URL, выбор эндпоинта, параметры)
    await Constructor.init();
    // Холст сценариев (центральная область)
    if (window.Scenario) await Scenario.init();

    document.getElementById("req-method")?.addEventListener("change", (e) => {
        currentMethod = e.target.value;
        if (Constructor.endpoint && Constructor.endpoint.method !== currentMethod) {
            Constructor.detach();
            Constructor.renderForm();
        }
    });

    // Управление токеном и модальными окнами
    const savedToken = localStorage.getItem("lzt_api_token") || "";
    const hiddenTokenInput = document.getElementById("api-token");
    const modalTokenInput = document.getElementById("modal-api-token");
    const btnOpenModal = document.getElementById("btn-open-token-modal");
    const tokenStatusText = document.getElementById("token-status-text");
    const tokenModal = document.getElementById("token-modal");

    function updateTokenState(token) {
        hiddenTokenInput.value = token;
        modalTokenInput.value = token;
        if (token) {
            currentHeaders["Authorization"] = `Bearer ${token}`;
            btnOpenModal.classList.add("has-token");
            tokenStatusText.innerHTML = `<i class="fa-solid fa-check" style="color: var(--lzt-green);"></i> ${(window.I18N && I18N.t("token.connected")) || "Токен подключен"}`;
        } else {
            delete currentHeaders["Authorization"];
            btnOpenModal.classList.remove("has-token");
            tokenStatusText.innerText = (window.I18N && I18N.t("token.setupFirst")) || "Шаг 1: API-токен";
        }
        // Даём блоку «Старт» обновить свой вид
        if (window.Scenario && Scenario.nodesLayer) Scenario.refreshStartNode();
    }

    window.refreshTokenStatus = () => updateTokenState(localStorage.getItem("lzt_api_token") || "");

    // Глобальный доступ к токену для блока «Старт» в конструкторе сценариев
    window.LZTToken = {
        get: () => localStorage.getItem("lzt_api_token") || "",
        set: (token) => {
            const t = (token || "").trim();
            localStorage.setItem("lzt_api_token", t);
            updateTokenState(t);
        },
        openGetPage: () => {
            fetch("/api/open-browser", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: "https://zelenka.guru/account/api" })
            });
        }
    };

    if (savedToken) {
        updateTokenState(savedToken);
    }

    btnOpenModal.addEventListener("click", () => {
        // Токен настраивается в блоке «Старт» на холсте — шапка ведёт туда же
        if (window.Scenario && Scenario.openStartTokenEditor && Scenario.openStartTokenEditor()) return;
        LZTUi.showOverlay(tokenModal);
    });
    document.getElementById("btn-close-modal").addEventListener("click", () => LZTUi.hideOverlay(tokenModal));

    // Управление окном: сначала прямой IPC pywebview (надёжно, не зависит от HTTP/порта),
    // затем запасной путь через HTTP-эндпоинт.
    const winAction = (apiMethod, httpPath) => {
        const api = window.pywebview && window.pywebview.api;
        if (api && typeof api[apiMethod] === "function") {
            try { api[apiMethod](); return; } catch (e) {}
        }
        fetch(httpPath, { method: "POST" }).catch(() => {});
    };
    document.getElementById("win-min")?.addEventListener("click", () => {
        if (localStorage.getItem("lzt_tray_minimize") === "1" && window.pywebview && window.pywebview.api.minimize_to_tray) {
            try { window.pywebview.api.minimize_to_tray(); return; } catch (e) {}
        }
        winAction("minimize", "/api/window/minimize");
    });
    document.getElementById("win-max")?.addEventListener("click", () => winAction("maximize", "/api/window/maximize"));
    document.getElementById("win-close")?.addEventListener("click", () => winAction("close", "/api/window/close"));

    const MIN_WIN_W = 1100;
    const MIN_WIN_H = 700;
    let winResize = null;

    const applyWinResize = (e) => {
        if (!winResize || e.pointerId !== winResize.pid) return;
        const dx = e.screenX - winResize.startX;
        const dy = e.screenY - winResize.startY;
        let { left, top, width, height, hit } = winResize;
        if (hit === 10 || hit === 13 || hit === 16) {
            left += dx;
            width -= dx;
        }
        if (hit === 11 || hit === 14 || hit === 17) width += dx;
        if (hit === 12 || hit === 13 || hit === 14) {
            top += dy;
            height -= dy;
        }
        if (hit === 15 || hit === 16 || hit === 17) height += dy;
        if (width < MIN_WIN_W) {
            if (hit === 10 || hit === 13 || hit === 16) left -= (MIN_WIN_W - width);
            width = MIN_WIN_W;
        }
        if (height < MIN_WIN_H) {
            if (hit === 12 || hit === 13 || hit === 14) top -= (MIN_WIN_H - height);
            height = MIN_WIN_H;
        }
        if (window.pywebview?.api?.set_window_bounds) {
            window.pywebview.api.set_window_bounds(Math.round(left), Math.round(top), Math.round(width), Math.round(height));
        }
    };

    document.querySelectorAll("#win-resize-handles .wre").forEach(el => {
        el.addEventListener("pointerdown", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!window.pywebview?.api?.get_window_bounds) return;
            const b = await window.pywebview.api.get_window_bounds();
            if (!b || !b.ok) return;
            const hit = parseInt(el.dataset.hit, 10);
            winResize = {
                hit,
                pid: e.pointerId,
                startX: e.screenX,
                startY: e.screenY,
                left: b.left,
                top: b.top,
                width: b.width,
                height: b.height
            };
            try { el.setPointerCapture(e.pointerId); } catch (err) {}
        });
        el.addEventListener("pointermove", applyWinResize);
        el.addEventListener("pointerup", (e) => {
            if (winResize && e.pointerId === winResize.pid) winResize = null;
        });
        el.addEventListener("pointercancel", (e) => {
            if (winResize && e.pointerId === winResize.pid) winResize = null;
        });
    });

    // Перетаскивание окна: считаем дельту движения мыши и двигаем окно нативно.
    // Так надёжнее, чем WM_NCLBUTTONDOWN из фонового потока (там ReleaseCapture не срабатывает).
    const headerEl = document.querySelector('header');
    if (headerEl) {
        let dragging = false;
        let lastX = 0, lastY = 0;
        let pending = false;

        const moveWindow = (dx, dy) => {
            if (window.pywebview && window.pywebview.api && window.pywebview.api.move_by) {
                window.pywebview.api.move_by(dx, dy);
            } else {
                if (pending) return;
                pending = true;
                fetch("/api/window/move-by", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ dx, dy })
                }).finally(() => { pending = false; });
            }
        };

        headerEl.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            if (e.target.closest('input, button, select, .window-controls, .header-search, .nav-link, .eye-logo, [style*="no-drag"]')) return;
            dragging = true;
            lastX = e.screenX;
            lastY = e.screenY;
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const dx = e.screenX - lastX;
            const dy = e.screenY - lastY;
            if (dx === 0 && dy === 0) return;
            lastX = e.screenX;
            lastY = e.screenY;
            moveWindow(dx, dy);
        });

        window.addEventListener('mouseup', () => { dragging = false; });
        window.addEventListener('blur', () => { dragging = false; });

        // Двойной клик по шапке — развернуть/восстановить
        headerEl.addEventListener('dblclick', (e) => {
            if (e.target.closest('input, button, select, .window-controls, .header-search, .nav-link, .eye-logo, [style*="no-drag"]')) return;
            fetch("/api/window/maximize", { method: "POST" });
        });
    }

    document.getElementById("btn-save-token").addEventListener("click", () => {
        const token = modalTokenInput.value.trim();
        localStorage.setItem("lzt_api_token", token);
        updateTokenState(token);
        LZTUi.hideOverlay(tokenModal);
    });

    document.getElementById("btn-get-token").addEventListener("click", () => {
        fetch("/api/open-browser", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: "https://zelenka.guru/account/api" })
        });
    });

    // Синхронизация базы описаний параметров с живым API (переиспользуется в блоке «Старт»)
    window.LZTSyncSpec = async function () {
        const res = await fetch("/api/sync-spec");
        const data = await res.json();
        if (data.status === "ok") {
            Object.keys(data.params).forEach(k => {
                const item = data.params[k];
                const desc = typeof item === 'string' ? item : (item.desc || item.description || "Параметр API");
                const catStr = typeof item === 'object' && item.category ? item.category : "";
                let cat = detectCategory(k);
                if (catStr.includes("Steam")) cat = "steam";
                else if (catStr.includes("Telegram")) cat = "telegram";
                else if (catStr.includes("Discord")) cat = "discord";
                else if (catStr.includes("Fortnite") || catStr.includes("Riot")) cat = "fortnite";
                else if (catStr.includes("Форум")) cat = "forum";

                PARAM_DATA[k] = { desc, cat };
            });
            localStorage.setItem("lzt_synced_params_v2", JSON.stringify(PARAM_DATA));
            return { ok: true, count: Object.keys(PARAM_DATA).length };
        }
        return { ok: false };
    };

    // Кнопка синхронизации базы API
    document.getElementById("btn-sync-api").addEventListener("click", async () => {
        const btn = document.getElementById("btn-sync-api");
        const origText = btn.innerHTML;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Синхронизация...`;
        try {
            const r = await window.LZTSyncSpec();
            if (r.ok) {
                btn.innerHTML = `<i class="fa-solid fa-check"></i> База обновлена (${r.count} пар.)`;
                btn.style.background = "#2cb674";
                setTimeout(() => {
                    btn.innerHTML = origText;
                    btn.style.background = "#3594bc";
                }, 3000);
            }
        } catch (err) {
            btn.innerHTML = `❌ Ошибка сети`;
            setTimeout(() => btn.innerHTML = origText, 2000);
        }
    });

    // Модальное окно Встроенной Документации
    const docsModal = document.getElementById("docs-modal");
    document.getElementById("btn-open-docs").addEventListener("click", () => {
        const search = document.getElementById("docs-search");
        if (search) search.value = "";
        if (window.renderDocs) window.renderDocs();
        LZTUi.showOverlay(docsModal);
    });
    document.getElementById("btn-close-docs").addEventListener("click", () => LZTUi.hideOverlay(docsModal));

    const btnNewReq = document.getElementById("btn-new-request");
    if (btnNewReq) {
        btnNewReq.addEventListener("click", () => {
            if (window.LZTFeatures?.addScenarioTab) {
                window.LZTFeatures.addScenarioTab();
            } else if (window.Scenario) {
                Scenario.newScenario();
            } else {
                Constructor.newRequest();
            }
        });
    }

    const globalSearchInput = document.getElementById("global-search-input");
    const globalSearchBox = document.getElementById("global-search-box");
    if (globalSearchInput && globalSearchBox) {
        const renderGlobalSearch = (q) => {
            globalSearchBox.innerHTML = "";
            if (!q) {
                globalSearchBox.style.display = "none";
                return;
            }
            const qLow = q.toLowerCase();
            const matchingScenarios = window.Scenario
                ? Scenario.examples().filter(ex => ex.title.toLowerCase().includes(qLow) || (ex.desc || "").toLowerCase().includes(qLow)).slice(0, 4)
                : [];
            const matchingTpls = TEMPLATES.filter(t => t.title.toLowerCase().includes(qLow) || t.url.toLowerCase().includes(qLow)).slice(0, 5);
            const matchingParams = Object.keys(PARAM_DATA).filter(k => k.toLowerCase().includes(qLow) || (PARAM_DATA[k].desc && PARAM_DATA[k].desc.toLowerCase().includes(qLow))).slice(0, 10);

            if (matchingScenarios.length === 0 && matchingTpls.length === 0 && matchingParams.length === 0) {
                globalSearchBox.innerHTML = `<div style="padding: 12px; color: var(--text-muted); text-align: center; font-size: 13px;">Ничего не найдено</div>`;
                globalSearchBox.style.display = "flex";
                return;
            }

            if (matchingScenarios.length > 0) {
                const titleEl = document.createElement("div");
                titleEl.style.padding = "6px 12px";
                titleEl.style.fontSize = "11px";
                titleEl.style.color = "var(--text-muted)";
                titleEl.style.fontWeight = "bold";
                titleEl.style.background = "var(--bg-card)";
                titleEl.innerText = "ГОТОВЫЕ СЦЕНАРИИ";
                globalSearchBox.appendChild(titleEl);

                matchingScenarios.forEach(ex => {
                    const item = document.createElement("div");
                    item.className = "autocomplete-item";
                    item.innerHTML = `
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <span class="autocomplete-item-key" style="color: #fff;">${ex.title}</span>
                            <span style="font-size: 10px; background: rgba(53, 148, 188, 0.2); color: #3594bc; padding: 2px 6px; border-radius: 4px;">Открыть</span>
                        </div>
                        <span class="autocomplete-item-desc">${ex.desc || ""}</span>
                    `;
                    item.addEventListener("click", () => {
                        Scenario.load(ex.build());
                        globalSearchInput.value = "";
                        globalSearchBox.style.display = "none";
                    });
                    globalSearchBox.appendChild(item);
                });
            }

            if (matchingTpls.length > 0) {
                const titleEl = document.createElement("div");
                titleEl.style.padding = "6px 12px";
                titleEl.style.fontSize = "11px";
                titleEl.style.color = "var(--text-muted)";
                titleEl.style.fontWeight = "bold";
                titleEl.style.background = "var(--bg-card)";
                titleEl.innerText = window.Scenario ? "БЛОКИ-ЗАПРОСЫ (ПРИМЕРЫ API)" : "ГОТОВЫЕ ПРИМЕРЫ API";
                globalSearchBox.appendChild(titleEl);

                matchingTpls.forEach(tpl => {
                    const item = document.createElement("div");
                    item.className = "autocomplete-item";
                    item.innerHTML = `
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <span class="autocomplete-item-key" style="color: #fff;">${tpl.title}</span>
                            <span style="font-size: 10px; background: rgba(0, 186, 120, 0.2); color: #00ba78; padding: 2px 6px; border-radius: 4px;">${window.Scenario ? "+ Блок" : "Загрузить"}</span>
                        </div>
                        <span class="autocomplete-item-desc">${tpl.url}</span>
                    `;
                    item.addEventListener("click", () => {
                        loadTemplate(tpl);
                        globalSearchInput.value = "";
                        globalSearchBox.style.display = "none";
                    });
                    globalSearchBox.appendChild(item);
                });
            }

            if (matchingParams.length > 0) {
                const titleEl = document.createElement("div");
                titleEl.style.padding = "6px 12px";
                titleEl.style.fontSize = "11px";
                titleEl.style.color = "var(--text-muted)";
                titleEl.style.fontWeight = "bold";
                titleEl.style.background = "var(--bg-card)";
                titleEl.innerText = "ПАРАМЕТРЫ ЗАПРОСА";
                globalSearchBox.appendChild(titleEl);

                matchingParams.forEach(k => {
                    const itemObj = PARAM_DATA[k];
                    const item = document.createElement("div");
                    item.className = "autocomplete-item";
                    item.innerHTML = `
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <span class="autocomplete-item-key" style="color: var(--lzt-green);">${k}</span>
                            <span style="font-size: 10px; background: rgba(53, 148, 188, 0.2); color: #3594bc; padding: 2px 6px; border-radius: 4px;">+ Добавить</span>
                        </div>
                        <span class="autocomplete-item-desc">${itemObj.desc}</span>
                    `;
                    item.addEventListener("click", () => {
                        if (window.Scenario) {
                            const params = {};
                            params[k] = "";
                            Scenario.addRequestFromTemplate({ method: "GET", url: "https://prod-api.lzt.market/", params, title: "Запрос с параметром" });
                        } else {
                            Constructor.addParam(k);
                        }
                        globalSearchInput.value = "";
                        globalSearchBox.style.display = "none";
                    });
                    globalSearchBox.appendChild(item);
                });
            }
            globalSearchBox.style.display = "flex";
        };

        globalSearchInput.addEventListener("input", (e) => renderGlobalSearch(e.target.value.trim()));
        globalSearchInput.addEventListener("focus", () => {
            if (globalSearchInput.value.trim()) renderGlobalSearch(globalSearchInput.value.trim());
        });
        document.addEventListener("click", (e) => {
            if (!e.target.closest(".header-search")) globalSearchBox.style.display = "none";
        });
    }
});

function initAccordions() {
    document.querySelectorAll(".accordion").forEach(acc => {
        const header = acc.querySelector(".accordion-header");
        if (header) {
            header.style.cursor = "pointer";
            header.addEventListener("click", () => {
                acc.classList.toggle("active");
            });
        }
    });
}

function openAccordion(name) {
    const accordions = document.querySelectorAll(".accordion");
    if (name === "examples" && accordions[0]) {
        accordions[0].classList.add("active");
    } else if (name === "templates" && accordions[1]) {
        accordions[1].classList.add("active");
    }
}

function renderTemplates() {
    const marketContainer = document.getElementById("templates-market") || document.getElementById("templates-list");
    const forumContainer = document.getElementById("templates-forum") || document.getElementById("templates-forum-list");
    if (marketContainer) marketContainer.innerHTML = "";
    if (forumContainer) forumContainer.innerHTML = "";

    TEMPLATES.forEach(tpl => {
        const div = document.createElement("div");
        div.className = "tpl-row";
        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
                <span class="icon" style="color: var(--lzt-green);"><i class="${tpl.iconClass || 'fa-solid fa-code'}"></i></span>
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${tpl.title}</span>
            </div>`;
        div.title = tpl.desc;

        div.addEventListener("click", () => {
            document.querySelectorAll(".tpl-row").forEach(el => el.classList.remove("active"));
            div.classList.add("active");
            loadTemplate(tpl);
        });

        if (tpl.category === "market" && marketContainer) {
            marketContainer.appendChild(div);
        } else if (forumContainer) {
            forumContainer.appendChild(div);
        }
    });
}

function renderCustomTemplates() {
    // «Мои сценарии» отрисовывает Scenario (localStorage lzt_scenarios).
    if (window.Scenario) { Scenario.renderSaved(); return; }
    const container = document.getElementById("custom-templates-list");
    if (!container) return;
    container.innerHTML = "";

    if (customTemplates.length === 0) {
        container.innerHTML = `<span style="font-size: 12px; color: var(--text-muted); padding: 4px 8px;">У вас пока нет сохранённых шаблонов. Нажмите + чтобы добавить текущий запрос.</span>`;
        return;
    }

    customTemplates.forEach((tpl, index) => {
        const div = document.createElement("div");
        div.className = "tpl-row";
        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
                <span class="icon" style="color: #3594bc;"><i class="fa-solid fa-file-code"></i></span>
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${tpl.title}</span>
            </div>
            <i class="fa-solid fa-trash" style="color: var(--text-muted); font-size: 12px; padding: 4px;" title="Удалить шаблон"></i>
        `;

        div.addEventListener("click", () => {
            document.querySelectorAll(".tpl-row").forEach(el => el.classList.remove("active"));
            div.classList.add("active");
            loadTemplate(tpl);
        });

        div.querySelector(".fa-trash").addEventListener("click", (e) => {
            e.stopPropagation();
            customTemplates.splice(index, 1);
            localStorage.setItem("lzt_custom_templates", JSON.stringify(customTemplates));
            renderCustomTemplates();
        });

        container.appendChild(div);
    });
}

function loadTemplate(tpl) {
    // В режиме сценариев клик по «блоку-запросу» создаёт новый мини-сценарий (Старт → Запрос).
    if (window.Scenario) {
        Scenario.addRequestFromTemplate(tpl).catch((err) => {
            console.error("loadTemplate:", err);
            Scenario.flash("Не удалось загрузить запрос", "err");
        });
    } else {
        Constructor.loadTemplate(tpl);
    }
}
