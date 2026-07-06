import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, "../web/js/scenario_codegen.js");
const src = fs.readFileSync(p, "utf8");
const startAssign = src.indexOf("Object.assign(window.Scenario, {");
const endAssign = src.lastIndexOf("});");
const body = src.slice(startAssign + "Object.assign(window.Scenario, {".length, endAssign);

const genPy = body.indexOf("    generatePython()");
const flowStart = body.indexOf("    flow()");
const zipStart = body.indexOf("    scriptGenerators()");
const buildReq = body.indexOf("    buildProjectRequirements(data)");

const zipPart = body.slice(zipStart, flowStart);
const helpersPart = body.slice(flowStart, genPy);
const generatorsPart = body.slice(genPy, buildReq);
const readmePart = body.slice(buildReq);

function wrap(name, content) {
    return `// scenario/codegen/${name}.js — подмешивается в window.Scenario
(function () {
    "use strict";
    if (!window.Scenario) { console.error("scenario_codegen/${name}: window.Scenario не найден"); return; }
    Object.assign(window.Scenario, {${content}
    });
})();
`;
}

const base = path.join(__dirname, "../web/js/scenario/codegen");
fs.mkdirSync(base, { recursive: true });
fs.writeFileSync(path.join(base, "zip.js"), wrap("zip", zipPart));
fs.writeFileSync(path.join(base, "helpers.js"), wrap("helpers", helpersPart));
fs.writeFileSync(path.join(base, "generators.js"), wrap("generators", generatorsPart + readmePart));

fs.writeFileSync(
    p,
    `// Точка входа codegen — модули в scenario/codegen/*.js (подключаются из index.html до scenario.js)
`
);

console.log("Split OK:", {
    zip: zipPart.split("\n").length,
    helpers: helpersPart.split("\n").length,
    generators: (generatorsPart + readmePart).split("\n").length,
});
