// Конструктор запросов на базе OpenAPI-каталога (/api/catalog).
// Управляет выбором эндпоинта, path-параметрами и типизированной формой параметров.
// Результат синхронизируется в глобальные currentUrl / currentMethod / currentParams (app.js).

const Constructor = {
    catalog: { apis: {} },
    allEndpoints: [],
    byId: {},
    endpoint: null,      // выбранный эндпоинт каталога (null = свободный режим)
    pathValues: {},      // {item_id: "123"}
    values: {},          // имя параметра -> значение (строка | массив | объект для deepObject)
    custom: [],          // произвольные параметры [{k, v}]
    _draftKey: "lzt_constructor_draft",

    saveDraft() {
        try {
            const state = {
                endpointId: this.endpoint ? this.endpoint.id : null,
                pathValues: this.pathValues,
                values: this.values,
                custom: this.custom,
                method: typeof currentMethod !== "undefined" ? currentMethod : "GET",
                url: typeof currentUrl !== "undefined" ? currentUrl : "",
                headers: typeof currentHeaders !== "undefined" ? currentHeaders : {},
            };
            localStorage.setItem(this._draftKey, JSON.stringify(state));
        } catch (e) { /* ignore */ }
    },

    restoreDraft() {
        try {
            const raw = localStorage.getItem(this._draftKey);
            if (!raw) return false;
            const s = JSON.parse(raw);
            if (s.headers && typeof currentHeaders !== "undefined") {
                Object.keys(currentHeaders).forEach(k => { delete currentHeaders[k]; });
                Object.assign(currentHeaders, s.headers);
            }
            if (s.method) {
                currentMethod = s.method;
                const methodEl = document.getElementById("req-method");
                if (methodEl) methodEl.value = s.method;
            }
            if (s.url) {
                currentUrl = s.url;
                const urlInput = document.getElementById("req-url");
                if (urlInput) urlInput.value = s.url;
            }
            this.pathValues = s.pathValues || {};
            this.values = s.values || {};
            this.custom = Array.isArray(s.custom) ? s.custom : [];
            if (s.endpointId && this.byId[s.endpointId]) {
                this.endpoint = this.byId[s.endpointId];
                this.renderForm();
                this.sync(false);
                return true;
            }
            if (this.custom.length || Object.keys(this.values).length) {
                this.endpoint = null;
                this.renderForm();
                this.sync(false);
                return true;
            }
        } catch (e) { /* ignore */ }
        return false;
    },

    async init() {
        try {
            const res = await fetch("/api/catalog");
            this.catalog = await res.json();
        } catch (err) {
            console.error("Не удалось загрузить каталог API:", err);
        }
        this.allEndpoints = [];
        Object.values(this.catalog.apis || {}).forEach(api => {
            (api.endpoints || []).forEach(ep => {
                ep._base = (api.base_urls && api.base_urls[0]) || "";
                ep._bases = api.base_urls || [];
                ep._apiTitle = api.title;
                this.allEndpoints.push(ep);
                this.byId[ep.id] = ep;
            });
        });
        this.bindUI();
        if (!this.restoreDraft()) {
            const urlInput = document.getElementById("req-url");
            if (urlInput && currentUrl) urlInput.value = currentUrl;
        }
    },

    bindUI() {
        const urlInput = document.getElementById("req-url");
        const toggleBtn = document.getElementById("btn-toggle-endpoint-list");
        const box = document.getElementById("endpoint-autocomplete-box");

        if (urlInput) {
            urlInput.addEventListener("input", (e) => {
                // Ручное редактирование URL = свободный режим
                this.detach();
                currentUrl = e.target.value;
                this.renderForm();
                this.sync(false);
                this.renderPicker(e.target.value.trim());
            });
            urlInput.addEventListener("focus", () => this.renderPicker(urlInput.value.trim()));
        }

        if (toggleBtn) {
            toggleBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                if (box && box.style.display === "flex") {
                    box.style.display = "none";
                } else {
                    this.renderPicker("");
                }
            });
        }

        document.addEventListener("click", (e) => {
            if (!e.target.closest("#req-url") && !e.target.closest("#btn-toggle-endpoint-list") && !e.target.closest("#endpoint-autocomplete-box")) {
                if (box) box.style.display = "none";
            }
        });

        const clearBtn = document.getElementById("btn-clear-params");
        if (clearBtn) {
            clearBtn.addEventListener("click", () => this.clearParams());
        }
    },

    // ================= ВЫБОР ЭНДПОИНТА =================

    renderPicker(query) {
        const box = document.getElementById("endpoint-autocomplete-box");
        if (!box) return;
        box.innerHTML = "";
        const q = (query || "").toLowerCase();

        const apiIcons = { market: "fa-solid fa-cart-shopping", forum: "fa-solid fa-comments" };

        Object.values(this.catalog.apis || {}).forEach(api => {
            const matches = (api.endpoints || []).filter(ep =>
                !q ||
                ep.summary.toLowerCase().includes(q) ||
                ep.path.toLowerCase().includes(q) ||
                ep.tag.toLowerCase().includes(q) ||
                (ep._base + ep.path).toLowerCase().includes(q)
            );
            if (matches.length === 0) return;

            const apiHeader = document.createElement("div");
            apiHeader.className = "autocomplete-category";
            apiHeader.innerHTML = `<i class="${apiIcons[api.id] || 'fa-solid fa-code'}"></i> ${api.title.toUpperCase()} — ${matches.length} эндпоинтов`;
            box.appendChild(apiHeader);

            // Группировка по категориям (tag)
            const byTag = {};
            matches.forEach(ep => (byTag[ep.tag] = byTag[ep.tag] || []).push(ep));

            Object.keys(byTag).forEach(tag => {
                const tagHeader = document.createElement("div");
                tagHeader.className = "picker-tag-header";
                tagHeader.innerHTML = `<i class="fa-solid fa-chevron-right picker-tag-arrow"></i> ${tag} <span class="picker-tag-count">${byTag[tag].length}</span>`;
                const groupWrap = document.createElement("div");
                groupWrap.className = "picker-tag-group";
                // При поиске группы раскрыты, без поиска — свёрнуты
                groupWrap.style.display = q ? "block" : "none";
                if (q) tagHeader.classList.add("open");

                tagHeader.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const isOpen = groupWrap.style.display === "block";
                    groupWrap.style.display = isOpen ? "none" : "block";
                    tagHeader.classList.toggle("open", !isOpen);
                });

                byTag[tag].forEach(ep => {
                    const item = document.createElement("div");
                    item.className = "autocomplete-item";
                    item.innerHTML = `
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span class="doc-method-badge ${ep.method}" style="padding: 2px 6px; font-size: 10px;">${ep.method}</span>
                                <span style="font-weight: 700; color: #fff; font-size: 13px;">${ep.summary}</span>
                            </div>
                            <span style="font-size: 10px; background: rgba(0, 186, 120, 0.2); color: var(--lzt-green); padding: 2px 6px; border-radius: 4px; font-weight: bold;">Выбрать</span>
                        </div>
                        <span style="color: var(--lzt-green); font-family: monospace; font-size: 11px;">${ep.path}</span>
                        ${ep.desc ? `<span class="autocomplete-item-desc">${ep.desc.substring(0, 110)}</span>` : ""}
                    `;
                    item.addEventListener("click", () => {
                        this.select(ep.id);
                        const b = document.getElementById("endpoint-autocomplete-box");
                        if (b) b.style.display = "none";
                    });
                    groupWrap.appendChild(item);
                });

                box.appendChild(tagHeader);
                box.appendChild(groupWrap);
            });
        });

        if (!box.children.length) {
            box.innerHTML = `<div style="padding: 12px; color: var(--text-muted); text-align: center; font-size: 13px;">Эндпоинты не найдены</div>`;
        }
        box.style.display = "flex";
    },

    select(endpointId, keepValues = false) {
        const ep = this.byId[endpointId];
        if (!ep) return;
        this.endpoint = ep;
        if (!keepValues) {
            this.pathValues = {};
            this.values = {};
            this.custom = [];
            // Обязательные параметры сразу в форме
            ep.params.filter(p => p.required && p.in !== "path").forEach(p => {
                this.values[p.name] = this.defaultValue(p);
            });
        }
        const methodEl = document.getElementById("req-method");
        if (methodEl) methodEl.value = ep.method;
        currentMethod = ep.method;
        this.renderForm();
        this.sync();
    },

    // Выход из режима каталога: текущие параметры превращаются в свободные строки
    detach() {
        if (!this.endpoint) return;
        const built = this.buildParams();
        const flat = { ...built.query, ...built.body };
        this.endpoint = null;
        this.pathValues = {};
        this.values = {};
        this.custom = Object.entries(flat).map(([k, v]) => ({
            k,
            v: Array.isArray(v) ? v.join(",") : String(v)
        }));
    },

    defaultValue(p) {
        if (p.type === "array") return [];
        if (p.type === "object") return {};
        if (p.default !== undefined) return String(p.default);
        return "";
    },

    // ================= ПОИСК ЭНДПОИНТА ПО URL (для шаблонов) =================

    findByUrl(method, url) {
        const clean = (url || "").split("?")[0].replace(/\/+$/, "");
        let best = null;
        let bestScore = -1;

        for (const ep of this.allEndpoints) {
            if (ep.method !== (method || "GET").toUpperCase()) continue;
            for (const base of ep._bases.concat([ep._base])) {
                if (!base) continue;
                let path = null;
                if (clean.startsWith(base)) {
                    path = clean.substring(base.length).replace(/\/+$/, "") || "/";
                } else if (clean === base) {
                    path = "/";
                }
                // Разные зеркала (api.zelenka.guru и т.п.) — сравним только хвост
                if (path === null) {
                    const m = clean.match(/^https?:\/\/[^\/]+(\/.*)?$/);
                    if (m) path = (m[1] || "/").replace(/\/+$/, "") || "/";
                }
                if (path === null) continue;

                const epPath = ep.path.replace(/\/+$/, "") || "/";
                const pSegs = path.split("/").filter(Boolean);
                const eSegs = epPath.split("/").filter(Boolean);
                if (pSegs.length !== eSegs.length) continue;

                let score = 0;
                let ok = true;
                const extracted = {};
                for (let i = 0; i < eSegs.length; i++) {
                    const es = eSegs[i];
                    const ph = es.match(/^\{(.+)\}$/);
                    if (ph) {
                        extracted[ph[1]] = pSegs[i];
                    } else if (es === pSegs[i]) {
                        score += 2;
                    } else {
                        ok = false;
                        break;
                    }
                }
                if (!ok) continue;
                if (eSegs.length === 0 && pSegs.length === 0) score = 1; // корень "/"
                // Совпадение хоста с базой этого API — бонус
                if (clean.startsWith(base)) score += 1;
                if (score > bestScore) {
                    bestScore = score;
                    best = { ep, extracted };
                }
            }
        }
        return best;
    },

    loadTemplate(tpl) {
        const found = this.findByUrl(tpl.method, tpl.url);
        if (found) {
            this.select(found.ep.id, true);
            this.pathValues = { ...found.extracted };
            this.values = {};
            this.custom = [];
            const defined = {};
            found.ep.params.forEach(p => defined[p.name] = p);
            Object.entries(tpl.params || {}).forEach(([k, v]) => {
                const dm = k.match(/^([^\[]+\[?\]?)\[(.+)\]$/); // deepObject: hours_played[730]
                if (defined[k]) {
                    if (defined[k].type === "array") {
                        this.values[k] = Array.isArray(v) ? v.map(String) : [String(v)];
                    } else {
                        this.values[k] = String(v);
                    }
                } else if (dm && defined[dm[1]] && defined[dm[1]].type === "object") {
                    this.values[dm[1]] = this.values[dm[1]] || {};
                    this.values[dm[1]][dm[2]] = String(v);
                } else {
                    this.custom.push({ k, v: String(v) });
                }
            });
            this.renderForm();
            this.sync();
        } else {
            // Свободный режим
            this.endpoint = null;
            this.pathValues = {};
            this.values = {};
            this.custom = Object.entries(tpl.params || {}).map(([k, v]) => ({ k, v: String(v) }));
            currentMethod = tpl.method || "GET";
            currentUrl = tpl.url || "";
            const methodEl = document.getElementById("req-method");
            const urlEl = document.getElementById("req-url");
            if (methodEl) methodEl.value = currentMethod;
            if (urlEl) urlEl.value = currentUrl;
            this.renderForm();
            this.sync();
        }
    },

    // ================= СБОРКА URL И ПАРАМЕТРОВ =================

    buildUrl() {
        if (!this.endpoint) return currentUrl;
        let path = this.endpoint.path;
        Object.entries(this.pathValues).forEach(([k, v]) => {
            if (v !== "") path = path.replace(`{${k}}`, encodeURIComponent(v));
        });
        return this.endpoint._base + path;
    },

    buildParams() {
        const query = {};
        const body = {};
        const paramLoc = {};
        if (this.endpoint) {
            this.endpoint.params.forEach(p => { paramLoc[p.name] = p.in; });
        }

        const put = (name, val) => {
            if (val === "" || val === null || val === undefined) return;
            const loc = paramLoc[name] || "query";
            const target = loc === "body" ? body : query;

            if (Array.isArray(val)) {
                if (val.length) target[name] = val;
            } else if (typeof val === "object") {
                Object.entries(val).forEach(([k, v]) => {
                    if (k !== "" && v !== "") query[`${name}[${k}]`] = v;
                });
            } else {
                target[name] = val;
            }
        };

        Object.entries(this.values).forEach(([name, val]) => put(name, val));
        this.custom.forEach(({ k, v }) => {
            if (k) query[k] = v;
        });

        return { query, body };
    },

    sync(updateUrlInput = true) {
        const built = this.buildParams();
        currentParams = built.query;
        currentBody = Object.keys(built.body).length ? built.body : null;
        if (this.endpoint) {
            currentUrl = this.buildUrl();
            currentMethod = this.endpoint.method;
        }
        if (updateUrlInput) {
            const urlInput = document.getElementById("req-url");
            if (urlInput) urlInput.value = currentUrl;
        }
        this.renderUrlPreview();
        triggerGenerate();
        this.saveDraft();
    },

    renderUrlPreview() {
        const box = document.getElementById("url-preview");
        if (!box) return;
        const q = new URLSearchParams();
        Object.entries(currentParams).forEach(([k, v]) => {
            if (Array.isArray(v)) v.forEach(x => q.append(k, x));
            else q.append(k, v);
        });
        const qStr = q.toString();
        let full = currentUrl + (qStr ? (currentUrl.includes("?") ? "&" : "?") + qStr : "");
        if (currentBody && Object.keys(currentBody).length) {
            full += `\nBody: ${JSON.stringify(currentBody)}`;
        }
        const methodColor = { GET: "#2cb674", POST: "#3594bc", PUT: "#e6a23c", DELETE: "#ff5555" }[currentMethod] || "#2cb674";
        box.innerHTML = `
            <span style="color: ${methodColor}; font-weight: 800; margin-right: 8px;">${currentMethod}</span>
            <span style="word-break: break-all;">${full.replace(/([?&])/g, '<wbr>$1')}</span>
        `;
    },

    // ================= ФОРМА ПАРАМЕТРОВ =================

    renderForm() {
        this.renderEndpointInfo();
        this.renderPathParams();
        this.renderActiveParams();
    },

    renderEndpointInfo() {
        const box = document.getElementById("endpoint-info");
        if (!box) return;
        if (!this.endpoint) {
            box.style.display = "none";
            return;
        }
        box.style.display = "flex";
        box.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <span class="doc-method-badge ${this.endpoint.method}">${this.endpoint.method}</span>
                <span style="font-weight: 700; color: #fff;">${this.endpoint.summary}</span>
                <span style="font-size: 11px; color: var(--text-muted); background: var(--bg-input); padding: 2px 8px; border-radius: 4px; border: 1px solid var(--border-color);">${this.endpoint._apiTitle} · ${this.endpoint.tag}</span>
            </div>
            ${this.endpoint.desc ? `<div style="font-size: 12px; color: var(--text-muted); line-height: 1.45; margin-top: 6px;">${this.endpoint.desc}</div>` : ""}
        `;
    },

    renderPathParams() {
        const section = document.getElementById("path-params-section");
        if (!section) return;
        const pathParams = this.endpoint ? this.endpoint.params.filter(p => p.in === "path") : [];
        if (!pathParams.length) {
            section.style.display = "none";
            section.innerHTML = "";
            return;
        }
        section.style.display = "block";
        section.innerHTML = `<label>Path-параметры (подставляются в URL)</label>`;
        const wrap = document.createElement("div");
        wrap.style.cssText = "display: flex; gap: 10px; flex-wrap: wrap;";
        pathParams.forEach(p => {
            const cell = document.createElement("div");
            cell.style.cssText = "flex: 1; min-width: 180px;";
            cell.innerHTML = `
                <div class="param-label-row">
                    <span class="param-name" style="color: #e6a23c;">{${p.name}}</span>
                    <span class="param-required">обязательный</span>
                </div>
                <input type="text" class="form-control" placeholder="${p.desc_ru || p.desc || p.name}" value="${this.pathValues[p.name] || ""}">
                ${(p.desc_ru || p.desc) ? `<div class="param-hint">${p.desc_ru || p.desc}</div>` : ""}
            `;
            cell.querySelector("input").addEventListener("input", (e) => {
                this.pathValues[p.name] = e.target.value.trim();
                this.sync();
            });
            wrap.appendChild(cell);
        });
        section.appendChild(wrap);
    },

    renderActiveParams() {
        const container = document.getElementById("params-list");
        if (!container) return;
        container.innerHTML = "";

        if (this.endpoint) {
            const nonPath = this.endpoint.params.filter(p => p.in !== "path");
            const required = nonPath.filter(p => p.required);
            const optional = nonPath.filter(p => !p.required);

            // Обязательные всегда имеют значение по умолчанию
            required.forEach(p => { if (this.values[p.name] === undefined) this.values[p.name] = this.defaultValue(p); });

            if (required.length) {
                const rHead = document.createElement("div");
                rHead.className = "params-section-label";
                rHead.innerHTML = `<i class="fa-solid fa-asterisk" style="color:#ff5555; font-size:9px;"></i> Обязательные`;
                container.appendChild(rHead);
                required.forEach(p => container.appendChild(this.buildParamCard(p)));
            }

            if (optional.length) {
                const group = document.createElement("div");
                group.className = "opt-params-group";

                const activeCount = optional.filter(p => {
                    const v = this.values[p.name];
                    return v !== undefined && v !== "" && !(Array.isArray(v) && !v.length) && !(v && typeof v === "object" && !Object.keys(v).length);
                }).length;

                const header = document.createElement("button");
                header.type = "button";
                header.className = "opt-params-toggle" + (this._optOpen ? " open" : "");
                header.innerHTML = `<i class="fa-solid fa-chevron-right opt-arrow"></i> Необязательные параметры
                    <span class="opt-count">${optional.length}</span>
                    ${activeCount ? `<span class="opt-active">${activeCount} заполнено</span>` : ""}`;
                container.appendChild(header);

                const body = document.createElement("div");
                body.className = "opt-params-body";
                body.style.display = this._optOpen ? "block" : "none";
                container.appendChild(body);

                const filter = document.createElement("input");
                filter.type = "text";
                filter.className = "form-control opt-filter";
                filter.placeholder = "Фильтр по названию или описанию…";
                filter.value = this._optFilter || "";
                filter.addEventListener("click", e => e.stopPropagation());
                filter.addEventListener("input", () => { this._optFilter = filter.value; renderOpt(); });
                body.appendChild(filter);

                const listWrap = document.createElement("div");
                body.appendChild(listWrap);

                const renderOpt = () => {
                    const q = (this._optFilter || "").trim().toLowerCase();
                    listWrap.innerHTML = "";
                    const shown = optional.filter(p => !q || p.name.toLowerCase().includes(q) || (p.desc_ru || p.desc || "").toLowerCase().includes(q));
                    if (!shown.length) {
                        listWrap.innerHTML = `<div class="params-empty">Ничего не найдено</div>`;
                        return;
                    }
                    shown.forEach(p => listWrap.appendChild(this.buildParamCard(p)));
                };
                renderOpt();

                header.addEventListener("click", () => {
                    this._optOpen = !this._optOpen;
                    body.style.display = this._optOpen ? "block" : "none";
                    header.classList.toggle("open", this._optOpen);
                    if (this._optOpen) setTimeout(() => filter.focus(), 30);
                });
            }
        }

        this.custom.forEach((row, idx) => container.appendChild(this.buildCustomRow(row, idx)));

        // Для свободного URL (без эндпоинта) оставляем возможность добавить свой параметр
        if (!this.endpoint) {
            const addCustom = document.createElement("button");
            addCustom.type = "button";
            addCustom.className = "btn-add";
            addCustom.style.cssText = "margin-top: 6px;";
            addCustom.innerHTML = `<i class="fa-solid fa-plus"></i> Добавить свой параметр`;
            addCustom.addEventListener("click", () => { this.custom.push({ k: "", v: "" }); this.renderActiveParams(); });
            container.appendChild(addCustom);
        }

        if (!container.children.length) {
            container.innerHTML = `<div class="params-empty-hint"><i class="fa-solid fa-arrow-up"></i> Выберите эндпоинт выше — и все его параметры появятся здесь автоматически.</div>`;
        }
    },

    buildParamCard(p) {
        const card = document.createElement("div");
        card.className = "param-card";

        const head = document.createElement("div");
        head.className = "param-label-row";
        const typeBadge = { array: "массив", object: "объект", integer: "число", number: "число", boolean: "флаг", string: "строка" }[p.type] || p.type;
        const locBadge = p.in === "body"
            ? `<span class="param-type-badge" style="background: rgba(53,148,188,0.2); color: #3594bc;">body</span>`
            : "";
        head.innerHTML = `
            <span class="param-name">${p.name}</span>
            <span class="param-type-badge">${typeBadge}</span>
            ${locBadge}
            ${p.required ? `<span class="param-required">обязательный</span>` : ""}
            <span style="flex: 1;"></span>
        `;
        if (!p.required) {
            const del = document.createElement("button");
            del.className = "btn-remove";
            del.innerHTML = "×";
            del.title = "Очистить значение";
            del.addEventListener("click", () => {
                delete this.values[p.name];
                this.renderActiveParams();
                this.sync();
            });
            head.appendChild(del);
        }
        card.appendChild(head);

        card.appendChild(this.buildControl(p));

        const desc = p.desc_ru || p.desc;
        if (desc) {
            const hint = document.createElement("div");
            hint.className = "param-hint";
            hint.textContent = desc;
            card.appendChild(hint);
        }
        return card;
    },

    buildControl(p) {
        const isToggle = p.enum && p.enum.length <= 2 && p.enum.every(v => String(v) === "0" || String(v) === "1");

        // Тумблер для флагов 0/1
        if (isToggle && p.type !== "array") {
            const wrap = document.createElement("label");
            wrap.className = "lzt-toggle";
            const checked = String(this.values[p.name]) === "1";
            wrap.innerHTML = `
                <input type="checkbox" ${checked ? "checked" : ""}>
                <span class="lzt-toggle-slider"></span>
                <span class="lzt-toggle-text">${checked ? "Да (1)" : "Нет (0)"}</span>
            `;
            const cb = wrap.querySelector("input");
            cb.addEventListener("change", () => {
                this.values[p.name] = cb.checked ? "1" : "0";
                wrap.querySelector(".lzt-toggle-text").textContent = cb.checked ? "Да (1)" : "Нет (0)";
                this.sync();
            });
            return wrap;
        }

        // Enum-массив -> мультивыбор чипсами
        if (p.type === "array" && p.enum) {
            const wrap = document.createElement("div");
            wrap.className = "chips-wrap";
            const selected = new Set((this.values[p.name] || []).map(String));
            p.enum.forEach(opt => {
                const chip = document.createElement("span");
                const optStr = String(opt);
                const label = (p.enum_desc && p.enum_desc[optStr]) ? `${optStr} — ${p.enum_desc[optStr]}` : optStr;
                chip.className = "chip" + (selected.has(optStr) ? " chip-active" : "");
                chip.textContent = label;
                chip.addEventListener("click", () => {
                    if (selected.has(optStr)) selected.delete(optStr);
                    else selected.add(optStr);
                    this.values[p.name] = Array.from(selected);
                    chip.classList.toggle("chip-active");
                    this.sync();
                });
                wrap.appendChild(chip);
            });
            return wrap;
        }

        // Массив без enum -> значения через запятую
        if (p.type === "array") {
            const input = document.createElement("input");
            input.type = "text";
            input.className = "form-control";
            input.placeholder = "Значения через запятую (напр. 730, 570)";
            input.value = (this.values[p.name] || []).join(", ");
            input.addEventListener("input", () => {
                this.values[p.name] = input.value.split(",").map(s => s.trim()).filter(Boolean);
                this.sync();
            });
            return input;
        }

        // deepObject -> подстроки ключ/значение
        if (p.type === "object") {
            const wrap = document.createElement("div");
            wrap.className = "deep-object-wrap";
            wrap.style.cssText = "display: flex; flex-direction: column; gap: 6px;";

            const readRows = () => {
                const next = {};
                wrap.querySelectorAll(".deep-row").forEach(row => {
                    const ins = row.querySelectorAll("input");
                    const key = ins[0].value.trim();
                    const val = ins[1].value.trim();
                    if (key) next[key] = val;
                });
                this.values[p.name] = next;
                this.sync();
            };

            const renderRows = () => {
                wrap.querySelectorAll(".deep-row, .deep-add-btn").forEach(el => el.remove());
                const obj = this.values[p.name] || {};
                const entries = Object.entries(obj);
                if (!entries.length) entries.push(["", ""]);

                entries.forEach(([k, v]) => {
                    const row = document.createElement("div");
                    row.className = "deep-row";
                    row.style.cssText = "display: flex; gap: 6px; align-items: center;";
                    row.innerHTML = `
                        <input type="text" class="form-control" placeholder="Ключ (напр. 730 = CS2)" value="${k}" style="flex: 1;">
                        <input type="text" class="form-control" placeholder="Значение" value="${v}" style="flex: 1;">
                        <button type="button" class="btn-remove" title="Убрать строку">×</button>
                    `;
                    row.querySelectorAll("input").forEach(inp => inp.addEventListener("input", readRows));
                    row.querySelector(".btn-remove").addEventListener("click", () => {
                        const key = row.querySelectorAll("input")[0].value.trim();
                        const cur = { ...(this.values[p.name] || {}) };
                        delete cur[key];
                        this.values[p.name] = cur;
                        renderRows();
                        this.sync();
                    });
                    wrap.appendChild(row);
                });

                const addRow = document.createElement("button");
                addRow.type = "button";
                addRow.className = "btn-add deep-add-btn";
                addRow.style.cssText = "padding: 4px; font-size: 11px;";
                addRow.textContent = "+ Добавить пару ключ/значение";
                addRow.addEventListener("click", () => {
                    this.values[p.name] = { ...(this.values[p.name] || {}), "": "" };
                    renderRows();
                });
                wrap.appendChild(addRow);
            };

            renderRows();
            return wrap;
        }

        // Enum -> выпадающий список
        if (p.enum) {
            const select = document.createElement("select");
            select.className = "form-control";
            select.style.cursor = "pointer";
            const empty = document.createElement("option");
            empty.value = "";
            empty.textContent = "— не задано —";
            select.appendChild(empty);
            p.enum.forEach(opt => {
                const o = document.createElement("option");
                const optStr = String(opt);
                o.value = optStr;
                o.textContent = (p.enum_desc && p.enum_desc[optStr]) ? `${optStr} — ${p.enum_desc[optStr]}` : optStr;
                if (String(this.values[p.name]) === optStr) o.selected = true;
                select.appendChild(o);
            });
            select.addEventListener("change", () => {
                this.values[p.name] = select.value;
                this.sync();
            });
            return select;
        }

        // Число
        if (p.type === "integer" || p.type === "number") {
            const input = document.createElement("input");
            input.type = "number";
            input.className = "form-control";
            if (p.min !== undefined) input.min = p.min;
            if (p.max !== undefined) input.max = p.max;
            input.placeholder = p.desc_ru || p.desc || "Число";
            input.value = this.values[p.name] || "";
            input.addEventListener("input", () => {
                this.values[p.name] = input.value.trim();
                this.sync();
            });
            return input;
        }

        // Строка (по умолчанию)
        const input = document.createElement("input");
        input.type = "text";
        input.className = "form-control";
        input.placeholder = p.desc_ru || p.desc || "Значение";
        input.value = this.values[p.name] || "";
        input.addEventListener("input", () => {
            this.values[p.name] = input.value;
            this.sync();
        });
        return input;
    },

    buildCustomRow(row, idx) {
        const div = document.createElement("div");
        div.className = "param-card";
        div.innerHTML = `
            <div class="param-label-row">
                <span class="param-name" style="color: #3594bc;">Свой параметр</span>
                <span style="flex: 1;"></span>
                <button class="btn-remove" title="Убрать">×</button>
            </div>
            <div style="display: flex; gap: 6px;">
                <input type="text" class="form-control custom-key" placeholder="Имя параметра" value="${row.k}" style="flex: 1;">
                <input type="text" class="form-control custom-val" placeholder="Значение" value="${row.v}" style="flex: 1;">
            </div>
        `;
        div.querySelector(".custom-key").addEventListener("input", (e) => {
            row.k = e.target.value.trim();
            this.sync();
        });
        div.querySelector(".custom-val").addEventListener("input", (e) => {
            row.v = e.target.value;
            this.sync();
        });
        div.querySelector(".btn-remove").addEventListener("click", () => {
            this.custom.splice(idx, 1);
            this.renderActiveParams();
            this.sync();
        });
        return div;
    },

    // ================= КАТАЛОГ ПАРАМЕТРОВ (кнопка "+ Добавить") =================

    renderParamCatalog(query) {
        const panel = document.getElementById("param-catalog-panel");
        if (!panel) return;
        panel.innerHTML = "";
        panel.style.display = "flex";

        const search = document.createElement("input");
        search.type = "text";
        search.className = "form-control";
        search.placeholder = "Поиск параметра...";
        search.value = query || "";
        search.style.cssText = "margin: 8px; width: calc(100% - 16px); flex-shrink: 0;";
        search.addEventListener("click", e => e.stopPropagation());
        search.addEventListener("input", () => renderList(search.value.trim().toLowerCase()));
        panel.appendChild(search);

        const list = document.createElement("div");
        list.style.cssText = "overflow-y: auto; flex: 1; display: flex; flex-direction: column;";
        panel.appendChild(list);

        const renderList = (q) => {
            list.innerHTML = "";

            // Пункт "свой параметр"
            const customItem = document.createElement("div");
            customItem.className = "autocomplete-item";
            customItem.innerHTML = `<span class="autocomplete-item-key" style="color: #3594bc;"><i class="fa-solid fa-pen"></i> Ввести свой параметр вручную</span>`;
            customItem.addEventListener("click", () => {
                this.custom.push({ k: "", v: "" });
                panel.style.display = "none";
                this.renderActiveParams();
            });
            list.appendChild(customItem);

            if (!this.endpoint) return;

            const available = this.endpoint.params.filter(p =>
                p.in !== "path" &&
                this.values[p.name] === undefined &&
                (!q || p.name.toLowerCase().includes(q) || (p.desc_ru || p.desc || "").toLowerCase().includes(q))
            );

            if (!available.length) {
                const noRes = document.createElement("div");
                noRes.style.cssText = "padding: 12px; color: var(--text-muted); text-align: center; font-size: 13px;";
                noRes.textContent = "Все подходящие параметры уже добавлены";
                list.appendChild(noRes);
                return;
            }

            available.forEach(p => {
                const item = document.createElement("div");
                item.className = "autocomplete-item";
                const typeBadge = { array: "массив", object: "объект", integer: "число", number: "число", string: "строка" }[p.type] || p.type;
                item.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span class="autocomplete-item-key">${p.name}</span>
                        <span style="display: flex; gap: 4px;">
                            ${p.enum ? `<span class="param-type-badge" style="background: rgba(53,148,188,0.2); color: #3594bc;">выбор</span>` : ""}
                            <span class="param-type-badge">${typeBadge}</span>
                        </span>
                    </div>
                    <span class="autocomplete-item-desc">${p.desc_ru || p.desc || ""}</span>
                `;
                item.addEventListener("click", () => {
                    this.addParam(p.name);
                    panel.style.display = "none";
                });
                list.appendChild(item);
            });
        };

        renderList((query || "").toLowerCase());
        setTimeout(() => {
            search.focus();
            panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }, 30);
    },

    addParam(name) {
        if (this.endpoint) {
            const p = this.endpoint.params.find(x => x.name === name);
            if (p) {
                if (this.values[name] === undefined) this.values[name] = this.defaultValue(p);
                this.renderActiveParams();
                this.sync();
                return;
            }
        }
        this.custom.push({ k: name, v: "" });
        this.renderActiveParams();
        this.sync();
    },

    clearParams() {
        this.custom = [];
        if (this.endpoint) {
            this.values = {};
            this.endpoint.params.filter(p => p.required && p.in !== "path").forEach(p => {
                this.values[p.name] = this.defaultValue(p);
            });
        } else {
            this.values = {};
        }
        this.renderForm();
        this.sync();
    },

    newRequest() {
        this.endpoint = null;
        this.pathValues = {};
        this.values = {};
        this.custom = [];
        currentMethod = "GET";
        currentUrl = "https://prod-api.lzt.market/";
        const methodEl = document.getElementById("req-method");
        const urlEl = document.getElementById("req-url");
        if (methodEl) methodEl.value = "GET";
        if (urlEl) urlEl.value = currentUrl;
        this.renderForm();
        this.sync();
    }
};

window.Constructor = Constructor;
