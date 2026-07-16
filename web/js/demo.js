/** Демо-режим: mock API и готовый сценарий без токена LZT. */
(function () {
    const MOCK_ITEMS = [
        { item_id: 900001, price: 45, title: "Steam | CS2 | Prime | 1200ч | RU", item_state: "active" },
        { item_id: 900002, price: 72, title: "Steam | Dota 2 | 800ч | без VAC", item_state: "active" },
        { item_id: 900003, price: 38, title: "Steam | Rust | 200ч | новый", item_state: "active" },
        { item_id: 900004, price: 95, title: "Steam | GTA V | Social Club", item_state: "active" },
        { item_id: 900005, price: 55, title: "Steam | PUBG | 400ч", item_state: "active" },
        { item_id: 900006, price: 120, title: "Steam | CS2 | 5 медалей | Prime", item_state: "active" },
        { item_id: 900007, price: 28, title: "Steam | пустой | 0 игр", item_state: "active" },
        { item_id: 900008, price: 64, title: "Steam | TF2 | инвентарь", item_state: "active" },
        { item_id: 900009, price: 81, title: "Steam | ARK | 150ч", item_state: "active" },
        { item_id: 900010, price: 49, title: "Steam | ETS2 | 90ч", item_state: "active" },
    ];

    function parseUrl(url) {
        try {
            return new URL(url.replace(/\{\{[^}]+\}\}/g, "1"));
        } catch (e) {
            return null;
        }
    }

    function mockApiTest(payload) {
        const url = (payload && payload.url) || "";
        const method = ((payload && payload.method) || "GET").toUpperCase();
        const u = parseUrl(url) || { pathname: url, href: url };

        if (/\/fast-buy/i.test(u.pathname || url) && method === "POST") {
            const id = (u.pathname.match(/(\d+)/) || [])[1] || "?";
            return Promise.resolve({
                success: true,
                status_code: 200,
                data: { item_id: parseInt(id, 10), bought: true, demo: true },
            });
        }

        if (/\/me\b/i.test(u.pathname || url)) {
            return Promise.resolve({
                success: true,
                status_code: 200,
                data: { user: { username: "demo_user", balance: 12500 }, demo: true },
            });
        }

        const idMatch = (u.pathname || url).match(/\/(\d{5,})\/?$/);
        if (idMatch && method === "GET") {
            const id = parseInt(idMatch[1], 10);
            const lot = MOCK_ITEMS.find(x => x.item_id === id) || {
                item_id: id, price: 50, title: "Demo lot " + id, item_state: "active",
            };
            return Promise.resolve({
                success: true,
                status_code: 200,
                data: { item: Object.assign({}, lot), demo: true },
            });
        }

        if (/\/steam/i.test(u.pathname || url) || /prod-api\.lzt\.market\/?$/i.test(u.href || url)) {
            return Promise.resolve({
                success: true,
                status_code: 200,
                data: { items: MOCK_ITEMS.map(x => Object.assign({}, x)), demo: true },
            });
        }

        return Promise.resolve({
            success: true,
            status_code: 200,
            data: { items: MOCK_ITEMS.slice(0, 3), demo: true, note: "mock fallback" },
        });
    }

    function mockAiResponse(prompt) {
        const picks = MOCK_ITEMS.filter(x => x.price <= 70).slice(0, 3).map(x => ({
            item_id: x.item_id, buy: true, score: 8, reason: "Демо: цена ниже медианы",
        }));
        return JSON.stringify({ items: picks, demo: true, summary: "Демо-ответ ИИ (без реального API)" });
    }

    function buildDemoScenario() {
        return {
            title: "Демо: поиск → фильтр → снайпер",
            nodes: [
                { id: "d1", type: "start", x: 40, y: 240, start: { globalError: true } },
                {
                    id: "d2", type: "request", x: 280, y: 220,
                    request: {
                        method: "GET", url: "https://prod-api.lzt.market/steam",
                        params: { pmax: "150", order_by: "price_to_up" },
                        body: null, headers: {}, title: "Поиск Steam (демо)",
                        retries: 0, retryDelay: 1000, timeout: 15, respectRateLimit: true,
                    },
                },
                {
                    id: "d3", type: "filter", x: 580, y: 220,
                    filter: { source: "last.items", field: "price", op: "<=", value: "70", saveAs: "filtered" },
                },
                {
                    id: "d4", type: "sniper", x: 880, y: 220,
                    sniper: { source: "vars.filtered", maxPrice: "70", maxSpend: "500", priceField: "price", itemField: "item_id" },
                },
                { id: "d5", type: "logmsg", x: 1180, y: 220, logmsg: { text: "Демо завершено! Потрачено: {{vars._lzt_spend}}₽" } },
                { id: "d6", type: "stop", x: 1460, y: 220 },
            ],
            edges: [
                { id: "de1", from: "d1", fromPort: "out", to: "d2" },
                { id: "de2", from: "d2", fromPort: "success", to: "d3" },
                { id: "de3", from: "d3", fromPort: "found", to: "d4" },
                { id: "de4", from: "d3", fromPort: "empty", to: "d6" },
                { id: "de5", from: "d4", fromPort: "bought", to: "d5" },
                { id: "de6", from: "d4", fromPort: "skip", to: "d5" },
                { id: "de7", from: "d5", fromPort: "out", to: "d6" },
            ],
            view: { scale: 0.85, panX: 20, panY: 10 },
        };
    }

    function buildSmartSniperScenario() {
        return {
            title: "Умный снайпер (ИИ + фильтр)",
            nodes: [
                { id: "s1", type: "start", x: 40, y: 260, start: { globalError: true } },
                {
                    id: "s2", type: "request", x: 260, y: 240,
                    request: {
                        method: "GET", url: "https://prod-api.lzt.market/steam",
                        params: { pmax: "200", order_by: "price_to_up" },
                        body: null, headers: {}, title: "Поиск Steam",
                        retries: 1, retryDelay: 1500, timeout: 15, respectRateLimit: true,
                    },
                },
                {
                    id: "s3", type: "filter", x: 520, y: 240,
                    filter: { source: "last.items", field: "price", op: "<=", value: "150", saveAs: "filtered" },
                },
                {
                    id: "s4", type: "ai", x: 780, y: 240,
                    ai: {
                        batch: true, batchLimit: 50, source: "vars.filtered",
                        outputVar: "ai_result",
                        prompt: "Оцени лоты Steam. Верни JSON: {\"items\":[{\"item_id\":N,\"buy\":true,\"score\":1-10,\"reason\":\"...\"}]} только где buy=true и score>=7.",
                        preset: "steam_batch",
                    },
                },
                {
                    id: "s5", type: "condition", x: 1040, y: 240,
                    condition: { left: "vars.ai_result", op: "exists", right: "" },
                },
                {
                    id: "s6", type: "sniper", x: 1300, y: 180,
                    sniper: { source: "vars.ai_result.items", maxPrice: "150", maxSpend: "3000", priceField: "price", itemField: "item_id" },
                },
                { id: "s7", type: "stop", x: 1580, y: 180 },
                { id: "s8", type: "stop", x: 1300, y: 340 },
            ],
            edges: [
                { id: "se1", from: "s1", fromPort: "out", to: "s2" },
                { id: "se2", from: "s2", fromPort: "success", to: "s3" },
                { id: "se3", from: "s3", fromPort: "found", to: "s4" },
                { id: "se4", from: "s4", fromPort: "success", to: "s5" },
                { id: "se5", from: "s5", fromPort: "true", to: "s6" },
                { id: "se6", from: "s6", fromPort: "bought", to: "s7" },
                { id: "se7", from: "s6", fromPort: "skip", to: "s7" },
                { id: "se8", from: "s5", fromPort: "false", to: "s8" },
                { id: "se9", from: "s3", fromPort: "empty", to: "s8" },
            ],
            view: { scale: 0.72, panX: 10, panY: 0 },
        };
    }

    window.LZTDemo = {
        MOCK_ITEMS,
        mockApiTest,
        mockAiResponse,
        buildDemoScenario,
        buildSmartSniperScenario,
    };
})();
