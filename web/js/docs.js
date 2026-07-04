// Модалка справочника LOLZ API: эндпоинты + таблицы значений.
(function () {
    "use strict";

    let activeDocCat = "all";
    let activeRefSection = "all";

    function esc(s) {
        return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function copyDocText(text, el) {
        const val = String(text || "");
        if (!val) return;
        navigator.clipboard.writeText(val).then(() => {
            if (!el) return;
            el.classList.add("doc-copied");
            const hint = el.closest(".doc-url-box")?.querySelector(".doc-url-hint");
            if (hint) {
                const orig = hint.textContent;
                hint.textContent = "Скопировано ✓";
                setTimeout(() => { hint.textContent = orig; el.classList.remove("doc-copied"); }, 1400);
            } else if (el.classList.contains("doc-ref-val") || el.classList.contains("doc-ref-query")) {
                const origHtml = el.dataset.origHtml || el.innerHTML;
                if (el.classList.contains("doc-ref-query")) {
                    el.innerHTML = '<i class="fa-solid fa-check"></i>';
                } else {
                    el.textContent = "✓";
                }
                setTimeout(() => {
                    if (el.classList.contains("doc-ref-query")) el.innerHTML = origHtml;
                    else el.textContent = el.dataset.orig || origHtml;
                    el.classList.remove("doc-copied");
                }, 1200);
            } else {
                const orig = el.textContent;
                el.textContent = "✓";
                setTimeout(() => { el.textContent = orig; el.classList.remove("doc-copied"); }, 1200);
            }
        }).catch(() => {});
    }

    function paramDesc(name) {
        const key = String(name).split(" / ")[0].trim();
        const pd = window.PARAM_DATA;
        return pd && pd[key] ? pd[key].desc : "";
    }

    function enrichParamDetails(doc) {
        const fromDoc = doc.param_details || [];
        const names = new Set(fromDoc.map(p => p.name.split(" / ")[0].trim()));
        const extra = [];
        if (doc.params && typeof doc.params === "object") {
            Object.keys(doc.params).forEach(k => {
                if (!names.has(k) && !fromDoc.some(p => p.name.includes(k))) {
                    extra.push({ name: k, desc: paramDesc(k) || "Параметр запроса" });
                }
            });
        }
        return [...fromDoc, ...extra];
    }

    function buildExampleUrl(doc) {
        if (!doc.params || !Object.keys(doc.params).length) return doc.url;
        const q = new URLSearchParams();
        Object.entries(doc.params).forEach(([k, v]) => {
            if (v === undefined || v === null || v === "") return;
            if (Array.isArray(v)) v.forEach(x => q.append(k, x));
            else q.append(k, v);
        });
        const qs = q.toString();
        return qs ? doc.url + (doc.url.includes("?") ? "&" : "?") + qs : doc.url;
    }

    function bindCopyables(root) {
        root.querySelectorAll(".doc-copy-url").forEach(el => {
            el.addEventListener("click", () => copyDocText(el.textContent.trim(), el));
        });
        root.querySelectorAll(".doc-copy-param").forEach(el => {
            el.addEventListener("click", () => copyDocText(el.getAttribute("data-copy") || el.textContent, el));
        });
        root.querySelectorAll(".doc-ref-val, .doc-ref-query").forEach(el => {
            if (!el.dataset.orig) el.dataset.orig = el.textContent.trim();
            if (!el.dataset.origHtml) el.dataset.origHtml = el.innerHTML;
            el.addEventListener("click", () => copyDocText(el.getAttribute("data-copy") || el.textContent, el));
        });
        root.querySelectorAll(".doc-copy-example").forEach(el => {
            el.addEventListener("click", () => copyDocText(el.getAttribute("data-url"), el));
        });
    }

    function setResultCount(n, mode) {
        const el = document.getElementById("docs-result-count");
        if (!el) return;
        if (mode === "ref") {
            el.textContent = n ? `Значений в справке: ${n}` : "";
        } else {
            el.textContent = n ? `Эндпоинтов: ${n}` : "";
        }
    }

    function renderEndpointCard(doc) {
        const card = document.createElement("div");
        card.className = "doc-card";
        const paramsList = enrichParamDetails(doc);
        const exampleUrl = buildExampleUrl(doc);

        let paramsHtml = "";
        if (paramsList.length) {
            paramsHtml = `
                <details class="doc-params-block" open>
                    <summary>Параметры запроса <span class="doc-params-count">${paramsList.length}</span></summary>
                    <div class="doc-params-list">
                        ${paramsList.map(p => {
                            const key = p.name.split(" / ")[0].trim();
                            return `
                            <div class="doc-param-row">
                                <span class="doc-copy-param" title="Копировать имя параметра" data-copy="${esc(key)}">${esc(p.name)}</span>
                                <span class="doc-param-desc">${esc(p.desc || paramDesc(p.name) || "—")}</span>
                            </div>`;
                        }).join("")}
                    </div>
                </details>`;
        }

        card.innerHTML = `
            <div class="doc-card-header">
                <div class="doc-card-title">
                    <span class="doc-method-badge ${esc(doc.method)}">${esc(doc.method)}</span>
                    <span class="doc-card-name">${esc(doc.title)}</span>
                </div>
                <button type="button" class="btn-use-doc"><i class="fa-solid fa-bolt"></i> В сценарий</button>
            </div>
            <div class="doc-card-desc">${esc(doc.full_desc || doc.desc || "")}</div>
            <div class="doc-url-box">
                <span class="doc-copy-url" title="Копировать базовый URL">${esc(doc.url)}</span>
                <span class="doc-url-hint">клик — URL</span>
            </div>
            ${Object.keys(doc.params || {}).length ? `
            <div class="doc-example-row">
                <code class="doc-example-url">${esc(exampleUrl)}</code>
                <button type="button" class="doc-copy-example btn-token" data-url="${esc(exampleUrl)}" title="Копировать URL с параметрами"><i class="fa-solid fa-copy"></i> Пример</button>
            </div>` : ""}
            ${paramsHtml}
        `;

        card.querySelector(".btn-use-doc")?.addEventListener("click", () => {
            if (typeof loadTemplate === "function") loadTemplate(doc);
            LZTUi.hideOverlay(document.getElementById("docs-modal"));
        });
        bindCopyables(card);
        return card;
    }

    function renderRefTable(title, hint, rows, query, opts) {
        opts = opts || {};
        const q = query.toLowerCase();
        const filtered = rows.filter(r => {
            const hay = [r.key, r.val, r.label, r.name, r.desc, r.code, r.value, r.id, r.path, r.url, r.copyQuery].filter(Boolean).join(" ").toLowerCase();
            return !q || hay.includes(q);
        });
        if (!filtered.length) return { html: "", count: 0 };

        const queryHint = opts.queryHint || (opts.queryLabel ? `Иконка справа — ${opts.queryLabel}=…` : "");
        const gridClass = opts.layout === "params" ? "doc-ref-grid doc-ref-grid--params" : "doc-ref-grid";

        const html = `
            <section class="doc-ref-section">
                <div class="doc-ref-head">
                    <h3>${esc(title)}</h3>
                    ${hint || queryHint ? `<p class="doc-ref-hint">${esc([hint, queryHint].filter(Boolean).join(" · "))}</p>` : ""}
                </div>
                <div class="${gridClass}">
                    ${filtered.map(r => {
                        const val = r.copy || r.key || r.val || r.code || r.value || r.id || r.path || "";
                        const label = r.label || r.name || r.desc || "";
                        const sub = r.desc && r.label ? r.desc : (r.name && (r.id || r.path) ? r.name : "");
                        const queryCopy = r.copyQuery || "";
                        const showLabel = label && label !== val;
                        return `<div class="doc-ref-item">
                            <button type="button" class="doc-ref-val" data-copy="${esc(val)}" title="Копировать: ${esc(val)}">${esc(val)}</button>
                            <div class="doc-ref-meta">
                                ${showLabel ? `<div class="doc-ref-label">${esc(label)}</div>` : ""}
                                ${sub && sub !== label ? `<div class="doc-ref-sub">${esc(sub)}</div>` : ""}
                            </div>
                            ${queryCopy ? `<button type="button" class="doc-ref-query" data-copy="${esc(queryCopy)}" title="Копировать: ${esc(queryCopy)}" aria-label="Копировать параметр"><i class="fa-solid fa-link"></i></button>` : ""}
                        </div>`;
                    }).join("")}
                </div>
            </section>`;
        return { html, count: filtered.length };
    }

    function paramsByGroup(groupId, query) {
        if (!window.PARAM_DATA) return [];
        const q = query.toLowerCase();
        return Object.entries(window.PARAM_DATA)
            .filter(([, v]) => v.cat === groupId)
            .filter(([k, v]) => !q || k.toLowerCase().includes(q) || (v.desc && v.desc.toLowerCase().includes(q)))
            .map(([k, v]) => ({ key: k, label: k, desc: v.desc, copy: k }));
    }

    function renderRefIntro(ref) {
        if (!ref.apiBases || !ref.apiBases.length) return "";
        return `
            <section class="doc-ref-intro">
                <p class="doc-ref-intro-lead"><i class="fa-solid fa-circle-info"></i> Клик по значению — в буфер. Готовые эндпоинты — во вкладках «Маркет» и «Форум».</p>
                <div class="doc-ref-bases">
                    ${ref.apiBases.map(b => `
                        <div class="doc-ref-base">
                            <span class="doc-ref-base-label">${esc(b.label)}</span>
                            <button type="button" class="doc-ref-val doc-ref-base-url" data-copy="${esc(b.url)}" title="Копировать ${esc(b.label)}">${esc(b.url)}</button>
                        </div>
                    `).join("")}
                </div>
            </section>`;
    }

    function renderReference(query) {
        const container = document.getElementById("docs-list");
        const ref = window.DOCS_REFERENCE;
        if (!container || !ref) return;

        let total = 0;
        const parts = [];

        if (activeRefSection === "all" && !query) {
            parts.push(renderRefIntro(ref));
        }

        const sections = [
            {
                id: "steam_games",
                title: "ID игр Steam",
                hint: "Параметр game[] — клик по ID копирует число",
                queryLabel: "game[]",
                rows: ref.steamGames.map(g => ({
                    key: g.id,
                    label: g.name,
                    copy: g.id,
                    copyQuery: `game[]=${g.id}`,
                })),
            },
            {
                id: "market_paths",
                title: "Пути категорий Маркета",
                hint: "Часть URL после prod-api.lzt.market/ — например /steam, /telegram",
                rows: (ref.marketPaths || []).map(p => ({
                    key: p.path,
                    label: p.path,
                    desc: p.name,
                    copy: p.path,
                    copyQuery: `https://prod-api.lzt.market/${p.path}`,
                })),
            },
            {
                id: "categories",
                title: "ID категорий Маркета (category_id)",
                hint: "Числовой идентификатор раздела аккаунтов",
                rows: (ref.marketCategories || []).map(c => ({
                    key: c.id,
                    label: `category_id=${c.id}`,
                    desc: c.name,
                    copy: c.id,
                })),
            },
            {
                id: "order_by",
                title: "Сортировка (order_by)",
                hint: "Значения для параметра order_by",
                rows: ref.orderBy.map(o => ({ key: o.value, label: o.value, desc: o.desc, copy: o.value, copyQuery: `order_by=${o.value}` })),
            },
            {
                id: "currency",
                title: "Валюта (currency)",
                hint: "В какой валюте искать или отображать цену",
                rows: (ref.currencies || []).map(c => ({ key: c.code, label: c.code, desc: c.name, copy: c.code, copyQuery: `currency=${c.code}` })),
            },
            {
                id: "email",
                title: "Почта (email_type[] / email_provider[])",
                hint: "Тип и провайдер почты на лоте",
                rows: [
                    ...(ref.emailTypes || []).map(e => ({ key: e.value, label: `email_type[]=${e.value}`, desc: e.desc, copy: e.value, copyQuery: `email_type[]=${e.value}` })),
                    ...(ref.emailProviders || []).map(e => ({ key: e.value, label: `email_provider[]=${e.value}`, desc: e.desc, copy: e.value, copyQuery: `email_provider[]=${e.value}` })),
                ],
            },
            {
                id: "csgo_ranks",
                title: "Звания CS2 (rmin / csgo_mm_rank)",
                hint: "Числовой ранг 0–18 в соревновательном режиме",
                rows: ref.csgoRanks.map(r => ({ key: r.value, label: `Ранг ${r.value}`, desc: r.desc, copy: r.value })),
            },
            {
                id: "valorant_ranks",
                title: "Ранги Valorant (rmin / rmax)",
                hint: "Числовые значения 3–27 (Iron → Radiant)",
                rows: (ref.valorantRanks || []).map(r => ({ key: r.value, label: r.desc, desc: `rmin=${r.value}`, copy: r.value })),
            },
            {
                id: "countries",
                title: "Коды стран Telegram (country[])",
                hint: "Двухбуквенный код ISO — клик копирует код",
                rows: ref.telegramCountries.map(c => ({
                    key: c.code,
                    label: c.code,
                    desc: c.name,
                    copy: c.code,
                    copyQuery: `country[]=${c.code}`,
                })),
            },
            {
                id: "valorant",
                title: "Регионы Valorant (valorant_region)",
                rows: ref.valorantRegions.map(r => ({
                    key: r.code,
                    label: r.code,
                    desc: r.name,
                    copy: r.code,
                    copyQuery: `valorant_region=${r.code}`,
                })),
            },
            {
                id: "forum",
                title: "Разделы форума (forum_id)",
                rows: ref.forumSections.map(f => ({
                    key: f.id,
                    label: `forum_id=${f.id}`,
                    desc: f.name,
                    copy: f.id,
                    copyQuery: `forum_id=${f.id}`,
                })),
            },
        ];

        sections.forEach(sec => {
            if (activeRefSection !== "all" && activeRefSection !== sec.id) return;
            const block = renderRefTable(sec.title, sec.hint, sec.rows, query, { queryLabel: sec.queryLabel });
            if (block.html) { parts.push(block.html); total += block.count; }
        });

        if (activeRefSection === "all" || activeRefSection === "params") {
            (ref.paramGroups || []).forEach(grp => {
                const rows = paramsByGroup(grp.id, query);
                if (!rows.length) return;
                const block = renderRefTable(grp.title, "Клик по имени — копирование параметра", rows, "", { layout: "params" });
                if (block.html) { parts.push(block.html); total += block.count; }
            });
        }

        if (!parts.length) {
            container.innerHTML = `<div class="doc-empty">Ничего не найдено. Попробуйте «730», «daybreak», «order_by», «RU», «steam»…</div>`;
            setResultCount(0, "ref");
            return;
        }

        container.innerHTML = `<div class="doc-ref-wrap">${parts.join("")}</div>`;
        bindCopyables(container);
        setResultCount(total, "ref");
    }

    function renderEndpoints(query) {
        const container = document.getElementById("docs-list");
        if (!container || !window.BUILTIN_DOCS) return;

        const filtered = window.BUILTIN_DOCS.filter(doc => {
            const matchCat = activeDocCat === "all" || doc.cat === activeDocCat || doc.category === activeDocCat;
            if (!matchCat) return false;
            if (!query) return true;
            const q = query.toLowerCase();
            return doc.title.toLowerCase().includes(q) ||
                (doc.desc && doc.desc.toLowerCase().includes(q)) ||
                (doc.full_desc && doc.full_desc.toLowerCase().includes(q)) ||
                doc.url.toLowerCase().includes(q) ||
                enrichParamDetails(doc).some(p =>
                    p.name.toLowerCase().includes(q) || (p.desc && p.desc.toLowerCase().includes(q))
                ) ||
                (window.DOCS_REFERENCE?.steamGames || []).some(g =>
                    (q === g.id || g.name.toLowerCase().includes(q)) &&
                    (doc.url.includes("steam") || (doc.param_details || []).some(p => p.name.includes("game")))
                );
        });

        container.innerHTML = "";
        if (!filtered.length) {
            container.innerHTML = `<div class="doc-empty">Эндпоинты не найдены</div>`;
            setResultCount(0, "api");
            return;
        }

        filtered.forEach(doc => container.appendChild(renderEndpointCard(doc)));
        setResultCount(filtered.length, "api");
    }

    function renderDocs() {
        const query = (document.getElementById("docs-search")?.value || "").trim();
        const refBar = document.getElementById("docs-ref-nav");
        const isRef = activeDocCat === "ref";

        if (refBar) refBar.style.display = isRef ? "flex" : "none";
        document.getElementById("docs-modal")?.classList.toggle("docs-mode-ref", isRef);

        if (isRef) renderReference(query);
        else renderEndpoints(query.toLowerCase());
    }

    function openRefSection(sectionId) {
        activeDocCat = "ref";
        activeRefSection = sectionId || "all";
        document.querySelectorAll(".doc-tab-btn").forEach(b => {
            b.classList.toggle("active", b.getAttribute("data-doc-cat") === "ref");
        });
        document.querySelectorAll(".doc-ref-chip").forEach(c => {
            c.classList.toggle("active", c.getAttribute("data-ref-section") === activeRefSection);
        });
        renderDocs();
    }

    function bindTabs() {
        document.querySelectorAll(".doc-tab-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                document.querySelectorAll(".doc-tab-btn").forEach(b => b.classList.remove("active"));
                e.currentTarget.classList.add("active");
                activeDocCat = e.currentTarget.getAttribute("data-doc-cat") || "all";
                if (activeDocCat !== "ref") activeRefSection = "all";
                renderDocs();
            });
        });
        document.querySelectorAll(".doc-ref-chip").forEach(chip => {
            chip.addEventListener("click", (e) => {
                document.querySelectorAll(".doc-ref-chip").forEach(c => c.classList.remove("active"));
                e.currentTarget.classList.add("active");
                activeRefSection = e.currentTarget.getAttribute("data-ref-section") || "all";
                renderDocs();
            });
        });
    }

    function bindModalExtras() {
        const modal = document.getElementById("docs-modal");
        if (!modal) return;
        modal.addEventListener("click", (e) => {
            if (e.target === modal) LZTUi.hideOverlay(modal);
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && modal.style.display !== "none" && !modal.classList.contains("ui-closing")) {
                LZTUi.hideOverlay(modal);
            }
        });
    }

    function init() {
        bindTabs();
        bindModalExtras();
        document.getElementById("docs-search")?.addEventListener("input", renderDocs);
        window.renderDocs = renderDocs;
        window.openDocsRef = openRefSection;
        window.copyDocText = copyDocText;
    }

    document.addEventListener("DOMContentLoaded", init);
})();
