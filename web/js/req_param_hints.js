// Подсказки параметров для блока «Запрос» (Market + Forum API).
(function () {
    "use strict";

    const MARKET_PRIORITY = ["pmax", "pmin", "order_by", "page", "limit", "title", "daybreak", "game[]", "currency"];
    const FORUM_PRIORITY = ["forum_id", "thread_id", "post_id", "user_id", "creator_user_id", "limit", "page", "order", "post_body", "thread_title", "comment", "comment_body"];
    const FORUM_SHARED = ["limit", "page"];
    const BODY_NAMES = new Set(["post_body", "comment_body", "comment", "thread_title", "message", "title_html"]);
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

    function isBodyParam(p, method) {
        const m = String(method || "GET").toUpperCase();
        if (p.in === "body" || p.in === "formData") return true;
        if ((m === "POST" || m === "PUT" || m === "PATCH") && BODY_NAMES.has(p.name)) return true;
        return false;
    }

    function docsChoices(name) {
        const D = window.DOCS_REFERENCE;
        if (!D) return null;
        if (name === "order_by") return (D.orderBy || []).map((o) => ({ value: o.value, label: o.desc || o.value }));
        if (name === "game[]" || name === "game") {
            return (D.steamGames || []).map((g) => ({ value: g.id, label: g.name + " (" + g.id + ")" }));
        }
        if (name === "currency") {
            return (D.currencies || []).map((c) => ({ value: c.code, label: c.name + " (" + c.code + ")" }));
        }
        if (name === "country[]" || name === "country") {
            return (D.telegramCountries || []).map((c) => ({ value: c.code, label: c.name + " (" + c.code + ")" }));
        }
        if (name === "email_type") {
            return (D.emailTypes || []).map((e) => ({ value: e.value, label: e.desc || e.value }));
        }
        if (name === "forum_id") {
            return (D.forumSections || []).map((f) => ({ value: f.id, label: f.name + " (" + f.id + ")" }));
        }
        return null;
    }

    function enumChoices(p) {
        if (Array.isArray(p.enum) && p.enum.length) {
            return p.enum.map((v) => {
                const s = String(v);
                const desc = (p.enum_desc && p.enum_desc[s]) || "";
                return { value: s, label: desc ? s + " — " + desc : s };
            });
        }
        return docsChoices(p.name);
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

    function resolveParams(method, url, existingKeys, opts) {
        opts = opts || {};
        const includeBody = opts.includeBody !== false;
        const kind = detectApiKind(url);
        const items = new Map();
        const found = findEndpoint(method, url);

        const add = (name, info) => {
            if (!name || existingKeys.has(name)) return;
            if (!includeBody && info.inBody) return;
            if (items.has(name)) {
                const cur = items.get(name);
                if (info.required) cur.required = true;
                if (info.desc && !cur.desc) cur.desc = info.desc;
                if (info.example != null && cur.example == null) cur.example = info.example;
                if (info.enum) cur.enum = info.enum;
                if (info.enum_desc) cur.enum_desc = info.enum_desc;
                if (info.inBody) cur.inBody = true;
                return;
            }
            items.set(name, {
                name,
                desc: info.desc || "",
                required: !!info.required,
                example: info.example != null ? String(info.example) : "",
                source: info.source || "common",
                type: info.type || "string",
                enum: info.enum || null,
                enum_desc: info.enum_desc || null,
                inBody: !!info.inBody,
                in: info.in || (info.inBody ? "body" : "query"),
            });
        };

        if (found?.ep?.params?.length) {
            found.ep.params.forEach((p) => {
                if (!p.name || p.in === "path") return;
                const meta = paramMeta(p.name);
                const body = isBodyParam(p, method);
                add(p.name, {
                    desc: p.desc_ru || p.desc || meta?.desc || "",
                    required: p.required,
                    example: suggestValue(p),
                    source: "endpoint",
                    type: p.type,
                    enum: p.enum || meta?.enum,
                    enum_desc: p.enum_desc || meta?.enum_desc,
                    inBody: body,
                    in: p.in || (body ? "body" : "query"),
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
                    const body = isBodyParam({ name, in: meta.in }, method);
                    add(name, {
                        desc: meta.desc,
                        source: "common",
                        example: suggestValue({ name }),
                        enum: meta.enum,
                        enum_desc: meta.enum_desc,
                        inBody: body,
                        in: body ? "body" : "query",
                    });
                }
            });
            if (kind === "forum") {
                FORUM_SHARED.forEach((name) => {
                    const meta = paramMeta(name);
                    if (meta) add(name, { desc: meta.desc, source: "common", example: suggestValue({ name }) });
                });
            }
        }

        return { params: sortParams([...items.values()], kind), found, kind };
    }

    function parseExistingKeys(text) {
        const keys = new Set();
        String(text || "").split("\n").forEach((line) => {
            line = line.trim();
            if (!line || line.startsWith("#")) return;
            const i = line.indexOf("=");
            if (i > 0) keys.add(line.slice(0, i).trim());
        });
        return keys;
    }

    function upsertParamLine(textarea, name, value) {
        const lines = String(textarea.value || "").split("\n");
        let found = false;
        const remove = value == null || value === "";
        const next = [];
        lines.forEach((line) => {
            const t = line.trim();
            if (!t || t.startsWith("#")) { next.push(line); return; }
            const i = t.indexOf("=");
            if (i < 0) { next.push(line); return; }
            if (t.slice(0, i).trim() === name) {
                found = true;
                if (!remove) next.push(name + "=" + value);
                return;
            }
            next.push(line);
        });
        if (!found && !remove) {
            if (next.length === 1 && next[0].trim() === "") next[0] = name + "=" + value;
            else next.push(name + "=" + value);
        }
        textarea.value = next.join("\n").replace(/\n+$/, "") + (next.some((l) => l.trim()) ? "\n" : "");
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function insertParam(textarea, name, value) {
        upsertParamLine(textarea, name, value);
        textarea.focus();
    }

    function insertBodyField(bodyTa, name, value) {
        let obj = {};
        const raw = String(bodyTa.value || "").trim();
        if (raw) {
            try { obj = JSON.parse(raw); if (!obj || typeof obj !== "object" || Array.isArray(obj)) obj = {}; }
            catch (e) { obj = {}; }
        }
        obj[name] = value !== "" ? (isNaN(value) || value === "" ? value : (String(Number(value)) === String(value) ? Number(value) : value)) : "";
        bodyTa.value = JSON.stringify(obj, null, 2);
        bodyTa.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function syncTabs(pop, name) {
        pop.querySelectorAll(".req-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
        pop.querySelectorAll(".req-tab-pane").forEach((p) => p.classList.toggle("active", p.dataset.pane === name));
    }

    function closeEnumPop() {
        document.querySelectorAll(".req-enum-pop").forEach((el) => el.remove());
    }

    function openEnumPop(anchorBtn, choices, onPick) {
        closeEnumPop();
        const pop = document.createElement("div");
        pop.className = "req-enum-pop";
        pop.innerHTML = choices.slice(0, 40).map((c) =>
            `<button type="button" class="req-enum-opt" data-value="${esc(c.value)}">${esc(c.label)}</button>`
        ).join("");
        document.body.appendChild(pop);
        const r = anchorBtn.getBoundingClientRect();
        pop.style.left = Math.min(r.left, window.innerWidth - 280) + "px";
        pop.style.top = Math.min(r.bottom + 4, window.innerHeight - 220) + "px";
        pop.querySelectorAll(".req-enum-opt").forEach((b) => {
            b.addEventListener("click", () => {
                onPick(b.dataset.value);
                closeEnumPop();
            });
        });
        const closer = (e) => {
            if (!pop.contains(e.target) && e.target !== anchorBtn) {
                closeEnumPop();
                document.removeEventListener("mousedown", closer, true);
            }
        };
        setTimeout(() => document.addEventListener("mousedown", closer, true), 0);
    }

    function bind(pop) {
        const ta = pop.querySelector("#pop-req-params");
        const bodyTa = pop.querySelector("#pop-req-body");
        const methodEl = pop.querySelector("#pop-req-method");
        const urlEl = pop.querySelector("#pop-req-url");
        if (!ta || !urlEl) return;

        const paramsPane = pop.querySelector('.req-tab-pane[data-pane="params"]');
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
            if (paramsPane) {
                const hint = paramsPane.querySelector(".pop-label-hint");
                if (hint) hint.insertAdjacentElement("afterend", hintsEl);
                else paramsPane.insertBefore(hintsEl, paramsPane.firstChild);
            } else {
                ta.insertAdjacentElement("beforebegin", hintsEl);
            }
        } else if (paramsPane && hintsEl.parentElement !== paramsPane) {
            const hint = paramsPane.querySelector(".pop-label-hint");
            if (hint) hint.insertAdjacentElement("afterend", hintsEl);
            else paramsPane.insertBefore(hintsEl, paramsPane.firstChild);
        }

        const titleEl = hintsEl.querySelector(".req-param-hints-title");
        const metaEl = hintsEl.querySelector(".req-param-hints-meta");
        const searchEl = hintsEl.querySelector(".req-param-hints-search");
        const chipsEl = hintsEl.querySelector(".req-param-hints-chips");
        let debounceTimer = null;
        let panelSearch = "";

        const onChipClick = (btn, p) => {
            const choices = enumChoices(p);
            if (choices && choices.length) {
                openEnumPop(btn, choices, (val) => {
                    if (p.inBody && bodyTa) {
                        insertBodyField(bodyTa, p.name, val);
                        syncTabs(pop, "body");
                    } else {
                        insertParam(ta, p.name, val);
                    }
                    scheduleRender(true);
                    pop._reqTopSync?.();
                });
                return;
            }
            const val = btn.dataset.value || suggestValue(p) || "";
            if (p.inBody && bodyTa) {
                insertBodyField(bodyTa, p.name, val);
                syncTabs(pop, "body");
            } else {
                insertParam(ta, p.name, val);
            }
            scheduleRender(true);
            pop._reqTopSync?.();
        };

        const render = () => {
            const method = methodEl?.value || "GET";
            const url = urlEl.value.trim();
            const existing = parseExistingKeys(ta.value);
            // body keys also "used" for body chips
            if (bodyTa) {
                try {
                    const o = JSON.parse(bodyTa.value || "{}");
                    if (o && typeof o === "object") Object.keys(o).forEach((k) => existing.add(k));
                } catch (e) { /* ignore */ }
            }
            const q = (panelSearch || "").toLowerCase().trim();

            const { params: allParams, found, kind } = resolveParams(method, url, existing, { includeBody: true });
            let params = allParams;
            if (q) {
                params = params.filter((p) =>
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
                    : `${total} доступно · клик — вставить`);

            const slice = params.slice(0, CHIP_LIMIT);
            chipsEl.innerHTML = slice.length
                ? slice.map((p) => {
                    const ex = p.example ? ` data-value="${esc(p.example)}"` : "";
                    const hasEnum = !!(enumChoices(p) || []).length;
                    return `<button type="button" class="req-param-chip${p.required ? " is-required" : ""}${p.inBody ? " is-body" : ""}${hasEnum ? " has-enum" : ""}" data-name="${esc(p.name)}"${ex} title="${esc(p.desc || p.name)}">
                        ${p.inBody ? '<span class="req-chip-badge">body</span>' : ""}${hasEnum ? '<span class="req-chip-badge enum">выбор</span>' : ""}
                        <b>${esc(p.name)}</b>${p.desc ? `<small>${esc(p.desc.length > 72 ? p.desc.slice(0, 72) + "…" : p.desc)}</small>` : ""}
                    </button>`;
                }).join("")
                : `<span class="req-param-hints-empty">${existing.size && !q ? "Все подходящие параметры уже заданы" : "Ничего не найдено"}</span>`;

            const byName = Object.fromEntries(slice.map((p) => [p.name, p]));
            chipsEl.querySelectorAll(".req-param-chip").forEach((btn) => {
                btn.addEventListener("mousedown", (e) => e.preventDefault());
                btn.addEventListener("click", () => onChipClick(btn, byName[btn.dataset.name] || { name: btn.dataset.name }));
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
        searchEl.addEventListener("click", (e) => e.stopPropagation());

        ta.addEventListener("focus", () => scheduleRender(true));
        ta.addEventListener("click", () => scheduleRender(true));
        ta.addEventListener("keyup", () => scheduleRender(true));
        ta.addEventListener("input", () => scheduleRender(true));
        bodyTa?.addEventListener("input", () => scheduleRender(true));

        urlEl.addEventListener("input", () => scheduleRender(false));
        urlEl.addEventListener("keyup", () => scheduleRender(false));
        urlEl.addEventListener("paste", () => scheduleRender(false));
        urlEl.addEventListener("change", () => scheduleRender(true));
        urlEl.addEventListener("focus", () => scheduleRender(true));

        methodEl?.addEventListener("change", () => scheduleRender(true));

        scheduleRender(true);
        pop._reqHintsRefresh = () => scheduleRender(true);
    }

    function missingRequired(method, url, paramsObj, bodyObj) {
        const found = findEndpoint(method, url);
        if (!found?.ep?.params) return [];
        const miss = [];
        const params = paramsObj || {};
        const body = bodyObj && typeof bodyObj === "object" ? bodyObj : {};
        found.ep.params.forEach((p) => {
            if (!p.required || !p.name || p.in === "path") return;
            const inBody = isBodyParam(p, method);
            const has = inBody
                ? body[p.name] != null && String(body[p.name]) !== ""
                : params[p.name] != null && String(params[p.name]) !== "";
            if (!has) miss.push(p.name);
        });
        // path placeholders still as {{vars.x}} count as ok if present in URL
        (found.ep.params || []).filter((p) => p.in === "path" && p.required).forEach((p) => {
            if (!new RegExp("\\{\\{?\\s*(vars\\.)?" + p.name).test(url) && !url.includes("{" + p.name + "}")) {
                // if replaced with concrete value, ok
                if (new RegExp("/" + p.name + "/").test(url)) return;
                // leave path UI to handle
            }
        });
        return miss;
    }

    window.LZTReqParamHints = {
        bind, resolveParams, detectApiKind, findEndpoint, suggestValue,
        enumChoices, docsChoices, missingRequired, upsertParamLine, isBodyParam,
    };
})();
