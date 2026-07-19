/** Popover-редакторы: запрос, фильтр. */
(function () {
    "use strict";
    const R = () => window.ScenarioPropEditorRegistry;
    if (!R()) return;

    function headersToText(headers) {
        return Object.entries(headers || {}).map(([k, v]) => `${k}: ${v}`).join("\n");
    }

    function textToHeaders(text) {
        const out = {};
        String(text || "").split("\n").forEach((line) => {
            line = line.trim();
            if (!line || line.startsWith("#")) return;
            const i = line.indexOf(":");
            if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
        });
        return out;
    }

    function bodyToText(body) {
        if (body == null || body === "") return "";
        if (typeof body === "string") return body;
        try { return JSON.stringify(body, null, 2); } catch (e) { return String(body); }
    }

    function textToBody(text) {
        const t = String(text || "").trim();
        if (!t) return null;
        try { return JSON.parse(t); } catch (e) { return t; }
    }

    const TOP_FIELDS = [
        { name: "pmin", label: "Цена от", kind: "market" },
        { name: "pmax", label: "Цена до", kind: "market" },
        { name: "forum_id", label: "Раздел", kind: "forum", picker: true },
    ];

    R().register("request", ({ sc, node, pop, dismiss, esc }) => {
        const req = node.request || {};
        const paramsText = sc._reqParamsToText(req.params);
        const method = req.method || "GET";
        const showBodyFirst = method === "POST" || method === "PUT" || method === "PATCH";
        pop.classList.add("pop-wide");
        pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-bolt" style="color:#00ba78;"></i> Запрос к API</div>
            <label class="pop-label">Название (в логе)</label>
            <input type="text" class="form-control" id="pop-req-title" spellcheck="false" autocomplete="off" value="${esc(req.title || "Запрос")}" placeholder="Поиск Steam до 100₽">
            <label class="pop-label" style="margin-top:10px;">Метод и URL</label>
            <div class="pop-filter-row">
                <select class="form-control" id="pop-req-method" style="font-weight:700;color:var(--lzt-green);">
                    ${["GET", "POST", "PUT", "PATCH", "DELETE"].map(m => `<option value="${m}" ${method === m ? "selected" : ""}>${m}</option>`).join("")}
                </select>
                <input type="text" class="form-control" id="pop-req-url" spellcheck="false" autocomplete="off" value="${esc(req.url || "")}" placeholder="https://prod-api.lzt.market/steam">
            </div>
            <div class="req-top-fields" id="pop-req-top-fields"></div>
            <div class="req-tabs" id="pop-req-tabs" style="margin-top:12px;">
                <button type="button" class="req-tab ${!showBodyFirst ? "active" : ""}" data-tab="params">Параметры</button>
                <button type="button" class="req-tab ${showBodyFirst ? "active" : ""}" data-tab="body">Body</button>
                <button type="button" class="req-tab" data-tab="headers">Headers</button>
            </div>
            <div class="req-tab-pane ${!showBodyFirst ? "active" : ""}" data-pane="params">
                <span class="pop-label-hint">key=value, по одному на строку — или чипы / поля выше</span>
                <textarea class="form-control" id="pop-req-params" rows="4" spellcheck="false" autocomplete="off" placeholder="pmin=1&#10;pmax=100&#10;order_by=price_to_up">${esc(paramsText)}</textarea>
            </div>
            <div class="req-tab-pane ${showBodyFirst ? "active" : ""}" data-pane="body">
                <span class="pop-label-hint">JSON для POST/PUT. Forum: тело сюда, не в параметры query.</span>
                <textarea class="form-control" id="pop-req-body" rows="5" spellcheck="false" autocomplete="off" placeholder='{"thread_id": 123, "comment_body": "текст"}'>${esc(bodyToText(req.body))}</textarea>
            </div>
            <div class="req-tab-pane" data-pane="headers">
                <span class="pop-label-hint">Header: value, по одному на строку (Authorization уже из Старта)</span>
                <textarea class="form-control" id="pop-req-headers" rows="4" spellcheck="false" autocomplete="off" placeholder="Accept: application/json">${esc(headersToText(req.headers))}</textarea>
            </div>
            <div class="pop-hint">Подстановки: <code>{{vars…}}</code> · эндпоинт — чипы / «Каталог API».</div>
            <details class="pop-advanced" style="margin-top:10px;">
                <summary>Дополнительно</summary>
                <div class="pop-filter-row" style="margin-top:8px;">
                    <div><label class="mini-label">Повторов</label><input type="number" class="form-control" id="pop-req-retries" value="${req.retries != null ? req.retries : 0}" min="0" max="10"></div>
                    <div><label class="mini-label">Пауза, мс</label><input type="number" class="form-control" id="pop-req-delay" value="${req.retryDelay != null ? req.retryDelay : 1000}" min="0" step="100"></div>
                    <div><label class="mini-label">Тайм-аут, сек</label><input type="number" class="form-control" id="pop-req-timeout" value="${req.timeout != null ? req.timeout : 15}" min="1" max="120"></div>
                </div>
                <label class="rate-check" style="margin-top:8px;"><input type="checkbox" id="pop-req-rate" ${req.respectRateLimit !== false ? "checked" : ""}> Ждать при лимите LZT (429)</label>
            </details>
            <div class="req-required-strip" id="pop-req-required" style="display:none;"></div>
            <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
        document.body.appendChild(pop);

        const methodEl = pop.querySelector("#pop-req-method");
        const urlEl = pop.querySelector("#pop-req-url");
        const paramsTa = pop.querySelector("#pop-req-params");
        const bodyTa = pop.querySelector("#pop-req-body");
        const topHost = pop.querySelector("#pop-req-top-fields");
        const requiredEl = pop.querySelector("#pop-req-required");

        const syncTabs = (name) => {
            pop.querySelectorAll(".req-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
            pop.querySelectorAll(".req-tab-pane").forEach((p) => p.classList.toggle("active", p.dataset.pane === name));
        };
        pop.querySelectorAll(".req-tab").forEach((t) => {
            t.addEventListener("click", () => syncTabs(t.dataset.tab));
        });
        methodEl.addEventListener("change", () => {
            const m = methodEl.value;
            if (m === "POST" || m === "PUT" || m === "PATCH") syncTabs("body");
            else syncTabs("params");
            refreshTopFields();
            refreshRequired();
        });

        function parseParams() {
            return sc._reqTextToParams(paramsTa.value);
        }

        function writeParam(name, value) {
            if (window.LZTReqParamHints?.upsertParamLine) {
                window.LZTReqParamHints.upsertParamLine(paramsTa, name, value);
            } else {
                const cur = parseParams();
                if (value === "" || value == null) delete cur[name];
                else cur[name] = value;
                paramsTa.value = sc._reqParamsToText(cur) + (Object.keys(cur).length ? "\n" : "");
                paramsTa.dispatchEvent(new Event("input", { bubbles: true }));
            }
        }

        function refreshTopFields() {
            const kind = window.LZTReqParamHints?.detectApiKind?.(urlEl.value) || null;
            const params = parseParams();
            const fields = TOP_FIELDS.filter((f) => !f.kind || f.kind === kind);
            if (!fields.length || !kind) {
                topHost.innerHTML = "";
                topHost.classList.remove("is-visible");
                return;
            }
            topHost.classList.add("is-visible");
            topHost.innerHTML = fields.map((f) => {
                if (f.name === "forum_id") {
                    const opts = (window.DOCS_REFERENCE?.forumSections || [])
                        .map((s) => `<option value="${esc(s.id)}" ${String(params.forum_id || "") === String(s.id) ? "selected" : ""}>${esc(s.name)} (${esc(s.id)})</option>`)
                        .join("");
                    return `<div class="req-top-field">
                        <label>${esc(f.label)}</label>
                        <select class="form-control" data-top-param="${esc(f.name)}">
                            <option value="">—</option>${opts}
                        </select>
                    </div>`;
                }
                return `<div class="req-top-field">
                    <label>${esc(f.label)}</label>
                    <input type="text" class="form-control" data-top-param="${esc(f.name)}" value="${esc(params[f.name] || "")}" placeholder="${esc(f.name)}" spellcheck="false" autocomplete="off">
                </div>`;
            }).join("");

            topHost.querySelectorAll("[data-top-param]").forEach((el) => {
                const name = el.dataset.topParam;
                const sync = () => {
                    writeParam(name, el.value);
                    refreshRequired();
                };
                el.addEventListener("input", sync);
                el.addEventListener("change", sync);
            });
        }

        function syncTopFromParams() {
            const params = parseParams();
            topHost.querySelectorAll("[data-top-param]").forEach((el) => {
                const v = params[el.dataset.topParam] || "";
                if (el.value !== v) el.value = v;
            });
        }

        function refreshRequired() {
            const H = window.LZTReqParamHints;
            if (!H?.missingRequired) {
                requiredEl.style.display = "none";
                return;
            }
            const params = parseParams();
            let body = {};
            try {
                const b = textToBody(bodyTa.value);
                if (b && typeof b === "object") body = b;
            } catch (e) { /* ignore */ }
            const miss = H.missingRequired(methodEl.value, urlEl.value.trim(), params, body);
            if (!miss.length) {
                requiredEl.style.display = "none";
                requiredEl.innerHTML = "";
                return;
            }
            requiredEl.style.display = "block";
            requiredEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Не хватает: <b>${miss.map(esc).join(", ")}</b> — можно сохранить, но запрос может упасть.`;
        }

        pop._reqTopSync = () => { refreshTopFields(); syncTopFromParams(); };
        pop._reqRequiredRefresh = refreshRequired;

        paramsTa.addEventListener("input", () => { syncTopFromParams(); refreshRequired(); });
        bodyTa.addEventListener("input", refreshRequired);
        urlEl.addEventListener("input", () => { refreshTopFields(); refreshRequired(); });
        urlEl.addEventListener("change", () => { refreshTopFields(); refreshRequired(); });

        window.LZTEndpointPicker?.bind(pop);
        window.LZTReqParamHints?.bind(pop);
        window.LZTPathPicker?.bind(pop.querySelector("#pop-req-url"), {
            sc, nodeId: node.id, insertMode: "mustache", buttonLabel: "vars", mode: "condition",
            noQuickBar: true,
        });

        refreshTopFields();
        refreshRequired();

        sc.editingNodeId = node.id;
        pop.querySelector("#pop-ok").addEventListener("click", () => {
            const num = (id, def) => { const n = parseInt(pop.querySelector(id)?.value, 10); return isNaN(n) ? def : n; };
            node.request = {
                method: methodEl.value || "GET",
                url: urlEl.value.trim(),
                params: sc._reqTextToParams(paramsTa.value),
                body: textToBody(bodyTa.value),
                headers: textToHeaders(pop.querySelector("#pop-req-headers").value),
                title: pop.querySelector("#pop-req-title").value.trim() || "Запрос",
                retries: Math.max(0, num("#pop-req-retries", 0)),
                retryDelay: Math.max(0, num("#pop-req-delay", 1000)),
                timeout: Math.max(1, num("#pop-req-timeout", 15)),
                respectRateLimit: pop.querySelector("#pop-req-rate").checked,
            };
            sc.editingNodeId = null;
            dismiss();
            sc.render();
            sc.regenScript();
            sc.commit();
        });
    });

    R().register("filter", ({ sc, node, pop, dismiss, esc, OP_LABELS }) => {
        const f = node.filter;
        const ops = ["<=", "<", ">=", ">", "==", "!="].map(o => `<option value="${o}" ${f.op === o ? "selected" : ""}>${o} (${OP_LABELS[o]})</option>`).join("");
        pop.classList.add("pop-wide");
        pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-filter" style="color:#d68910;"></i> Фильтр списка</div>
            <div class="pop-intro">Берёт список из ответа и оставляет только те элементы, что подходят под условие. Результат сохраняется в переменную.</div>
            <label class="pop-label">Список (путь в ответе)</label>
            <div class="pop-field-row">
                <input type="text" class="form-control" id="pop-source" value="${esc(f.source)}" placeholder="last.items">
            </div>
            <label class="pop-label" style="margin-top:10px;">Оставить элементы, где</label>
            <div class="pop-filter-row">
                <input type="text" class="form-control" id="pop-field" value="${esc(f.field)}" placeholder="price">
                <select class="form-control" id="pop-op" style="max-width:120px;">${ops}</select>
                <input type="text" class="form-control" id="pop-value" value="${esc(f.value)}" placeholder="1000">
            </div>
            <label class="pop-label" style="margin-top:10px;">Сохранить результат как</label>
            <input type="text" class="form-control" id="pop-saveas" value="${esc(f.saveAs)}" placeholder="filtered">
            <div class="pop-hint">Потом используйте <code id="pop-filter-usage">{{vars.${esc(f.saveAs)}}}</code>. Выход <b>«Есть»</b> — если что-то нашлось, <b>«Пусто»</b> — если ничего.</div>
            <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
        document.body.appendChild(pop);
        window.LZTPathPicker?.bind(pop.querySelector("#pop-source"), { sc, nodeId: node.id, insertMode: "path", preferLists: true, mode: "list" });
        window.LZTPathPicker?.bind(pop.querySelector("#pop-field"), { sc, nodeId: node.id, insertMode: "path", buttonLabel: "поле", asField: true });
        const saveAsInput = pop.querySelector("#pop-saveas");
        const usage = pop.querySelector("#pop-filter-usage");
        saveAsInput.addEventListener("input", () => { usage.textContent = `{{vars.${saveAsInput.value.trim().replace(/[^\w]/g, "_") || "filtered"}}}`; });
        pop.querySelector("#pop-ok").addEventListener("click", () => {
            f.source = pop.querySelector("#pop-source").value.trim() || "last.items";
            f.field = pop.querySelector("#pop-field").value.trim();
            f.op = pop.querySelector("#pop-op").value;
            f.value = pop.querySelector("#pop-value").value.trim();
            f.saveAs = saveAsInput.value.trim().replace(/[^\w]/g, "_") || "filtered";
            dismiss();
            sc.render();
            sc.regenScript();
            sc.commit();
        });
    });
})();
