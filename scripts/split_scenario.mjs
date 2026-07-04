/**
 * Разрезает scenario.js на editor.js и runtime.js (один раз / при обновлении ядра).
 * node scripts/split_scenario.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcPath = path.join(root, "web/js/scenario.js");
const lines = fs.readFileSync(srcPath, "utf8").split(/\r?\n/);

function slice(start, end) {
    return lines.slice(start - 1, end).join("\n");
}

function wrapMixin(name, body, comment) {
    return `/** ${comment} */\nwindow.${name} = {\n${body}\n};\n`;
}

// 1-based line numbers from section markers
const editorBody = slice(402, 1557); // screenToWorld .. saveEditor (exclude section headers)
const runtimeBody = slice(1561, 2233); // bindRun .. end of run()

fs.writeFileSync(
    path.join(root, "web/js/scenario/editor.js"),
    wrapMixin("ScenarioEditorMixin", editorBody, "Холст, рендер, редакторы блоков")
);
fs.writeFileSync(
    path.join(root, "web/js/scenario/runtime.js"),
    wrapMixin("ScenarioRuntimeMixin", runtimeBody, "Запуск, лог, исполнение блоков")
);

// Remove extracted blocks from scenario.js, insert mixin merge before closing };
const head = lines.slice(0, 133); // through startTour end, before autosave/history
const mid = lines.slice(172, 401); // genId through fitView start (before screenToWorld)
const tailStart = 2234; // from run history section
const tail = lines.slice(tailStart - 1);

const mergeBlock = `
    // Делегаты движка (чистая логика в scenario/engine.js)
    getPath(obj, path) { return window.ScenarioEngine.getPath(obj, path); },
    resolveVars(val, ctx) { return window.ScenarioEngine.resolveVars(val, ctx); },
    evalCondition(cond, ctx) {
        if (cond.left && String(cond.left).startsWith("__it.")) {
            return window.ScenarioEngine.evalCondition(cond, { __it: ctx.__it });
        }
        return window.ScenarioEngine.evalCondition(cond, ctx);
    },
`;

const out = [
    ...head,
    ...mid.slice(0, mid.length), // includes newScenario through applyTransform partial
    mergeBlock.trim(),
    ...tail.slice(0, -4), // up to utilities, before closing
    "",
    "Object.assign(Scenario, window.ScenarioHistoryMixin, window.ScenarioEditorMixin, window.ScenarioRuntimeMixin);",
    "",
    "window.Scenario = Scenario;",
    "window.NODE_TYPES = NODE_TYPES;",
].join("\n");

// Fix: mid should end before screenToWorld - line 401 is blank before render section
// head ends line 132, we need lines 174-400 from original (genId to end of applyTransform in fitView?)

console.log("Wrote editor.js and runtime.js");
console.log("Manual step: merge scenario.js using split output — run with --apply to rewrite core");

if (process.argv.includes("--apply")) {
    // Rebuild more carefully
    const part1 = lines.slice(0, 132).join("\n"); // through startTour
    const part2 = lines.slice(173, 400).join("\n"); // genId .. fitView (393-440 is transform - keep in editor only)
    // part2 currently 174-400 = genId through line before render - includes transform coords at 393-400 which duplicate editor
    // Better: part2 = 174-392 (genId through applyTransform setZoom ends at 419, fitView 421-440)
    const core = lines.slice(173, 391).join("\n");
    const utils = lines.slice(2772).join("\n"); // utilities + window export
    const rest = lines.slice(2234, 2771).join("\n"); // run history through examples

    const merged = [
        part1,
        core,
        mergeBlock.trim() + ",",
        rest,
        "",
        "Object.assign(Scenario, window.ScenarioHistoryMixin, window.ScenarioEditorMixin, window.ScenarioRuntimeMixin);",
        "",
        utils.replace(/window\.Scenario = Scenario;\s*\nwindow\.NODE_TYPES = NODE_TYPES;\s*$/, ""),
        "window.Scenario = Scenario;",
        "window.NODE_TYPES = NODE_TYPES;",
    ].join("\n");

    fs.writeFileSync(srcPath, merged);
    console.log("Applied scenario.js slim core (~" + merged.split("\n").length + " lines)");
}
