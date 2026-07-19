/** Выбор эндпоинта API внутри поповера блока «Запрос». */
(function () {
    "use strict";

    function esc(s) {
        return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function allEndpoints() {
        const C = (typeof Constructor !== "undefined" ? Constructor : window.Constructor);
        if (C?.allEndpoints?.length) return C.allEndpoints;
        const out = [];
        Object.values(C?.catalog?.apis || {}).forEach((api) => {
            (api.endpoints || []).forEach((ep) => out.push(ep));
        });
        return out;
    }

    function epUrl(ep) {
        let path = ep.path || "";
        (ep.params || []).filter((p) => p.in === "path").forEach((p) => {
            path = path.replace(`{${p.name}}`, `{{vars.${p.name}}}`);
        });
        return (ep._base || "https://prod-api.lzt.market") + path;
    }

    function findEp(method, url) {
        return window.Constructor?.findByUrl?.(method, url) || null;
    }

    function suggestDefault(p) {
        const H = window.LZTReqParamHints;
        if (H?.suggestValue) return H.suggestValue(p);
        if (p.example != null && p.example !== "") return String(p.example);
        if (p.default != null && p.default !== "") return String(p.default);
        if (Array.isArray(p.enum) && p.enum.length) return String(p.enum[0]);
        return "";
    }

    function isBodyParam(p, method) {
        if (window.LZTReqParamHints?.isBodyParam) return window.LZTReqParamHints.isBodyParam(p, method);
        return p.in === "body" || p.in === "formData";
    }

    function parseParamsText(text) {
        const params = {};
        String(text || "").split("\n").forEach((line) => {
            line = line.trim();
            if (!line || line.startsWith("#")) return;
            const i = line.indexOf("=");
            if (i > 0) params[line.slice(0, i).trim()] = line.slice(i + 1).trim();
        });
        return params;
    }

    function paramsToText(params) {
        return Object.entries(params || {}).map(([k, v]) => `${k}=${v}`).join("\n");
    }

    function allowedParamNames(ep, method) {
        const names = new Set();
        (ep?.params || []).forEach((p) => {
            if (!p.name || p.in === "path") return;
            names.add(p.name);
        });
        return names;
    }

    function applyEndpointDefaults(pop, method, url, opts) {
        opts = opts || {};
        const found = findEp(method, url);
        const ep = found?.ep;
        const titleEl = pop.querySelector("#pop-req-title");
        const paramsTa = pop.querySelector("#pop-req-params");
        const bodyTa = pop.querySelector("#pop-req-body");

        if (titleEl && (!titleEl.value.trim() || titleEl.value.trim() === "Запрос" || opts.forceTitle)) {
            if (ep?.summary) titleEl.value = ep.summary;
        }

        if (!ep) {
            if (typeof opts.onApplied === "function") opts.onApplied({ method, url, ep: null });
            return { method, url, ep: null };
        }

        const cur = parseParamsText(paramsTa?.value);
        let bodyObj = {};
        if (bodyTa) {
            try {
                const raw = String(bodyTa.value || "").trim();
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) bodyObj = parsed;
                }
            } catch (e) { /* keep */ }
        }

        const allowed = allowedParamNames(ep, method);
        const stale = Object.keys(cur).filter((k) => allowed.size && !allowed.has(k));

        (ep.params || []).forEach((p) => {
            if (!p.name || p.in === "path") return;
            const val = suggestDefault(p);
            if (val === "" && !p.required) return;
            if (isBodyParam(p, method)) {
                if (bodyObj[p.name] == null || bodyObj[p.name] === "") {
                    if (p.required || val !== "") bodyObj[p.name] = val === "" ? "" : (isNaN(val) ? val : Number(val));
                }
            } else if (cur[p.name] == null || cur[p.name] === "") {
                if (p.required || val !== "") cur[p.name] = val;
            }
        });

        if (paramsTa) {
            paramsTa.value = paramsToText(cur) + (Object.keys(cur).length ? "\n" : "");
            paramsTa.dispatchEvent(new Event("input", { bubbles: true }));
        }
        if (bodyTa && Object.keys(bodyObj).length) {
            bodyTa.value = JSON.stringify(bodyObj, null, 2);
            bodyTa.dispatchEvent(new Event("input", { bubbles: true }));
        }

        if (typeof opts.onApplied === "function") {
            opts.onApplied({ method, url, ep, stale, allowed: [...allowed] });
        }
        return { method, url, ep, stale, allowed: [...allowed] };
    }

    function pathParamsFromUrl(url, ep) {
        const slots = [];
        const pathParams = (ep?.params || []).filter((p) => p.in === "path");
        if (pathParams.length) {
            pathParams.forEach((p) => {
                const re = new RegExp("\\{\\{\\s*vars\\." + p.name + "\\s*\\}\\}|\\{" + p.name + "\\}");
                const m = String(url || "").match(re);
                slots.push({
                    name: p.name,
                    required: !!p.required,
                    desc: p.desc_ru || p.desc || "",
                    value: m ? (m[0].startsWith("{{") ? "" : m[0]) : "",
                    placeholder: `{{vars.${p.name}}}`,
                });
            });
            return slots;
        }
        // fallback: detect {{vars.x}} in URL
        const re = /\{\{\s*vars\.([a-zA-Z0-9_]+)\s*\}\}/g;
        let mm;
        const seen = new Set();
        while ((mm = re.exec(String(url || ""))) !== null) {
            if (seen.has(mm[1])) continue;
            seen.add(mm[1]);
            slots.push({ name: mm[1], required: true, desc: "", value: "", placeholder: `{{vars.${mm[1]}}}` });
        }
        return slots;
    }

    function applyPathSlot(url, name, value) {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp("\\{\\{\\s*vars\\." + escaped + "\\s*\\}\\}|\\{" + escaped + "\\}", "g");
        const next = value.trim() || `{{vars.${name}}}`;
        if (re.test(url)) return url.replace(re, next);
        return url;
    }

    function quickChips() {
        const chips = [];
        const seen = new Set();
        const add = (label, method, url) => {
            const key = method + " " + url;
            if (seen.has(key)) return;
            seen.add(key);
            chips.push({ label, method, url });
        };
        add("Баланс /me", "GET", "https://prod-api.lzt.market/me");
        add("Темы форума", "GET", "https://api.lolz.live/threads");
        add("Посты", "GET", "https://api.lolz.live/posts");
        (window.DOCS_REFERENCE?.marketPaths || []).slice(0, 14).forEach((p) => {
            add(p.name || p.path, "GET", `https://prod-api.lzt.market/${p.path}`);
        });
        add("Fast-buy", "POST", "https://prod-api.lzt.market/{{vars.item_id}}/fast-buy");
        return chips;
    }

    /**
     * @param {HTMLElement} pop
     * @param {{ onSelect?: function }} opts
     */
    function bind(pop, opts) {
        opts = opts || {};
        const methodEl = pop.querySelector("#pop-req-method");
        const urlEl = pop.querySelector("#pop-req-url");
        if (!methodEl || !urlEl) return null;

        let host = pop.querySelector("#pop-req-endpoint-host");
        if (!host) {
            host = document.createElement("div");
            host.id = "pop-req-endpoint-host";
            host.className = "req-endpoint-host";
            const urlRow = urlEl.closest(".pop-filter-row") || urlEl.parentElement;
            urlRow.parentNode.insertBefore(host, urlRow.nextSibling);
        }

        let pathHost = pop.querySelector("#pop-req-path-params");
        if (!pathHost) {
            pathHost = document.createElement("div");
            pathHost.id = "pop-req-path-params";
            pathHost.className = "req-path-params";
            host.parentNode.insertBefore(pathHost, host.nextSibling);
        }

        let staleBanner = pop.querySelector("#pop-req-stale");
        if (!staleBanner) {
            staleBanner = document.createElement("div");
            staleBanner.id = "pop-req-stale";
            staleBanner.className = "req-stale-banner";
            staleBanner.style.display = "none";
            pathHost.parentNode.insertBefore(staleBanner, pathHost.nextSibling);
        }

        host.innerHTML = `
            <div class="req-ep-quick" id="pop-req-ep-quick"></div>
            <div class="req-ep-search-row">
                <button type="button" class="btn-pick-field" id="pop-req-ep-btn"><i class="fa-solid fa-book"></i> Каталог API</button>
                <input type="text" class="form-control" id="pop-req-ep-q" placeholder="Поиск: threads, steam, fast-buy…" style="display:none;">
            </div>
            <div class="pop-field-list req-ep-list" id="pop-req-ep-list" style="display:none;"></div>
        `;

        const quick = host.querySelector("#pop-req-ep-quick");
        quickChips().forEach((c) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "req-ep-chip";
            b.textContent = c.label;
            b.title = `${c.method} ${c.url}`;
            b.addEventListener("click", () => apply(c.method, c.url, { forceTitle: true }));
            quick.appendChild(b);
        });

        const btn = host.querySelector("#pop-req-ep-btn");
        const qInput = host.querySelector("#pop-req-ep-q");
        const list = host.querySelector("#pop-req-ep-list");

        function renderPathSlots(method, url) {
            const found = findEp(method, url);
            const slots = pathParamsFromUrl(url, found?.ep);
            if (!slots.length) {
                pathHost.innerHTML = "";
                pathHost.classList.remove("is-visible");
                return;
            }
            pathHost.classList.add("is-visible");
            pathHost.innerHTML = `<div class="req-path-head">Параметры в URL</div>` +
                slots.map((s) => `
                    <div class="req-path-row">
                        <label class="req-path-label">${esc(s.name)}${s.required ? " *" : ""}</label>
                        <input type="text" class="form-control req-path-input" data-path-name="${esc(s.name)}"
                            value="${esc(s.value)}" placeholder="${esc(s.placeholder)}" spellcheck="false" autocomplete="off"
                            title="${esc(s.desc || s.name)}">
                    </div>`).join("");
            pathHost.querySelectorAll(".req-path-input").forEach((inp) => {
                const sync = () => {
                    urlEl.value = applyPathSlot(urlEl.value, inp.dataset.pathName, inp.value);
                    urlEl.dispatchEvent(new Event("input", { bubbles: true }));
                };
                inp.addEventListener("input", sync);
                inp.addEventListener("change", sync);
            });
        }

        function showStale(stale) {
            if (!stale || !stale.length) {
                staleBanner.style.display = "none";
                staleBanner.innerHTML = "";
                return;
            }
            staleBanner.style.display = "block";
            staleBanner.innerHTML = `
                <span>В параметрах остались поля не из этого эндпоинта: <code>${esc(stale.join(", "))}</code></span>
                <button type="button" class="btn-link-sm" id="pop-req-stale-clear">Убрать</button>
            `;
            staleBanner.querySelector("#pop-req-stale-clear")?.addEventListener("click", () => {
                const ta = pop.querySelector("#pop-req-params");
                if (!ta) return;
                const cur = parseParamsText(ta.value);
                stale.forEach((k) => delete cur[k]);
                ta.value = paramsToText(cur) + (Object.keys(cur).length ? "\n" : "");
                ta.dispatchEvent(new Event("input", { bubbles: true }));
                showStale([]);
                pop._reqTopSync?.();
                pop._reqHintsRefresh?.();
                pop._reqRequiredRefresh?.();
            });
        }

        function apply(method, url, applyOpts) {
            applyOpts = applyOpts || {};
            methodEl.value = method || "GET";
            urlEl.value = url || "";
            methodEl.dispatchEvent(new Event("change", { bubbles: true }));
            urlEl.dispatchEvent(new Event("input", { bubbles: true }));
            urlEl.dispatchEvent(new Event("change", { bubbles: true }));
            list.style.display = "none";
            qInput.style.display = "none";

            const result = applyEndpointDefaults(pop, methodEl.value, urlEl.value, {
                forceTitle: applyOpts.forceTitle !== false,
                onApplied: (info) => showStale(info.stale || []),
            });
            renderPathSlots(methodEl.value, urlEl.value);
            pop._reqTopSync?.();
            pop._reqHintsRefresh?.();
            pop._reqRequiredRefresh?.();

            if (typeof opts.onSelect === "function") opts.onSelect({ method, url, ...result });
        }

        function render(query) {
            const q = (query || "").toLowerCase().trim();
            const eps = allEndpoints();
            list.innerHTML = "";
            if (!eps.length) {
                list.innerHTML = `<div class="pop-field-empty">Каталог ещё не загружен. Откройте вкладку конструктора или нажмите «Обновить базу API» в блоке Старт.</div>`;
                list.style.display = "block";
                return;
            }
            const matches = eps.filter((ep) =>
                !q ||
                (ep.summary || "").toLowerCase().includes(q) ||
                (ep.path || "").toLowerCase().includes(q) ||
                (ep.tag || "").toLowerCase().includes(q) ||
                ((ep._base || "") + (ep.path || "")).toLowerCase().includes(q)
            ).slice(0, 60);

            if (!matches.length) {
                list.innerHTML = `<div class="pop-field-empty">Эндпоинты не найдены</div>`;
                list.style.display = "block";
                return;
            }

            matches.forEach((ep) => {
                const it = document.createElement("div");
                it.className = "pop-field-item req-ep-item";
                it.innerHTML = `
                    <div class="req-ep-item-main">
                        <span class="doc-method-badge ${esc(ep.method)}" style="padding:2px 6px;font-size:10px;">${esc(ep.method)}</span>
                        <span class="req-ep-sum">${esc(ep.summary || ep.path)}</span>
                    </div>
                    <code class="req-ep-path">${esc(ep.path)}</code>
                `;
                it.addEventListener("click", () => apply(ep.method, epUrl(ep), { forceTitle: true }));
                list.appendChild(it);
            });
            list.style.display = "block";
        }

        btn.addEventListener("click", () => {
            const open = list.style.display === "block";
            if (open) {
                list.style.display = "none";
                qInput.style.display = "none";
                return;
            }
            qInput.style.display = "block";
            qInput.value = "";
            render("");
            setTimeout(() => qInput.focus(), 30);
        });
        qInput.addEventListener("input", () => render(qInput.value));

        urlEl.addEventListener("change", () => renderPathSlots(methodEl.value, urlEl.value));
        urlEl.addEventListener("blur", () => renderPathSlots(methodEl.value, urlEl.value));
        methodEl.addEventListener("change", () => renderPathSlots(methodEl.value, urlEl.value));
        renderPathSlots(methodEl.value, urlEl.value);

        const params = pop.querySelector("#pop-req-params");
        if (params && window.LZTPathPicker) {
            window.LZTPathPicker.bindChips(params, { sc: window.Scenario, mode: "condition", forField: "params" });
        }

        return { apply, host, renderPathSlots, applyEndpointDefaults, showStale };
    }

    window.LZTEndpointPicker = {
        bind, quickChips, allEndpoints, applyEndpointDefaults,
        pathParamsFromUrl, applyPathSlot, epUrl,
    };
})();
