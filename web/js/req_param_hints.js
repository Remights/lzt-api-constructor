// Подсказки параметров для блока «Запрос» (Market + Forum API, OpenAPI-каталог + PARAM_DATA).
(function () {
    "use strict";

    const MARKET_PRIORITY = ["pmax", "pmin", "order_by", "page", "limit", "title", "daybreak", "game[]", "currency"];
    const FORUM_PRIORITY = ["forum_id", "thread_id", "post_id", "user_id", "creator_user_id", "limit", "page", "order", "post_body", "thread_title", "comment"];
    const FORUM_SHARED = ["limit", "page"];
    const MARKET_PATH_CATS = {
        steam: "steam", discord: "discord", telegram: "telegram", fortnite: "fortnite",
        valorant: "riot", riot: "riot", genshin: "genshin", roblox: "roblox", gta5: "gta5",
    };
    const CHIP_LIMIT = 32;

    function esc(s) {
        return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function detectApiKind(url) {
        const u = String(url || "").toLowerCase();
        if (/lolz\.live|zelenka\.guru|api\.zelenka/.test(u)) return "forum";
        if (/lzt\.market|prod-api\.lzt/.test(u)) return "market";
        if (/\/(threads|posts|forums|users)(\/|$|\?)/.test(u)) return "forum";
        return null;
    }

    function pathCategory(url) {
        try {
            const raw = String(url || "").trim();
            const path = (raw.startsWith("http") ? new URL(raw) : new URL("https://" + raw.replace(/^\/+/, ""))).pathname.toLowerCase();
            const seg = path.split("/").filter(Boolean)[0];
            return MARKET_PATH_CATS[seg] || null;
        } catch (e) {
            return null;
        }
    }

    function findEndpoint(method, url) {
        return window.Constructor?.findByUrl?.(method, url) || null;
    }

    function paramMeta(name) {
        return (window.PARAM_DATA && window.PARAM_DATA[name]) || null;
    }

    function suggestValue(p) {
        if (p.example != null && p.example !== "") return String(p.example);
        if (p.default != null && p.default !== "") return String(p.default);
        if (Array.isArray(p.enum) && p.enum.length) return String(p.enum[0]);
        const presets = {
            pmax: "100", pmin: "1", order_by: "price_to_up", page: "1", limit: "20",
            forum_id: "84", daybreak: "7", "game[]": "730", currency: "rub",
            direction: "desc", order: "thread_create_date",
        };
        if (presets[p.name] != null) return presets[p.name];
        if (p.type === "boolean") return "1";
        if (p.type === "integer" || p.type === "number") return "1";
        return "";
    }

    function sortParams(list, kind) {
        const prio = kind === "forum" ? FORUM_PRIORITY : MARKET_PRIORITY;
        const score = (p) => {
            let s = 0;
            if (p.required) s -= 1000;
            const pi = prio.indexOf(p.name);
            if (pi >= 0) s -= 500 - pi;
            if (p.source === "endpoint") s -= 100;
            return s;
        };
        return list.sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name, "ru"));
    }

    function resolveParams(method, url, existingKeys) {
        const kind = detectApiKind(url);
        const items = new Map();
        const found = findEndpoint(method, url);

        const add = (name, info) => {
            if (!name || existingKeys.has(name)) return;
            if (items.has(name)) {
                const cur = items.get(name);
                if (info.required) cur.required = true;
                if (info.desc && !cur.desc) cur.desc = info.desc;
                if (info.example != null && cur.example == null) cur.example = info.example;
                return;
            }
            items.set(name, {
                name,
                desc: info.desc || "",
                required: !!info.required,
                example: info.example != null ? String(info.example) : "",
                source: info.source || "common",
                type: info.type || "string",
            });
        };

        if (found?.ep?.params?.length) {
            found.ep.params.forEach(p => {
                if (!p.name || p.in === "path") return;
                const meta = paramMeta(p.name);
                add(p.name, {
                    desc: p.desc_ru || p.desc || meta?.desc || "",
                    required: p.required,
                    example: suggestValue(p),
                    source: "endpoint",
                    type: p.type,
                });
            });
        } else {
            const cats = [];
            if (kind === "market") {
                cats.push("market_general");
                const pc = pathCategory(url);
                if (pc) cats.push(pc);
            } else if (kind === "forum") {
                cats.push("forum");
            }
            Object.entries(window.PARAM_DATA || {}).forEach(([name, meta]) => {
                if (cats.includes(meta.cat)) {
                    add(name, { desc: meta.desc, source: "common", example: suggestValue({ name }) });
                }
            });
            if (kind === "forum") {
                FORUM_SHARED.forEach(name => {
                    const meta = paramMeta(name);
                    if (meta) add(name, { desc: meta.desc, source: "common", example: suggestValue({ name }) });
                });
            }
        }

        return { params: sortParams([...items.values()], kind), found, kind };
    }

    function parseExistingKeys(text) {
        const keys = new Set();
        String(text || "").split("\n").forEach(line => {
            line = line.trim();
            if (!line || line.startsWith("#")) return;
            const i = line.indexOf("=");
            if (i > 0) keys.add(line.slice(0, i).trim());
        });
        return keys;
    }

    function currentLineFilter(textarea) {
        if (!textarea) return "";
        const pos = textarea.selectionStart;
        const before = textarea.value.slice(0, pos);
        const line = (before.split("\n").pop() || "").trim();
        const eq = line.indexOf("=");
        if (eq >= 0) return "";
        return line.toLowerCase();
    }

    function insertParam(textarea, name, value) {
        const val = value != null && value !== "" ? value : "";
        const pos = textarea.selectionStart;
        const text = textarea.value;
        const before = text.slice(0, pos);
        const after = text.slice(pos);
        const lineStart = before.lastIndexOf("\n") + 1;
        const lineEnd = pos + after.indexOf("\n");
        const line = text.slice(lineStart, lineEnd >= pos ? lineEnd : text.length);
        const eq = line.indexOf("=");
        const newLine = val !== "" ? `${name}=${val}` : `${name}=`;

        let next;
        if (eq < 0 && line.trim() && !line.includes("=")) {
            next = text.slice(0, lineStart) + newLine + text.slice(lineStart + line.length);
        } else if (line.trim() === "") {
            const prefix = lineStart > 0 && text[lineStart - 1] !== "\n" ? "\n" : "";
            next = text.slice(0, pos) + prefix + newLine + (after.startsWith("\n") || !after ? "" : "\n") + after;
        } else {
            const join = text.length && !text.endsWith("\n") ? "\n" : "";
            next = text + join + newLine;
        }

        textarea.value = next;
        textarea.focus();
        const idx = next.indexOf(newLine) + newLine.length;
        textarea.setSelectionRange(idx, idx);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function bind(pop) {
        const ta = pop.querySelector("#pop-req-params");
        const methodEl = pop.querySelector("#pop-req-method");
        const urlEl = pop.querySelector("#pop-req-url");
        if (!ta || !urlEl) return;

        let hintsEl = pop.querySelector("#pop-req-param-hints");
        if (!hintsEl) {
            hintsEl = document.createElement("div");
            hintsEl.id = "pop-req-param-hints";
            hintsEl.className = "req-param-hints";
            hintsEl.innerHTML = `<div class="req-param-hints-head">
                <span class="req-param-hints-title"></span>
                <span class="req-param-hints-meta"></span>
            </div>
            <input type="text" class="form-control req-param-hints-search" placeholder="Поиск параметра…" autocomplete="off" spellcheck="false">
            <div class="req-param-hints-chips"></div>`;
            const urlRow = urlEl.closest(".pop-filter-row");
            if (urlRow) urlRow.insertAdjacentElement("afterend", hintsEl);
            else ta.insertAdjacentElement("beforebegin", hintsEl);
        }

        const titleEl = hintsEl.querySelector(".req-param-hints-title");
        const metaEl = hintsEl.querySelector(".req-param-hints-meta");
        const searchEl = hintsEl.querySelector(".req-param-hints-search");
        const chipsEl = hintsEl.querySelector(".req-param-hints-chips");
        let debounceTimer = null;
        let panelSearch = "";

        const render = () => {
            const method = methodEl?.value || "GET";
            const url = urlEl.value.trim();
            const existing = parseExistingKeys(ta.value);
            const lineFilter = document.activeElement === ta ? currentLineFilter(ta) : "";
            const q = (panelSearch || lineFilter || "").toLowerCase().trim();

            const { params: allParams, found, kind } = resolveParams(method, url, existing);
            let params = allParams;
            if (q) {
                params = params.filter(p =>
                    p.name.toLowerCase().includes(q) ||
                    (p.desc || "").toLowerCase().includes(q)
                );
            }

            if (found?.ep) {
                const tag = found.ep._apiTitle || (kind === "forum" ? "Forum API" : "Market API");
                const path = found.ep.path || "";
                titleEl.textContent = `${tag} · ${method} ${path} — ${found.ep.summary || path}`;
            } else if (kind === "forum") {
                titleEl.textContent = "Forum API — эндпоинт не распознан, общие параметры";
            } else if (kind === "market") {
                const seg = pathCategory(url);
                titleEl.textContent = seg
                    ? `Market API /${seg} — общие параметры категории`
                    : "Market API — эндпоинт не распознан, общие параметры";
            } else {
                titleEl.textContent = "Укажите URL Market или Forum";
            }

            const show = url.length > 0;
            hintsEl.classList.toggle("is-visible", show);
            if (!show) return;

            const total = allParams.length;
            const shown = Math.min(params.length, CHIP_LIMIT);
            metaEl.textContent = q
                ? `найдено ${params.length} из ${total} · клик — вставить`
                : (params.length > CHIP_LIMIT
                    ? `${shown} из ${total} · поиск сужает список`
                    : `${total} доступно · клик — вставить строку`);

            const slice = params.slice(0, CHIP_LIMIT);
            chipsEl.innerHTML = slice.length
                ? slice.map(p => {
                    const ex = p.example ? ` data-value="${esc(p.example)}"` : "";
                    return `<button type="button" class="req-param-chip${p.required ? " is-required" : ""}" data-name="${esc(p.name)}"${ex} title="${esc(p.desc || p.name)}">
                        <b>${esc(p.name)}</b>${p.desc ? `<small>${esc(p.desc.length > 72 ? p.desc.slice(0, 72) + "…" : p.desc)}</small>` : ""}
                    </button>`;
                }).join("")
                : `<span class="req-param-hints-empty">${existing.size && !q ? "Все подходящие параметры уже в списке" : "Ничего не найдено"}</span>`;

            chipsEl.querySelectorAll(".req-param-chip").forEach(btn => {
                btn.addEventListener("mousedown", e => e.preventDefault());
                btn.addEventListener("click", () => insertParam(ta, btn.dataset.name, btn.dataset.value || ""));
            });
        };

        const scheduleRender = (immediate) => {
            if (immediate) {
                clearTimeout(debounceTimer);
                render();
                return;
            }
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(render, 120);
        };

        searchEl.addEventListener("input", () => {
            panelSearch = searchEl.value.trim();
            scheduleRender(true);
        });
        searchEl.addEventListener("click", e => e.stopPropagation());

        ta.addEventListener("focus", () => scheduleRender(true));
        ta.addEventListener("click", () => scheduleRender(true));
        ta.addEventListener("keyup", () => scheduleRender(true));
        ta.addEventListener("input", () => scheduleRender(true));

        urlEl.addEventListener("input", () => scheduleRender(false));
        urlEl.addEventListener("keyup", () => scheduleRender(false));
        urlEl.addEventListener("paste", () => scheduleRender(false));
        urlEl.addEventListener("change", () => scheduleRender(true));
        urlEl.addEventListener("focus", () => scheduleRender(true));

        methodEl?.addEventListener("change", () => scheduleRender(true));

        scheduleRender(true);
    }

    window.LZTReqParamHints = { bind, resolveParams, detectApiKind, findEndpoint };
})();
