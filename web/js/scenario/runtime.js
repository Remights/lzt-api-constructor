/** Runtime mixin */
window.ScenarioRuntimeMixin = {
    bindRun() {
        document.getElementById("btn-run-scenario")?.addEventListener("click", () => {
            if (this._runBusy) {
                // не сбрасываем _runBusy здесь — иначе Stop→Run даст два параллельных цикла
                this._runToken = null;
                this.running = false;
                this._runCompleted = false;
                this._activeEdge = null;
                document.getElementById("run-debug")?.classList.remove("run-active");
                const t = (k, fb) => (window.I18N && I18N.t(k)) || fb;
                document.getElementById("run-status").textContent = t("run.status.stopping", "остановка…") || "остановка…";
                this.log(`<span class="log-warn"><i class="fa-solid fa-stop"></i> Остановка…</span>`);
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
        document.getElementById("btn-copy-script")?.addEventListener("click", async () => {
            const lim = this.codegenLimitations?.() || [];
            if (lim.length && window.LZTDialog?.confirm) {
                const ok = await LZTDialog.confirm(
                    `В коде есть заглушки для: ${lim.map((l) => l.label).join(", ")}. Копировать всё равно?`,
                    { title: "Экспорт неполный", okText: "Копировать", danger: false }
                );
                if (!ok) return;
            }
            const b = document.getElementById("btn-copy-script");
            navigator.clipboard.writeText(document.getElementById("script-output").textContent);
            if (!b) return;
            const t = (k, fb) => (window.I18N && I18N.t(k)) || fb;
            const o = b.innerHTML;
            b.innerHTML = `<i class="fa-solid fa-check"></i> ${t("bot.copied", "Готово")}`;
            setTimeout(() => { b.innerHTML = o; }, 1500);
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
                this.run({ demo: !!this._scenarioIsDemo });
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

    _lztBuyOk(result) {
        if (!result?.success) return false;
        const E = window.ScenarioEngine;
        if (E?.lztResponseOk) return E.lztResponseOk(result.status_code || 0, result.data);
        if ((result.status_code || 0) >= 400) return false;
        const d = result.data;
        if (!d || typeof d !== "object") return false;
        if (Array.isArray(d.errors) && d.errors.length) return false;
        if (d.error) return false;
        return true;
    },

    _isRetryRequest(data) {
        return !!(window.ScenarioEngine?.isRetryRequest?.(data));
    },

    _hashStr(s) {
        let h = 2166136261;
        const str = String(s || "");
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return (h >>> 0).toString(16);
    },

    async scenarioAiCall(prompt, system) {
        if (this._demoMode && window.LZTDemo) return window.LZTDemo.mockAiResponse(prompt);
        const sys = system || "Ответь кратко. Если просят JSON — только валидный JSON без markdown.";
        const key = (localStorage.getItem("lzt_ai_key") || "").trim();
        if (key) {
            let cfg = {};
            try { cfg = JSON.parse(localStorage.getItem("lzt_ai_cfg") || "{}"); } catch (e) {}
            const res = await fetch("/api/ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    base_url: (cfg.base || "https://api.openai.com/v1").replace(/\/+$/, ""),
                    api_key: key,
                    model: cfg.model || "gpt-4o-mini",
                    system: sys,
                    prompt,
                }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || "Ошибка ИИ");
            return data.content;
        }
        let fp = "LZTConstruct/1.3.0";
        try {
            const cr = await fetch("/api/config", { headers: { "X-LZT-Client": fp } });
            const cfg = await cr.json();
            if (cfg.client_fp) fp = cfg.client_fp;
        } catch (e) { /* ignore */ }
        const freeModel = (localStorage.getItem("lzt_ai_free_model") || "").trim();
        const res = await fetch("/api/ai/free", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-LZT-Client": fp },
            body: JSON.stringify({ prompt, system: sys, model: freeModel || undefined }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Бесплатный ИИ недоступен — задайте ключ в AI+");
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

    _authHeaders(extra) {
        const headers = Object.assign(
            {},
            (typeof currentHeaders !== "undefined" ? currentHeaders : {}) || {},
            extra || {}
        );
        const token = window.LZTToken?.get?.();
        if (token && !headers.Authorization && !headers.authorization) {
            headers.Authorization = `Bearer ${token}`;
        }
        return headers;
    },

    // Универсальный исполнитель графа (основной сценарий + под-сценарии)
    async _execLoop(initialCur, ctx, stats, counters, proxyState, opts) {
        opts = Object.assign({ maxSteps: 2000, silent: false, label: "" }, opts || {});
        const savedNodes = this.nodes;
        const savedEdges = this.edges;
        if (opts.nodes) this.nodes = opts.nodes;
        if (opts.edges) this.edges = opts.edges;
        let cur = initialCur;
        let steps = 0;
        let lastId = null;
        let sameStreak = 0;
        if (opts.label) {
            this.log(`<span class="log-time">${this.now()}</span> <i class="fa-solid fa-layer-group"></i> Под-сценарий: <b>${this.esc(opts.label)}</b>`);
        }
        try {
            const myToken = this._runToken;
            while (cur && this.running && this._runToken === myToken && steps < opts.maxSteps) {
                steps++;
                if (cur === lastId) {
                    sameStreak++;
                    if (sameStreak >= 80) {
                        this.log(`<span class="log-err">Похоже на цикл: блок <code>${this.esc(String(cur))}</code> повторяется без прогресса.</span>`);
                        break;
                    }
                } else {
                    lastId = cur;
                    sameStreak = 0;
                }
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
            if (steps >= opts.maxSteps) {
                this.log(`<span class="log-err">Достигнут лимит шагов (${opts.maxSteps}).</span>`);
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
                    const headers = Object.assign({}, this._authHeaders(), this.resolveVars(req.headers || {}, ctx));
                    if (!headers.Authorization && !headers.authorization) {
                        const token = window.LZTToken?.get?.();
                        if (token) headers.Authorization = `Bearer ${token}`;
                    }
                    if (body != null && !headers["Content-Type"] && !headers["content-type"]) {
                        const found = window.Constructor?.findByUrl?.(req.method || "GET", url);
                        const ct = found?.ep?.body_content_type;
                        if (ct) headers["Content-Type"] = ct;
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
                                ok = window.ScenarioEngine?.lztResponseOk
                                    ? window.ScenarioEngine.lztResponseOk(code, data)
                                    : code < 400;
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
                        if (isRate) {
                            stats.rate429 = (stats.rate429 || 0) + 1;
                            if (window.LZTFeatures?.updateRunDash) window.LZTFeatures.updateRunDash(stats);
                        }
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
                        if (window.LZTFeatures?.updateRunDash) window.LZTFeatures.updateRunDash(stats);
                        this.debugLog(`<span class="log-ok">HTTP ${code}</span> <span class="log-dim">${this.summary(data)}</span>`);
                        this.logResultPreview(data);
                        cur = this.followEdge(node.id, "success");
                        if (!cur) this.log(`<span class="log-dim">→ выход «Успех» ни к чему не подключён, стоп.</span>`);
                    } else {
                        this.setNodeState(node.id, "error");
                        stats.reqErr++;
                        if (window.LZTFeatures?.updateRunDash) window.LZTFeatures.updateRunDash(stats);                        this.log(`<span class="log-err">✕</span> <span class="log-dim">${this.esc(req.title || "Запрос")}</span>`);
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
                        else { this.setNodeState(node.id, "error"); stats.hardFail = (stats.hardFail || 0) + 1; this.log(`<span class="log-err">✕ ${this.esc(r.error || "не отправлено")}</span>`); }
                        }
                    } catch (err) { this.setNodeState(node.id, "error"); stats.hardFail = (stats.hardFail || 0) + 1; this.log(`<span class="log-err">✕ ${this.esc(String(err))}</span>`); }
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
                        const result = await this.apiTest({ url, method: "GET", params: {}, headers: this._authHeaders(), body: null, proxy: ctx.proxy || null, timeout: 15 });
                        if (result.success && result.data) {
                            const item = result.data.item || result.data;
                            const sold = item.item_state === "paid" || item.item_state === "deleted" || item.is_sold;
                            ok = c.rejectSold !== false ? !sold && !!item.item_id : !!item.item_id;
                            if (!ok) errText = sold ? "продан" : "нет данных";
                        } else errText = result.error || "ошибка";
                    } catch (e) { errText = String(e); }
                    this.setNodeState(node.id, ok ? "done" : "error");
                    if (!ok) stats.hardFail = (stats.hardFail || 0) + 1;
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
                    const structuredHint = "\n\nВерни ТОЛЬКО валидный JSON без markdown и пояснений.";
                    const userPrompt = `${this.resolveVars(a.prompt || "", ctx)}${structuredHint}\n\nЛоты (JSON):\n${JSON.stringify(compact)}`;
                    const cacheKey = "ai:" + this._hashStr(userPrompt);
                    this.log(`<span class="log-time">${this.now()}</span> <i class="fa-solid fa-brain" style="color:#9b59b6;"></i> ИИ: ${compact.length} лот(ов)`);
                    try {
                        this._aiCache = this._aiCache || {};
                        let raw = this._aiCache[cacheKey];
                        if (raw == null) {
                            raw = await this.scenarioAiCall(userPrompt);
                            this._aiCache[cacheKey] = raw;
                        } else {
                            this.log(`<span class="log-dim">кэш ИИ по hash лотов</span>`);
                        }
                        if (typeof raw === "string") raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
                        let parsed;
                        let aiOk = true;
                        try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (e) { parsed = { raw }; aiOk = false; }
                        const outVar = a.outputVar || "ai_result";
                        ctx.vars[outVar] = parsed;
                        ctx.last = parsed;
                        this.lastRunData[node.id] = parsed;
                        if (!aiOk) {
                            this.setNodeState(node.id, "error");
                            this.log(`<span class="log-err">✕ ИИ: ответ не JSON</span>`);
                            cur = this.followEdge(node.id, "error");
                            if (!cur) { this.log(`<span class="log-dim">→ выход «Ошибка» не подключён, стоп.</span>`); return null; }
                        } else {
                        this.setNodeState(node.id, "done");
                        const recs = Array.isArray(parsed.items) ? parsed.items.length : 0;
                        this.log(`<span class="log-ok">✓ ИИ</span> <span class="log-dim">${recs ? recs + " рекомендаций → vars." + outVar : this.summary(parsed)}</span>`);
                        cur = this.followEdge(node.id, "success");
                        }
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
                    const maxPRaw = this.resolveVars(String(sn.maxPrice), ctx);
                    const maxSRaw = this.resolveVars(String(sn.maxSpend), ctx);
                    const maxP = (maxPRaw === "" || maxPRaw == null || isNaN(parseFloat(maxPRaw))) ? Infinity : parseFloat(maxPRaw);
                    const maxSpend = (maxSRaw === "" || maxSRaw == null || isNaN(parseFloat(maxSRaw))) ? Infinity : parseFloat(maxSRaw);
                    ctx.vars._lzt_spend = ctx.vars._lzt_spend || 0;
                    let port = "skip", bought = false;
                    if (!Array.isArray(items) || !items.length) {
                        this.log(`<span class="log-warn">Снайпер: список пуст</span>`);
                    } else {
                        for (const it of items) {
                            const id = it[sn.itemField || "item_id"];
                            let price = parseFloat(it[sn.priceField || "price"] || 0);
                            // AI-вердикты часто без price — подтягиваем из filtered / last.items
                            if ((!price || isNaN(price)) && id != null) {
                                const pools = [ctx.vars.filtered, ctx.last?.items].filter(Array.isArray);
                                for (const arr of pools) {
                                    const src = arr.find(x => x && String(x[sn.itemField || "item_id"]) === String(id));
                                    if (src && src[sn.priceField || "price"] != null) {
                                        price = parseFloat(src[sn.priceField || "price"]);
                                        break;
                                    }
                                }
                            }
                            if (!id || isNaN(price) || price > maxP) continue;
                            if (ctx.vars._lzt_spend + price > maxSpend) { this.log(`<span class="log-warn">Лимит трат ${maxSpend}₽</span>`); break; }
                            const title = it.title || it.item_title || "";
                            this.log(`<span class="log-dim">кандидат: <b>${this.esc(String(id))}</b> · ${price}₽${title ? " · " + this.esc(String(title).slice(0, 60)) : ""}</span>`);
                            if (sn.dryRun || this._demoMode) {
                                this.log(`<span class="log-ok">○ Dry-run: купил бы ${id} за ${price}₽ (без fast-buy)</span>`);
                                bought = true; port = "bought";
                                break;
                            }
                            if (sn.confirmBuy !== false && !this._sniperLiveOkByNode?.[node.id]) {
                                const okBuy = window.LZTDialog?.confirm
                                    ? await LZTDialog.confirm(`Реальная покупка лота ${id} за ${price}₽?\nЛимит трат: ${maxSpend === Infinity ? "∞" : maxSpend + "₽"}`, { title: "Снайпер", okText: "Купить", danger: true })
                                    : confirm(`Купить ${id} за ${price}₽?`);
                                if (!okBuy) {
                                    this.log(`<span class="log-warn">Покупка отменена</span>`);
                                    break;
                                }
                                if (!this._sniperLiveOkByNode) this._sniperLiveOkByNode = {};
                                this._sniperLiveOkByNode[node.id] = true;
                            }
                            const url = `https://prod-api.lzt.market/${id}/fast-buy`;
                            this.log(`<span class="log-time">${this.now()}</span> <i class="fa-solid fa-crosshairs"></i> Покупка <b>${id}</b> за ${price}₽…`);
                            try {
                                let result = null;
                                let buyOk = false;
                                for (let ri = 0; ri < 20; ri++) {
                                    result = await this.apiTest({
                                        url, method: "POST", params: {},
                                        headers: this._authHeaders(),
                                        body: { price },
                                        proxy: ctx.proxy || null, timeout: 20,
                                    });
                                    if (this._lztBuyOk(result)) { buyOk = true; break; }
                                    if (this._isRetryRequest(result?.data) && this.running) {
                                        const waitMs = Math.min(5000, 300 + ri * 200);
                                        this.debugLog(`<span class="log-warn">retry_request, повтор ${ri + 1}/20…</span>`);
                                        await this.sleep(waitMs);
                                        continue;
                                    }
                                    break;
                                }
                                if (buyOk) {
                                    ctx.vars._lzt_spend += price;
                                    stats.spent = (stats.spent || 0) + price;
                                    bought = true; port = "bought";
                                    this.log(`<span class="log-ok">✓ Куплено! Потрачено: ${ctx.vars._lzt_spend}₽</span>`);
                                    this._sniperToast(id, price);
                                    if (window.LZTFeatures) window.LZTFeatures.updateProfit(stats);
                                    break;
                                } else {
                                    port = "fail";
                                    stats.hardFail = (stats.hardFail || 0) + 1;
                                    const failMsg = result?.data?.errors?.[0]?.message
                                        || result?.data?.error
                                        || result?.error
                                        || "не куплено";
                                    this.log(`<span class="log-err">✕ ${this.esc(String(failMsg))}</span>`);
                                    break;
                                }
                            } catch (e) { port = "fail"; stats.hardFail = (stats.hardFail || 0) + 1; this.log(`<span class="log-err">✕ ${this.esc(String(e))}</span>`); break; }
                        }
                    }
                    this.setNodeState(node.id, bought ? "done" : port === "fail" ? "error" : "done");
                    cur = this.followEdge(node.id, port);
                } else if (node.type === "script") {
                    const s = node.script || {};
                    const fname = (s.filename || "").trim();
                    const saveAs = (s.saveAs || "script_out").trim() || "script_out";
                    const timeout = Math.min(120, Math.max(1, parseInt(s.timeout, 10) || 30));
                    this.log(`<span class="log-time">${this.now()}</span> <i class="fa-solid fa-puzzle-piece" style="color:#e67e22;"></i> Скрипт <b>${this.esc(fname || "?")}</b>`);
                    if (!fname) {
                        this.setNodeState(node.id, "error");
                        this.log(`<span class="log-err">Не указан файл скрипта (папка hooks)</span>`);
                        cur = this.followEdge(node.id, "error");
                        if (!cur) return null;
                    } else if (this._demoMode) {
                        const mock = { ok: true, demo: true, echo: ctx.vars.hook || ctx.last };
                        ctx.vars[saveAs] = mock;
                        ctx.last = mock;
                        this.setNodeState(node.id, "done");
                        this.log(`<span class="log-ok">✓ [демо] скрипт</span>`);
                        cur = this.followEdge(node.id, "success");
                    } else {
                        try {
                            const payload = {
                                hook: ctx.vars.hook || null,
                                last: ctx.last,
                                vars: ctx.vars,
                                event: ctx.vars.hook_event || null,
                            };
                            const res = await fetch("/api/hooks/script", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ filename: fname, payload, timeout }),
                            });
                            const r = await res.json();
                            if (r.ok) {
                                ctx.vars[saveAs] = r.result;
                                ctx.last = r.result;
                                this.lastRunData[node.id] = r.result;
                                this.setNodeState(node.id, "done");
                                this.log(`<span class="log-ok">✓ скрипт → vars.${this.esc(saveAs)}</span>`);
                                cur = this.followEdge(node.id, "success");
                            } else {
                                this.setNodeState(node.id, "error");
                                stats.hardFail = (stats.hardFail || 0) + 1;
                                this.log(`<span class="log-err">✕ ${this.esc(r.error || "ошибка скрипта")}</span>`);
                                cur = this.followEdge(node.id, "error");
                                if (!cur) return null;
                            }
                        } catch (e) {
                            this.setNodeState(node.id, "error");
                            stats.hardFail = (stats.hardFail || 0) + 1;
                            this.log(`<span class="log-err">✕ ${this.esc(String(e))}</span>`);
                            cur = this.followEdge(node.id, "error");
                            if (!cur) return null;
                        }
                    }
                } else if (node.type === "subscenario") {
                    const ss = node.subscenario;
                    let tpl = null;
                    try {
                        tpl = (window.Scenario?.savedList?.() || JSON.parse(localStorage.getItem("lzt_scenarios") || "[]")).find(t => t.id === ss.templateId);
                    } catch (e) {}
                    const subNodes = tpl?.nodes || tpl?.data?.nodes || [];
                    const subEdges = tpl?.edges || tpl?.data?.edges || [];
                    if (!tpl || !subNodes.length) {
                        if (!opts.silent) this.setNodeState(node.id, "error");
                        this.log(`<span class="log-err">Под-сценарий не выбран или не найден</span>`);
                        cur = null;
                    } else {
                        const subStart = subNodes.find(n => n.type === "start");
                        const subEdge = subEdges.find(e => e.from === subStart?.id && e.fromPort === "out");
                        const subCur = subEdge ? subEdge.to : null;
                        if (subCur) {
                            await this._execLoop(subCur, ctx, stats, counters, proxyState, {
                                nodes: subNodes,
                                edges: subEdges,
                                maxSteps: 500,
                                silent: false,
                                label: tpl.title
                            });
                        }
                        if (!opts.silent) this.setNodeState(node.id, "done");
                        cur = this.followEdge(node.id, "out");
                    }
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
        this._runCompleted = false;
        this._lastHookResult = null;
        try {
        if (this._runBusy) return { ok: false, error: "busy" };
        if (this._nodeTestBusy) {
            this.flash?.("Дождитесь мини-теста шага", "err");
            return { ok: false, error: "busy" };
        }
        const t = (k, fb) => (window.I18N && I18N.t(k)) || fb;
        const start = this.nodes.find(n => n.type === "start");
        if (!start) {
            const msg = t("run.err.noStart", "Нет блока «Старт».");
            this.log(`<span class="log-err">${this.esc(msg)}</span>`);
            if (!opts.fromHook && window.LZTDialog) await LZTDialog.alert(msg, { title: t("run.err.noConnectionTitle", "Ошибка") });
            return { ok: false, error: msg };
        }
        const startCur = this.edgeTarget(start.id, "out");
        if (!startCur) {
            const msg = t("run.err.noConnection", "От «Старта» ничего не подключено.");
            this.log(`<span class="log-err"><i class="fa-solid fa-circle-xmark"></i> ${this.esc(msg.split("\n")[0])}</span>`);
            if (!opts.fromHook && window.LZTDialog) await LZTDialog.alert(msg, { title: t("run.err.noConnectionTitle", "Сначала соедините блоки") });
            else if (!opts.fromHook) this.flash?.(msg.split("\n")[0], "err");
            return { ok: false, error: msg };
        }

        const check = this.validateScenario();
        if (check.errors.length) {
            check.errors.forEach(e => this.log(`<span class="log-err"><i class="fa-solid fa-circle-xmark"></i> ${this.esc(e)}</span>`));
            return { ok: false, error: check.errors[0] };
        }

        this._runBusy = true;
        this._sniperLiveOkByNode = {};
        const runToken = Symbol("run");
        this._runToken = runToken;
        this.running = true;
        const debugBox = document.getElementById("run-debug");
        debugBox?.classList.add("run-active");
        this.clearRunStates();
        this._resetLogBoxes();
        const hookTag = opts.fromHook ? ' <span class="log-warn">· webhook</span>' : "";
        this.log(`<span class="log-time">${this.now()}</span> <b>Старт сценария</b>${this._demoMode ? ' <span class="log-warn">· демо</span>' : ""}${hookTag}`);
        check.warnings.forEach(w => this.log(`<span class="log-warn"><i class="fa-solid fa-triangle-exclamation"></i> ${this.esc(w)}</span>`));
        this.updateRunButton(true);
        document.getElementById("run-status").textContent = (window.I18N && I18N.t("run.status.running")) || "выполняется…";

        const ctx = { last: null, vars: {}, proxy: null };
        if (opts.hook != null) {
            ctx.vars.hook = opts.hook;
            ctx.vars.hook_event = opts.hookEvent || "event";
            ctx.last = opts.hook;
            this.log(`<span class="log-dim">webhook → vars.hook (${typeof opts.hook === "object" ? Object.keys(opts.hook || {}).slice(0, 6).join(", ") : "…"})</span>`);
        }
        const counters = {};
        const proxyState = {};
        const stats = { reqOk: 0, reqErr: 0, notify: 0, saved: 0, spent: 0, hardFail: 0, rate429: 0, startedAt: Date.now() };
        this._runStats = stats;
        if (window.LZTFeatures?.updateRunDash) window.LZTFeatures.updateRunDash(stats);
        let steps = 0;
        let runErr = null;
        try {
            ({ steps } = await this._execLoop(startCur, ctx, stats, counters, proxyState, {}));
            if (steps >= 2000) {
                runErr = "step limit";
            }
        } catch (err) {
            runErr = String(err);
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
            this.log(`<span class="log-warn">Сценарий остановлен</span>`);
            return { ok: false, error: "stopped", aborted: true };
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
        this._runCompleted = !runErr;

        const response = ctx.vars.hook_response != null
            ? ctx.vars.hook_response
            : {
                ok: !runErr && (stats.reqErr || 0) === 0 && (stats.hardFail || 0) === 0,
                event: ctx.vars.hook_event || null,
                last: ctx.last,
                spent: stats.spent || 0,
                reqOk: stats.reqOk,
                reqErr: stats.reqErr,
            };
        const topOk = !runErr && (stats.reqErr || 0) === 0 && (stats.hardFail || 0) === 0;
        const out = { ok: topOk, result: response, error: runErr || (topOk ? null : "scenario errors"), stats, steps };
        this._lastHookResult = out;
        return out;
        } finally {
            this._demoMode = false;
        }
    },

    _ctxLastForNode(nodeId) {
        const preds = (this.edges || []).filter((e) => e.to === nodeId).map((e) => e.from);
        for (const pid of preds) {
            if (this.lastRunData && this.lastRunData[pid] != null) return this.lastRunData[pid];
        }
        if (this.lastRunData && this.lastRunData.__latest != null) return this.lastRunData.__latest;
        return null;
    },

    _isFastBuyRequest(node) {
        const req = node && node.request;
        if (!req) return false;
        const method = String(req.method || "GET").toUpperCase();
        if (!/^(POST|PUT|PATCH)$/.test(method)) return false;
        const url = String(req.url || "");
        return /fast-buy/i.test(url);
    },

    showNodeTestPopover(nodeId, text, ok) {
        document.querySelectorAll(".snode-test-pop").forEach((el) => el.remove());
        const card = this.nodesLayer?.querySelector(`[data-node="${nodeId}"]`);
        if (!card) return;
        const pop = document.createElement("div");
        pop.className = "snode-test-pop" + (ok ? " ok" : " err");
        pop.innerHTML = `<i class="fa-solid ${ok ? "fa-circle-check" : "fa-circle-xmark"}"></i> <span>${this.esc(text)}</span>`;
        card.appendChild(pop);
        setTimeout(() => { try { pop.remove(); } catch (e) {} }, 6000);
    },

    /** Мини-тест одного блока request|ai без полного Run */
    async testNode(nodeId) {
        if (this._runBusy || this._nodeTestBusy) {
            this.flash?.("Сначала дождитесь окончания прогона", "err");
            return { ok: false, error: "busy" };
        }
        const node = (this.nodes || []).find((n) => n.id === nodeId);
        if (!node || (node.type !== "request" && node.type !== "ai")) {
            this.flash?.("Мини-тест только для Запрос / ИИ", "err");
            return { ok: false, error: "unsupported" };
        }
        if (node.type === "request" && this._isFastBuyRequest(node)) {
            this.flash?.("fast-buy нельзя мини-тестить — полный Run или Dry-run снайпера", "err");
            return { ok: false, error: "fast-buy" };
        }

        this._nodeTestBusy = true;
        this._demoMode = !!this._scenarioIsDemo;
        this.running = true;
        const stats = { reqOk: 0, reqErr: 0, notify: 0, saved: 0, spent: 0, hardFail: 0, rate429: 0, startedAt: Date.now() };
        this._runStats = stats;
        this._testVars = this._testVars || {};
        const ctx = {
            last: this._ctxLastForNode(nodeId),
            vars: Object.assign({}, this._testVars),
            proxy: null,
        };

        this.clearRunStates();
        this.setNodeState(nodeId, "running");
        this.log(`<span class="log-time">${this.now()}</span> <b>Мини-тест</b> · ${this.esc(node.type)}`);
        this.debugLog(`<span class="log-time">${this.now()}</span> <span class="log-dim">test node ${this.esc(nodeId)}</span>`);

        let ok = true;
        let errMsg = "";
        let meta = { nodeType: node.type };
        try {
            await this._execNode(node, ctx, stats, {}, {}, { silent: false });
            Object.assign(this._testVars, ctx.vars || {});
            const data = this.lastRunData?.[nodeId] ?? ctx.last;
            const el = this.nodesLayer?.querySelector(`[data-node="${nodeId}"]`);
            ok = !!(el && el.classList.contains("done"));
            meta.aiOk = node.type !== "ai" || ok;
            const text = this.humanTestSummary(data, Object.assign({ error: ok ? "" : (stats.reqErr ? "ошибка запроса" : "") }, meta));
            this.showNodeTestPopover(nodeId, text, ok);
            if (!ok) this.setNodeState(nodeId, "error");
            else this.setNodeState(nodeId, "done");
            this.flash?.(ok ? text : ("Ошибка: " + text), ok ? "ok" : "err");
            return { ok, result: data, summary: text };
        } catch (e) {
            ok = false;
            errMsg = String(e.message || e);
            this.setNodeState(nodeId, "error");
            this.showNodeTestPopover(nodeId, errMsg, false);
            this.log(`<span class="log-err">✕ Мини-тест: ${this.esc(errMsg)}</span>`);
            this.flash?.(errMsg, "err");
            return { ok: false, error: errMsg };
        } finally {
            this.running = false;
            this._nodeTestBusy = false;
            this._demoMode = false;
        }
    },
};
