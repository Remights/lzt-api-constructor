/** Умный пикер путей last.* / vars.* для поповеров блоков сценария. */
(function () {
    "use strict";

    function esc(s) {
        return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function collectKnownVars(sc, opts) {
        opts = opts || {};
        const out = [];
        const seen = new Set();
        const add = (name, hint, kind) => {
            const n = String(name || "").replace(/[^\w]/g, "_");
            if (!n || seen.has(n)) return;
            seen.add(n);
            out.push({ name: n, hint: hint || "", kind: kind || "user" });
        };
        (sc?.nodes || []).forEach((n) => {
            if (!n) return;
            if (n.type === "variable" && n.variable?.name) add(n.variable.name, "блок «Запомнить»", "user");
            if (n.type === "filter" && n.filter?.saveAs) add(n.filter.saveAs, "результат фильтра", "user");
            if (n.type === "ai" && n.ai?.outputVar) add(n.ai.outputVar, "ответ ИИ", "user");
            if (n.type === "foreach") {
                if (n.foreach?.itemVar) add(n.foreach.itemVar, "элемент foreach", "user");
                if (n.foreach?.indexVar) add(n.foreach.indexVar, "индекс foreach", "user");
            }
            if (n.type === "script" && n.script?.saveAs) add(n.script.saveAs, "stdout скрипта", "user");
        });
        const hasSniper = (sc?.nodes || []).some((n) => n.type === "sniper");
        const hasHooks = (sc?.nodes || []).some((n) => n.type === "script") || opts.includeHooks;
        if (hasSniper) add("_lzt_spend", "потрачено снайпером", "sys");
        if (hasHooks || opts.includeHooks) {
            add("hook", "webhook payload", "sys");
            add("hook_response", "ответ webhook", "sys");
            add("hook_event", "событие webhook", "sys");
        }
        return out;
    }

    function predecessors(sc, nodeId) {
        if (!sc?.edges || !nodeId) return [];
        return sc.edges.filter((e) => e.to === nodeId).map((e) => sc.nodes.find((n) => n.id === e.from)).filter(Boolean);
    }

    function detectApiKindFromUrl(url) {
        const u = String(url || "").toLowerCase();
        if (/lolz\.live|zelenka\.guru|\/threads|\/posts|\/forums/.test(u)) return "forum";
        if (/lzt\.market|prod-api\.lzt/.test(u)) return "market";
        return null;
    }

    function inferContext(sc, nodeId) {
        const preds = predecessors(sc, nodeId);
        const sample = (optsNodeId) => {
            if (optsNodeId) sc.editingNodeId = optsNodeId;
            return typeof sc.sampleForEditing === "function" ? sc.sampleForEditing() : null;
        };
        const data = sample(nodeId);
        let kind = null;
        let predLabel = "";
        for (const p of preds) {
            if (p.type === "request" && p.request?.url) {
                kind = detectApiKindFromUrl(p.request.url) || kind;
                predLabel = p.request.title || p.request.url;
            }
            if (p.type === "filter") kind = kind || "market";
            if (p.type === "ai") predLabel = predLabel || "ИИ";
        }
        if (!kind && data) {
            if (Array.isArray(data.threads) || data.threads) kind = "forum";
            else if (Array.isArray(data.items) || data.items) kind = "market";
            else if (Array.isArray(data.posts) || data.posts) kind = "forum";
        }
        return { preds, data, kind, predLabel };
    }

    /** Быстрые пресеты под контекст (клик — готовый путь). */
    function smartSuggestions(ctx, opts) {
        opts = opts || {};
        const list = [];
        const add = (path, label, hot) => list.push({ path, label, hot: !!hot });
        const kind = ctx.kind;
        const d = ctx.data;

        if (opts.preferLists || opts.mode === "list") {
            if (kind === "forum" || (d && d.threads)) {
                add("last.threads", "список тем", true);
                add("last.threads.length", "кол-во тем", true);
            }
            if (kind === "market" || (d && d.items) || !kind) {
                add("last.items", "список лотов", true);
                add("last.items.length", "кол-во лотов", true);
            }
            if (d && d.posts) add("last.posts", "список постов", true);
        } else if (opts.mode === "condition" || !opts.mode) {
            if (kind === "forum" || (d && (d.threads || d.posts))) {
                add("last.threads.length", "есть темы?", true);
                add("last.threads.0.thread_id", "id первой темы");
                add("last.threads.0.thread_title", "заголовок темы");
                if (d?.posts) add("last.posts.length", "есть посты?");
            }
            if (kind === "market" || (d && d.items) || !kind) {
                add("last.items.length", "есть лоты?", true);
                add("last.items.0.item_id", "id первого лота");
                add("last.items.0.price", "цена первого лота");
            }
        } else if (opts.mode === "id") {
            if (kind === "forum") add("last.threads.0.thread_id", "id темы", true);
            add("last.items.0.item_id", "id лота", true);
            add("vars.item_id", "vars.item_id");
        }

        (ctx.userVars || []).forEach((v) => {
            if (opts.preferLists) add(`vars.${v.name}`, v.hint || v.name);
            else add(`vars.${v.name}`, v.hint || v.name, v.name === "ai_result" || v.name === "filtered");
        });

        return list;
    }

    function rankPath(p, kind, preferLists) {
        let s = 0;
        const path = p.path || "";
        if (preferLists && /(^|\.)(items|threads|posts)$/.test(path)) s -= 100;
        if (kind === "forum") {
            if (path.startsWith("threads")) s -= 80;
            if (path.includes("thread_")) s -= 40;
            if (path.startsWith("items")) s += 20;
        }
        if (kind === "market") {
            if (path.startsWith("items")) s -= 80;
            if (path.includes("item_id") || path.includes("price")) s -= 40;
            if (path.startsWith("threads")) s += 20;
        }
        if (path.endsWith(".length")) s -= 30;
        if (/^\d+$/.test(path.split(".").pop() || "")) s += 10;
        return s;
    }

    function formatValue(path, insertMode) {
        if (insertMode === "mustache") return `{{${path}}}`;
        return path;
    }

    function applyValue(input, value, insertMode) {
        if (!input) return;
        if (insertMode === "mustache") {
            const start = input.selectionStart ?? input.value.length;
            const end = input.selectionEnd ?? start;
            input.value = input.value.slice(0, start) + value + input.value.slice(end);
            const pos = start + value.length;
            input.focus();
            try { input.setSelectionRange(pos, pos); } catch (e) { /* ignore */ }
        } else {
            input.value = value;
            input.focus();
        }
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    /** Куда вешать list/chips: после целой строки method+url, не внутрь flex. */
    function layoutAnchor(inputEl) {
        const filterRow = inputEl.closest(".pop-filter-row");
        if (filterRow) {
            return { row: filterRow, parent: filterRow.parentNode, after: filterRow };
        }
        let wrap = inputEl.closest(".pop-field-row");
        if (!wrap || !wrap.contains(inputEl)) {
            wrap = document.createElement("div");
            wrap.className = "pop-field-row";
            inputEl.parentNode.insertBefore(wrap, inputEl);
            wrap.appendChild(inputEl);
        }
        return { row: wrap, parent: wrap.parentNode, after: wrap };
    }

    function ensureButton(anchor, inputEl, label) {
        const row = anchor.row;
        let btn = row.querySelector(":scope > .btn-path-pick") || row.querySelector(".btn-path-pick");
        // В pop-filter-row кнопка рядом с URL, не растягивается
        if (!btn) {
            btn = document.createElement("button");
            btn.type = "button";
            btn.className = "btn-pick-field btn-path-pick";
            btn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> ${label || "Выбрать"}`;
            if (row.classList.contains("pop-filter-row")) {
                // после URL input
                if (inputEl.nextSibling) row.insertBefore(btn, inputEl.nextSibling);
                else row.appendChild(btn);
            } else {
                row.appendChild(btn);
            }
        } else {
            btn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> ${label || "Выбрать"}`;
        }
        return btn;
    }

    function ensureBelow(anchor, className) {
        const primary = className.split(/\s+/)[0];
        let el = anchor.after.nextElementSibling;
        while (el && (
            el.classList.contains("path-insert-chips") ||
            el.classList.contains("path-quick-bar") ||
            el.id === "pop-req-endpoint-host" ||
            el.classList.contains("req-param-hints")
        )) {
            if (el.classList.contains(primary)) break;
            el = el.nextElementSibling;
        }
        if (el && el.classList.contains(primary)) {
            el.style.cssText = "display:none!important;margin:0;padding:0;border:none;min-height:0;";
            el.hidden = true;
            el.setAttribute("aria-hidden", "true");
            el.innerHTML = "";
            return el;
        }
        el = document.createElement("div");
        el.className = className;
        el.hidden = true;
        el.setAttribute("aria-hidden", "true");
        el.style.cssText = "display:none!important;margin:0;padding:0;border:none;min-height:0;";
        anchor.parent.insertBefore(el, anchor.after.nextSibling);
        return el;
    }

    /**
     * @param {HTMLElement} inputEl
     * @param {{ sc, nodeId, insertMode, buttonLabel, preferLists, mode, asField, onPick }} opts
     * mode: "condition"|"list"|"id"|"text"
     */
    function bind(inputEl, opts) {
        opts = opts || {};
        const sc = opts.sc || window.Scenario;
        const insertMode = opts.insertMode || "path";
        if (!inputEl || !sc) return null;

        const anchor = layoutAnchor(inputEl);
        const btn = ensureButton(anchor, inputEl, opts.buttonLabel || "Выбрать");
        const listBox = ensureBelow(anchor, "pop-field-list path-pick-panel");
        listBox.classList.add("path-pick-panel");

        // quick bar under field
        let quickBar = null;
        if (!opts.noQuickBar) {
            quickBar = anchor.after.nextElementSibling;
            if (!quickBar || !quickBar.classList.contains("path-quick-bar")) {
                // не вставлять quick bar внутрь/перед каталогом повторно
                const existing = anchor.parent.querySelector(":scope > .path-quick-bar");
                if (existing && existing.previousElementSibling === anchor.after) {
                    quickBar = existing;
                } else {
                    quickBar = document.createElement("div");
                    quickBar.className = "path-quick-bar";
                    anchor.parent.insertBefore(quickBar, listBox);
                }
            }
        } else {
            // убрать старый quick bar у URL если был
            let qb = anchor.after.nextElementSibling;
            if (qb && qb.classList.contains("path-quick-bar")) qb.remove();
        }

        const close = () => {
            listBox.style.cssText = "display:none!important;margin:0;padding:0;border:none;min-height:0;";
            listBox.hidden = true;
            listBox.setAttribute("aria-hidden", "true");
            listBox.classList.remove("path-pick-open");
            listBox.innerHTML = "";
        };

        const pick = (path) => {
            let out = path;
            if (opts.asField) {
                const bare = path.replace(/^last\./, "").replace(/^vars\./, "");
                const parts = bare.split(".").filter((x) => !/^\d+$/.test(x));
                out = parts[parts.length - 1] || bare;
            }
            applyValue(inputEl, opts.asField ? out : formatValue(out, insertMode), opts.asField ? "path" : insertMode);
            if (typeof opts.onPick === "function") opts.onPick(out, path);
            close();
        };

        const refreshQuick = () => {
            if (!quickBar) return;
            if (opts.nodeId) sc.editingNodeId = opts.nodeId;
            const userVars = collectKnownVars(sc).filter((v) => v.kind === "user");
            const ctx = inferContext(sc, opts.nodeId);
            ctx.userVars = userVars;
            const mode = opts.mode || (opts.preferLists ? "list" : "condition");
            const sug = smartSuggestions(ctx, { mode, preferLists: opts.preferLists });
            const hot = sug.filter((s) => s.hot).slice(0, 6);
            if (!hot.length) {
                quickBar.style.display = "none";
                quickBar.hidden = true;
                quickBar.innerHTML = "";
                return;
            }
            quickBar.hidden = false;
            quickBar.style.display = "flex";
            const kindHint = ctx.kind === "forum" ? "форум" : ctx.kind === "market" ? "маркет" : "";
            quickBar.innerHTML = (kindHint ? `<span class="path-quick-hint">${esc(kindHint)}</span>` : "") +
                hot.map((s) => `<button type="button" class="path-quick-chip" data-path="${esc(s.path)}">${esc(s.label)}</button>`).join("");
            quickBar.querySelectorAll(".path-quick-chip").forEach((b) => {
                b.addEventListener("click", () => pick(b.dataset.path));
            });
        };

        const open = () => {
            if (listBox.style.display === "block" && !listBox.hidden) { close(); return; }
            if (opts.nodeId) sc.editingNodeId = opts.nodeId;

            const userVars = collectKnownVars(sc).filter((v) => v.kind === "user");
            const allVars = collectKnownVars(sc);
            const ctx = inferContext(sc, opts.nodeId);
            ctx.userVars = userVars;
            const sample = ctx.data;
            const paths = sample && typeof sc.flattenPaths === "function"
                ? sc.flattenPaths(sample, "", [], 0)
                : [];

            listBox.innerHTML = "";
            listBox.hidden = false;
            listBox.removeAttribute("aria-hidden");
            listBox.classList.add("path-pick-open");
            listBox.style.cssText = "";
            listBox.style.display = "block";
            const head = document.createElement("div");
            head.className = "path-pick-head";
            const kindLbl = ctx.kind === "forum" ? "Форум" : ctx.kind === "market" ? "Маркет" : "Данные";
            head.innerHTML = `<span class="path-pick-kind">${esc(kindLbl)}</span>` +
                (ctx.predLabel ? `<span class="path-pick-pred">${esc(String(ctx.predLabel).slice(0, 48))}</span>` : "");
            listBox.appendChild(head);

            const search = document.createElement("input");
            search.type = "text";
            search.className = "form-control";
            search.placeholder = "Поиск поля…";
            search.style.cssText = "margin-bottom:6px;";
            listBox.appendChild(search);

            const rows = document.createElement("div");
            rows.className = "pop-field-rows";
            listBox.appendChild(rows);

            const draw = (q) => {
                rows.innerHTML = "";
                const qq = (q || "").toLowerCase();
                const mode = opts.mode || (opts.preferLists ? "list" : "condition");

                // 1) Умные подсказки
                const sug = smartSuggestions(ctx, { mode, preferLists: opts.preferLists })
                    .filter((s) => !qq || s.path.toLowerCase().includes(qq) || s.label.toLowerCase().includes(qq));
                if (sug.length) {
                    const sec = document.createElement("div");
                    sec.className = "path-pick-section";
                    sec.innerHTML = `<div class="path-pick-sec-title">Рекомендуем</div>`;
                    sug.slice(0, 10).forEach((s) => {
                        const it = document.createElement("div");
                        it.className = "pop-field-item" + (s.hot ? " path-pick-hot" : "");
                        it.innerHTML = `<code>${esc(formatValue(s.path, insertMode))}</code><span class="pop-field-preview">${esc(s.label)}</span>`;
                        it.addEventListener("click", () => pick(s.path));
                        sec.appendChild(it);
                    });
                    rows.appendChild(sec);
                }

                // 2) Ответ предыдущего блока — главный
                const lastSec = document.createElement("div");
                lastSec.className = "path-pick-section";
                lastSec.innerHTML = `<div class="path-pick-sec-title">Из ответа предыдущего блока</div>`;
                if (!sample) {
                    lastSec.innerHTML += `<div class="pop-field-empty">Сначала нажмите <b>Запустить</b> — подтянутся реальные поля (threads / items). Пока можно взять из «Рекомендуем».</div>`;
                } else if (!qq && sample && typeof sample === "object") {
                    const tree = document.createElement("div");
                    tree.className = "path-pick-tree";
                    const walk = (obj, prefix, depth) => {
                        if (depth > 4 || obj == null) return;
                        if (Array.isArray(obj)) {
                            const it = document.createElement("div");
                            it.className = "pop-field-item path-tree-node";
                            const path = prefix ? `last.${prefix}` : "last";
                            it.style.paddingLeft = (8 + depth * 10) + "px";
                            it.innerHTML = `<code>${esc(formatValue(path, insertMode))}</code><span class="pop-field-preview">[${obj.length}]</span>`;
                            it.addEventListener("click", () => pick(path));
                            tree.appendChild(it);
                            if (obj[0] != null && typeof obj[0] === "object") walk(obj[0], prefix ? prefix + ".0" : "0", depth + 1);
                            return;
                        }
                        if (typeof obj !== "object") return;
                        Object.keys(obj).slice(0, 40).forEach((k) => {
                            const path = prefix ? `${prefix}.${k}` : k;
                            const full = `last.${path}`;
                            const v = obj[k];
                            const it = document.createElement("div");
                            it.className = "pop-field-item path-tree-node";
                            it.style.paddingLeft = (8 + depth * 10) + "px";
                            let prev = "";
                            if (Array.isArray(v)) prev = `[${v.length}]`;
                            else if (v && typeof v === "object") prev = "{…}";
                            else prev = String(v).slice(0, 40);
                            it.innerHTML = `<code>${esc(formatValue(full, insertMode))}</code><span class="pop-field-preview">${esc(prev)}</span>`;
                            it.addEventListener("click", () => pick(full));
                            tree.appendChild(it);
                            if (v && typeof v === "object") walk(v, path, depth + 1);
                        });
                    };
                    walk(sample, "", 0);
                    lastSec.appendChild(tree);
                    const flat = document.createElement("details");
                    flat.className = "path-pick-sys";
                    flat.innerHTML = `<summary>Плоский список (все пути)</summary>`;
                    let list = paths.slice().sort((a, b) => rankPath(a, ctx.kind, opts.preferLists) - rankPath(b, ctx.kind, opts.preferLists));
                    list.slice(0, 80).forEach((p) => {
                        const it = document.createElement("div");
                        it.className = "pop-field-item";
                        const path = `last.${p.path}`;
                        const preview = p.val === null ? "null" : String(p.val);
                        it.innerHTML = `<code>${esc(formatValue(path, insertMode))}</code><span class="pop-field-preview">${esc(preview.slice(0, 48))}</span>`;
                        it.addEventListener("click", () => pick(path));
                        flat.appendChild(it);
                    });
                    lastSec.appendChild(flat);
                } else {
                    let list = paths.filter((p) => !qq || p.path.toLowerCase().includes(qq));
                    list = list.slice().sort((a, b) => rankPath(a, ctx.kind, opts.preferLists) - rankPath(b, ctx.kind, opts.preferLists));
                    list.slice(0, 80).forEach((p) => {
                        const it = document.createElement("div");
                        it.className = "pop-field-item";
                        const path = `last.${p.path}`;
                        const preview = p.val === null ? "null" : String(p.val);
                        it.innerHTML = `<code>${esc(formatValue(path, insertMode))}</code><span class="pop-field-preview">${esc(preview.slice(0, 48))}</span>`;
                        it.addEventListener("click", () => pick(path));
                        lastSec.appendChild(it);
                    });
                    if (!list.length) lastSec.innerHTML += `<div class="pop-field-empty">Ничего не найдено</div>`;
                }
                rows.appendChild(lastSec);

                // 3) Vars пользователя
                const uv = allVars.filter((v) => v.kind === "user" && (!qq || v.name.toLowerCase().includes(qq)));
                if (uv.length) {
                    const sec = document.createElement("div");
                    sec.className = "path-pick-section";
                    sec.innerHTML = `<div class="path-pick-sec-title">Ваши переменные</div>`;
                    uv.forEach((v) => {
                        const it = document.createElement("div");
                        it.className = "pop-field-item";
                        const path = `vars.${v.name}`;
                        it.innerHTML = `<code>${esc(formatValue(path, insertMode))}</code><span class="pop-field-preview">${esc(v.hint)}</span>`;
                        it.addEventListener("click", () => pick(path));
                        sec.appendChild(it);
                    });
                    rows.appendChild(sec);
                }

                // 4) Системные — свёрнуто
                const sv = allVars.filter((v) => v.kind === "sys" && (!qq || v.name.toLowerCase().includes(qq)));
                if (sv.length) {
                    const det = document.createElement("details");
                    det.className = "path-pick-sys";
                    det.innerHTML = `<summary>Системные (webhook / spend)</summary>`;
                    sv.forEach((v) => {
                        const it = document.createElement("div");
                        it.className = "pop-field-item";
                        const path = `vars.${v.name}`;
                        it.innerHTML = `<code>${esc(formatValue(path, insertMode))}</code><span class="pop-field-preview">${esc(v.hint)}</span>`;
                        it.addEventListener("click", () => pick(path));
                        det.appendChild(it);
                    });
                    rows.appendChild(det);
                }
            };

            search.addEventListener("input", () => draw(search.value.trim().toLowerCase()));
            draw("");
            listBox.style.display = "block";
            setTimeout(() => search.focus(), 30);
        };

        btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); open(); };
        refreshQuick();
        return { open, close, listBox, button: btn, refreshQuick };
    }

    function bindChips(containerOrInput, opts) {
        opts = opts || {};
        const sc = opts.sc || window.Scenario;
        const input = containerOrInput?.tagName === "TEXTAREA" || containerOrInput?.tagName === "INPUT"
            ? containerOrInput
            : containerOrInput?.querySelector?.("textarea, input");
        if (!input || !sc) return null;

        // строго рядом с полем, не прыгаем к каталогу эндпоинтов
        let wrap = input.closest(".pop-field-row");
        let afterEl = wrap || input;
        let parent = afterEl.parentNode;

        // убрать старые дубли рядом с этим полем
        let sib = afterEl.nextElementSibling;
        while (sib && sib.classList.contains("path-insert-chips")) {
            const next = sib.nextElementSibling;
            sib.remove();
            sib = next;
        }

        const chips = document.createElement("div");
        chips.className = "path-insert-chips";
        if (afterEl.nextSibling) parent.insertBefore(chips, afterEl.nextSibling);
        else parent.appendChild(chips);

        const ctx = inferContext(sc, opts.nodeId);
        const userVars = collectKnownVars(sc).filter((v) => v.kind === "user");
        ctx.userVars = userVars;
        // для params URL-блока — короткие подсказки подстановки, без дублей
        const seen = new Set();
        const items = [];
        const push = (path, label) => {
            if (seen.has(path)) return;
            seen.add(path);
            items.push({ path, label });
        };
        (smartSuggestions(ctx, { mode: opts.mode || "condition" }) || [])
            .filter((s) => s.hot)
            .slice(0, 5)
            .forEach((s) => push(s.path, s.label));
        userVars.slice(0, 4).forEach((v) => push(`vars.${v.name}`, v.name));

        chips.innerHTML = items.length
            ? items.map((it) =>
                `<button type="button" class="path-chip" data-path="${esc(it.path)}" title="${esc(it.path)}"><span class="path-chip-code">{{${esc(it.path)}}}</span>${it.label ? ` <span>${esc(it.label)}</span>` : ""}</button>`
            ).join("")
            : `<span class="path-quick-hint">Подстановки появятся после Run</span>`;

        chips.querySelectorAll(".path-chip").forEach((btn) => {
            btn.addEventListener("click", () => applyValue(input, `{{${btn.dataset.path}}}`, "mustache"));
        });
        return chips;
    }

    window.LZTPathPicker = {
        bind,
        bindChips,
        collectKnownVars,
        formatValue,
        inferContext,
        smartSuggestions,
    };
})();
