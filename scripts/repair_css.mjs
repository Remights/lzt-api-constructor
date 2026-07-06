import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const devPath = path.join(root, "web/css/lzt_style.css");
const copyPath = path.join(root, "../LZT API Constructor DEV - Copy/web/css/lzt_style.css");
const tourPath = path.join(root, "web/css/tour.css");

const dev = fs.readFileSync(devPath, "utf8");
const copy = fs.readFileSync(copyPath, "utf8");

const tourStart = copy.indexOf("/* Обучающий тур */");
const logMark = ".log-row code { color: #e6a23c; font-family: monospace; }";
const logIdx = copy.indexOf(logMark, tourStart);
if (tourStart < 0 || logIdx < 0) {
    console.error("tour markers missing in copy");
    process.exit(1);
}

const tourChunk = copy.slice(tourStart, logIdx).trim();
const tail = copy.slice(logIdx).trimStart();

const devHeadEnd = dev.indexOf("/* Обучающий тур");
const devHead = devHeadEnd >= 0 ? dev.slice(0, devHeadEnd) : dev.replace(/\s*$/, "\n\n");
const fixedDev = devHead + "/* Обучающий тур → css/tour.css */\n\n" + tail + "\n";

const light = `:root[data-theme="light"] .tour-text b,
:root[data-theme="light"] .tour-title { color: #111; }
:root[data-theme="light"] .tour-ico { border-color: var(--border-color); }

`;

const extras = `
/* --- Расширения spotlight-тура (анимации, layout) --- */
@keyframes tour-root-in {
    from { opacity: 0; }
    to { opacity: 1; }
}
@keyframes tour-dim-in {
    from { opacity: 0; }
    to { opacity: 1; }
}
@keyframes tour-ring-glow {
    0%, 100% {
        box-shadow:
            0 0 0 0 rgba(0, 186, 120, 0.55),
            0 0 18px rgba(0, 186, 120, 0.2);
        border-color: rgba(0, 186, 120, 0.88);
    }
    50% {
        box-shadow:
            0 0 0 8px rgba(0, 186, 120, 0.22),
            0 0 36px rgba(0, 186, 120, 0.55);
        border-color: rgba(80, 255, 190, 1);
    }
}
@keyframes tour-ring-bump {
    0% { transform: scale(1); }
    40% { transform: scale(1.028); }
    100% { transform: scale(1); }
}
@keyframes tour-ring-aura {
    0%, 100% { opacity: 0.35; transform: scale(1); }
    50% { opacity: 0.85; transform: scale(1.04); }
}
@keyframes tour-tooltip-in {
    from {
        opacity: 0;
        transform: translateY(12px) scale(0.96);
        filter: blur(2px);
    }
    to {
        opacity: 1;
        transform: none;
        filter: blur(0);
    }
}
@keyframes tour-tooltip-in-center {
    from {
        opacity: 0;
        transform: translate(-50%, calc(-50% + 14px)) scale(0.95);
        filter: blur(2px);
    }
    to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
        filter: blur(0);
    }
}
@keyframes tour-tooltip-praise {
    0% { transform: scale(1); }
    20% {
        transform: scale(1.025);
        box-shadow:
            0 0 0 0 rgba(0, 186, 120, 0.45),
            0 22px 56px rgba(0, 0, 0, 0.58);
    }
    100% {
        transform: scale(1);
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.55);
    }
}
@keyframes tour-tooltip-praise-center {
    0% { transform: translate(-50%, -50%) scale(1); }
    20% {
        transform: translate(-50%, -50%) scale(1.025);
        box-shadow:
            0 0 0 0 rgba(0, 186, 120, 0.45),
            0 22px 56px rgba(0, 0, 0, 0.58);
    }
    100% {
        transform: translate(-50%, -50%) scale(1);
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.55);
    }
}
@keyframes tour-port-beacon {
    0%, 100% {
        transform: translate(-50%, -50%) scale(1.3);
        box-shadow: 0 0 0 3px rgba(0, 186, 120, 0.35);
    }
    50% {
        transform: translate(-50%, -50%) scale(1.45);
        box-shadow: 0 0 0 8px rgba(0, 186, 120, 0.18), 0 0 22px rgba(0, 186, 120, 0.55);
    }
}
@keyframes tour-hint-blink {
    0%, 100% {
        color: var(--text-muted);
        opacity: 0.55;
    }
    50% {
        color: var(--lzt-green, #00ba78);
        opacity: 1;
        text-shadow: 0 0 10px rgba(0, 186, 120, 0.55);
    }
}
@keyframes tour-head-icon-pop {
    0% { transform: scale(0.85); opacity: 0.6; }
    60% { transform: scale(1.08); opacity: 1; }
    100% { transform: scale(1); }
}

.tour-spotlight-root.tour-root-enter {
    animation: tour-root-in 0.28s ease forwards;
}
.tour-dim {
    animation: tour-dim-in 0.22s ease forwards;
}
.tour-spot-ring-box {
    transform-origin: center center;
    overflow: visible;
    transition:
        top 0.38s cubic-bezier(0.22, 1, 0.36, 1),
        left 0.38s cubic-bezier(0.22, 1, 0.36, 1),
        width 0.38s cubic-bezier(0.22, 1, 0.36, 1),
        height 0.38s cubic-bezier(0.22, 1, 0.36, 1);
}
.tour-spot-ring-box::before {
    content: "";
    position: absolute;
    inset: -6px;
    border-radius: inherit;
    border: 1px solid rgba(0, 186, 120, 0.35);
    pointer-events: none;
}
.tour-spot-ring-box::after {
    content: "";
    position: absolute;
    inset: -12px;
    border-radius: inherit;
    border: 1px dashed rgba(0, 186, 120, 0.12);
    pointer-events: none;
}
body.tour-fx-on .tour-spot-ring-box.tour-ring-pulse {
    animation: tour-ring-glow 1.8s ease-in-out infinite;
}
body.tour-fx-on .tour-spot-ring-box.tour-ring-pulse::before {
    animation: tour-ring-aura 2.4s ease-in-out infinite;
}
body.tour-fx-on .tour-spot-ring-box.tour-ring-bump {
    animation: tour-ring-bump 0.42s cubic-bezier(0.22, 1, 0.36, 1);
}
body.tour-fx-on .tour-spot-ring-box.tour-ring-glow-only {
    border-color: rgba(0, 186, 120, 0.35);
    animation: none !important;
    box-shadow: 0 0 28px rgba(0, 186, 120, 0.28);
}
body.tour-fx-on .tour-spot-ring-box.tour-ring-glow-only::before,
body.tour-fx-on .tour-spot-ring-box.tour-ring-glow-only::after {
    animation: none !important;
    opacity: 0;
    border-color: transparent;
}
body.tour-fx-on .sport.tour-port-active {
    animation: tour-port-beacon 1.6s ease-in-out infinite;
}
body.tour-fx-on .snode-edit-hint.tour-hint-blink {
    animation: tour-hint-blink 1.4s ease-in-out infinite;
}
body.tour-fx-on .tour-spotlight-tooltip.tour-tooltip-enter:not(.tour-spotlight-tooltip--center) {
    animation: tour-tooltip-in 0.34s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
body.tour-fx-on .tour-spotlight-tooltip--center.tour-tooltip-enter {
    animation: tour-tooltip-in-center 0.34s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
body.tour-fx-on .tour-spotlight-tooltip.tour-tooltip-praise:not(.tour-spotlight-tooltip--center) {
    animation: tour-tooltip-praise 0.55s cubic-bezier(0.22, 1, 0.36, 1);
}
body.tour-fx-on .tour-spotlight-tooltip--center.tour-tooltip-praise {
    animation: tour-tooltip-praise-center 0.55s cubic-bezier(0.22, 1, 0.36, 1);
}
body.tour-fx-on .tour-spotlight-tooltip-head i {
    animation: tour-head-icon-pop 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}
.tour-spotlight-tooltip--center {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
}
.tour-progress {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
}
.tour-progress .tour-dots {
    margin-bottom: 0;
}
.tour-progress .tour-step-label {
    margin-bottom: 0;
    letter-spacing: 0.02em;
}
.tour-spotlight-tooltip--center .tour-actions {
    justify-content: space-between;
}
.tour-actions-right {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
}
.tour-tip-passive {
    pointer-events: none;
}
.tour-tip-passive .tour-actions,
.tour-tip-passive .tour-actions--compact {
    pointer-events: auto;
}

body.tour-active .floating-panel-backdrop,
body.tour-active .modal-overlay,
body.tour-active .lzt-dialog-overlay,
body.tour-active .tour-overlay::before {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
}
body.tour-active .add-block-menu,
body.tour-active .node-popover {
    transition: none !important;
}
body.tour-active .canvas-edges .edge-active,
body.tour-active .snode.running,
body.tour-active .log-row-enter {
    animation: none !important;
}

@media (prefers-reduced-motion: reduce) {
    body.tour-fx-on .tour-spotlight-root,
    body.tour-fx-on .tour-dim,
    body.tour-fx-on .tour-spot-ring-box,
    body.tour-fx-on .tour-spotlight-tooltip,
    body.tour-fx-on .sport.tour-port-active,
    body.tour-fx-on .snode-edit-hint.tour-hint-blink {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
    }
}
`;

// Replace aggressive global animation kill from copy base
const tourBase = tourChunk
    .replace(/body\.tour-active \* \{\s*animation: none !important;\s*\}\s*/g, "");

fs.writeFileSync(tourPath, `/* Spotlight tour — вынесено из lzt_style.css */\n\n${light}${tourBase}\n${extras}\n`);
fs.writeFileSync(devPath, fixedDev);

console.log("repaired lzt_style.css:", fixedDev.split("\n").length, "lines");
console.log("tour.css:", fs.statSync(tourPath).size, "bytes");
