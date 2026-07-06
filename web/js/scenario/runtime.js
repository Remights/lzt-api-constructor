/** Runtime mixin */
window.ScenarioRuntimeMixin = {
    bindRun() {
        document.getElementById("btn-run-scenario")?.addEventListener("click", () => {
            if (this._runBusy) {
                this._runToken = null;
                this.running = false;
                return;
            }
            this.run({ demo: !!this._scenarioIsDemo });
        });
        document.getElementById("btn-run-history")?.addEventListener("click", () => this.openHistory());
        document.getElementById("btn-export-run-log")?.addEventListener("click", () => this.exportRunLog());
        document.getElementById("chk-schedule")?.addEventListener("change", (e) => {
            if (e.target.checked) this.startSchedule(); else this.stopSchedule();
        });
        const langSel = document.getElementById("script-lang");
        if (langSel) {
            langSel.value = this.scriptLang;
            langSel.addEventListener("change", () => { this.scriptLang = langSel.value; this.regenScript(); });
        }
        document.getElementById("btn-copy-script")?.addEventListener("click", () => {
            navigator.clipboard.writeText(document.getElementById("script-output").textContent);
            const b = document.getElementById("btn-copy-script");
            const t = (k, fb) => (window.I18N && I18N.t(k)) || fb;
            const o = b.innerHTML;
            b.innerHTML = `<i class="fa-solid fa-check"></i> ${t("bot.copied", "Готово")}`;
            setTimeout(() => b.innerHTML = o, 1500);
        });
    },

    updateRunButton(isRunning) {
        const btn = document.getElementById("btn-run-scenario");
        if (!btn) return;
        const t = (k, fb) => (window.I18N && I18N.t(k)) || fb;
        if (isRunning) {
            btn.classList.add("is-running");
            btn.innerHTML = `<i class="fa-solid fa-stop"></i> <span>${t("run.stop", "Остановить")}</span>`;
        } else {
            btn.classList.remove("is-running");
            btn.innerHTML = `<i class="fa-solid fa-play"></i> <span data-i18n="run.start">${t("run.start", "Запустить")}</span>`;
        }
        btn.disabled = false;
    },

    // ==================== ПЛАНИРОВЩИК (ПОВТОР ПО РАСПИСАНИЮ) ====================

    startSchedule() {
        this.stopSchedule(true);
        const n = parseInt(document.getElementById("sched-interval")?.value || "5") || 5;
        const unit = parseInt(document.getElementById("sched-unit")?.value || "60000") || 60000;
        const ms = Math.max(1000, n * unit);
        this._schedMs = ms;
        const statusEl = document.getElementById("sched-status");
        const unitTxt = unit === 1000 ? "сек" : (unit === 3600000 ? "ч" : "мин");
        const tick = () => {
            if (!this.running) {
                this.log(`<span class="log-time">${this.now()}</span> <i class="fa-solid fa-clock" style="color:var(--lzt-green);"></i> Запуск по расписанию`);
                this.run();
            }
        };
        // первый запуск через интервал (не сразу — новички часто включают случайно)
        this._schedTimer = setInterval(tick, ms);
        if (statusEl) statusEl.innerHTML = `<span style="color:var(--lzt-green);">● каждые ${n} ${unitTxt} (старт через ${n} ${unitTxt})</span>`;
        this.flash && this.flash(`Расписание: первый запуск через ${n} ${unitTxt}`, "ok");
    },

    stopSchedule(keepChecked) {
        if (this._schedTimer) { clearInterval(this._schedTimer); this._schedTimer = null; }
        const statusEl = document.getElementById("sched-status");
        if (statusEl) statusEl.textContent = "";
        if (!keepChecked) {
            const chk = document.getElementById("chk-schedule");
            if (chk) chk.checked = false;
        }
    },

    setNodeState(id, state) {
        const el = this.nodesLayer.querySelector(`[data-node="${id}"]`);
        if (!el) return;
        el.classList.remove("running", "done", "error");
        if (state) el.classList.add(state);
        if (state === "running" && el.scrollIntoView) {
            try { el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" }); } catch (e) {}
        }
    },

    clearRunStates() {
        this.nodesLayer.querySelectorAll(".snode").forEach(el => el.classList.remove("running", "done", "error"));
    },

    log(html, cls) {
        this._appendLog("run-log", html, cls);
    },

    debugLog(html, cls) {
        this._appendLog("run-debug", html, cls);
    },

    _appendLog(boxId, html, cls) {
        const box = document.getElementById(boxId);
        if (!box) return;
        if (box.dataset.fresh !== "1") { box.innerHTML = ""; box.dataset.fresh = "1"; }
        const row = document.createElement("div");
        row.className = "log-row log-row-enter" + (cls ? " " + cls : "");
        row.innerHTML = html;
        box.appendChild(row);
        if (typeof box.scrollTo === "function") {
            box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
        } else {
            box.scrollTop = box.scrollHeight;
        }
    },

    _resetLogBoxes() {
        ["run-log", "run-debug"].forEach(id => {
            const box = document.getElementById(id);
            if (box) box.dataset.fresh = "0";
        });
    },

    tableColgroup(cols) {
        const colW = (c) => {
            const k = String(c || "").toLowerCase();
            if (k === "item_id" || k === "id") return 88;
            if (k === "price") return 64;
            if (k === "item_state" || k === "state" || k === "status") return 76;
            if (k === "title" || k === "name" || k === "description") return null;
            return 112;
        };
        return `<colgroup>${cols.map(c => {
            const w = colW(c);
            return w ? `<col style="width:${w}px">` : "<col>";
        }).join("")}</colgroup>`;
    },

    tableCell(v, maxLen) {
        if (v == null) return "";
        if (typeof v === "object") v = JSON.stringify(v);
        v = String(v);
        const full = this.esc(v);
        const short = this.esc(v.length > maxLen ? v.slice(0, maxLen) + "…" : v);
        return `<td title="${full}">${short}</td>`;
    },

    // Найти в ответе первый массив объектов (items / список верхнего уровня)
    findRows(data) {
        if (Array.isArray(data) && data.length && typeof data[0] === "object") return data;
        if (data && typeof data === "object") {
            for (const k of ["items", "data", "results", "list"]) {
                if (Array.isArray(data[k]) && data[k].length && typeof data[k][0] === "object") return data[k];
            }
        }
        return null;
    },

    // Превью ответа таблицей + кнопки скачивания прямо в логе прогона
    logResultPreview(data) {
        const rows = this.findRows(data);
        if (!rows) return;
        const box = document.getElementById("run-debug");
        if (!box) return;
        if (box.dataset.fresh !== "1") { box.innerHTML = ""; box.dataset.fresh = "1"; }
        const cols = [];
        rows.slice(0, 20).forEach(r => Object.keys(r).forEach(k => { if (!cols.includes(k) && cols.length < 6) cols.push(k); }));
        const head = cols.map(c => `<th title="${this.esc(c)}">${this.esc(c)}</th>`).join("");
        const body = rows.slice(0, 8).map(r => `<tr>${cols.map(c => this.tableCell(r[c], 80)).join("")}</tr>`).join("");
        const colgroup = this.tableColgroup(cols);
        const wrap = document.createElement("div");
        wrap.className = "log-row log-row-enter";
        wrap.innerHTML = `<div class="result-preview">
            <div class="result-preview-head">
                <span><i class="fa-solid fa-table-list"></i> Результат: ${rows.length} записей ${rows.length > 8 ? "(показаны первые 8)" : ""}</span>
                <span class="result-dl">
                    <button class="result-dl-btn" data-act="open"><i class="fa-solid fa-table-cells-large"></i> Таблица</button>
                    <button class="result-dl-btn" data-fmt="csv"><i class="fa-solid fa-file-csv"></i> CSV</button>
                    <button class="result-dl-btn" data-fmt="json"><i class="fa-solid fa-file-code"></i> JSON</button>
                </span>
            </div>
            <div class="result-table-wrap"><table class="result-table dt-table">${colgroup}<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
        </div>`;
        wrap.querySelectorAll(".result-dl-btn[data-fmt]").forEach(b => b.addEventListener("click", () => {
            const fmt = b.dataset.fmt;
            const content = fmt === "csv" ? this.toCSV(rows) : JSON.stringify(rows, null, 2);
            this.downloadFile(`result.${fmt}`, content, fmt === "csv" ? "text/csv" : "application/json");
        }));
        wrap.querySelector('[data-act="open"]').addEventListener("click", () => this.openDataTable(rows));
        box.appendChild(wrap);
        box.scrollTop = box.scrollHeight;
    },

    // Полноэкранная таблица результатов: поиск, сортировка по колонкам, экспорт
    openDataTable(rows) {
        if (!Array.isArray(rows) || !rows.length) return;
        document.querySelectorAll(".datatable-modal").forEach(m => m.remove());
        const cols = [];
        rows.forEach(r => { if (r && typeof r === "object") Object.keys(r).forEach(k => { if (!cols.includes(k)) cols.push(k); }); });
        const state = { q: "", sortCol: null, sortDir: 1 };
        const cellVal = (r, c) => { let v = r ? r[c] : undefined; if (v == null) return ""; return typeof v === "object" ? JSON.stringify(v) : v; };

        const el = document.createElement("div");
        el.className = "modal-overlay datatable-modal";
        el.innerHTML = `
            <div class="modal-box" style="width:min(1100px,94vw); max-height:88vh; display:flex; flex-direction:column;">
                <div class="modal-header">
                    <span style="font-weight:700; color:#fff; display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-table-cells-large" style="color:var(--lzt-green);"></i> Таблица результатов <span id="dt-count" style="color:var(--text-muted); font-weight:500; font-size:13px;"></span></span>
                    <button class="modal-close" id="dt-close-x"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="modal-body" style="overflow:hidden; display:flex; flex-direction:column; gap:10px;">
                    <div style="display:flex; gap:8px; align-items:center;">
                        <div style="position:relative; flex:1;">
                            <i class="fa-solid fa-magnifying-glass" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--text-muted); font-size:12px;"></i>
                            <input type="text" id="dt-search" class="form-control" placeholder="Поиск по всем полям…" style="padding-left:30px;">
                        </div>
                        <button class="btn-token" id="dt-csv"><i class="fa-solid fa-file-csv"></i> CSV</button>
                        <button class="btn-token" id="dt-json"><i class="fa-solid fa-file-code"></i> JSON</button>
                    </div>
                    <div style="overflow:auto; flex:1;"><table class="result-table dt-table" id="dt-table">${this.tableColgroup(cols)}<thead><tr id="dt-head"></tr></thead><tbody id="dt-body"></tbody></table></div>
                </div>
            </div>`;
        document.body.appendChild(el);
        LZTUi.showOverlay(el);
        const close = () => LZTUi.hideOverlay(el, { remove: true });
        el.querySelector("#dt-close-x").addEventListener("click", close);
        el.addEventListener("click", (e) => { if (e.target === el) close(); });
        el.querySelector("#dt-csv").addEventListener("click", () => this.downloadFile("result.csv", this.toCSV(view()), "text/csv"));
        el.querySelector("#dt-json").addEventListener("click", () => this.downloadFile("result.json", JSON.stringify(view(), null, 2), "application/json"));

        const head = el.querySelector("#dt-head");
        const bodyEl = el.querySelector("#dt-body");
        const countEl = el.querySelector("#dt-count");

        const view = () => {
            let r = rows.slice();
            if (state.q) {
                const q = state.q.toLowerCase();
                r = r.filter(row => cols.some(c => String(cellVal(row, c)).toLowerCase().includes(q)));
            }
            if (state.sortCol != null) {
                const c = state.sortCol;
                r.sort((a, b) => {
                    const av = cellVal(a, c), bv = cellVal(b, c);
                    const an = parseFloat(av), bn = parseFloat(bv);
                    let cmp;
                    if (!isNaN(an) && !isNaN(bn)) cmp = an - bn;
                    else cmp = String(av).localeCompare(String(bv), "ru");
                    return cmp * state.sortDir;
                });
            }
            return r;
        };
        const renderHead = () => {
            head.innerHTML = cols.map(c => {
                const arrow = state.sortCol === c ? (state.sortDir === 1 ? " ▲" : " ▼") : "";
                return `<th data-col="${this.esc(c)}" style="cursor:pointer; white-space:nowrap;">${this.esc(c)}${arrow}</th>`;
            }).join("");
            head.querySelectorAll("th").forEach(th => th.addEventListener("click", () => {
                const c = th.dataset.col;
                if (state.sortCol === c) state.sortDir *= -1; else { state.sortCol = c; state.sortDir = 1; }
                renderHead(); renderBody();
            }));
        };
        const renderBody = () => {
            const r = view();
            countEl.textContent = `· ${r.length} из ${rows.length}`;
            bodyEl.innerHTML = r.slice(0, 500).map(row =>
                `<tr>${cols.map(c => this.tableCell(cellVal(row, c), 120)).join("")}</tr>`
            ).join("");
        };
        el.querySelector("#dt-search").addEventListener("input", (e) => { state.q = e.target.value.trim(); renderBody(); });
        renderHead(); renderBody();
        setTimeout(() => el.querySelector("#dt-search").focus(), 50);
    },


    // Проверка сценария: возвращает { errors, warnings }
    validateScenario() {
        return window.ScenarioValidate.validate(this.nodes, this.edges, {
            hasToken: this._demoMode || !!(window.LZTToken && window.LZTToken.get()),
            demoMode: !!this._demoMode,
            nodeTypes: NODE_TYPES,
        });
    },

    async apiTest(body) {
        if (this._demoMode && window.LZTDemo) return window.LZTDemo.mockApiTest(body);
        const res = await fetch("/api/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        return res.json();
    },

    async scenarioAiCall(prompt, system) {
        if (this._demoMode && window.LZTDemo) return window.LZTDemo.mockAiResponse(prompt);
        let cfg = {};
        try { cfg = JSON.parse(localStorage.getItem("lzt_ai_cfg") || "{}"); } catch (e) {}
        const key = (localStorage.getItem("lzt_ai_key") || "").trim();
        if (!key) throw new Error("Нет API-ключа ИИ — настройте в AI+ или настройках");
        const res = await fetch("/api/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                base_url: (cfg.base || "https://api.openai.com/v1").replace(/\/+$/, ""),
                api_key: key,
                model: cfg.model || "gpt-4o-mini",
                system: system || "Ответь кратко. Если просят JSON — только валидный JSON без markdown.",
                prompt,
            }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Ошибка ИИ");
        return data.content;
    },

    _playSniperBeep() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.frequency.value = 1046; g.gain.value = 0.1;
            o.start(); o.stop(ctx.currentTime + 0.12);
        } catch (e) {}
    },

    _sniperToast(id, price) {
        if (window.LZTToast) window.LZTToast("Снайпер", `Куплен лот #${id} за ${price}₽`, { type: "success" });
        this._playSniperBeep();
    },

    // Универсальный исполнитель графа (основной сценарий + под-сценарии)
    async _execLoop(initialCur, ctx, stats, counters, proxyState, opts) {
        opts = Object.assign({ maxSteps: 300, silent: false, label: "" }, opts || {});
        const savedNodes = this.nodes;
        const savedEdges = this.edges;
        if (opts.nodes) this.nodes = opts.nodes;
        if (opts.edges) this.edges = opts.edges;
        let cur = initialCur;
        let steps = 0;
        if (opts.label) {
            this.log(`<span class="log-time">${this.now()}</span> <i class="fa-solid fa-layer-group"></i> Под-сценарий: <b>${this.esc(opts.label)}</b>`);
        }
        try {
            while (cur && this.running && this._runToken != null && steps < opts.maxSteps) {
                steps++;
                const node = this.getNode(cur);
                if (!node) break;
                if (!opts.silent) {
                    this.setNodeState(node.id, "running");
                    await this.sleep(280);
                } else {
                    await this.sleep(80);
                }
                cur = await this._execNode(node, ctx, stats, counters, proxyState, opts);
            }
        } finally {
            this.nodes = savedNodes;
            this.edges = savedEdges;
        }
        return { steps, cur };
    },

    // Выполнить один блок, вернуть id следующего
    async _execNode(node, ctx, stats, counters, proxyState, opts) {
        opts = opts || {};
        let cur = null;
        if (node.type === "request") {
                    const req = node.request || {};
                    const url = (window.ScenarioNormalize?.fixMarketUrl || (u => u))(this.resolveVars(req.url, ctx));
                    const params = this.resolveVars(req.params || {}, ctx);
                    const body = req.body ? this.resolveVars(req.body, ctx) : null;
                    const headers = Object.assign({}, (typeof currentHeaders !== "undefined" ? currentHeaders : {}) || {}, req.headers || {});
                    const token = window.LZTToken?.get?.();
                    if (token && !headers.Authorization && !headers.authorization) {
                        headers.Authorization = `Bearer ${token}`;
                    }
                    this.log(`<span class="log-time">${this.now()}</span> <b>${this.esc(req.title || "Запрос")}</b>`);
                    this.debugLog(`<span class="log-time">${this.now()}</span> <span class="log-dim">${req.method} ${this.esc(this.shortUrl(url))}</span>`);
                    let ok = false, data = null, code = 0, errText = "";
                    const maxRetries = Math.max(0, req.retries || 0);
                    const respectRL = req.respectRateLimit !== false;
                    let attempt = 0;
                    while (true) {
                        let respHeaders = {};
                        try {
                            const result = await this.apiTest({ url, method: req.method, params, headers, body, proxy: ctx.proxy || null, timeout: req.timeout || 15 });
                            if (result.success) {
                                data = result.data; code = result.status_code || 200; respHeaders = result.headers || {};
                                ok = code < 400;
                                if (!ok) {
                                    const apiErr = data?.errors?.[0]?.message || data?.error?.message
                                        || (typeof data?.error === "string" ? data.error : null)
                                        || data?.message;
                                    errText = apiErr ? `HTTP ${code}: ${apiErr}` : "HTTP " + code;
                                }
                            } else { errText = result.error || "ошибка"; }
                        } catch (err) { errText = String(err); }

                        if (ok) break;

                        // 429 / rate limit: ждём Retry-After и повторяем (сверх обычных ретраев)
                        const isRate = code === 429;
                        if (isRate && respectRL && this.running) {
                            const ra = parseInt(respHeaders["retry-after"] || respHeaders["Retry-After"] || "");
                            const waitMs = (!isNaN(ra) ? ra * 1000 : Math.min(30000, 2000 * Math.pow(2, attempt)));
                            this.debugLog(`<span class="log-warn"><i class="fa-solid fa-hourglass-half"></i> Лимит LZT (429), ждём ${Math.round(waitMs / 1000)}с…</span>`);
                            await this.sleep(waitMs);
                            attempt++;
                            if (attempt > 8) break; // предохранитель от вечного цикла
                            continue;
                        }

                        // Обычный ретрай при ошибке
                        if (attempt < maxRetries && this.running) {
                            attempt++;
                            const waitMs = (req.retryDelay || 1000) * attempt;
                            this.debugLog(`<span class="log-warn"><i class="fa-solid fa-rotate"></i> Повтор ${attempt}/${maxRetries} через ${Math.round(waitMs / 1000)}с (${this.esc(errText)})…</span>`);
                            await this.sleep(waitMs);
                            continue;
                        }
                        break;
                    }
                    ctx.last = data;
                    if (data != null) { this.lastRunData[node.id] = data; this.lastRunData.__latest = data; }
                    if (ok) {
                        this.setNodeState(node.id, "done");
                        stats.reqOk++;
                        this.debugLog(`<span class="log-ok">HTTP ${code}</span> <span class="log-dim">${this.summary(data)}</span>`);
                        this.logResultPreview(data);
                        cur = this.followEdge(node.id, "success");
                        if (!cur) this.log(`<span class="log-dim">→ выход «Успех» ни к чему не подключён, стоп.</span>`);
                    } else {
                        this.setNodeState(node.id, "error");
                        stats.reqErr++;
                        this.log(`<span class="log-err">✕</span> <span class="log-dim">${this.esc(req.title || "Запрос")}</span>`);
                        this.debugLog(`<span class="log-err">${this.esc(errText)}</span>`);
                        cur = this.followEdge(node.id, "error");
                        if (!cur) {
                            const startN = this.nodes.find(n => n.type === "start");
                            if (startN && (!startN.start || startN.start.globalError !== false)) {
                                cur = this.followEdge(startN.id, "onerror");
                                if (cur) this.log(`<span class="log-warn"><i class="fa-solid fa-shield-halved"></i> Глобальная обработка ошибки</span>`);
                            }
                        }
                        if (!cur) { this.log(`<span class="log-dim">→ выход «Ошибка» не подключён, стоп.</span>`); return null; }
                    }
                } else if (node.type === "condition") {
                    const res = this.evalCondition(node.condition, ctx);
                    this.setNodeState(node.id, "done");
                    this.log(`<span class="log-time">${this.now()}</span> Условие <code>${this.esc(node.condition.left)}</code> → <b class="${res ? "log-ok" : "log-err"}">${res ? "Да" : "Нет"}</b>`);
                    cur = this.followEdge(node.id, res ? "true" : "false");
                } else if (node.type === "filter") {
                    const f = node.filter;
                    const fr = window.ScenarioEngine.applyFilter(f, ctx);
                    const arr = fr.arr;
                    const result = fr.ok ? fr.items : [];
                    ctx.vars[f.saveAs] = result;
                    ctx.last = result;
                    this.setNodeState(node.id, fr.ok ? "done" : "error");
                    if (!fr.ok) {
                        this.log(`<span class="log-err"><code>${this.esc(f.source)}</code></span>`);
                    } else {
                        this.log(`<span class="log-time">${this.now()}</span> ${result.length}/${arr.length}`);
                    }
                    cur = this.followEdge(node.id, result.length ? "found" : "empty");
                    if (!cur) { this.log(`<span class="log-dim">stop</span>`); return null; }
                } else if (node.type === "notify") {
                    const n = node.notify;
                    const text = this.resolveVars(n.text, ctx);
                    this.log(`<span class="log-time">${this.now()}</span> <i class="fa-solid fa-paper-plane" style="color:#0088cc;"></i> Уведомление: <span class="log-dim">${this.esc(text.slice(0, 60))}</span>`);
                    try {
                        if (this._demoMode) {
                            this.setNodeState(node.id, "done");
                            this.log(`<span class="log-ok">✓ [демо] уведомление отправлено</span>`);
                            if (window.LZTToast) window.LZTToast("Telegram (демо)", text.slice(0, 80), { type: "info" });
                        } else {
                        const res = await fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: n.channel, text, tg_token: n.tgToken, tg_chat: n.tgChat, discord_url: n.discordUrl }) });
                        const r = await res.json();
                        if (r.success) { this.setNodeState(node.id, "done"); this.log(`<span class="log-ok">✓ отправлено</span>`); }
                        else { this.setNodeState(node.id, "error"); this.log(`<span class="log-err">✕ ${this.esc(r.error || "не отправлено")}</span>`); }
                        }
                    } catch (err) { this.setNodeState(node.id, "error"); this.log(`<span class="log-err">✕ ${this.esc(String(err))}</span>`); }
                    cur = this.followEdge(node.id, "out");
                } else if (node.type === "logmsg") {
                    const text = this.resolveVars(node.logmsg.text, ctx);
                    this.setNodeState(node.id, "done");
                    this.log(`<span class="log-time">${this.now()}</span> <i class="fa-solid fa-comment-dots" style="color:#7f8c8d;"></i> ${this.esc(text)}`);
                    cur = this.followEdge(node.id, "out");
                } else if (node.type === "savefile") {
                    const s = node.savefile;
                    const val = this.getPath(ctx, s.source);
                    if (val == null) {
                        this.setNodeState(node.id, "error");
                        this.log(`<span class="log-err">Сохранение: по пути <code>${this.esc(s.source)}</code> нет данных.</span>`);
                    } else {
                        const content = s.format === "csv" ? this.toCSV(val) : JSON.stringify(val, null, 2);
                        const fname = `${s.filename || "results"}.${s.format}`;
                        const okd = await this.downloadFile(fname, content, s.format === "csv" ? "text/csv" : "application/json");
                        const cnt = Array.isArray(val) ? val.length : 1;
                        this.setNodeState(node.id, okd ? "done" : "error");
                        this.log(`<span class="log-time">${this.now()}</span> <i class="fa-solid fa-file-arrow-down" style="color:#27ae60;"></i> ${okd ? "Сохранён" : "Не удалось сохранить"} <b>${this.esc(fname)}</b> <span class="log-dim">(${cnt} записей)</span>`);
                    }
                    cur = this.followEdge(node.id, "out");
                } else if (node.type === "proxy") {
                    const list = (node.proxy.list || "").split("\n").map(s => s.trim()).filter(Boolean);
                    if (!list.length) {
                        ctx.proxy = null;
                        this.log(`<span class="log-time">${this.now()}</span> Прокси: список пуст — запросы идут напрямую.`);
                    } else {
                        let pick;
                        if (node.proxy.mode === "random") {
                            pick = list[Math.floor(Math.random() * list.length)];
                        } else {
                            const i = (proxyState[node.id] || 0) % list.length;
                            proxyState[node.id] = i + 1;
                            pick = list[i];
                        }
                        ctx.proxy = pick;
                        this.log(`<span class="log-time">${this.now()}</span> <i class="fa-solid fa-shield-halved" style="color:#607d8b;"></i> Прокси: <span class="log-dim">${this.esc(pick)}</span>`);
                    }
                    this.setNodeState(node.id, "done");
                    cur = this.followEdge(node.id, "out");
                } else if (node.type === "loop") {
                    const step = window.ScenarioEngine.stepLoop(node.id, node.loop.times, counters);
                    if (step.port === "done") {
                        this.setNodeState(node.id, "done");
                        this.log(`<span class="log-time">${this.now()}</span> ${node.loop.times}`);
                        cur = this.followEdge(node.id, "done");
                    } else {
                        ctx.loop = step.iteration;
                        this.setNodeState(node.id, "done");
                        this.log(`<span class="log-time">${this.now()}</span> ${step.iteration}/${node.loop.times}`);
                        cur = this.followEdge(node.id, "body");
                        if (!cur) { this.log(`<span class="log-dim">stop</span>`); return null; }
                    }
                } else if (node.type === "variable") {
                    const val = this.getPath(ctx, node.variable.path);
                    ctx.vars[node.variable.name] = val;
                    this.setNodeState(node.id, "done");
                    this.log(`<span class="log-time">${this.now()}</span> <code>${this.esc(node.variable.name)}</code> = <b>${this.esc(val == null ? "—" : (typeof val === "object" ? JSON.stringify(val) : String(val)))}</b>`);
                    cur = this.followEdge(node.id, "out");
                } else if (node.type === "foreach") {
                    const fe = node.foreach;
                    const arr = this.getPath(ctx, fe.source);
                    const step = window.ScenarioEngine.stepForeach(node.id, arr, counters, "_fi");
                    if (step.error === "not_array") {
                        this.setNodeState(node.id, "error");
                        this.log(`<span class="log-err">For-each: <code>${this.esc(fe.source)}</code></span>`);
                        cur = this.followEdge(node.id, "done");
                    } else if (step.port === "done") {
                        this.setNodeState(node.id, "done");
                        this.log(`<span class="log-time">${this.now()}</span> For-each ${step.length}`);
                        cur = this.followEdge(node.id, "done");
                    } else {
                        ctx.vars[fe.itemVar] = step.item;
                        ctx.vars[fe.indexVar || "i"] = step.index;
                        ctx.last = step.item;
                        this.setNodeState(node.id, "done");
                        this.log(`<span class="log-time">${this.now()}</span> For-each: ${step.index + 1}/${step.length}`);
                        cur = this.followEdge(node.id, "body");
                        if (!cur) { this.log(`<span class="log-dim">stop</span>`); return null; }
                    }
                } else if (node.type === "checker") {
                    const c = node.checker;
                    let itemId = this.getPath(ctx, c.itemPath);
                    if (itemId == null) itemId = this.resolveVars(String(c.itemPath), ctx);
                    const url = `https://prod-api.lzt.market/${itemId}`;
                    this.log(`<span class="log-time">${this.now()}</span> <i class="fa-solid fa-user-check"></i> Проверка лота <b>${this.esc(String(itemId))}</b>`);
                    let ok = false, errText = "";
                    try {
                        const result = await this.apiTest({ url, method: "GET", params: {}, headers: Object.assign({}, currentHeaders || {}), body: null, proxy: ctx.proxy || null, timeout: 15 });
                        if (result.success && result.data) {
                            const item = result.data.item || result.data;
                            const sold = item.item_state === "paid" || item.item_state === "deleted" || item.is_sold;
                            ok = c.rejectSold !== false ? !sold && !!item.item_id : !!item.item_id;
                            if (!ok) errText = sold ? "продан" : "нет данных";
                        } else errText = result.error || "ошибка";
                    } catch (e) { errText = String(e); }
                    this.setNodeState(node.id, ok ? "done" : "error");
                    this.log(ok ? `<span class="log-ok">✓ аккаунт OK</span>` : `<span class="log-err">✕ ${this.esc(errText)}</span>`);
                    cur = this.followEdge(node.id, ok ? "ok" : "fail");
                } else if (node.type === "ai") {
                    const a = node.ai || {};
                    const rawSource = this.getPath(ctx, a.source);
                    let batch = Array.isArray(rawSource) ? rawSource : (rawSource != null ? [rawSource] : []);
                    if (a.batch !== false) batch = batch.slice(0, parseInt(a.batchLimit, 10) || 50);
                    const compact = batch.map(it => ({
                        item_id: it.item_id,
                        price: it.price,
                        title: String(it.title || "").slice(0, 80),
                    }));
                    const userPrompt = `${this.resolveVars(a.prompt || "", ctx)}\n\nЛоты (JSON):\n${JSON.stringify(compact)}`;
                    this.log(`<span class="log-time">${this.now()}</span> <i class="fa-solid fa-brain" style="color:#9b59b6;"></i> ИИ: ${compact.length} лот(ов)`);
                    try {
                        let raw = await this.scenarioAiCall(userPrompt);
                        if (typeof raw === "string") raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
                        let parsed;
                        try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (e) { parsed = { raw }; }
                        const outVar = a.outputVar || "ai_result";
                        ctx.vars[outVar] = parsed;
                        ctx.last = parsed;
                        this.lastRunData[node.id] = parsed;
                        this.setNodeState(node.id, "done");
                        const recs = Array.isArray(parsed.items) ? parsed.items.length : 0;
                        this.log(`<span class="log-ok">✓ ИИ</span> <span class="log-dim">${recs ? recs + " рекомендаций → vars." + outVar : this.summary(parsed)}</span>`);
                        cur = this.followEdge(node.id, "success");
                        if (!cur) this.log(`<span class="log-dim">→ выход «Успех» ни к чему не подключён, стоп.</span>`);
                    } catch (err) {
                        this.setNodeState(node.id, "error");
                        this.log(`<span class="log-err">✕ ИИ: ${this.esc(String(err.message || err))}</span>`);
                        cur = this.followEdge(node.id, "error");
                        if (!cur) { this.log(`<span class="log-dim">→ выход «Ошибка» не подключён, стоп.</span>`); return null; }
                    }
                } else if (node.type === "sniper") {
                    const sn = node.sniper;
                    const items = this.getPath(ctx, sn.source);
                    const maxP = parseFloat(this.resolveVars(String(sn.maxPrice), ctx)) || Infinity;
                    const maxSpend = parseFloat(this.resolveVars(String(sn.maxSpend), ctx)) || Infinity;
                    ctx.vars._lzt_spend = ctx.vars._lzt_spend || 0;
                    let port = "skip", bought = false;
                    if (!Array.isArray(items) || !items.length) {
                        this.log(`<span class="log-warn">Снайпер: список пуст</span>`);
                    } else {
                        for (const it of items) {
                            const price = parseFloat(it[sn.priceField || "price"] || 0);
                            const id = it[sn.itemField || "item_id"];
                            if (!id || price > maxP) continue;
                            if (ctx.vars._lzt_spend + price > maxSpend) { this.log(`<span class="log-warn">Лимит трат ${maxSpend}₽</span>`); break; }
                            const url = `https://prod-api.lzt.market/${id}/fast-buy`;
                            this.log(`<span class="log-time">${this.now()}</span> <i class="fa-solid fa-crosshairs"></i> Покупка <b>${id}</b> за ${price}₽…`);
                            try {
                                const result = await this.apiTest({ url, method: "POST", params: {}, headers: Object.assign({}, currentHeaders || {}), body: null, proxy: ctx.proxy || null, timeout: 20 });
                                if (result.success && (result.status_code || 200) < 400) {
                                    ctx.vars._lzt_spend += price;
                                    stats.spent = (stats.spent || 0) + price;
                                    bought = true; port = "bought";
                                    this.log(`<span class="log-ok">✓ Куплено! Потрачено: ${ctx.vars._lzt_spend}₽</span>`);
                                    this._sniperToast(id, price);
                                    if (window.LZTFeatures) window.LZTFeatures.updateProfit(stats);
                                    break;
                                } else this.log(`<span class="log-err">✕ ${this.esc(result.error || "не куплено")}</span>`);
                            } catch (e) { port = "fail"; this.log(`<span class="log-err">✕ ${this.esc(String(e))}</span>`); break; }
                        }
                    }
                    this.setNodeState(node.id, bought ? "done" : port === "fail" ? "error" : "done");
                    cur = this.followEdge(node.id, port);
                } else if (node.type === "subscenario") {
                    const ss = node.subscenario;
                    let tpl = null;
                    try {
                        tpl = JSON.parse(localStorage.getItem("lzt_scenarios") || "[]").find(t => t.id === ss.templateId);
                    } catch (e) {}
                    const subNodes = tpl?.nodes || tpl?.data?.nodes || [];
                    const subEdges = tpl?.edges || tpl?.data?.edges || [];
                    if (!tpl || !subNodes.length) {
                        if (!opts.silent) this.setNodeState(node.id, "error");
                        this.log(`<span class="log-err">Под-сценарий не выбран или не найден</span>`);
                    } else {
                        const subStart = subNodes.find(n => n.type === "start");
                        const subEdge = subEdges.find(e => e.from === subStart?.id && e.fromPort === "out");
                        const subCur = subEdge ? subEdge.to : null;
                        if (subCur) {
                            await this._execLoop(subCur, ctx, stats, counters, proxyState, {
                                nodes: subNodes,
                                edges: subEdges,
                                maxSteps: 200,
                                silent: true,
                                label: tpl.title
                            });
                        }
                        if (!opts.silent) this.setNodeState(node.id, "done");
                    }
                    cur = this.followEdge(node.id, "out");
                } else if (node.type === "delay") {
                    this.log(`<span class="log-time">${this.now()}</span> Пауза ${node.delay.ms} мс…`);
                    await this.sleep(node.delay.ms);
                    if (!opts.silent) this.setNodeState(node.id, "done");
                    cur = this.followEdge(node.id, "out");
                } else if (node.type === "stop") {
                    if (!opts.silent) this.setNodeState(node.id, "done");
                    this.log(`<span class="log-time">${this.now()}</span> <b>Стоп</b>`);
                    cur = null;
                } else { cur = null; }
        return cur;
    },

    async run(opts = {}) {
        this._demoMode = !!(opts && opts.demo);
        try {
        if (this._runBusy) return;
        const t = (k, fb) => (window.I18N && I18N.t(k)) || fb;
        const start = this.nodes.find(n => n.type === "start");
        if (!start) {
            const msg = t("run.err.noStart", "Нет блока «Старт».");
            this.log(`<span class="log-err">${this.esc(msg)}</span>`);
            if (window.LZTDialog) await LZTDialog.alert(msg, { title: t("run.err.noConnectionTitle", "Ошибка") });
            return;
        }
        const startCur = this.edgeTarget(start.id, "out");
        if (!startCur) {
            const msg = t("run.err.noConnection", "От «Старта» ничего не подключено.");
            this.log(`<span class="log-err"><i class="fa-solid fa-circle-xmark"></i> ${this.esc(msg.split("\n")[0])}</span>`);
            if (window.LZTDialog) await LZTDialog.alert(msg, { title: t("run.err.noConnectionTitle", "Сначала соедините блоки") });
            else this.flash?.(msg.split("\n")[0], "err");
            return;
        }

        const check = this.validateScenario();
        if (check.errors.length) {
            check.errors.forEach(e => this.log(`<span class="log-err"><i class="fa-solid fa-circle-xmark"></i> ${this.esc(e)}</span>`));
            return;
        }

        this._runBusy = true;
        const runToken = Symbol("run");
        this._runToken = runToken;
        this.running = true;
        const debugBox = document.getElementById("run-debug");
        debugBox?.classList.add("run-active");
        this.clearRunStates();
        this._resetLogBoxes();
        this.log(`<span class="log-time">${this.now()}</span> <b>Старт сценария</b>${this._demoMode ? ' <span class="log-warn">· демо</span>' : ""}`);
        check.warnings.forEach(w => this.log(`<span class="log-warn"><i class="fa-solid fa-triangle-exclamation"></i> ${this.esc(w)}</span>`));
        this.updateRunButton(true);
        document.getElementById("run-status").textContent = (window.I18N && I18N.t("run.status.running")) || "выполняется…";

        const ctx = { last: null, vars: {}, proxy: null };
        const counters = {};
        const proxyState = {};
        const stats = { reqOk: 0, reqErr: 0, notify: 0, saved: 0, spent: 0, startedAt: Date.now() };
        this._runStats = stats;
        let steps = 0;
        try {
            ({ steps } = await this._execLoop(startCur, ctx, stats, counters, proxyState, {}));
            if (steps >= 300) this.log(`<span class="log-err">Достигнут лимит шагов (300) — возможно, зациклено.</span>`);
        } catch (err) {
            this.log(`<span class="log-err">Сбой выполнения: ${this.esc(String(err))}</span>`);
        }

        if (this._runToken !== runToken) {
            document.getElementById("run-debug")?.classList.remove("run-active");
            if (this._runToken === null) {
                this._runBusy = false;
                this.running = false;
                this.updateRunButton(false);
                document.getElementById("run-status").textContent = (window.I18N && I18N.t("run.status.done")) || "готово";
            }
            return;
        }

        this.running = false;
        this._runBusy = false;
        this._runToken = null;
        this._activeEdge = null;
        document.getElementById("run-debug")?.classList.remove("run-active");
        this.redrawEdges();
        this.updateRunButton(false);
        document.getElementById("run-status").textContent = (window.I18N && I18N.t("run.status.done")) || "готово";
        this.log(`<span class="log-time">${this.now()}</span> <b>Сценарий завершён</b> · шагов: ${steps}`);
        this.recordHistory(stats, steps);
        } finally {
            this._demoMode = false;
        }
    },
};
