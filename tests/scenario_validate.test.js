// Валидация графа сценария (scenario/validate.js)
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.dirname(__dirname);
global.window = {};
eval(fs.readFileSync(path.join(root, "web/js/scenario/constants.js"), "utf8"));
eval(fs.readFileSync(path.join(root, "web/js/scenario/validate.js"), "utf8"));
const V = window.ScenarioValidate;

let passed = 0;
function ok(name, fn) { fn(); passed++; console.log("PASS " + name); }

ok("validate: нет старта", () => {
    const r = V.validate([{ id: "n1", type: "request" }], [], {});
    assert.ok(r.errors.some(e => e.includes("Старт")));
});

ok("validate: старт без связи", () => {
    const r = V.validate(
        [{ id: "s", type: "start" }, { id: "r", type: "request", request: { url: "https://a.b" } }],
        [],
        { hasToken: true }
    );
    assert.ok(r.errors.some(e => e.includes("Старт")));
});

ok("validate: сирота — warning", () => {
    const nodes = [
        { id: "s", type: "start" },
        { id: "r", type: "request", request: { url: "https://a.b" } },
        { id: "x", type: "delay", delay: { ms: 1000 } },
    ];
    const edges = [{ id: "e1", from: "s", fromPort: "out", to: "r" }];
    const r = V.validate(nodes, edges, { hasToken: true });
    assert.ok(r.warnings.some(w => w.includes("не подключён")));
});

ok("validate: ok минимальный сценарий", () => {
    const nodes = [
        { id: "s", type: "start" },
        { id: "r", type: "request", request: { url: "https://prod-api.lzt.market/steam" } },
    ];
    const edges = [{ id: "e1", from: "s", fromPort: "out", to: "r" }];
    const r = V.validate(nodes, edges, { hasToken: true });
    assert.strictEqual(r.errors.length, 0);
});

ok("validate: необязательный выход «Ошибка» — без warning", () => {
    const nodes = [
        { id: "s", type: "start" },
        { id: "r", type: "request", request: { url: "https://prod-api.lzt.market/steam" } },
        { id: "c", type: "condition", condition: { left: "last.items.length", op: ">", right: "0" } },
    ];
    const edges = [
        { id: "e1", from: "s", fromPort: "out", to: "r" },
        { id: "e2", from: "r", fromPort: "success", to: "c" },
    ];
    const r = V.validate(nodes, edges, { hasToken: true });
    assert.ok(!r.warnings.some(w => w.includes("Ошибка")));
});

console.log("\n" + passed + " passed");
if (passed !== 5) process.exit(1);
