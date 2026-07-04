// Node-тесты JS-генераторов: сниппет кода (codegen.js), парсер curl и AI-генератор (assistant.js).
// Запуск: node tests/js_generators.test.js
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.dirname(__dirname);
global.window = {};
global.document = { addEventListener: function () {} };
global.localStorage = { getItem: () => null, setItem: () => {} };

function load(rel) { eval(fs.readFileSync(path.join(root, rel), "utf8")); }
load("web/js/codegen.js");
load("web/js/scenario_normalize.js");
load("web/js/assistant.js");

let passed = 0;
function ok(name, fn) { fn(); passed++; console.log("PASS " + name); }

// ---- Codegen: сниппет одиночного запроса ----
ok("codegen: 8 языков", () => {
    const out = window.Codegen.generateAll({ url: "https://prod-api.lzt.market/steam", method: "GET", params: { pmax: 100 }, headers: { Accept: "application/json" } });
    const keys = ["python_requests", "python_aiohttp", "js_fetch", "js_axios", "curl", "csharp", "php", "go"];
    keys.forEach(k => assert.ok(out[k] && out[k].length > 0, "нет " + k));
});

ok("codegen: GET requests содержит url и params", () => {
    const out = window.Codegen.generateAll({ url: "https://prod-api.lzt.market/steam", method: "GET", params: { pmax: 100 }, headers: {} });
    assert.ok(out.python_requests.includes("import requests"));
    assert.ok(out.python_requests.includes("https://prod-api.lzt.market/steam"));
    assert.ok(out.python_requests.includes("requests.get"));
});

ok("codegen: POST добавляет тело", () => {
    const out = window.Codegen.generateAll({ url: "https://prod-api.lzt.market/x/fast-buy", method: "POST", params: {}, headers: {}, body: { price: 100 } });
    assert.ok(out.python_requests.includes("data ="));
    assert.ok(out.php.includes("CURLOPT_POSTFIELDS"));
    assert.ok(out.go.includes("bytes.NewBufferString"));
});

ok("codegen: fullUrl склеивает query", () => {
    assert.strictEqual(window.Codegen.fullUrl("https://a.b/c", { x: 1, y: 2 }), "https://a.b/c?x=1&y=2");
    assert.strictEqual(window.Codegen.fullUrl("https://a.b/c?z=0", { x: 1 }), "https://a.b/c?z=0&x=1");
});

// ---- Assistant: парсер curl ----
ok("curl: GET с query и заголовками", () => {
    const r = window.Assistant.parseCurl("curl 'https://prod-api.lzt.market/steam?pmax=100' -H 'Accept: application/json'");
    assert.strictEqual(r.method, "GET");
    assert.strictEqual(r.url, "https://prod-api.lzt.market/steam");
    assert.strictEqual(r.params.pmax, "100");
    assert.strictEqual(r.headers.Accept, "application/json");
});

ok("curl: POST с данными → метод POST и тело", () => {
    const r = window.Assistant.parseCurl("curl -X POST https://prod-api.lzt.market/1/fast-buy -d 'price=100&currency=rub'");
    assert.strictEqual(r.method, "POST");
    assert.deepStrictEqual(r.body, { price: "100", currency: "rub" });
});

ok("curl: токен авторизации не тащим в блок", () => {
    const r = window.Assistant.parseCurl("curl https://api.lzt.market/me -H 'Authorization: Bearer SECRET'");
    assert.ok(!("Authorization" in r.headers));
});

ok("curl: не-curl бросает ошибку", () => {
    assert.throws(() => window.Assistant.parseCurl("wget https://a.b"));
});

// ---- Assistant: AI-генератор сценария (бесплатный) ----
ok("ai: монитор с фильтром/уведомлением/циклом", () => {
    const sc = window.Assistant.generateScenarioFromText("каждые 5 минут ищи стим дешевле 100 и шли в телеграм");
    const types = sc.nodes.map(n => n.type);
    assert.ok(types.includes("start"));
    assert.ok(types.includes("request"));
    assert.ok(types.includes("filter"));
    assert.ok(types.includes("notify"));
    assert.ok(types.includes("delay")); // цикл по времени
    const req = sc.nodes.find(n => n.type === "request");
    assert.strictEqual(req.request.params.pmax, "100");
    assert.ok(req.request.url.includes("/steam"));
    assert.strictEqual(sc.layout, "auto");
    assert.ok(req.x > sc.nodes.find(n => n.type === "start").x);
});

ok("ai: баланс → эндпоинт /me", () => {
    const sc = window.Assistant.generateScenarioFromText("проверь мой баланс");
    const req = sc.nodes.find(n => n.type === "request");
    assert.ok(req.request.url.endsWith("/me"));
});

ok("ai: сохранение в csv", () => {
    const sc = window.Assistant.generateScenarioFromText("найди телеграм дешевле 50 и сохрани в csv");
    const sf = sc.nodes.find(n => n.type === "savefile");
    assert.ok(sf, "нет блока savefile");
    assert.strictEqual(sf.savefile.format, "csv");
});

ok("ai: extractJson вытаскивает JSON из markdown", () => {
    const obj = window.Assistant.extractJson("```json\n{\"a\":1}\n```");
    assert.strictEqual(obj.a, 1);
});

console.log("\nВсего пройдено: " + passed);
