// Тесты шаринга сценариев и codegen новых блоков.
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.dirname(__dirname);
let passed = 0;
function ok(name, fn) { fn(); passed++; console.log("PASS " + name); }

function encodeShare(data) {
    const json = JSON.stringify(data);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return "LZT1:" + b64.replace(/=+$/, "");
}

function decodeShare(code) {
    const c = String(code || "").trim().replace(/^LZT1:/, "");
    const pad = c.length % 4 ? "=".repeat(4 - (c.length % 4)) : "";
    const json = decodeURIComponent(escape(atob(c + pad)));
    return JSON.parse(json);
}

ok("share: encode/decode roundtrip", () => {
    const src = { title: "Test", nodes: [{ id: "n1", type: "start" }], edges: [] };
    const code = encodeShare(src);
    assert.ok(code.startsWith("LZT1:"));
    const back = decodeShare(code);
    assert.strictEqual(back.title, "Test");
    assert.strictEqual(back.nodes.length, 1);
});

// --- scenario_codegen: foreach / sniper в Python ---
global.window = {};
global.NODE_TYPES = {
    start: { outs: [{ id: "out" }, { id: "onerror" }] },
    foreach: {}, checker: {}, sniper: {}, subscenario: {},
    request: {}, stop: {}
};
global.Scenario = {
    scriptLang: "python",
    nodes: [
        { id: "s", type: "start", start: { globalError: true } },
        { id: "f", type: "foreach", foreach: { source: "last.items", itemVar: "item", indexVar: "i" } },
        { id: "sn", type: "sniper", sniper: { source: "last.items", maxPrice: "50", maxSpend: "1000", priceField: "price", itemField: "item_id" } },
        { id: "r", type: "request", request: { method: "GET", url: "https://prod-api.lzt.market/steam", params: {}, body: null, title: "T", retries: 0, retryDelay: 1000, timeout: 15, respectRateLimit: true } },
    ],
    edges: [
        { from: "s", fromPort: "out", to: "f" },
        { from: "s", fromPort: "onerror", to: "sn" },
        { from: "f", fromPort: "body", to: "r" },
        { from: "sn", fromPort: "skip", to: "r" },
        { from: "r", fromPort: "success", to: "sn" },
        { from: "r", fromPort: "error", to: "s" },
    ],
    edgeTarget(from, port) {
        const e = this.edges.find(x => x.from === from && x.fromPort === port);
        return e ? e.to : null;
    },
    py(s) { return JSON.stringify(String(s)); },
    pyDict(obj) {
        return "{" + Object.entries(obj || {}).map(([k, v]) => this.py(k) + ": " + this.py(String(v))).join(", ") + "}";
    },
    pyFilterExpr() { return "True"; },
    pyComment(s) { return String(s); },
    flow() {
        const start = this.nodes.find(n => n.type === "start");
        return { startTarget: start ? this.edgeTarget(start.id, "out") : null, nodes: this.nodes.filter(n => n.type !== "start") };
    },
};
window.Scenario = global.Scenario;
eval(fs.readFileSync(path.join(root, "web/js/scenario_codegen.js"), "utf8"));

ok("codegen: foreach в Python", () => {
    const py = window.Scenario.generatePython();
    assert.ok(py.includes("_ki"), "нет счётчика foreach");
    assert.ok(py.includes("item"), "нет itemVar");
});

ok("codegen: sniper в Python", () => {
    const py = window.Scenario.generatePython();
    assert.ok(py.includes("fast-buy"), "нет fast-buy");
    assert.ok(py.includes("_lzt_spend"), "нет трекера трат");
});

ok("codegen: global error port", () => {
    const py = window.Scenario.generatePython();
    assert.ok(py.includes("do_request"), "нет запросов");
    assert.ok(window.Scenario._globalErrTarget(), "нет global err target");
});

ok("requirements: notify → requests + комментарии, без telegram/discord SDK", () => {
    const reqs = window.Scenario.buildProjectRequirements({
        nodes: [
            { id: "s", type: "start" },
            { id: "n1", type: "notify", notify: { channel: "both", tgToken: "", tgChat: "", discordUrl: "", text: "hi" } },
        ],
    });
    assert.ok(reqs.includes("requests>="), "нет requests");
    assert.ok(reqs.includes("Telegram"), "нет комментария Telegram");
    assert.ok(reqs.includes("Discord"), "нет комментария Discord");
    assert.ok(!/python-telegram-bot|discord\.py|aiogram|pytelegrambotapi/i.test(reqs), "лишние SDK");
});

ok("requirements: без notify — только requests", () => {
    const reqs = window.Scenario.buildProjectRequirements({
        nodes: [{ id: "s", type: "start" }, { id: "r", type: "request", request: {} }],
    });
    assert.strictEqual(reqs.trim(), "requests>=2.31.0");
});

console.log("\nВсего пройдено: " + passed);
