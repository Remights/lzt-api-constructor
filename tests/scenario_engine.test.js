// Тесты движка сценариев (loop, condition, foreach, filter).
// Запуск: node tests/scenario_engine.test.js
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.dirname(__dirname);
global.window = {};
eval(fs.readFileSync(path.join(root, "web/js/scenario/engine.js"), "utf8"));
const E = window.ScenarioEngine;

let passed = 0;
function ok(name, fn) { fn(); passed++; console.log("PASS " + name); }

ok("condition: last.items.length > 0", () => {
    assert.strictEqual(E.evalCondition({ left: "last.items.length", op: ">", right: "0" }, { last: { items: [1, 2] } }), true);
    assert.strictEqual(E.evalCondition({ left: "last.items.length", op: ">", right: "0" }, { last: { items: [] } }), false);
});

ok("condition: exists", () => {
    assert.strictEqual(E.evalCondition({ left: "vars.x", op: "exists", right: "" }, { vars: { x: 1 } }), true);
    assert.strictEqual(E.evalCondition({ left: "vars.x", op: "exists", right: "" }, { vars: {} }), false);
});

ok("condition: right resolves {{vars}}", () => {
    assert.strictEqual(E.evalCondition({ left: "vars.id", op: "==", right: "{{vars.target}}" }, { vars: { id: "42", target: "42" } }), true);
    assert.strictEqual(E.evalCondition({ left: "vars.id", op: "==", right: "{{vars.target}}" }, { vars: { id: "1", target: "2" } }), false);
});

ok("filter: price <= 100", () => {
    const ctx = { last: { items: [{ price: 50 }, { price: 150 }] } };
    const r = E.applyFilter({ source: "last.items", field: "price", op: "<=", value: "100" }, ctx);
    assert.strictEqual(r.items.length, 1);
    assert.strictEqual(r.items[0].price, 50);
});

ok("loop: body then done", () => {
    const c = {};
    const n = "loop1";
    let s = E.stepLoop(n, 3, c);
    assert.strictEqual(s.port, "body");
    assert.strictEqual(s.iteration, 1);
    s = E.stepLoop(n, 3, c);
    assert.strictEqual(s.port, "body");
    s = E.stepLoop(n, 3, c);
    assert.strictEqual(s.port, "body");
    s = E.stepLoop(n, 3, c);
    assert.strictEqual(s.port, "done");
    assert.strictEqual(s.finished, true);
    assert.strictEqual(c[n], 0);
});

ok("foreach: iterates items", () => {
    const c = {};
    const arr = [{ id: 1 }, { id: 2 }];
    let s = E.stepForeach("fe1", arr, c);
    assert.strictEqual(s.port, "body");
    assert.strictEqual(s.item.id, 1);
    s = E.stepForeach("fe1", arr, c);
    assert.strictEqual(s.port, "body");
    assert.strictEqual(s.item.id, 2);
    s = E.stepForeach("fe1", arr, c);
    assert.strictEqual(s.port, "done");
    assert.strictEqual(s.finished, true);
});

ok("resolveVars: подстановка {{vars.name}}", () => {
    const out = E.resolveVars("Hello {{vars.name}}!", { vars: { name: "LZT" } });
    assert.strictEqual(out, "Hello LZT!");
});

ok("lztResponseOk: HTTP 200 + errors = fail", () => {
    assert.strictEqual(E.lztResponseOk(200, { errors: [{ message: "x" }] }), false);
    assert.strictEqual(E.lztResponseOk(200, { error: "no" }), false);
    assert.strictEqual(E.lztResponseOk(200, { items: [] }), true);
    assert.strictEqual(E.lztResponseOk(400, {}), false);
});

ok("isRetryRequest", () => {
    assert.strictEqual(E.isRetryRequest({ errors: [{ message: "retry_request" }] }), true);
    assert.strictEqual(E.isRetryRequest({ ok: true }), false);
});

console.log("\n" + passed + " passed");
if (passed !== 9) process.exit(1);
