import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const stylePath = path.join(root, "web/css/lzt_style.css");
const tourPath = path.join(root, "web/css/tour.css");

let css = fs.readFileSync(stylePath, "utf8");
const startMark = "/* Обучающий тур";
const endMark = ".log-row code { color: #e6a23c; font-family: monospace; }";
const aiMark = "/* AI: IDE-кomposer в модалке ассистента */";

const iStart = css.indexOf(startMark);
const iLog = css.indexOf(endMark, iStart);
const iAi = css.indexOf(aiMark, iLog + endMark.length);
if (iStart < 0 || iLog < 0 || iAi < 0) {
    console.error("markers not found", { iStart, iLog, iAi });
    process.exit(1);
}

const tourChunk = css.slice(iStart, iLog).replace(/^\/\* Обучающий тур[^\n]*\n\n?/, "");
const light = `:root[data-theme="light"] .tour-text b,
:root[data-theme="light"] .tour-title { color: #111; }
:root[data-theme="light"] .tour-ico { border-color: var(--border-color); }

`;
fs.writeFileSync(tourPath, `/* Spotlight tour — вынесено из lzt_style.css */\n\n${light}${tourChunk}`);

const fixed = css.slice(0, iStart)
    + "/* Обучающий тур → css/tour.css */\n\n"
    + css.slice(iLog, iAi);
fs.writeFileSync(stylePath, fixed);
console.log("tour.css written,", tourChunk.length, "bytes");
