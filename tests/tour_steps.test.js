// Мета шагов spotlight-тура (tour/steps.js)
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.dirname(__dirname);
global.window = {};
global.document = {
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
};
global.I18N = { t: (key) => key };

eval(fs.readFileSync(path.join(root, "web/js/tour/util.js"), "utf8"));
eval(fs.readFileSync(path.join(root, "web/js/tour/spotlight.js"), "utf8"));
eval(fs.readFileSync(path.join(root, "web/js/tour/helpers.js"), "utf8"));
eval(fs.readFileSync(path.join(root, "web/js/tour/steps.js"), "utf8"));

const { STEP_META, steps, stepLabel } = window.TourSteps;

let passed = 0;
function ok(name, fn) {
    fn();
    passed++;
    console.log("PASS " + name);
}

ok("STEP_META: 13 шагов", () => {
    assert.strictEqual(STEP_META.length, 13);
});

ok("STEP_META: уникальные id", () => {
    const ids = STEP_META.map(s => s.id);
    assert.strictEqual(new Set(ids).size, ids.length);
});

ok("steps(): title/text из i18n ключей", () => {
    const list = steps();
    assert.strictEqual(list.length, 13);
    assert.strictEqual(list[0].id, "lang");
    assert.strictEqual(list[0].title, "tour.s0.title");
    assert.ok(list[0].text.includes("tour."));
});

ok("stepLabel: подстановка n/total", () => {
    const label = stepLabel(2, 13);
    assert.ok(label.includes("3"));
    assert.ok(label.includes("13"));
});

ok("центральные шаги: lang, welcome, done", () => {
    const centerIds = STEP_META.filter(s => s.center).map(s => s.id);
    assert.deepStrictEqual(centerIds, ["lang", "welcome", "done"]);
});

ok("интерактивные шаги: task-флаг", () => {
    const tasks = STEP_META.filter(s => s.task).map(s => s.id);
    assert.deepStrictEqual(tasks, [
        "addBlockOpen", "addBlockPick", "requestEdit", "connect", "demo",
    ]);
});

console.log("\n" + passed + " passed");
