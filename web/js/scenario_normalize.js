/**
 * Нормализация и авто-раскладка сценариев из AI / импорта.
 */
(function () {
    const LAYOUT = {
        startX: 60,
        startY: 260,
        colStep: 320,
        rowStep: 140,
        loopDrop: 190,
    };

    const PORT_RANK = {
        out: 0, success: 0, true: 0, found: 0, ok: 0, bought: 0, body: 0,
        false: 1, empty: 1, skip: 1, done: 1, fail: 2, error: 2, onerror: 2,
    };

    function fixMarketUrl(url) {
        if (!url) return url;
        return String(url)
            .replace(/\/genshin-impact(?=\/|\?|$)/i, "/mihoyo")
            .replace(/\/gta5(?=\/|\?|$)/i, "/socialclub")
            .replace(/\/valorant(?=\/|\?|$)/i, "/riot");
    }

    function inferMarketUrl(node, scTitle) {
        const text = ((node.request && node.request.title) || "") + " " + (scTitle || "");
        const t = text.toLowerCase();
        const map = {
            fortnite: "fortnite", steam: "steam", telegram: "telegram", discord: "discord",
            roblox: "roblox", minecraft: "minecraft", mihoyo: "mihoyo", genshin: "mihoyo",
            riot: "riot", valorant: "riot", gta: "socialclub", socialclub: "socialclub",
        };
        for (const [kw, slug] of Object.entries(map)) {
            if (t.includes(kw)) return "https://prod-api.lzt.market/" + slug;
        }
        return "https://prod-api.lzt.market/steam";
    }

    function normalizeScenarioNode(n, scTitle) {
        if (!n || !n.type) return null;
        const out = { ...n };
        if (typeof out.x !== "number") out.x = LAYOUT.startX;
        if (typeof out.y !== "number") out.y = LAYOUT.startY;
        if (!out.id) out.id = "n_" + Math.random().toString(36).slice(2, 8);

        switch (out.type) {
            case "request":
                out.request = {
                    method: "GET", url: "", params: {}, body: null, headers: {},
                    title: "Запрос", retries: 2, retryDelay: 1500, timeout: 20, respectRateLimit: true,
                    ...(out.request || {}),
                };
                if (!out.request.url) out.request.url = inferMarketUrl(out, scTitle);
                else out.request.url = fixMarketUrl(out.request.url);
                if (!out.request.method) out.request.method = "GET";
                break;
            case "filter":
                out.filter = { source: "last.items", field: "price", op: "<=", value: "0", saveAs: "filtered", ...(out.filter || {}) };
                break;
            case "notify":
                out.notify = { channel: "telegram", tgToken: "", tgChat: "", discordUrl: "", text: "", ...(out.notify || {}) };
                break;
            case "delay":
                out.delay = { ms: 5000, ...(out.delay || {}) };
                break;
            case "condition":
                out.condition = { left: "last.items.length", op: ">", right: "0", ...(out.condition || {}) };
                break;
            case "loop":
                out.loop = { times: 3, ...(out.loop || {}) };
                break;
            case "variable":
                out.variable = { name: "var", path: "last.items", ...(out.variable || {}) };
                break;
            case "logmsg":
                out.logmsg = { text: "", ...(out.logmsg || {}) };
                break;
            case "savefile":
                out.savefile = { source: "last.items", format: "csv", filename: "results", ...(out.savefile || {}) };
                break;
            case "proxy":
                out.proxy = { list: "", mode: "rotate", ...(out.proxy || {}) };
                break;
            case "foreach":
                out.foreach = { source: "last.items", itemVar: "item", ...(out.foreach || {}) };
                break;
            case "checker":
                out.checker = { itemPath: "last.item_id", rejectSold: true, ...(out.checker || {}) };
                break;
            case "sniper":
                out.sniper = { source: "last.items", maxPrice: "100", maxSpend: "5000", ...(out.sniper || {}) };
                break;
            case "ai":
                out.ai = {
                    batch: true, batchLimit: 50, source: "last.items", outputVar: "ai_result",
                    prompt: "Оцени лоты. Верни JSON {\"items\":[{\"item_id\":N,\"buy\":true,\"score\":8,\"reason\":\"...\"}]}",
                    preset: "steam_batch",
                    ...(out.ai || {}),
                };
                break;
            case "script":
                out.script = { filename: "hook_example.py", timeout: 30, saveAs: "script_out", ...(out.script || {}) };
                break;
            case "subscenario":
                out.subscenario = { templateId: "", ...(out.subscenario || {}) };
                break;
        }
        return out;
    }

    function isBackEdge(e, layer, byId) {
        const fromL = layer[e.from];
        const toL = layer[e.to];
        if (fromL == null || toL == null) return false;
        if (toL > fromL) return false;
        const fromType = byId[e.from]?.type;
        const toType = byId[e.to]?.type;
        if (fromType === "delay" && toType === "request") return true;
        if (fromType === "loop" && e.fromPort === "body") return true;
        if (fromType === "foreach" && e.fromPort === "body") return true;
        return toL <= fromL;
    }

    /** Авто-раскладка блоков слева направо по связям edges (как в scenario.json). */
    function layoutScenario(sc) {
        if (!sc || !Array.isArray(sc.nodes) || !sc.nodes.length) return sc;
        const nodes = sc.nodes;
        const edges = Array.isArray(sc.edges) ? sc.edges : [];
        const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
        const start = nodes.find(n => n.type === "start");
        if (!start) return sc;

        const outs = {};
        nodes.forEach(n => { outs[n.id] = []; });
        edges.forEach(e => {
            if (byId[e.from] && byId[e.to]) outs[e.from].push(e);
        });

        const layer = {};
        layer[start.id] = 0;
        let changed = true;
        let guard = 0;
        while (changed && guard++ < nodes.length * 4) {
            changed = false;
            edges.forEach(e => {
                if (!byId[e.from] || !byId[e.to] || layer[e.from] == null) return;
                if (isBackEdge(e, layer, byId)) return;
                const next = layer[e.from] + 1;
                if (layer[e.to] == null || next > layer[e.to]) {
                    layer[e.to] = next;
                    changed = true;
                }
            });
        }

        let maxLayer = Math.max(0, ...Object.values(layer).filter(v => typeof v === "number"));
        nodes.forEach(n => {
            if (layer[n.id] == null) layer[n.id] = ++maxLayer;
        });

        const rank = {};
        let seq = 0;
        rank[start.id] = seq++;
        const q = [start.id];
        const seen = new Set([start.id]);
        while (q.length) {
            const id = q.shift();
            (outs[id] || []).forEach(e => {
                if (seen.has(e.to)) return;
                seen.add(e.to);
                rank[e.to] = seq++;
                q.push(e.to);
            });
        }
        nodes.forEach(n => {
            if (rank[n.id] == null) rank[n.id] = seq++;
        });

        const layers = {};
        nodes.forEach(n => {
            const L = layer[n.id];
            if (!layers[L]) layers[L] = [];
            layers[L].push(n.id);
        });

        const sortScore = (id) => {
            const parents = edges.filter(e => e.to === id && byId[e.from]);
            if (!parents.length) return rank[id] * 1000;
            let sum = 0;
            parents.forEach(e => {
                sum += (byId[e.from].y || 0) + (PORT_RANK[e.fromPort] ?? 1) * 40 + (rank[e.from] ?? 0);
            });
            return sum / parents.length;
        };

        Object.keys(layers).forEach(L => {
            layers[L].sort((a, b) => sortScore(a) - sortScore(b) || (rank[a] - rank[b]));
        });

        Object.keys(layers).sort((a, b) => +a - +b).forEach(L => {
            const ids = layers[L];
            const mid = (ids.length - 1) / 2;
            ids.forEach((id, i) => {
                byId[id].x = LAYOUT.startX + (+L) * LAYOUT.colStep;
                byId[id].y = Math.round(LAYOUT.startY + (i - mid) * LAYOUT.rowStep);
            });
        });

        nodes.filter(n => n.type === "delay").forEach(n => {
            const back = edges.find(e => e.from === n.id && byId[e.to] && layer[e.to] < layer[n.id]);
            if (back) {
                const target = byId[back.to];
                n.x = target.x;
                n.y = target.y + LAYOUT.loopDrop;
            }
        });

        nodes.filter(n => n.type === "stop").forEach(n => {
            const parent = edges.find(e => e.to === n.id && byId[e.from]);
            if (parent) {
                const p = byId[parent.from];
                n.x = p.x + LAYOUT.colStep;
                n.y = p.y + ((PORT_RANK[parent.fromPort] ?? 0) - 0.5) * 50;
            }
        });

        sc.view = Object.assign({ scale: 0.85, panX: 20, panY: 10 }, sc.view || {});
        sc.layout = "auto";
        return sc;
    }

    function scenarioJsonPrompt() {
        return [
            "Формат scenario.json (координаты x/y НЕ нужны — конструктор расставит блоки сам):",
            '{ "title": "Название", "nodes": [...], "edges": [...] }',
            "nodes[]: { id, type, ...поля типа }. edges[]: { id, from, fromPort, to }.",
            "Типы: start, request, condition, filter, loop, foreach, variable, delay, notify, savefile, logmsg, proxy, checker, sniper, ai, script, subscenario, stop.",
            "Порты: start→out|onerror; request→success|error; condition→true|false; filter→found|empty; loop|foreach→body|done; checker→ok|fail; sniper→bought|skip|fail; ai|script→success|error; остальные→out.",
            "Подстановки: {{last.items.length}}, {{vars.filtered}}, {{vars.hook}}, {{vars.item_id}}.",
            "Пример цепочки: start.out→request→filter.found→notify→delay→(обратно request) или stop.",
        ].join("\n");
    }

    function validateScenarioObj(sc, opts) {
        opts = opts || {};
        if (!sc || !Array.isArray(sc.nodes) || !sc.nodes.length) throw new Error("AI вернул пустой сценарий");
        const title = sc.title || "Сценарий";
        sc.nodes = sc.nodes.map(n => normalizeScenarioNode(n, title)).filter(Boolean);
        if (!sc.nodes.some(n => n.type === "start")) {
            sc.nodes.unshift({ id: "n_start", type: "start", x: LAYOUT.startX, y: LAYOUT.startY });
        }
        sc.edges = Array.isArray(sc.edges) ? sc.edges : [];
        if (!sc.view) sc.view = { scale: 0.85, panX: 20, panY: 10 };
        if (opts.autoLayout) layoutScenario(sc);
        return sc;
    }

    window.ScenarioNormalize = {
        fixMarketUrl,
        inferMarketUrl,
        normalizeScenarioNode,
        layoutScenario,
        scenarioJsonPrompt,
        validateScenarioObj,
    };
})();
