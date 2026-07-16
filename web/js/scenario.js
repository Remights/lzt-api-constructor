// Визуальный конструктор сценариев (нод-граф) для LZT API.
// Блоки: Старт, Запрос, Условие (Да/Нет), Задержка, Стоп. Соединяются линиями через порты.
// Нода-«Запрос» переиспользует конструктор (Constructor + глобальные currentUrl/... из app.js).
// Умеет: реально выполнять цепочку через /api/test и генерировать цельный Python-скрипт-бот.

const NODE_TYPES = window.ScenarioConstants.NODE_TYPES;
const OP_LABELS = window.ScenarioConstants.OP_LABELS;

const Scenario = {
    nodes: [],
    edges: [],
    seq: 1,
    scale: 1,
    panX: 40,
    panY: 20,
    title: "Новый сценарий",
    currentId: null,           // id текущего сохранённого сценария (для перезаписи)
    selectedNode: null,
    editingNodeId: null,
    running: false,
    _runBusy: false,
    _runToken: null,
    _runCompleted: false,
    scriptLang: "python",      // выбранный язык скрипта-бота

    history: [],               // стек состояний для отмены/повтора
    histIndex: -1,
    _restoring: false,
    lastRunData: {},           // nodeId -> ответ (для пикера {{last...}})

    // временные состояния взаимодействий
    _drag: null,               // перетаскивание ноды
    _pan: null,                // панорамирование
    _connect: null,            // протяжка связи

    async init() {
        this.viewport = document.getElementById("canvas-viewport");
        this.world = document.getElementById("canvas-world");
        this.nodesLayer = document.getElementById("canvas-nodes");
        this.svg = document.getElementById("canvas-edges");
        if (!this.viewport) return;

        if (window.LZTScenarioStore) await LZTScenarioStore.hydrate();

        this.bindCanvas();
        this.bindToolbar();
        this.bindTitle();
        this.bindRun();
        this.bindMinimapAndSearch();
        this.renderExamples();
        this.renderSaved();

        // Сначала вкладки (если есть), иначе автосохранение черновика — но не до первого обучения
        const isFirstTour = !localStorage.getItem("lzt_tour_done");
        try {
            let tabsRaw = !isFirstTour ? localStorage.getItem("lzt_scenario_tabs") : null;
            if (!isFirstTour && window.LZTScenarioStore) {
                const diskTabs = await LZTScenarioStore.loadTabs();
                if (diskTabs) tabsRaw = JSON.stringify(diskTabs);
            }
            if (tabsRaw) {
                const st = JSON.parse(tabsRaw);
                const tab = st && st.tabs && st.tabs[st.active];
                if (tab && tab.data && Array.isArray(tab.data.nodes) && tab.data.nodes.length) {
                    this.load(tab.data, { keepView: true });
                    this.maybeStartTour();
                    window.dispatchEvent(new Event("lzt-scenario-ready"));
                    return;
                }
            }
        } catch (e) { /* битые вкладки — пробуем автосейв */ }

        // Восстановление незавершённой работы (автосохранение)
        let auto = !isFirstTour ? localStorage.getItem("lzt_scenario_autosave") : null;
        if (!isFirstTour && window.LZTScenarioStore) {
            const diskAuto = await LZTScenarioStore.loadAutosave();
            if (diskAuto) auto = JSON.stringify(diskAuto);
        }
        if (auto) {
            try {
                const d = JSON.parse(auto);
                if (d && Array.isArray(d.nodes) && d.nodes.filter(n => n.type !== "start").length) {
                    this.load(d);
                    this.maybeStartTour();
                    window.dispatchEvent(new Event("lzt-scenario-ready"));
                    return;
                }
            } catch (e) { /* повреждённый автосейв — игнорируем */ }
        }
        this.newScenario();
        this.maybeStartTour();
        requestAnimationFrame(() => requestAnimationFrame(() => this.fitView()));
        window.dispatchEvent(new Event("lzt-scenario-ready"));
    },

    maybeStartTour() {
        if (localStorage.getItem("lzt_tour_done") || this._tourAutoStarted) return;
        this._tourAutoStarted = true;
        setTimeout(() => this.startTour(), 600);
    },

    startTour() {
        if (!window.LZTTour) return;
        this.newScenario();
        this.commit();
        if (window.LZTFeatures?.syncActiveTab) window.LZTFeatures.syncActiveTab();
        window.LZTTour.start();
    },


    genId(prefix = "n") { return prefix + (this.seq++); },
    defaultTitle() {
        return (window.I18N && I18N.t("scenario.new")) || "Новый сценарий";
    },
    tabTitle(n) {
        const tpl = (window.I18N && I18N.t("scenario.tab")) || "Сценарий {n}";
        return tpl.replace("{n}", String(n));
    },
    getNode(id) { return this.nodes.find(n => n.id === id); },
    edgeTarget(nodeId, port) { const e = this.edges.find(e => e.from === nodeId && e.fromPort === port); return e ? e.to : null; },
    // Как edgeTarget, но дополнительно подсвечивает пройденную связь во время прогона
    followEdge(nodeId, port) {
        const e = this.edges.find(e => e.from === nodeId && e.fromPort === port);
        this._activeEdge = e ? e.id : null;
        this.redrawEdges();
        return e ? e.to : null;
    },

    // ==================== СОЗДАНИЕ / СБРОС ====================

    newScenario() {
        this.nodes = [];
        this.edges = [];
        this.seq = 1;
        this.title = this.defaultTitle();
        this.currentId = null;
        this._scenarioIsDemo = false;
        this.selectedNode = null;
        this.scale = 1; this.panX = 40; this.panY = 20;
        this.addNode("start", 60, 240);
        this.applyTransform();
        this.render();
        this.updateTitle();
        this.updateRunHint();
        this.regenScript();
        this.autosave();
        this.resetHistory();
    },

    updateRunHint() {
        const hint = document.querySelector(".run-action-hint");
        if (!hint) return;
        const tr = (k, fb) => (window.I18N && I18N.t(k)) || fb;
        hint.textContent = this._scenarioIsDemo
            ? tr("run.demoRunHint", "Mock-данные · токен не нужен")
            : tr("run.liveHint", "С вашим API-токеном");
    },

    updateTitle() {
        const el = document.getElementById("scenario-title");
        if (el) {
            el.textContent = this.title;
            const hint = (window.I18N && I18N.t("toolbar.renameHint")) || "Двойной клик — переименовать";
            el.title = `${this.title || ""}\n${hint}`;
        }
    },

    bindTitle() {
        const el = document.getElementById("scenario-title");
        const btn = document.getElementById("btn-rename-scenario");
        const run = () => this.renameScenario();
        el?.addEventListener("dblclick", (e) => { e.preventDefault(); run(); });
        btn?.addEventListener("click", (e) => { e.stopPropagation(); run(); });
    },

    async renameScenario() {
        const fb = this.title || this.defaultTitle();
        const t = (k) => (window.I18N && I18N.t(k)) || k;
        const name = await LZTDialog.prompt(t("dialog.rename.prompt"), fb, {
            title: t("dialog.rename.title"),
            okText: t("dialog.rename.ok"),
        });
        if (name == null) return;
        const trimmed = String(name).trim();
        if (!trimmed) return;
        this.title = trimmed;
        this.updateTitle();
        this.commit();
    },

    defaultData(type) {
        if (type === "request") return { request: { method: "GET", url: "https://prod-api.lzt.market/", params: {}, body: null, headers: {}, title: "Новый запрос", retries: 0, retryDelay: 1000, timeout: 15, respectRateLimit: true } };
        if (type === "condition") return { condition: { left: "last.items.length", op: ">", right: "0" } };
        if (type === "delay") return { delay: { ms: 1000 } };
        if (type === "loop") return { loop: { times: 3 } };
        if (type === "variable") return { variable: { name: "my_var", path: "last.items.0.item_id" } };
        if (type === "filter") return { filter: { source: "last.items", field: "price", op: "<=", value: "1000", saveAs: "filtered" } };
        if (type === "notify") return { notify: { channel: "telegram", tgToken: "", tgChat: "", discordUrl: "", text: "Найдено {{last.items.length}} лотов!" } };
        if (type === "logmsg") return { logmsg: { text: "Готово! {{last.items.length}} лотов" } };
        if (type === "savefile") return { savefile: { source: "last.items", format: "csv", filename: "results" } };
        if (type === "proxy") return { proxy: { list: "", mode: "rotate" } };
        if (type === "start") return { start: { globalError: true } };
        if (type === "foreach") return { foreach: { source: "last.items", itemVar: "item", indexVar: "i" } };
        if (type === "checker") return { checker: { itemPath: "last.items.0.item_id", rejectSold: true } };
        if (type === "sniper") return { sniper: { source: "last.items", maxPrice: "100", maxSpend: "5000", priceField: "price", itemField: "item_id" } };
        if (type === "ai") return { ai: { batch: true, batchLimit: 50, source: "vars.filtered", outputVar: "ai_result", prompt: "Оцени лоты. Верни JSON {\"items\":[{\"item_id\":N,\"buy\":true,\"score\":8,\"reason\":\"...\"}]}", preset: "steam_batch" } };
        if (type === "script") return { script: { filename: "hook_example.py", timeout: 30, saveAs: "script_out" } };
        if (type === "subscenario") return { subscenario: { templateId: "" } };
        return {};
    },

    addNode(type, x, y, data) {
        if (type !== "start" && this._scenarioIsDemo) {
            this._scenarioIsDemo = false;
            this.updateRunHint();
        }
        const node = Object.assign({ id: this.genId(), type, x, y }, this.defaultData(type), data || {});
        this.nodes.push(node);
        return node;
    },

    // Добавить блок в центр текущего вида
    addBlockAtCenter(type) {
        const r = this.viewport.getBoundingClientRect();
        const c = this.screenToWorld(r.left + r.width / 2, r.top + r.height / 2);
        const offset = (this.nodes.length % 5) * 26;
        const wasOnlyStart = this.nodes.length <= 1;
        const inTour = !!document.getElementById("tour-spotlight-root");
        const start = this.nodes.find(n => n.type === "start");
        let x = Math.round(c.x - 120 + offset);
        let y = Math.round(c.y - 40 + offset);
        if (inTour && type === "request" && start) {
            x = start.x + 300;
            y = start.y - 20;
        }
        const node = this.addNode(type, x, y);
        this.render();
        this.regenScript();
        this.commit();
        if (type === "request" && !document.getElementById("tour-spotlight-root")) {
            this.openPropEditor(node, r.left + r.width / 2, r.top + r.height / 2);
        }
        if (wasOnlyStart && type !== "start") {
            const msg = (window.I18N && I18N.t("canvas.connectHint")) || "Потяните линию от «Старт» к новому блоку";
            this.flash?.(msg, "ok");
        }
        return node;
    },

    // Добавить блок-запрос из примера API (клик по шаблону в сайдбаре)
    // Есть ли на холсте осмысленная работа, которую жалко потерять при замене?
    hasMeaningfulWork() {
        const start = this.nodes.find(n => n.type === "start");
        const others = this.nodes.filter(n => n.type !== "start");
        if (others.length === 0) return false;

        // Черновик из шаблона: только Старт → один Запрос (типичный результат клика по парсеру)
        if (others.length === 1 && others[0].type === "request" && start) {
            const req = others[0];
            const onlyStartToReq = this.edges.length === 1
                && this.edges[0].from === start.id
                && this.edges[0].to === req.id
                && this.edges[0].fromPort === "out";
            if (onlyStartToReq) return false;
        }

        // Старый баг: несколько запросов наслоились без связей — заменяем без вопроса
        if (others.length > 1 && others.every(n => n.type === "request") && this.edges.length === 0) return false;

        // Один сиротский запрос без связей — тоже черновик
        if (others.length === 1 && others[0].type === "request" && this.edges.length === 0) return false;

        return true;
    },

    addRequestFromTemplate(tpl) {
        const req = {
            method: tpl.method || "GET",
            url: tpl.url || "",
            params: JSON.parse(JSON.stringify(tpl.params || {})),
            body: tpl.body ? JSON.parse(JSON.stringify(tpl.body)) : null,
            headers: {},
            title: tpl.title || "Запрос",
            retries: tpl.retries != null ? tpl.retries : 0,
            retryDelay: tpl.retryDelay != null ? tpl.retryDelay : 1000,
            timeout: tpl.timeout != null ? tpl.timeout : 15,
            respectRateLimit: tpl.respectRateLimit !== false,
        };

        const title = tpl.title || "Запрос";
        const data = {
            title,
            nodes: [
                { id: "n1", type: "start", x: 60, y: 220 },
                { id: "n2", type: "request", x: 360, y: 200, request: req },
            ],
            edges: [
                { id: "e1", from: "n1", fromPort: "out", to: "n2" },
            ],
            view: { scale: 1, panX: 40, panY: 20 },
        };

        if (this.hasMeaningfulWork() && window.LZTFeatures?.openScenarioInNewTab) {
            window.LZTFeatures.openScenarioInNewTab(data);
            this.flash("Загружен: " + title, "ok");
            return;
        }

        this.load(data);
        this.commit();
        this.flash("Загружен: " + title, "ok");
    },

    openScenario(data, opts) {
        opts = opts || {};
        if (!data) return;
        if (!opts.force && this.hasMeaningfulWork() && window.LZTFeatures?.openScenarioInNewTab) {
            window.LZTFeatures.openScenarioInNewTab(data, opts);
            if (opts.flash !== false) this.flash("Загружен: " + (data.title || "Сценарий"), "ok");
            return;
        }
        this._scenarioIsDemo = !!(opts.demo || data.isDemo || data._demo);
        this.load(data, { keepView: !!opts.keepView, demo: this._scenarioIsDemo });
        this.commit();
        if (opts.flash !== false) this.flash("Загружен: " + (data.title || "Сценарий"), "ok");
    },

    openDemoExample() {
        const ex = this.examples().find(e => e.id === "demo");
        if (!ex) return;
        document.querySelector('#scenario-examples-list .tpl-row[data-tour-id="demo"]')
            ?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
        return this.openScenario(ex.build(), { demo: true });
    },

    deleteNode(id) {
        const node = this.getNode(id);
        if (node && node.type === "start") return; // старт не удаляем
        if (this._scenarioIsDemo) {
            this._scenarioIsDemo = false;
            this.updateRunHint();
        }
        this.nodes = this.nodes.filter(n => n.id !== id);
        this.edges = this.edges.filter(e => e.from !== id && e.to !== id);
        if (this.selectedNode === id) this.selectedNode = null;
        this.render();
        this.regenScript();
        this.commit();
    },

    // ==================== КОПИРОВАНИЕ / ДУБЛИРОВАНИЕ ====================

    copyNode(id) {
        const node = this.getNode(id);
        if (!node || node.type === "start") { this.flash("Блок «Старт» копировать нельзя", "err"); return; }
        const { id: _id, x: _x, y: _y, ...rest } = node;
        this._clipboard = JSON.parse(JSON.stringify(rest));
        this.flash("Блок скопирован (Ctrl+V — вставить)", "ok");
    },

    // Клон ноды с новым id и смещением; связи не копируются
    cloneNodeAt(src, x, y) {
        const data = JSON.parse(JSON.stringify(src));
        delete data.id; delete data.x; delete data.y; delete data.type;
        const node = Object.assign({ id: this.genId(), type: src.type, x, y }, data);
        this.nodes.push(node);
        return node;
    },

    pasteNode() {
        if (!this._clipboard) { this.flash("Буфер пуст — сначала Ctrl+C", "err"); return; }
        const r = this.viewport.getBoundingClientRect();
        const c = this.screenToWorld(r.left + r.width / 2, r.top + r.height / 2);
        const node = this.cloneNodeAt(this._clipboard, Math.round(c.x - 120), Math.round(c.y - 40));
        this.selectedNode = node.id;
        this.render();
        this.regenScript();
        this.commit();
        this.flash("Блок вставлен", "ok");
    },

    duplicateNode(id) {
        const src = this.getNode(id);
        if (!src || src.type === "start") { this.flash("Блок «Старт» дублировать нельзя", "err"); return; }
        const node = this.cloneNodeAt(src, src.x + 40, src.y + 40);
        this.selectedNode = node.id;
        this.render();
        this.regenScript();
        this.commit();
        this.flash("Блок продублирован", "ok");
    },

    // ==================== ТРАНСФОРМАЦИЯ / КООРДИНАТЫ ====================

    applyTransform(opts) {
        opts = opts || {};
        this.world.style.transform = `translate3d(${this.panX}px, ${this.panY}px, 0) scale(${this.scale})`;
        const zr = document.getElementById("zoom-reset");
        if (zr) zr.textContent = Math.round(this.scale * 100) + "%";
        if (opts.skipMinimap) return;
        if (this._minimapRaf) cancelAnimationFrame(this._minimapRaf);
        this._minimapRaf = requestAnimationFrame(() => {
            this._minimapRaf = 0;
            this.drawMinimap();
        });
    },



    // ==================== ИСТОРИЯ ЗАПУСКОВ ====================

    recordHistory(stats, steps) {
        try {
            const entry = {
                ts: Date.now(),
                title: this.title || "Сценарий",
                steps,
                reqOk: stats.reqOk, reqErr: stats.reqErr,
                durationMs: Date.now() - stats.startedAt,
                ok: stats.reqErr === 0
            };
            const list = JSON.parse(localStorage.getItem("lzt_run_history") || "[]");
            list.unshift(entry);
            if (list.length > 200) list.length = 200;
            localStorage.setItem("lzt_run_history", JSON.stringify(list));
        } catch (e) { /* localStorage может быть недоступен */ }
    },

    historyList() { try { return JSON.parse(localStorage.getItem("lzt_run_history") || "[]"); } catch (e) { return []; } },

    openHistory() {
        const list = this.historyList();
        document.querySelectorAll(".history-modal").forEach(m => m.remove());
        const total = list.length;
        const ok = list.filter(e => e.ok).length;
        const avgReq = total ? Math.round(list.reduce((s, e) => s + (e.reqOk + e.reqErr), 0) / total) : 0;
        const avgDur = total ? Math.round(list.reduce((s, e) => s + (e.durationMs || 0), 0) / total / 1000 * 10) / 10 : 0;
        const rows = list.slice(0, 100).map(e => {
            const d = new Date(e.ts);
            const when = d.toLocaleString();
            const badge = e.ok ? '<span style="color:#27ae60;">● успех</span>' : '<span style="color:#ff5555;">● с ошибками</span>';
            return `<tr><td>${when}</td><td>${this.esc(e.title)}</td><td>${badge}</td><td style="text-align:center;">${e.reqOk}/${e.reqOk + e.reqErr}</td><td style="text-align:center;">${e.steps}</td><td style="text-align:center;">${Math.round((e.durationMs || 0) / 100) / 10}с</td></tr>`;
        }).join("");
        const el = document.createElement("div");
        el.className = "modal-overlay history-modal";
        el.innerHTML = `
            <div class="modal-box" style="width: 720px; max-height: 82vh; display:flex; flex-direction:column;">
                <div class="modal-header">
                    <span style="font-weight:700; color:#fff; display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-chart-line" style="color:var(--lzt-green);"></i> История запусков</span>
                    <button class="modal-close" id="hist-close-x"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="modal-body" style="overflow:auto;">
                    <div class="hist-stats">
                        <div class="hist-card"><div class="hist-num">${total}</div><div class="hist-lbl">запусков</div></div>
                        <div class="hist-card"><div class="hist-num" style="color:#27ae60;">${total ? Math.round(ok / total * 100) : 0}%</div><div class="hist-lbl">успешных</div></div>
                        <div class="hist-card"><div class="hist-num">${avgReq}</div><div class="hist-lbl">запросов/прогон</div></div>
                        <div class="hist-card"><div class="hist-num">${avgDur}с</div><div class="hist-lbl">ср. время</div></div>
                    </div>
                    ${total ? `<table class="result-table hist-table"><thead><tr><th>Время</th><th>Сценарий</th><th>Итог</th><th>Запросы</th><th>Шаги</th><th>Длит.</th></tr></thead><tbody>${rows}</tbody></table>`
                        : '<p style="color:var(--text-muted); text-align:center; padding:30px;">Пока нет запусков. Запустите сценарий — здесь появится статистика.</p>'}
                </div>
                <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:8px;">
                    <button class="btn-token" id="hist-clear">Очистить историю</button>
                    <button class="btn-save" id="hist-ok">Закрыть</button>
                </div>
            </div>`;
        document.body.appendChild(el);
        LZTUi.showOverlay(el);
        const close = () => LZTUi.hideOverlay(el, { remove: true });
        el.querySelector("#hist-close-x").addEventListener("click", close);
        el.querySelector("#hist-ok").addEventListener("click", close);
        el.addEventListener("click", (e) => { if (e.target === el) close(); });
        el.querySelector("#hist-clear").addEventListener("click", async () => {
            if (await LZTDialog.confirm("Очистить всю историю запусков?", { title: "Очистить историю", okText: "Очистить", danger: true, icon: "fa-trash" })) {
                localStorage.removeItem("lzt_run_history");
                close();
                this.openHistory();
            }
        });
    },

    exportRunLog() {
        const logEl = document.getElementById("run-log");
        const debugEl = document.getElementById("run-debug");
        const logText = logEl?.innerText?.trim() || "";
        const debugText = debugEl?.innerText?.trim() || "";
        if (!logText && !debugText) {
            this.flash?.("Лог пуст — сначала запустите сценарий", "err");
            return;
        }
        const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const safeTitle = (this.title || "scenario").replace(/[^\w\u0400-\u04FF-]+/g, "_").slice(0, 40);
        const body = [
            `# LZT API Constructor — лог прогона`,
            `# Сценарий: ${this.title || "—"}`,
            `# ${new Date().toLocaleString()}`,
            "",
            "=== Ход выполнения ===",
            logText,
            "",
            "=== Debug / API ===",
            debugText,
        ].join("\n");
        const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${safeTitle}_run_${stamp}.txt`;
        a.click();
        URL.revokeObjectURL(a.href);
        this.flash?.("Лог сохранён", "ok");
    },

    // Центрировать вид на блоке (используется поиском и пошаговым режимом)
    centerOn(id) {
        const n = this.getNode(id);
        if (!n) return;
        const r = this.viewport.getBoundingClientRect();
        this.panX = r.width / 2 - (n.x + 120) * this.scale;
        this.panY = r.height / 2 - (n.y + 50) * this.scale;
        this.applyTransform();
        this.redrawEdges();
    },

    // ==================== МИНИКАРТА И ПОИСК ====================

    bindMinimapAndSearch() {
        const mini = document.getElementById("canvas-minimap");
        const cv = document.getElementById("minimap-canvas");
        if (mini && cv) {
            const jump = (e) => {
                const rect = cv.getBoundingClientRect();
                const mx = (e.clientX - rect.left) / rect.width;
                const my = (e.clientY - rect.top) / rect.height;
                const b = this._miniBounds;
                if (!b) return;
                const wx = b.minX + mx * (b.maxX - b.minX);
                const wy = b.minY + my * (b.maxY - b.minY);
                const r = this.viewport.getBoundingClientRect();
                this.panX = r.width / 2 - wx * this.scale;
                this.panY = r.height / 2 - wy * this.scale;
                this.applyTransform();
                this.redrawEdges();
            };
            cv.addEventListener("mousedown", (e) => { e.stopPropagation(); this._miniDrag = true; jump(e); });
            window.addEventListener("mousemove", (e) => { if (this._miniDrag) jump(e); });
            window.addEventListener("mouseup", () => { this._miniDrag = false; });
        }

        const input = document.getElementById("canvas-search-input");
        const results = document.getElementById("canvas-search-results");
        if (input && results) {
            const doSearch = () => {
                const q = input.value.trim().toLowerCase();
                if (!q) { results.style.display = "none"; results.innerHTML = ""; return; }
                const matches = this.nodes.filter(n => {
                    const def = NODE_TYPES[n.type];
                    const title = (def ? def.title : n.type).toLowerCase();
                    const extra = (n.request && n.request.title || n.request && n.request.url || n.variable && n.variable.name || n.logmsg && n.logmsg.text || "").toLowerCase();
                    return title.includes(q) || extra.includes(q) || n.type.includes(q);
                }).slice(0, 8);
                if (!matches.length) { results.style.display = "block"; results.innerHTML = `<div class="csr-empty">Ничего не найдено</div>`; return; }
                results.innerHTML = matches.map(n => {
                    const def = NODE_TYPES[n.type];
                    const sub = this.esc((n.request && (n.request.title || n.request.url) || n.variable && n.variable.name || "").slice(0, 40));
                    return `<div class="csr-item" data-id="${n.id}"><i class="fa-solid ${def.icon}" style="color:${def.color};"></i> <b>${this.esc(def.title)}</b> <span>${sub}</span></div>`;
                }).join("");
                results.style.display = "block";
                results.querySelectorAll(".csr-item").forEach(it => it.addEventListener("click", () => {
                    this.selectedNode = it.dataset.id;
                    this.render();
                    this.centerOn(it.dataset.id);
                    results.style.display = "none";
                    input.value = "";
                }));
            };
            input.addEventListener("input", doSearch);
            input.addEventListener("focus", doSearch);
            document.addEventListener("click", (e) => {
                if (!e.target.closest("#canvas-search")) results.style.display = "none";
            });
        }
    },

    drawMinimap() {
        const cv = document.getElementById("minimap-canvas");
        const mini = document.getElementById("canvas-minimap");
        if (!cv || !this.nodes.length || !mini || mini.style.display === "none") return;
        const ctx = cv.getContext("2d");
        const W = cv.width, H = cv.height;
        ctx.clearRect(0, 0, W, H);
        // границы всех нод
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        this.nodes.forEach(n => {
            minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
            maxX = Math.max(maxX, n.x + 240); maxY = Math.max(maxY, n.y + 90);
        });
        const pad = 40;
        minX -= pad; minY -= pad; maxX += pad; maxY += pad;
        this._miniBounds = { minX, minY, maxX, maxY };
        const sx = W / (maxX - minX), sy = H / (maxY - minY);
        const s = Math.min(sx, sy);
        const ox = (W - (maxX - minX) * s) / 2, oy = (H - (maxY - minY) * s) / 2;
        const tx = (x) => (x - minX) * s + ox, ty = (y) => (y - minY) * s + oy;
        // связи
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 1;
        this.edges.forEach(e => {
            const a = this.getNode(e.from), b = this.getNode(e.to);
            if (!a || !b) return;
            ctx.beginPath(); ctx.moveTo(tx(a.x + 120), ty(a.y + 45)); ctx.lineTo(tx(b.x + 120), ty(b.y + 45)); ctx.stroke();
        });
        // ноды
        this.nodes.forEach(n => {
            const def = NODE_TYPES[n.type];
            ctx.fillStyle = def ? def.color : "#888";
            ctx.fillRect(tx(n.x), ty(n.y), Math.max(3, 240 * s), Math.max(2, 90 * s));
        });
        // прямоугольник текущего вида
        const r = this.viewport.getBoundingClientRect();
        const vx1 = -this.panX / this.scale, vy1 = -this.panY / this.scale;
        const vx2 = vx1 + r.width / this.scale, vy2 = vy1 + r.height / this.scale;
        ctx.strokeStyle = "rgba(0,186,120,0.9)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(tx(vx1), ty(vy1), (vx2 - vx1) * s, (vy2 - vy1) * s);
    },

    summary(data) {
        if (!data) return "";
        if (Array.isArray(data.items)) return `лотов: ${data.items.length}`;
        if (Array.isArray(data.threads)) return `тем: ${data.threads.length}`;
        if (data.user) return `пользователь: ${data.user.username || data.user.user_id || ""}`;
        const keys = Object.keys(data).filter(k => k !== "system_info");
        return keys.slice(0, 3).join(", ");
    },


    // ==================== СОХРАНЕНИЕ / ПРИМЕРЫ ====================

    serialize() {
        // isDemo не пишем в сохранения — иначе демо «залипает» и webhook/расписание путаются
        return { id: this.currentId, title: this.title, seq: this.seq, view: { scale: this.scale, panX: this.panX, panY: this.panY }, nodes: JSON.parse(JSON.stringify(this.nodes)), edges: JSON.parse(JSON.stringify(this.edges)) };
    },

    // ==================== ЭКСПОРТ / ИМПОРТ В ФАЙЛ ====================

    // Универсальная выгрузка текста в файл (используется и для CSV/JSON результатов)
    downloadFile(filename, content, mime) {
        if (window.LZTFS) {
            return window.LZTFS.saveText(filename, content, mime).then(ok => ok).catch(() => false);
        }
        try {
            const blob = new Blob([content], { type: (mime || "application/octet-stream") + ";charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
            return Promise.resolve(true);
        } catch (e) { return Promise.resolve(false); }
    },

    slugify(s) {
        return String(s || "scenario").trim().toLowerCase()
            .replace(/[^a-z0-9а-яё]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "scenario";
    },

    // Преобразование значения (массив объектов / объект) в CSV
    toCSV(value) {
        let rows = [];
        if (Array.isArray(value)) rows = value;
        else if (value && typeof value === "object") rows = [value];
        else return String(value == null ? "" : value);
        if (!rows.length) return "";
        // колонки — объединение ключей объектов (для примитивов — колонка value)
        const allObj = rows.every(r => r && typeof r === "object" && !Array.isArray(r));
        const esc = (v) => {
            if (v == null) v = "";
            else if (typeof v === "object") v = JSON.stringify(v);
            else v = String(v);
            return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
        };
        if (!allObj) return "value\n" + rows.map(r => esc(r)).join("\n");
        const cols = [];
        rows.forEach(r => Object.keys(r).forEach(k => { if (!cols.includes(k)) cols.push(k); }));
        const head = cols.map(esc).join(",");
        const body = rows.map(r => cols.map(c => esc(r[c])).join(",")).join("\n");
        return head + "\n" + body;
    },

    async exportToFile() {
        const data = this.serialize();
        data._format = "lzt-scenario";
        data._version = 1;
        const json = JSON.stringify(data, null, 2);
        const ok = await this.downloadFile(`${this.slugify(this.title)}.json`, json, "application/json");
        this.flash(ok ? "Сценарий сохранён" : "Не удалось сохранить", ok ? "ok" : "err");
    },

    importFromFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const data = JSON.parse(reader.result);
                if (!data || !Array.isArray(data.nodes)) throw new Error("нет блоков");
                if (this.hasMeaningfulWork() && !await LZTDialog.confirm("Импорт заменит текущий сценарий. Продолжить?", { title: "Импорт сценария", okText: "Импортировать", danger: true })) return;
                data.id = null;
                this.load(data);
                this.flash("Сценарий импортирован", "ok");
            } catch (e) {
                this.flash("Не удалось прочитать файл сценария", "err");
            }
        };
        reader.onerror = () => this.flash("Ошибка чтения файла", "err");
        reader.readAsText(file);
    },

    // Короткое всплывающее уведомление в углу холста
    flash(text, kind) {
        let el = document.getElementById("scn-flash");
        if (!el) {
            el = document.createElement("div");
            el.id = "scn-flash";
            el.className = "scn-flash";
            (this.viewport || document.body).appendChild(el);
        }
        el.textContent = text;
        el.className = "scn-flash show" + (kind ? " " + kind : "");
        clearTimeout(this._flashT);
        this._flashT = setTimeout(() => { el.className = "scn-flash"; }, 2600);
    },

    load(data, opts) {
        opts = opts || {};
        let payload = data;
        if (window.Assistant?.validateScenarioObj) {
            try {
                payload = JSON.parse(JSON.stringify(data));
                window.Assistant.validateScenarioObj(payload, { autoLayout: false });
            } catch (_) { /* оставляем как есть */ }
        } else if (window.ScenarioNormalize?.validateScenarioObj) {
            try {
                payload = JSON.parse(JSON.stringify(data));
                window.ScenarioNormalize.validateScenarioObj(payload, { autoLayout: false });
            } catch (_) { /* оставляем как есть */ }
        }
        this.nodes = JSON.parse(JSON.stringify(payload.nodes || []));
        this.edges = JSON.parse(JSON.stringify(payload.edges || []));
        // всегда должен быть блок «Старт»
        if (!this.nodes.some(n => n.type === "start")) {
            this.addNode("start", 60, 240);
        }
        this.title = data.title || "Сценарий";
        this.currentId = data.id || null;
        this._scenarioIsDemo = !!(opts.demo || data.isDemo || data._demo);
        this.seq = data.seq || (this.nodes.length + this.edges.length + 5);
        // корректный seq, чтобы не было коллизий id
        let maxN = 0;
        this.nodes.concat(this.edges).forEach(o => { const m = String(o.id).match(/(\d+)$/); if (m) maxN = Math.max(maxN, parseInt(m[1])); });
        this.seq = maxN + 1;
        if (data.view) { this.scale = data.view.scale || 1; this.panX = data.view.panX || 40; this.panY = data.view.panY || 20; }
        this.selectedNode = null;
        this.applyTransform();
        this.render();
        this.updateTitle();
        this.updateRunHint();
        this.regenScript();
        if (!opts.keepView) setTimeout(() => this.fitView(), 60);
        // Автосейв всегда, а историю сбрасываем только при обычной загрузке (не при undo/redo)
        this.autosave();
        if (!this._restoring) this.resetHistory();
    },

    savedList() {
        try { return JSON.parse(localStorage.getItem("lzt_scenarios") || "[]"); }
        catch (e) { return []; }
    },

    async persistSavedList(list) {
        if (window.LZTScenarioStore) await LZTScenarioStore.saveLibrary(list);
        else localStorage.setItem("lzt_scenarios", JSON.stringify(list));
    },

    async saveCurrent() {
        const list = this.savedList();
        const i18n = (k) => (window.I18N && I18N.t(k)) || k;
        const def = this.defaultTitle();
        const fb = this.title === def ? i18n("scenario.myDefault") : this.title;
        const name = await LZTDialog.prompt(i18n("dialog.save.prompt"), fb, {
            title: i18n("dialog.save.title"),
            okText: i18n("dialog.rename.ok"),
        });
        if (!name || !String(name).trim()) return;
        this.title = String(name).trim();
        const data = this.serialize();
        if (this.currentId) {
            const idx = list.findIndex(s => s.id === this.currentId);
            data.id = this.currentId;
            if (idx >= 0) list[idx] = data; else list.push(data);
        } else {
            data.id = "sc_" + Date.now();
            this.currentId = data.id;
            list.push(data);
        }
        await this.persistSavedList(list);
        this.renderSaved();
        this.updateTitle();
        this.commit();
        this.flash("Сценарий сохранён в «Мои сценарии»", "ok");
        if (typeof openAccordion === "function") openAccordion("templates");
    },

    renderSaved() {
        const container = document.getElementById("custom-templates-list");
        if (!container) return;
        const list = this.savedList();
        container.innerHTML = "";
        if (!list.length) {
            const t = (k, fb) => (window.I18N && I18N.t(k)) || fb;
            container.innerHTML = `<div class="saved-empty-state">
                <span>${t("saved.empty", "Пока нет сохранённых сценариев.")}</span>
                <small>${t("saved.emptyHint", "")}</small>
                <button type="button" class="btn-token saved-try-demo"><i class="fa-solid fa-flask"></i> ${t("saved.tryDemo", "Попробовать демо")}</button>
            </div>`;
            container.querySelector(".saved-try-demo")?.addEventListener("click", () => {
                this.openDemoExample();
            });
            return;
        }
        list.forEach((sc, index) => {
            const div = document.createElement("div");
            div.className = "tpl-row";
            div.innerHTML = `<div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
                    <span class="icon" style="color:#3594bc;"><i class="fa-solid fa-diagram-project"></i></span>
                    <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this.esc(sc.title)}</span>
                </div>
                <i class="fa-solid fa-trash" style="color: var(--text-muted); font-size: 12px; padding: 4px;" title="Удалить сценарий"></i>`;
            div.addEventListener("click", () => this.openScenario(sc));
            div.querySelector(".fa-trash").addEventListener("click", async (e) => {
                e.stopPropagation();
                const t = (k, fb) => (window.I18N && I18N.t(k)) || fb;
                const msg = t("saved.deleteConfirm", "Удалить сценарий?").replace("{title}", sc.title || "");
                if (window.LZTDialog && !await LZTDialog.confirm(msg, { title: t("sidebar.myScenarios", "Мои сценарии"), okText: "Удалить", danger: true })) return;
                const l = this.savedList(); l.splice(index, 1);
                await this.persistSavedList(l);
                this.renderSaved();
            });
            container.appendChild(div);
        });
    },

    renderExamples() {
        const container = document.getElementById("scenario-examples-list");
        if (!container) return;
        container.innerHTML = "";
        this.examples().forEach(ex => {
            const div = document.createElement("div");
            div.className = "tpl-row";
            if (ex.id) div.dataset.tourId = ex.id;
            div.innerHTML = `<div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
                    <span class="icon" style="color: var(--lzt-green);"><i class="${ex.icon || "fa-solid fa-diagram-project"}"></i></span>
                    <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this.esc(ex.title)}</span>
                </div>`;
            div.title = ex.desc || "";
            div.addEventListener("click", async () => {
                document.querySelectorAll(".tpl-row").forEach(el => el.classList.remove("active"));
                div.classList.add("active");
                await this.openScenario(ex.build(), { demo: ex.id === "demo" });
            });
            container.appendChild(div);
        });
    },

    examples() {
        return [
            {
                id: "demo", title: "Демо: поиск → снайпер", icon: "fa-solid fa-flask",
                desc: "Готовый сценарий с mock API — без токена",
                build: () => (window.LZTDemo ? window.LZTDemo.buildDemoScenario() : { title: "Демо", nodes: [{ id: "n1", type: "start", x: 40, y: 220 }], edges: [] }),
            },
            {
                title: "Умный снайпер (ИИ)", icon: "fa-solid fa-brain",
                desc: "Поиск → фильтр → ИИ-оценка → снайпер",
                build: () => (window.LZTDemo ? window.LZTDemo.buildSmartSniperScenario() : { title: "Умный снайпер", nodes: [{ id: "n1", type: "start", x: 40, y: 220 }], edges: [] }),
            },
            {
                title: "Поиск дешёвых Steam-аккаунтов", icon: "fa-brands fa-steam",
                desc: "Ищет аккаунты Steam и проверяет, есть ли результаты",
                build: () => ({
                    title: "Поиск дешёвых Steam-аккаунтов",
                    nodes: [
                        { id: "n1", type: "start", x: 40, y: 220 },
                        { id: "n2", type: "request", x: 300, y: 200, request: { method: "GET", url: "https://prod-api.lzt.market/steam", params: { pmin: "1", pmax: "100", order_by: "price_to_up" }, body: null, headers: {}, title: "Поиск Steam до 100₽" } },
                        { id: "n3", type: "condition", x: 640, y: 200, condition: { left: "last.items.length", op: ">", right: "0" } },
                        { id: "n4", type: "stop", x: 960, y: 120 },
                        { id: "n5", type: "stop", x: 960, y: 300 },
                    ],
                    edges: [
                        { id: "e1", from: "n1", fromPort: "out", to: "n2" },
                        { id: "e2", from: "n2", fromPort: "success", to: "n3" },
                        { id: "e3", from: "n3", fromPort: "true", to: "n4" },
                        { id: "e4", from: "n3", fromPort: "false", to: "n5" },
                    ],
                    view: { scale: 0.9, panX: 30, panY: 20 }
                })
            },
            {
                title: "Автопокупка первого лота", icon: "fa-solid fa-cart-shopping",
                desc: "Ищет лот и, если есть, берёт item_id первого и вызывает fast-buy",
                build: () => ({
                    title: "Автопокупка первого лота",
                    nodes: [
                        { id: "n1", type: "start", x: 40, y: 260 },
                        { id: "n2", type: "request", x: 280, y: 240, request: { method: "GET", url: "https://prod-api.lzt.market/steam", params: { pmin: "1", pmax: "50", order_by: "price_to_up" }, body: null, headers: {}, title: "Поиск лота" } },
                        { id: "n3", type: "condition", x: 600, y: 240, condition: { left: "last.items.length", op: ">", right: "0" } },
                        { id: "n4", type: "request", x: 900, y: 160, request: { method: "POST", url: "https://prod-api.lzt.market/{{last.items.0.item_id}}/fast-buy", params: {}, body: null, headers: {}, title: "Купить первый лот" } },
                        { id: "n5", type: "stop", x: 1240, y: 160 },
                        { id: "n6", type: "delay", x: 600, y: 420, delay: { ms: 5000 } },
                    ],
                    edges: [
                        { id: "e1", from: "n1", fromPort: "out", to: "n2" },
                        { id: "e2", from: "n2", fromPort: "success", to: "n3" },
                        { id: "e3", from: "n3", fromPort: "true", to: "n4" },
                        { id: "e4", from: "n4", fromPort: "success", to: "n5" },
                        { id: "e5", from: "n3", fromPort: "false", to: "n6" },
                        { id: "e6", from: "n6", fromPort: "out", to: "n2" },
                    ],
                    view: { scale: 0.75, panX: 20, panY: 10 }
                })
            },
            {
                title: "Мониторинг баланса", icon: "fa-solid fa-wallet",
                desc: "Периодически запрашивает профиль и повторяет с задержкой",
                build: () => ({
                    title: "Мониторинг баланса",
                    nodes: [
                        { id: "n1", type: "start", x: 40, y: 220 },
                        { id: "n2", type: "request", x: 300, y: 200, request: { method: "GET", url: "https://prod-api.lzt.market/me", params: {}, body: null, headers: {}, title: "Мой профиль/баланс" } },
                        { id: "n3", type: "delay", x: 620, y: 200, delay: { ms: 10000 } },
                    ],
                    edges: [
                        { id: "e1", from: "n1", fromPort: "out", to: "n2" },
                        { id: "e2", from: "n2", fromPort: "success", to: "n3" },
                        { id: "e3", from: "n3", fromPort: "out", to: "n2" },
                    ],
                    view: { scale: 0.95, panX: 30, panY: 20 }
                })
            },
            {
                title: "Монитор дешёвых Steam → Telegram", icon: "fa-solid fa-bell",
                desc: "Каждые 60с ищет дешёвые аккаунты, фильтрует по цене и шлёт уведомление в Telegram",
                build: () => ({
                    title: "Монитор Steam → Telegram",
                    nodes: [
                        { id: "n1", type: "start", x: 40, y: 260 },
                        { id: "n2", type: "request", x: 280, y: 240, request: { method: "GET", url: "https://prod-api.lzt.market/steam", params: { pmax: "150", order_by: "price_to_up" }, body: null, headers: {}, title: "Поиск дешёвых Steam", retries: 2, retryDelay: 2000, timeout: 15, respectRateLimit: true } },
                        { id: "n3", type: "filter", x: 600, y: 240, filter: { source: "last.items", field: "price", op: "<=", value: "100", saveAs: "cheap" } },
                        { id: "n4", type: "notify", x: 920, y: 160, notify: { channel: "telegram", tgToken: "", tgChat: "", discordUrl: "", text: "Найдено {{vars.cheap.length}} дешёвых Steam-аккаунтов!" } },
                        { id: "n5", type: "delay", x: 600, y: 420, delay: { ms: 60000 } },
                    ],
                    edges: [
                        { id: "e1", from: "n1", fromPort: "out", to: "n2" },
                        { id: "e2", from: "n2", fromPort: "success", to: "n3" },
                        { id: "e3", from: "n3", fromPort: "found", to: "n4" },
                        { id: "e4", from: "n3", fromPort: "empty", to: "n5" },
                        { id: "e5", from: "n4", fromPort: "out", to: "n5" },
                        { id: "e6", from: "n5", fromPort: "out", to: "n2" },
                    ],
                    view: { scale: 0.75, panX: 20, panY: 10 }
                })
            },
            {
                title: "Выгрузить лоты в CSV", icon: "fa-solid fa-file-csv",
                desc: "Ищет аккаунты, фильтрует по цене и сохраняет результат в CSV-файл",
                build: () => ({
                    title: "Выгрузка лотов в CSV",
                    nodes: [
                        { id: "n1", type: "start", x: 40, y: 220 },
                        { id: "n2", type: "request", x: 280, y: 200, request: { method: "GET", url: "https://prod-api.lzt.market/steam", params: { pmax: "500", order_by: "price_to_up" }, body: null, headers: {}, title: "Поиск Steam", retries: 2, retryDelay: 1500, timeout: 20, respectRateLimit: true } },
                        { id: "n3", type: "filter", x: 600, y: 200, filter: { source: "last.items", field: "price", op: "<=", value: "300", saveAs: "cheap" } },
                        { id: "n4", type: "savefile", x: 920, y: 140, savefile: { source: "vars.cheap", format: "csv", filename: "steam_lots" } },
                        { id: "n5", type: "stop", x: 1220, y: 140 },
                        { id: "n6", type: "logmsg", x: 920, y: 320, logmsg: { text: "Ничего не нашли по фильтру" } },
                    ],
                    edges: [
                        { id: "e1", from: "n1", fromPort: "out", to: "n2" },
                        { id: "e2", from: "n2", fromPort: "success", to: "n3" },
                        { id: "e3", from: "n3", fromPort: "found", to: "n4" },
                        { id: "e4", from: "n4", fromPort: "out", to: "n5" },
                        { id: "e5", from: "n3", fromPort: "empty", to: "n6" },
                    ],
                    view: { scale: 0.72, panX: 20, panY: 10 }
                })
            }
        ];
    },

    // ==================== УТИЛИТЫ ====================

    shortUrl(url) {
        try {
            const u = String(url).replace(/^https?:\/\//, "");
            return u.length > 42 ? "…" + u.slice(-42) : u;
        } catch (e) { return url; }
    },
    esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); },
    now() { const d = new Date(); return d.toLocaleTimeString("ru-RU", { hour12: false }); },
    sleep(ms) {
        const total = Math.max(0, Number(ms) || 0);
        if (total <= 0) return Promise.resolve();
        return new Promise(resolve => {
            const t0 = Date.now();
            const step = () => {
                if (!this.running || this._runToken == null) return resolve();
                const left = total - (Date.now() - t0);
                if (left <= 0) return resolve();
                setTimeout(step, Math.min(120, left));
            };
            setTimeout(step, Math.min(120, total));
        });
    },

    getPath(obj, path) { return window.ScenarioEngine.getPath(obj, path); },
    resolveVars(val, ctx) { return window.ScenarioEngine.resolveVars(val, ctx); },
    evalCondition(cond, ctx) { return window.ScenarioEngine.evalCondition(cond, ctx); },
};

Object.assign(Scenario, window.ScenarioHistoryMixin, window.ScenarioEditorMixin, window.ScenarioRuntimeMixin);
window.Scenario = Scenario;
window.NODE_TYPES = NODE_TYPES;
