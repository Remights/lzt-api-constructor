// Экспорт сценария: PNG-скриншот схемы и ZIP с готовым Python-проектом.
// Без внешних зависимостей: PNG рисуется на <canvas>, ZIP собирается вручную (метод STORED + CRC32).
(function () {
    "use strict";

    // ---------- бинарное скачивание ----------
    function downloadBlob(filename, blob) {
        if (window.LZTFS) {
            window.LZTFS.saveBlob(filename, blob).then(ok => {
                if (!ok) fallbackBlob(filename, blob);
            });
            return;
        }
        fallbackBlob(filename, blob);
    }
    function fallbackBlob(filename, blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 120);
    }

    // ==================== PNG ====================
    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function nodeSize(id, node) {
        const el = document.querySelector(`#canvas-nodes [data-node="${id}"]`);
        if (el && el.offsetWidth) return { w: el.offsetWidth, h: el.offsetHeight };
        return { w: 240, h: 96 };
    }

    function portPos(node, sz, dir, portId, list) {
        const idx = Math.max(0, list.findIndex(p => p.id === portId));
        const frac = (idx + 1) / (list.length + 1);
        return { x: node.x + (dir === "out" ? sz.w : 0), y: node.y + sz.h * frac };
    }

    function exportPNG() {
        const S = window.Scenario;
        const NT = window.NODE_TYPES || (typeof NODE_TYPES !== "undefined" ? NODE_TYPES : {});
        if (!S || !S.nodes.length) { S && S.flash && S.flash("Пустой сценарий", "err"); return; }

        const sizes = {};
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        S.nodes.forEach(n => {
            const sz = nodeSize(n.id, n); sizes[n.id] = sz;
            minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
            maxX = Math.max(maxX, n.x + sz.w); maxY = Math.max(maxY, n.y + sz.h);
        });
        const pad = 60, headerH = 70;
        const W = Math.max(400, maxX - minX + pad * 2);
        const H = Math.max(300, maxY - minY + pad * 2 + headerH);
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const cap = 6000; // ограничение размера
        const scale = Math.min(1, cap / Math.max(W, H));

        const cv = document.createElement("canvas");
        cv.width = Math.round(W * dpr * scale);
        cv.height = Math.round(H * dpr * scale);
        const ctx = cv.getContext("2d");
        ctx.scale(dpr * scale, dpr * scale);
        const ox = -minX + pad, oy = -minY + pad + headerH;

        // фон
        ctx.fillStyle = "#0f1216";
        ctx.fillRect(0, 0, W, H);
        // шапка
        ctx.fillStyle = "#00ba78";
        ctx.font = "700 22px Inter, Arial, sans-serif";
        ctx.fillText("LZT API Constructor", pad, 40);
        ctx.fillStyle = "#8a94a6";
        ctx.font = "500 14px Inter, Arial, sans-serif";
        ctx.fillText("Сценарий: " + (S.title || "без названия"), pad, 60);

        // связи
        S.edges.forEach(e => {
            const from = S.getNode(e.from), to = S.getNode(e.to);
            if (!from || !to) return;
            const defF = NT[from.type], defT = NT[to.type];
            if (!defF || !defT) return;
            const a = portPos(from, sizes[from.id], "out", e.fromPort, defF.outs);
            const b = portPos(to, sizes[to.id], "in", "in", defT.ins);
            let color = "#3f8cff";
            if (e.fromPort === "true" || e.fromPort === "success" || e.fromPort === "found") color = "#2cb674";
            if (e.fromPort === "false" || e.fromPort === "error" || e.fromPort === "empty") color = "#ff5555";
            const dx = Math.max(40, Math.abs(b.x - a.x) * 0.45);
            ctx.strokeStyle = color; ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.moveTo(a.x + ox, a.y + oy);
            ctx.bezierCurveTo(a.x + dx + ox, a.y + oy, b.x - dx + ox, b.y + oy, b.x + ox, b.y + oy);
            ctx.stroke();
        });

        // ноды
        S.nodes.forEach(n => {
            const def = NT[n.type]; if (!def) return;
            const sz = sizes[n.id];
            const x = n.x + ox, y = n.y + oy;
            ctx.save();
            ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
            ctx.fillStyle = "#1a1f26";
            roundRect(ctx, x, y, sz.w, sz.h, 12); ctx.fill();
            ctx.restore();
            // цветная полоса-хедер
            ctx.fillStyle = def.color || "#00ba78";
            roundRect(ctx, x, y, sz.w, 30, 12); ctx.fill();
            ctx.fillRect(x, y + 18, sz.w, 12);
            // заголовок
            ctx.fillStyle = "#fff"; ctx.font = "700 14px Inter, Arial, sans-serif";
            ctx.fillText(def.title, x + 14, y + 20);
            // подпись тела
            ctx.fillStyle = "#c4ccd6"; ctx.font = "500 12px Inter, Arial, sans-serif";
            const sub = nodeSubtitle(n);
            if (sub) wrapText(ctx, sub, x + 14, y + 50, sz.w - 24, 16, 2);
            // рамка портов-точек
            ctx.fillStyle = def.color || "#00ba78";
            (def.outs || []).forEach(p => {
                const pp = portPos(n, sz, "out", p.id, def.outs);
                ctx.beginPath(); ctx.arc(pp.x + ox, pp.y + oy, 4, 0, Math.PI * 2); ctx.fill();
            });
        });

        cv.toBlob(b => {
            downloadBlob(S.slugify(S.title) + ".png", b);
            S.flash && S.flash("Схема сохранена в PNG", "ok");
        }, "image/png");
    }

    function nodeSubtitle(n) {
        switch (n.type) {
            case "request": {
                const r = n.request || {};
                return ((r.method || "GET") + " " + (r.title || r.url || "")).slice(0, 60);
            }
            case "condition": return `${n.condition.left} ${n.condition.op} ${n.condition.right}`;
            case "filter": return `${n.filter.field} ${n.filter.op} ${n.filter.value}`;
            case "loop": return `× ${n.loop.times} раз`;
            case "foreach": return `для каждого из ${n.foreach.source}`;
            case "variable": return `${n.variable.name} = ${n.variable.path}`;
            case "notify": return n.notify.channel;
            case "delay": return `${n.delay.ms} мс`;
            case "savefile": return `${n.savefile.filename}.${n.savefile.format}`;
            case "proxy": return "прокси";
            case "logmsg": return (n.logmsg.text || "").slice(0, 50);
            case "checker": return "проверка аккаунта";
            case "start": return "точка входа";
            case "stop": return "завершение";
            default: return "";
        }
    }

    function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
        const words = String(text).split(/\s+/);
        let line = "", lines = 0;
        for (let i = 0; i < words.length; i++) {
            const test = line ? line + " " + words[i] : words[i];
            if (ctx.measureText(test).width > maxW && line) {
                ctx.fillText(line, x, y); y += lineH; line = words[i]; lines++;
                if (lines >= maxLines - 1) {
                    let rest = words.slice(i).join(" ");
                    while (ctx.measureText(rest + "…").width > maxW && rest.length) rest = rest.slice(0, -1);
                    ctx.fillText(rest + "…", x, y); return;
                }
            } else line = test;
        }
        if (line) ctx.fillText(line, x, y);
    }

    // ==================== ZIP (STORED + CRC32) ====================
    const CRC_TABLE = (function () {
        const t = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            t[n] = c >>> 0;
        }
        return t;
    })();
    function crc32(bytes) {
        let c = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    }
    function strBytes(s) { return new TextEncoder().encode(s); }

    function buildZip(files) {
        // files: [{name, data(Uint8Array)}]
        const chunks = [];
        const central = [];
        let offset = 0;
        const u16 = (n) => [n & 0xFF, (n >> 8) & 0xFF];
        const u32 = (n) => [n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF, (n >>> 24) & 0xFF];
        files.forEach(f => {
            const name = strBytes(f.name);
            const crc = crc32(f.data);
            const size = f.data.length;
            const local = [].concat(
                u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
                u32(crc), u32(size), u32(size), u16(name.length), u16(0)
            );
            chunks.push(new Uint8Array(local), name, f.data);
            const localLen = local.length + name.length + size;
            central.push([].concat(
                u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
                u32(crc), u32(size), u32(size), u16(name.length), u16(0), u16(0), u16(0), u16(0),
                u32(0), u32(offset)
            ), name);
            offset += localLen;
        });
        const centralStart = offset;
        let centralLen = 0;
        const centralChunks = [];
        central.forEach((c, i) => {
            if (i % 2 === 0) { const arr = new Uint8Array(c); centralChunks.push(arr); centralLen += arr.length; }
            else { centralChunks.push(c); centralLen += c.length; }
        });
        const end = [].concat(
            u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
            u32(centralLen), u32(centralStart), u16(0)
        );
        const all = chunks.concat(centralChunks, [new Uint8Array(end)]);
        return new Blob(all, { type: "application/zip" });
    }

    function exportZip() {
        const S = window.Scenario;
        if (!S || !S.nodes.length) { S && S.flash && S.flash("Пустой сценарий", "err"); return; }
        const name = S.slugify(S.title);
        let py = "";
        try { py = S.generatePython(); } catch (e) { py = "# Ошибка генерации: " + e; }
        const scnData = S.serialize();
        const readme = S.buildProjectReadme
            ? S.buildProjectReadme(S.title, scnData)
            : `# ${S.title || "LZT бот"}\n\nСгенерировано **LZT API Constructor**.\n`;
        const reqs = S.buildProjectRequirements
            ? S.buildProjectRequirements(scnData)
            : "requests>=2.31.0\n";
        const scn = JSON.stringify(scnData, null, 2);
        const files = [
            { name: "bot.py", data: strBytes(py) },
            { name: "requirements.txt", data: strBytes(reqs) },
            { name: "README.md", data: strBytes(readme) },
            { name: "scenario.json", data: strBytes(scn) },
        ];
        downloadBlob(name + "_project.zip", buildZip(files));
        S.flash && S.flash("Python-проект сохранён (.zip)", "ok");
    }

    function rebuildShareMenu() {
        const menu = document.getElementById("share-menu");
        if (!menu || menu.dataset.bound !== "1") return;
        const t = (k, fb) => (window.I18N && I18N.t(k)) || fb;
        menu.innerHTML = `<div class="add-block-cat">${t("share.cat.files", "Файлы")}</div>
            <div class="add-block-item" data-share="json"><span class="add-block-ico" style="color:#3594bc;"><i class="fa-solid fa-file-code"></i></span><span class="add-block-txt"><b>${t("share.json.label", "Сценарий (.json)")}</b><small>${t("share.json.desc", "")}</small></span></div>
            <div class="add-block-item" data-share="png"><span class="add-block-ico" style="color:#e6a23c;"><i class="fa-solid fa-image"></i></span><span class="add-block-txt"><b>${t("share.png.label", "Картинка (.png)")}</b><small>${t("share.png.desc", "")}</small></span></div>
            <div class="add-block-item" data-share="zip"><span class="add-block-ico" style="color:#27ae60;"><i class="fa-solid fa-file-zipper"></i></span><span class="add-block-txt"><b>${t("share.zip.label", "Python-проект (.zip)")}</b><small>${t("share.zip.desc", "")}</small></span></div>`;
        if (typeof window.appendShareGalleryItems === "function") window.appendShareGalleryItems();
    }

    // ==================== привязка меню ====================
    function bindShare() {
        const btn = document.getElementById("btn-share");
        const menu = document.getElementById("share-menu");
        if (!btn || !menu) return;
        menu.dataset.bound = "1";
        rebuildShareMenu();
        window.rebuildShareMenu = rebuildShareMenu;
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const open = menu.style.display !== "block" || !menu.classList.contains("ui-open");
            if (open) {
                if (window.LZTUi) window.LZTUi.showFloatingMenu(menu);
                else menu.style.display = "block";
                if (window.LZTPanels) window.LZTPanels.positionMenu(menu, btn);
            } else if (window.LZTUi) {
                window.LZTUi.hideFloatingMenu(menu);
            } else {
                menu.style.display = "none";
            }
        });
        menu.addEventListener("click", (e) => {
            const it = e.target.closest(".add-block-item[data-share]");
            if (!it) return;
            const k = it.dataset.share;
            if (k !== "json" && k !== "png" && k !== "zip") return;
            if (window.LZTUi) window.LZTUi.hideFloatingMenu(menu);
            else menu.style.display = "none";
            if (k === "json") window.Scenario.exportToFile();
            else if (k === "png") exportPNG();
            else if (k === "zip") exportZip();
        });
        document.addEventListener("click", (e) => {
            if (!e.target.closest("#btn-share") && !e.target.closest("#share-menu")) {
                if (window.LZTUi) window.LZTUi.hideFloatingMenu(menu);
                else menu.style.display = "none";
            }
        });
    }

    window.Exporters = { exportPNG, exportZip, buildZip, crc32 };
    document.addEventListener("DOMContentLoaded", bindShare);
})();
