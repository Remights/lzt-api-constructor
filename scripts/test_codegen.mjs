import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const sample = {
    title: "Тест всех блоков",
    nodes: [
        { id: "start1", type: "start", x: 0, y: 0, start: { globalError: true } },
        { id: "req1", type: "request", x: 100, y: 0, request: { method: "GET", url: "https://prod-api.lzt.market/", params: { page: "1" } } },
        { id: "filt1", type: "filter", x: 200, y: 0, filter: { source: "last.items", field: "price", op: "<=", value: "1000", saveAs: "filtered" } },
        { id: "cond1", type: "condition", x: 300, y: 0, condition: { left: "vars.filtered.length", op: ">", right: "0" } },
        { id: "fe1", type: "foreach", x: 400, y: 0, foreach: { source: "vars.filtered", itemVar: "item", indexVar: "i" } },
        { id: "chk1", type: "checker", x: 500, y: 0, checker: { itemPath: "vars.item.item_id", rejectSold: true } },
        { id: "sn1", type: "sniper", x: 600, y: 0, sniper: { source: "vars.filtered", maxPrice: "100", maxSpend: "5000", priceField: "price", itemField: "item_id" } },
        { id: "ai1", type: "ai", x: 700, y: 0, ai: { batch: true, source: "vars.filtered", outputVar: "ai_result", prompt: "Оцени" } },
        { id: "var1", type: "variable", x: 800, y: 0, variable: { name: "top_id", path: "last.items.0.item_id" } },
        { id: "notify1", type: "notify", x: 900, y: 0, notify: { channel: "telegram", tgToken: "", tgChat: "", text: "done" } },
        { id: "save1", type: "savefile", x: 1000, y: 0, savefile: { source: "vars.filtered", format: "json", filename: "results" } },
        { id: "proxy1", type: "proxy", x: 1100, y: 0, proxy: { list: "127.0.0.1:8080", mode: "rotate" } },
        { id: "loop1", type: "loop", x: 1200, y: 0, loop: { times: 2 } },
        { id: "delay1", type: "delay", x: 1300, y: 0, delay: { ms: 100 } },
        { id: "log1", type: "logmsg", x: 1400, y: 0, logmsg: { text: "ok" } },
        { id: "sub1", type: "subscenario", x: 1500, y: 0, subscenario: { templateId: "demo" } },
        { id: "stop1", type: "stop", x: 1600, y: 0 },
    ],
    edges: [
        { from: "start1", fromPort: "out", to: "req1" },
        { from: "req1", fromPort: "success", to: "filt1" },
        { from: "filt1", fromPort: "found", to: "cond1" },
        { from: "cond1", fromPort: "true", to: "fe1" },
        { from: "fe1", fromPort: "body", to: "chk1" },
        { from: "chk1", fromPort: "ok", to: "sn1" },
        { from: "sn1", fromPort: "skip", to: "ai1" },
        { from: "ai1", fromPort: "success", to: "var1" },
        { from: "var1", fromPort: "out", to: "notify1" },
        { from: "notify1", fromPort: "out", to: "save1" },
        { from: "save1", fromPort: "out", to: "proxy1" },
        { from: "proxy1", fromPort: "out", to: "loop1" },
        { from: "loop1", fromPort: "body", to: "delay1" },
        { from: "delay1", fromPort: "out", to: "log1" },
        { from: "loop1", fromPort: "done", to: "sub1" },
        { from: "sub1", fromPort: "out", to: "stop1" },
    ],
};

function makeScenario(data) {
    const S = {
        nodes: data.nodes,
        edges: data.edges,
        title: data.title,
        scriptLang: "python",
        serialize() { return { title: this.title, nodes: this.nodes, edges: this.edges }; },
        slugify(t) { return String(t || "bot").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "bot"; },
        getNode(id) { return this.nodes.find(n => n.id === id); },
        edgeTarget(from, port) {
            const e = this.edges.find(x => x.from === from && x.fromPort === port);
            return e ? e.to : null;
        },
    };
    return S;
}

const codegenSrc = fs.readFileSync(path.join(root, "web/js/scenario_codegen.js"), "utf8");
const langs = ["python", "python_async", "node", "bash", "php", "csharp", "go"];
const S = makeScenario(sample);
const ctx = { window: { Scenario: S }, console };
vm.createContext(ctx);
vm.runInContext(codegenSrc, ctx);

const markers = {
    bash: ["get_path", "notify_send", "fast-buy", "jq"],
    csharp: ["GetPathArray", "NotifyAsync", "fast-buy", "item_state"],
    go: ["getPath", "notifySend", "fast-buy", "toFloat"],
};

const errors = [];
for (const lang of langs) {
    try {
        const code = S.generateScriptForLang(lang);
        if (!code || code.length < 100) throw new Error("empty or too short output");
        if (markers[lang]) {
            for (const m of markers[lang]) {
                if (!code.includes(m) && !code.toLowerCase().includes(m.toLowerCase())) {
                    throw new Error(`missing marker: ${m}`);
                }
            }
        }
        const zip = S.buildProjectZipFiles(lang);
        console.log(`OK ${lang}: ${code.split("\n").length} lines`);
    } catch (e) {
        errors.push(`${lang}: ${e.message}`);
        console.error(`FAIL ${lang}:`, e.message);
    }
}

if (errors.length) process.exit(1);
console.log("All generators passed full-block scenario.");
