// Тесты нормализации AI-сценариев (scenario_normalize.js).
// Запуск: node tests/scenario_normalize.test.js
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.dirname(__dirname);
global.window = {};

function load(rel) { eval(fs.readFileSync(path.join(root, rel), "utf8")); }
load("web/js/scenario_normalize.js");

const SN = window.ScenarioNormalize;
let passed = 0;
function ok(name, fn) { fn(); passed++; console.log("PASS " + name); }

ok("normalize: request без request → url fortnite", () => {
    const sc = SN.validateScenarioObj({
        title: "Fortnite parser",
        nodes: [{ id: "n1", type: "request", x: 100, y: 100 }],
        edges: [],
    });
    const req = sc.nodes.find(n => n.type === "request");
    assert.ok(req.request);
    assert.ok(req.request.url.includes("fortnite"));
});

ok("normalize: добавляет start если нет", () => {
    const sc = SN.validateScenarioObj({
        title: "t",
        nodes: [{ id: "n1", type: "delay", x: 0, y: 0, delay: { ms: 1000 } }],
        edges: [],
    });
    assert.ok(sc.nodes.some(n => n.type === "start"));
});

ok("normalize: filter получает defaults", () => {
    const sc = SN.validateScenarioObj({
        title: "t",
        nodes: [{ id: "n1", type: "filter", x: 0, y: 0 }],
        edges: [],
    });
    const f = sc.nodes.find(n => n.type === "filter");
    assert.strictEqual(f.filter.field, "price");
    assert.strictEqual(f.filter.source, "last.items");
});

ok("normalize: пустой сценарий бросает", () => {
    assert.throws(() => SN.validateScenarioObj({ nodes: [] }));
});

ok("layout: цепочка слева направо", () => {
    const sc = SN.validateScenarioObj({
        title: "t",
        nodes: [
            { id: "n1", type: "start" },
            { id: "n2", type: "request" },
            { id: "n3", type: "filter" },
        ],
        edges: [
            { id: "e1", from: "n1", fromPort: "out", to: "n2" },
            { id: "e2", from: "n2", fromPort: "success", to: "n3" },
        ],
    }, { autoLayout: true });
    const start = sc.nodes.find(n => n.type === "start");
    const req = sc.nodes.find(n => n.type === "request");
    const filt = sc.nodes.find(n => n.type === "filter");
    assert.ok(start.x < req.x, "start left of request");
    assert.ok(req.x < filt.x, "request left of filter");
    assert.strictEqual(sc.layout, "auto");
});

ok("layout: ветки filter на разной высоте", () => {
    const sc = SN.validateScenarioObj({
        title: "t",
        nodes: [
            { id: "n1", type: "start" },
            { id: "n2", type: "request" },
            { id: "n3", type: "filter" },
            { id: "n4", type: "notify" },
            { id: "n5", type: "stop" },
        ],
        edges: [
            { id: "e1", from: "n1", fromPort: "out", to: "n2" },
            { id: "e2", from: "n2", fromPort: "success", to: "n3" },
            { id: "e3", from: "n3", fromPort: "found", to: "n4" },
            { id: "e4", from: "n3", fromPort: "empty", to: "n5" },
        ],
    }, { autoLayout: true });
    const notify = sc.nodes.find(n => n.type === "notify");
    const stop = sc.nodes.find(n => n.type === "stop");
    assert.notStrictEqual(notify.y, stop.y, "branches should differ in y");
});

console.log("\n" + passed + " passed");
if (passed !== 6) process.exit(1);
