// Spotlight-геометрия тура (tour/spotlight.js)
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.dirname(__dirname);
global.window = {};
eval(fs.readFileSync(path.join(root, "web/js/tour/util.js"), "utf8"));
eval(fs.readFileSync(path.join(root, "web/js/tour/spotlight.js"), "utf8"));

const SL = window.TourSpotlight;

let passed = 0;
function ok(name, fn) {
    fn();
    passed++;
    console.log("PASS " + name);
}

ok("spotKey: квантование 2px", () => {
    const k1 = SL.spotKey([{ top: 100.1, left: 200.3, width: 50.1, height: 30.2 }]);
    const k2 = SL.spotKey([{ top: 100.9, left: 200.8, width: 50.9, height: 30.9 }]);
    assert.strictEqual(k1, k2);
});

ok("spotKey: разные rect → разный ключ", () => {
    const k1 = SL.spotKey([{ top: 10, left: 20, width: 100, height: 50 }]);
    const k2 = SL.spotKey([{ top: 30, left: 20, width: 100, height: 50 }]);
    assert.notStrictEqual(k1, k2);
});

ok("unionRect: объединение двух прямоугольников", () => {
    const u = SL.unionRect([
        { top: 0, left: 0, width: 10, height: 10 },
        { top: 5, left: 8, width: 10, height: 10 },
    ]);
    assert.deepStrictEqual(u, { top: 0, left: 0, width: 18, height: 15 });
});

ok("unionRect: пустой массив → null", () => {
    assert.strictEqual(SL.unionRect([]), null);
});

ok("rectsOverlap: пересекаются", () => {
    const a = { top: 0, left: 0, width: 10, height: 10 };
    const b = { top: 5, left: 5, width: 10, height: 10 };
    assert.strictEqual(SL.rectsOverlap(a, b), true);
});

ok("rectsOverlap: не пересекаются", () => {
    const a = { top: 0, left: 0, width: 10, height: 10 };
    const b = { top: 20, left: 20, width: 10, height: 10 };
    assert.strictEqual(SL.rectsOverlap(a, b), false);
});

ok("spotVisKey: pulse/glowOnly в ключе", () => {
    const g = "10:20:100:50";
    assert.notStrictEqual(
        SL.spotVisKey(g, { pulse: true, glowOnly: false }),
        SL.spotVisKey(g, { pulse: false, glowOnly: true })
    );
});

console.log("\n" + passed + " passed");
