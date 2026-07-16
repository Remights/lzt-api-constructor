/** Анализ цены лота (S1): мин / средняя / медиана, вердикт, похожие лоты. */
(function () {
    function median(nums) {
        if (!nums.length) return 0;
        const s = nums.slice().sort((a, b) => a - b);
        const m = Math.floor(s.length / 2);
        return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    }

    function stats(prices) {
        if (!prices.length) return { min: 0, max: 0, avg: 0, median: 0, count: 0 };
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const sum = prices.reduce((a, b) => a + b, 0);
        return { min, max, avg: Math.round(sum / prices.length), median: Math.round(median(prices)), count: prices.length };
    }

    function verdict(price, med) {
        if (!med || !price) return { label: "Недостаточно данных", cls: "neutral", pct: 0 };
        const pct = Math.round(((price - med) / med) * 100);
        if (pct <= -15) return { label: "Выгодно", cls: "good", pct };
        if (pct >= 15) return { label: "Дорого", cls: "bad", pct };
        return { label: "Цена в норме", cls: "neutral", pct };
    }

    function extractItems(data) {
        if (!data) return [];
        if (Array.isArray(data.items)) return data.items;
        if (Array.isArray(data)) return data;
        return [];
    }

    async function fetchSimilarMarket(endpoint, params) {
        const ep = String(endpoint || "steam").replace(/^\/+|\/+$/g, "") || "steam";
        const q = Object.assign({ order_by: "price_to_up", pmin: "1" }, params || {});
        const body = {
            url: `https://prod-api.lzt.market/${ep}`,
            method: "GET",
            params: q,
            headers: {},
            body: null,
            timeout: 20,
        };
        const token = window.LZTToken?.get?.();
        if (token) body.headers = { Authorization: "Bearer " + token };

        if (window.Scenario?._demoMode && window.LZTDemo) {
            const r = await window.LZTDemo.mockApiTest(body);
            return extractItems(r.data);
        }

        const res = await fetch("/api/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.error || "Ошибка API");
        return extractItems(result.data);
    }

    async function fetchItemById(itemId) {
        const body = {
            url: `https://prod-api.lzt.market/${itemId}`,
            method: "GET",
            params: {},
            headers: {},
            body: null,
            timeout: 20,
        };
        const token = window.LZTToken?.get?.();
        if (token) body.headers = { Authorization: "Bearer " + token };
        if (window.Scenario?._demoMode && window.LZTDemo) {
            const r = await window.LZTDemo.mockApiTest(body);
            return r.data?.item || r.data;
        }
        const res = await fetch("/api/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const result = await res.json();
        if (!result.success) return null;
        const d = result.data;
        return d?.item || d;
    }

    function categoryFromItem(item) {
        if (!item || typeof item !== "object") return "steam";
        const raw = item.category_url || item.category?.category_url || item.category_name || item.category?.category_name || "";
        const s = String(raw).replace(/^\/+|\/+$/g, "");
        if (s) return s.split("/").pop() || "steam";
        return "steam";
    }

    async function fetchSimilarSteam(params) {
        return fetchSimilarMarket("steam", params);
    }

    async function analyzeByItemId(itemId, opts) {
        opts = opts || {};
        let category = opts.category || null;
        let current = null;
        if (!opts.demo) {
            current = await fetchItemById(itemId);
            if (current) category = category || categoryFromItem(current);
        }
        category = category || "steam";
        const itemPrice = parseFloat(current?.price);
        const pmaxDefault = itemPrice > 0 ? Math.max(Math.ceil(itemPrice * 1.5), Math.ceil(itemPrice + 50)) : 500;
        const items = await fetchSimilarMarket(category, { pmax: String(opts.pmax || pmaxDefault) });
        const prices = items.map(x => parseFloat(x.price)).filter(n => !isNaN(n) && n > 0);
        const st = stats(prices);

        if (!current) {
            current = items.find(x => String(x.item_id) === String(itemId));
        }
        if (!current && opts.demo) {
            current = window.LZTDemo?.MOCK_ITEMS?.find(x => String(x.item_id) === String(itemId)) || {
                item_id: itemId, price: st.median || 50, title: "Demo lot " + itemId,
            };
        }
        const price = parseFloat(current?.price) || st.median;
        const v = verdict(price, st.median);

        const similar = items
            .filter(x => String(x.item_id) !== String(itemId))
            .slice(0, 5);

        return { item: current, stats: st, verdict: v, similar, sampleSize: items.length };
    }

    function parseItemIdFromText(text) {
        const s = String(text || "").trim();
        const m = s.match(/(?:lzt\.market\/|item_id[=:]?\s*)(\d{4,})/i) || s.match(/^(\d{4,})$/);
        return m ? m[1] : null;
    }

    function renderBars(container, similar, maxPrice) {
        if (!container) return;
        const max = maxPrice || Math.max(...similar.map(x => parseFloat(x.price) || 0), 1);
        container.innerHTML = similar.map(it => {
            const p = parseFloat(it.price) || 0;
            const w = Math.max(8, Math.round((p / max) * 100));
            return `<div class="price-bar-row"><span class="price-bar-label">${p} ₽</span><div class="price-bar-track"><div class="price-bar-fill" style="width:${w}%"></div></div></div>`;
        }).join("");
    }

    function renderPanel(data, targetId) {
        const box = document.getElementById(targetId || "price-analyze-result");
        if (!box || !data) return;
        const st = data.stats;
        const v = data.verdict;
        const item = data.item || {};
        const badgeCls = v.cls === "good" ? "price-badge-good" : (v.cls === "bad" ? "price-badge-bad" : "price-badge-neutral");
        const pctTxt = v.pct ? (v.pct > 0 ? `+${v.pct}%` : `${v.pct}%`) + " от медианы" : "";

        box.innerHTML = `
            <div class="price-item-card">
                <div class="price-item-title">${escapeHtml(item.title || "Лот #" + item.item_id)}</div>
                <div class="price-item-meta">ID ${item.item_id || "—"} · <b>${item.price || "—"} ₽</b></div>
            </div>
            <div class="price-stats-grid">
                <div><span>Мин</span><b>${st.min} ₽</b></div>
                <div><span>Макс</span><b>${st.max} ₽</b></div>
                <div><span>Средняя</span><b>${st.avg} ₽</b></div>
                <div><span>Медиана</span><b>${st.median} ₽</b></div>
            </div>
            <div class="price-verdict ${badgeCls}">${escapeHtml(v.label)}${pctTxt ? ` · ${pctTxt}` : ""}</div>
            <div class="price-similar-title">Похожие лоты (${data.sampleSize} в выборке)</div>
            <div class="price-analyze-bars"></div>
            <ul class="price-similar-list">${(data.similar || []).map(x =>
                `<li><span>${escapeHtml(String(x.title || x.item_id).slice(0, 48))}</span><b>${x.price} ₽</b></li>`
            ).join("")}</ul>`;
        renderBars(box.querySelector(".price-analyze-bars"), data.similar || [], st.max);
    }

    function escapeHtml(s) {
        return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    async function runAnalyze(demo, targetId) {
        const input = document.getElementById("price-analyze-id");
        const status = document.getElementById("price-analyze-status");
        const id = parseItemIdFromText(input?.value);
        if (!id) {
            if (status) status.textContent = "Укажите item_id или ссылку lzt.market/…";
            return;
        }
        if (status) status.textContent = "Загрузка…";
        const prevDemo = window.Scenario?._demoMode;
        try {
            if (demo && window.Scenario) window.Scenario._demoMode = true;
            const data = await analyzeByItemId(id, { demo: !!demo });
            renderPanel(data, targetId || "price-analyze-result");
            if (status) status.textContent = "";
        } catch (e) {
            if (status) status.textContent = String(e.message || e);
        } finally {
            if (window.Scenario && prevDemo !== undefined) window.Scenario._demoMode = prevDemo;
            else if (demo && window.Scenario && !window.Scenario._runBusy) window.Scenario._demoMode = false;
        }
    }

    function bind() {
        document.getElementById("btn-price-analyze")?.addEventListener("click", () => runAnalyze(false));
        document.getElementById("btn-price-analyze-demo")?.addEventListener("click", () => runAnalyze(true));

        document.addEventListener("paste", (e) => {
            const t = (e.clipboardData?.getData("text") || "").trim();
            const id = parseItemIdFromText(t);
            if (!id || !/lzt\.market/i.test(t)) return;
            const tag = (document.activeElement?.tagName || "").toLowerCase();
            if (tag === "input" || tag === "textarea" || document.activeElement?.isContentEditable) return;
            if (e.target.closest("#canvas-viewport, #canvas-world, .canvas-area")) return;
            const pop = document.getElementById("price-analyze-popup");
            if (pop && pop.style.display === "block") return;
            e.preventDefault();
            window.LZTPriceAnalyzer?.showPopup(id);
        });
    }

    function showPopup(itemId) {
        let pop = document.getElementById("price-analyze-popup");
        if (!pop) {
            pop = document.createElement("div");
            pop.id = "price-analyze-popup";
            pop.className = "price-analyze-popup";
            pop.innerHTML = `<div class="price-analyze-popup-inner">
                <button type="button" class="price-popup-close">&times;</button>
                <div class="widget-title"><i class="fa-solid fa-chart-line"></i> Анализ цены</div>
                <div id="price-analyze-popup-result"></div>
            </div>`;
            document.body.appendChild(pop);
            pop.querySelector(".price-popup-close").addEventListener("click", () => { pop.style.display = "none"; });
            pop.addEventListener("click", (ev) => { if (ev.target === pop) pop.style.display = "none"; });
        }
        pop.style.display = "flex";
        const inp = document.getElementById("price-analyze-id");
        if (inp) inp.value = itemId;
        runAnalyze(!!window.Scenario?._scenarioIsDemo, "price-analyze-popup-result");
    }

    window.LZTPriceAnalyzer = {
        stats, median, verdict, analyzeByItemId, parseItemIdFromText, renderPanel, runAnalyze, showPopup, bind,
    };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
    else bind();
})();
