/** Editor mixin */
window.ScenarioEditorMixin = {
    screenToWorld(clientX, clientY) {
        const r = this.viewport.getBoundingClientRect();
        return { x: (clientX - r.left - this.panX) / this.scale, y: (clientY - r.top - this.panY) / this.scale };
    },

    setZoom(newScale, centerClientX, centerClientY) {
        newScale = Math.max(0.35, Math.min(1.7, newScale));
        const r = this.viewport.getBoundingClientRect();
        const cx = centerClientX != null ? centerClientX : r.left + r.width / 2;
        const cy = centerClientY != null ? centerClientY : r.top + r.height / 2;
        const before = this.screenToWorld(cx, cy);
        this.scale = newScale;
        // сохраняем точку под курсором
        this.panX = (cx - r.left) - before.x * this.scale;
        this.panY = (cy - r.top) - before.y * this.scale;
        this.applyTransform();
        this.redrawEdges();
    },

    fitView() {
        if (!this.nodes.length) return;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        this.nodes.forEach(n => {
            const el = this.nodesLayer.querySelector(`[data-node="${n.id}"]`);
            const w = el ? el.offsetWidth : 240;
            const h = el ? el.offsetHeight : 90;
            minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
            maxX = Math.max(maxX, n.x + w); maxY = Math.max(maxY, n.y + h);
        });
        const r = this.viewport.getBoundingClientRect();
        const pad = 60;
        const sx = (r.width - pad * 2) / (maxX - minX);
        const sy = (r.height - pad * 2) / (maxY - minY);
        this.scale = Math.max(0.35, Math.min(1.2, Math.min(sx, sy)));
        this.panX = pad - minX * this.scale + (r.width - pad * 2 - (maxX - minX) * this.scale) / 2;
        this.panY = pad - minY * this.scale + (r.height - pad * 2 - (maxY - minY) * this.scale) / 2;
        this.applyTransform();
        this.redrawEdges();
    },

    // ==================== РЕНДЕР НОД ====================

    render() {
        this.nodesLayer.innerHTML = "";
        this.nodes.forEach(n => this.nodesLayer.appendChild(this.buildNode(n)));
        const hint = document.getElementById("canvas-hint");
        if (hint) {
            const empty = this.nodes.length <= 1;
            hint.style.display = empty ? "block" : "none";
            // Миникарта — только при большом сценарии, иначе перекрывает подсказку
            const mini = document.getElementById("canvas-minimap");
            if (mini) mini.style.display = (this.nodes.length >= 5 && !empty) ? "block" : "none";
            if (empty) {
                const hasToken = !!(window.LZTToken && window.LZTToken.get());
                const t = (k, fb) => (window.I18N && I18N.t(k)) || fb;
                hint.innerHTML = hasToken
                    ? t("canvas.hint.hasToken", "1) Нажмите «Добавить блок»…")
                    : t("canvas.hint.noToken", "Сначала нажмите блок «Старт»…");
            }
        }
        this.redrawEdges();
    },

    // Открыть редактор токена в блоке «Старт» (из шапки приложения)
    openStartTokenEditor() {
        const start = this.nodes.find(n => n.type === "start");
        if (!start) return false;
        this.selectedNode = start.id;
        this.render();
        const el = this.nodesLayer.querySelector(`[data-node="${start.id}"]`);
        const r = el ? el.getBoundingClientRect() : { left: 280, top: 180, width: 220, height: 90 };
        this.openPropEditor(start, Math.min(r.left + r.width / 2, window.innerWidth - 340), Math.min(r.bottom + 8, window.innerHeight - 320));
        return true;
    },

    buildNode(node) {
        const def = NODE_TYPES[node.type];
        const el = document.createElement("div");
        el.className = "snode snode-" + node.type + (this.selectedNode === node.id ? " selected" : "");
        el.dataset.node = node.id;
        el.style.left = node.x + "px";
        el.style.top = node.y + "px";

        // Шапка (ручка перетаскивания)
        const head = document.createElement("div");
        head.className = "snode-head";
        head.style.setProperty("--accent", def.color);
        head.innerHTML = `<span class="snode-ico" style="color:${def.color};"><i class="fa-solid ${def.icon}"></i></span>
            <span class="snode-type">${def.title}</span>`;
        if (node.type !== "start") {
            const dup = document.createElement("button");
            dup.className = "snode-dup";
            dup.innerHTML = '<i class="fa-regular fa-clone"></i>';
            dup.title = "Дублировать блок (Ctrl+D)";
            dup.addEventListener("mousedown", e => e.stopPropagation());
            dup.addEventListener("click", (e) => { e.stopPropagation(); this.duplicateNode(node.id); });
            head.appendChild(dup);

            const del = document.createElement("button");
            del.className = "snode-del";
            del.innerHTML = "&times;";
            del.title = "Удалить блок";
            del.addEventListener("mousedown", e => e.stopPropagation());
            del.addEventListener("click", (e) => { e.stopPropagation(); this.deleteNode(node.id); });
            head.appendChild(del);
        }
        el.appendChild(head);

        // Тело
        const body = document.createElement("div");
        body.className = "snode-body";
        body.innerHTML = this.nodeBodyHtml(node);
        el.appendChild(body);

        // Порты
        def.ins.forEach((p, i) => el.appendChild(this.buildPort(node, p, "in", i, def.ins.length)));
        def.outs.forEach((p, i) => el.appendChild(this.buildPort(node, p, "out", i, def.outs.length)));

        // Перетаскивание за шапку
        head.addEventListener("mousedown", (e) => {
            if (e.target.closest(".snode-del")) return;
            e.stopPropagation();
            this.startNodeDrag(node, e);
        });
        // Клик по телу — редактирование
        body.addEventListener("mousedown", e => e.stopPropagation());
        body.addEventListener("click", (e) => {
            this.selectedNode = node.id;
            this.render();
            if (["start", "request", "condition", "delay", "loop", "variable", "filter", "notify", "logmsg", "savefile", "proxy", "foreach", "checker", "sniper", "subscenario"].includes(node.type)) {
                this.openPropEditor(node, e.clientX, e.clientY);
            }
        });

        return el;
    },

    // Перерисовать тело блока «Старт» (напр. при смене токена)
    refreshStartNode() {
        const startNode = this.nodes.find(n => n.type === "start");
        if (!startNode || !this.nodesLayer) return;
        const el = this.nodesLayer.querySelector(`[data-node="${startNode.id}"] .snode-body`);
        if (el) el.innerHTML = this.nodeBodyHtml(startNode);
    },

    nodeBodyHtml(node) {
        if (node.type === "start") {
            const hasToken = !!(window.LZTToken && window.LZTToken.get());
            const ge = node.start && node.start.globalError !== false;
            return `<div class="snode-start">
                    <div class="snode-token-row ${hasToken ? "ok" : "no"}">
                        <i class="fa-solid ${hasToken ? "fa-circle-check" : "fa-triangle-exclamation"}"></i>
                        <span>${hasToken ? "Токен подключён" : "Токен не задан"}</span>
                    </div>
                    ${ge ? '<div class="snode-muted" style="font-size:11px;margin-top:4px;"><i class="fa-solid fa-shield-halved"></i> глоб. обработка ошибок</div>' : ""}
                    <div class="snode-edit-hint"><i class="fa-solid fa-key"></i> нажмите, чтобы настроить</div>
                </div>`;
        }
        if (node.type === "stop") return `<div class="snode-muted">Завершение</div>`;
        if (node.type === "delay") return `<div class="snode-strong">${node.delay.ms} мс</div><div class="snode-muted">пауза перед следующим блоком</div>`;
        if (node.type === "loop") return `<div class="snode-strong">× ${node.loop.times} раз</div><div class="snode-muted">выход «Тело» повторится N раз, затем «Готово»</div>`;
        if (node.type === "variable") {
            const v = node.variable;
            return `<div class="snode-var">
                    <div class="snode-var-row"><span class="snode-var-lbl">запомнить как</span> <code class="snode-var-name">${this.esc(v.name)}</code></div>
                    <div class="snode-var-row"><span class="snode-var-lbl">из ответа</span> <span class="snode-var-path">${this.esc(v.path)}</span></div>
                </div>
                <div class="snode-edit-hint">потом вставляйте <code>{{vars.${this.esc(v.name)}}}</code> в другие блоки</div>`;
        }
        if (node.type === "condition") {
            const c = node.condition;
            const opTxt = OP_LABELS[c.op] || c.op;
            const right = c.op === "exists" ? "" : ` <b>${this.esc(c.right)}</b>`;
            return `<div class="snode-cond"><code>${this.esc(c.left)}</code> ${opTxt}${right}</div>`;
        }
        if (node.type === "filter") {
            const f = node.filter;
            const opTxt = OP_LABELS[f.op] || f.op;
            return `<div class="snode-cond">оставить где <code>${this.esc(f.field)}</code> ${opTxt} <b>${this.esc(f.value)}</b></div>
                <div class="snode-muted">из <code>${this.esc(f.source)}</code> → <code style="color:#d68910;">{{vars.${this.esc(f.saveAs)}}}</code></div>`;
        }
        if (node.type === "notify") {
            const n = node.notify;
            const ch = { telegram: "Telegram", discord: "Discord", both: "Telegram + Discord" }[n.channel] || n.channel;
            return `<div class="snode-strong" style="font-size:13px;"><i class="fa-brands fa-telegram" style="color:#0088cc;"></i> ${ch}</div>
                <div class="snode-muted">${this.esc((n.text || "").slice(0, 46))}${(n.text || "").length > 46 ? "…" : ""}</div>
                <div class="snode-edit-hint"><i class="fa-solid fa-pen"></i> нажмите, чтобы настроить</div>`;
        }
        if (node.type === "logmsg") {
            return `<div class="snode-cond">"${this.esc((node.logmsg.text || "").slice(0, 50))}"</div>
                <div class="snode-muted">вывод в лог выполнения</div>`;
        }
        if (node.type === "savefile") {
            const s = node.savefile;
            return `<div class="snode-strong" style="font-size:13px;"><i class="fa-solid fa-file-arrow-down" style="color:#27ae60;"></i> ${this.esc(s.filename)}.${s.format}</div>
                <div class="snode-muted">из <code>${this.esc(s.source)}</code></div>
                <div class="snode-edit-hint"><i class="fa-solid fa-pen"></i> нажмите, чтобы настроить</div>`;
        }
        if (node.type === "proxy") {
            const count = (node.proxy.list || "").split("\n").map(s => s.trim()).filter(Boolean).length;
            const modeTxt = node.proxy.mode === "rotate" ? "по очереди" : "случайно";
            return `<div class="snode-strong" style="font-size:13px;">${count} прокси</div>
                <div class="snode-muted">${count ? "менять " + modeTxt : "список пуст"}</div>
                <div class="snode-edit-hint"><i class="fa-solid fa-pen"></i> нажмите, чтобы настроить</div>`;
        }
        if (node.type === "request") {
            const req = node.request || {};
            const short = this.shortUrl(req.url || "");
            const method = req.method || "GET";
            const mColor = { GET: "#2cb674", POST: "#3594bc", PUT: "#e6a23c", DELETE: "#ff5555" }[method] || "#2cb674";
            const pc = Object.keys(req.params || {}).length + (req.body ? Object.keys(req.body).length : 0);
            return `<div class="snode-req-title">${this.esc(req.title || "Запрос")}</div>
                <div class="snode-req-url"><span class="snode-method" style="color:${mColor};">${method}</span> <span>${this.esc(short || "URL не задан")}</span></div>
                ${pc ? `<div class="snode-muted">${pc} парам.</div>` : ""}
                <div class="snode-edit-hint"><i class="fa-solid fa-pen"></i> нажмите, чтобы настроить</div>`;
        }
        if (node.type === "foreach") {
            const fe = node.foreach;
            return `<div class="snode-strong">по <code>${this.esc(fe.source)}</code></div>
                <div class="snode-muted">→ <code>{{vars.${this.esc(fe.itemVar)}}}</code></div>`;
        }
        if (node.type === "checker") {
            const c = node.checker;
            return `<div class="snode-strong">ID: <code>${this.esc(c.itemPath)}</code></div>
                <div class="snode-muted">${c.rejectSold ? "отсеять проданные" : "только наличие"}</div>`;
        }
        if (node.type === "sniper") {
            const sn = node.sniper;
            return `<div class="snode-strong">≤ ${this.esc(sn.maxPrice)}₽ · лимит ${this.esc(sn.maxSpend)}₽</div>
                <div class="snode-muted">из <code>${this.esc(sn.source)}</code></div>`;
        }
        if (node.type === "subscenario") {
            const ss = node.subscenario;
            const title = ss.templateId ? (this._templateTitle(ss.templateId) || ss.templateId) : "не выбран";
            return `<div class="snode-strong"><i class="fa-solid fa-layer-group"></i> ${this.esc(title)}</div>
                <div class="snode-muted">вызов сохранённого сценария</div>`;
        }
        return "";
    },

    _savedScenarios() {
        try {
            if (window.Scenario?.savedList) return window.Scenario.savedList();
            return JSON.parse(localStorage.getItem("lzt_scenarios") || "[]");
        } catch (e) { return []; }
    },

    _templateTitle(id) {
        const t = this._savedScenarios().find(x => x.id === id);
        return t ? t.title : null;
    },

    buildPort(node, port, dir, index, count) {
        const POS = new Set(["out", "success", "true", "found", "body", "done", "ok", "bought"]);
        const NEG = new Set(["onerror", "error", "false", "fail", "empty"]);
        const el = document.createElement("div");
        el.className = `sport sport-${dir} sport-${port.id}`;
        if (POS.has(port.id)) el.classList.add("sport-pos");
        else if (NEG.has(port.id)) el.classList.add("sport-neg");
        el.dataset.node = node.id;
        el.dataset.port = port.id;
        el.dataset.dir = dir;
        el.style.top = ((index + 1) / (count + 1) * 100) + "%";
        if (port.label) {
            const lbl = document.createElement("span");
            lbl.className = "sport-label";
            lbl.textContent = port.label;
            el.appendChild(lbl);
        }
        if (dir === "out") {
            el.addEventListener("mousedown", (e) => { e.stopPropagation(); this.startConnect(node.id, port.id, e); });
        }
        return el;
    },

    // ==================== СВЯЗИ (SVG) ====================

    portWorldPos(nodeId, port, dir) {
        const node = this.getNode(nodeId);
        const el = this.nodesLayer.querySelector(`[data-node="${nodeId}"]`);
        if (!node || !el) return { x: 0, y: 0 };
        const w = el.offsetWidth, h = el.offsetHeight;
        const def = NODE_TYPES[node.type];
        const list = dir === "in" ? def.ins : def.outs;
        const idx = Math.max(0, list.findIndex(p => p.id === port));
        const frac = (idx + 1) / (list.length + 1);
        return { x: node.x + (dir === "out" ? w : 0), y: node.y + h * frac };
    },

    bezier(a, b) {
        const dx = Math.max(40, Math.abs(b.x - a.x) * 0.45);
        return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
    },

    redrawEdges() {
        if (!this.svg) return;
        this.svg.innerHTML = "";
        const mk = (d, cls, color) => {
            const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
            p.setAttribute("d", d);
            p.setAttribute("class", cls);
            if (color) p.setAttribute("stroke", color);
            return p;
        };
        this.edges.forEach(edge => {
            const a = this.portWorldPos(edge.from, edge.fromPort, "out");
            const b = this.portWorldPos(edge.to, "in", "in");
            let color = "#3f8cff";
            if (edge.fromPort === "true" || edge.fromPort === "success") color = "#2cb674";
            if (edge.fromPort === "false" || edge.fromPort === "error") color = "#ff5555";
            // невидимая широкая линия для удобного клика
            const hit = mk(this.bezier(a, b), "edge-hit");
            hit.addEventListener("click", (e) => { e.stopPropagation(); this.removeEdge(edge.id); });
            this.svg.appendChild(hit);
            const path = mk(this.bezier(a, b), "edge" + (this.running && this._activeEdge === edge.id ? " edge-active" : ""), color);
            this.svg.appendChild(path);
        });
        // временная связь при протяжке
        if (this._connect && this._connect.cursor) {
            const a = this.portWorldPos(this._connect.from, this._connect.fromPort, "out");
            this.svg.appendChild(mk(this.bezier(a, this._connect.cursor), "edge edge-temp"));
        }
    },

    removeEdge(id) { this.edges = this.edges.filter(e => e.id !== id); this.redrawEdges(); this.regenScript(); this.commit(); },

    addEdge(from, fromPort, to) {
        if (from === to) return;
        // один выход = одна связь
        this.edges = this.edges.filter(e => !(e.from === from && e.fromPort === fromPort));
        this.edges.push({ id: this.genId("e"), from, fromPort, to });
        this.redrawEdges();
        this.regenScript();
        this.commit();
    },

    // ==================== ВЗАИМОДЕЙСТВИЕ ====================

    bindCanvas() {
        const panBlock = ".snode, .canvas-search, .canvas-zoom, .canvas-minimap, button, input, textarea, .sport, a, label, select";

        const endPan = (e) => {
            if (!this._pan || (e && this._pan.pid != null && e.pointerId !== this._pan.pid)) return;
            this._pan = null;
            this.viewport.classList.remove("panning");
            if (e) try { this.viewport.releasePointerCapture(e.pointerId); } catch (err) {}
        };

        // панорамирование фона (pointer + capture — иначе в WebView2 курсор меняется, а экран не тянется)
        this.viewport.addEventListener("pointerdown", (e) => {
            if (e.button !== 0) return;
            if (e.target.closest(panBlock)) return;
            e.preventDefault();
            this._pan = { startX: e.clientX, startY: e.clientY, panX: this.panX, panY: this.panY, pid: e.pointerId };
            this.viewport.classList.add("panning");
            if (this.selectedNode) {
                this.selectedNode = null;
                this.nodesLayer.querySelectorAll(".snode.selected").forEach(n => n.classList.remove("selected"));
            }
            try { this.viewport.setPointerCapture(e.pointerId); } catch (err) {}
        });

        this.viewport.addEventListener("pointermove", (e) => {
            if (this._pan) {
                if (this._pan.pid != null && e.pointerId !== this._pan.pid) return;
                this.panX = this._pan.panX + (e.clientX - this._pan.startX);
                this.panY = this._pan.panY + (e.clientY - this._pan.startY);
                this.applyTransform();
            } else if (this._drag) {
                if (this._drag.pid != null && e.pointerId !== this._drag.pid) return;
                const w = this.screenToWorld(e.clientX, e.clientY);
                const n = this.getNode(this._drag.id);
                if (n) {
                    n.x = Math.round(w.x - this._drag.dx);
                    n.y = Math.round(w.y - this._drag.dy);
                    const el = this.nodesLayer.querySelector(`[data-node="${n.id}"]`);
                    if (el) { el.style.left = n.x + "px"; el.style.top = n.y + "px"; }
                    this.redrawEdges();
                }
            } else if (this._connect) {
                if (this._connect.pid != null && e.pointerId !== this._connect.pid) return;
                this._connect.cursor = this.screenToWorld(e.clientX, e.clientY);
                this.redrawEdges();
            }
        });

        this.viewport.addEventListener("pointerup", (e) => {
            endPan(e);
            if (this._drag && (this._drag.pid == null || e.pointerId === this._drag.pid)) {
                this._drag = null;
                this.commit();
            }
            if (this._connect && (this._connect.pid == null || e.pointerId === this._connect.pid)) {
                const target = document.elementFromPoint(e.clientX, e.clientY);
                let targetNodeId = null;
                const port = target && target.closest ? target.closest('.sport[data-dir="in"]') : null;
                if (port) {
                    targetNodeId = port.dataset.node;
                } else {
                    const snode = target && target.closest ? target.closest(".snode") : null;
                    if (snode) {
                        const n = this.getNode(snode.dataset.node);
                        if (n && NODE_TYPES[n.type].ins.length) targetNodeId = snode.dataset.node;
                    }
                }
                if (targetNodeId && targetNodeId !== this._connect.from) {
                    this.addEdge(this._connect.from, this._connect.fromPort, targetNodeId);
                }
                this._connect = null;
                this.viewport.classList.remove("connecting");
                this.redrawEdges();
            }
        });

        this.viewport.addEventListener("pointercancel", (e) => {
            endPan(e);
            if (this._drag) this._drag = null;
            if (this._connect) {
                this._connect = null;
                this.viewport.classList.remove("connecting");
                this.redrawEdges();
            }
        });

        this.viewport.addEventListener("wheel", (e) => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
            this.setZoom(this.scale * factor, e.clientX, e.clientY);
        }, { passive: false });

        window.addEventListener("keydown", (e) => {
            const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
            const ctrl = e.ctrlKey || e.metaKey;
            if (ctrl && (e.key === "z" || e.key === "Z") && !e.shiftKey) {
                if (typing) return;
                e.preventDefault(); this.undo(); return;
            }
            if (ctrl && ((e.key === "y" || e.key === "Y") || (e.shiftKey && (e.key === "z" || e.key === "Z")))) {
                if (typing) return;
                e.preventDefault(); this.redo(); return;
            }
            if (ctrl && (e.key === "c" || e.key === "C")) {
                if (typing) return;
                if (this.selectedNode) { this.copyNode(this.selectedNode); e.preventDefault(); }
                return;
            }
            if (ctrl && (e.key === "v" || e.key === "V")) {
                if (typing) return;
                this.pasteNode(); e.preventDefault(); return;
            }
            if (ctrl && (e.key === "d" || e.key === "D")) {
                if (typing) return;
                if (this.selectedNode) { this.duplicateNode(this.selectedNode); e.preventDefault(); }
                return;
            }
            if ((e.key === "Delete" || e.key === "Backspace") && this.selectedNode) {
                if (typing) return;
                this.deleteNode(this.selectedNode);
            } else if (e.key === "Escape") {
                // Закрываем то, что открыто: поповер → меню → модалку редактора
                const menu = document.getElementById("add-block-menu");
                if (window.LZTUi && window.LZTUi.closeActiveFloatingPanel()) return;
                const pop = document.querySelector(".node-popover");
                if (pop) {
                    if (typeof pop._close === "function") pop._close();
                    else pop.remove();
                    return;
                }
                if (menu && menu.style.display === "block") {
                    if (window.LZTUi) window.LZTUi.hideFloatingMenu(menu);
                    else menu.style.display = "none";
                    return;
                }
                if (this.selectedNode) { this.selectedNode = null; this.render(); }
            }
        });
    },

    startNodeDrag(node, e) {
        const w = this.screenToWorld(e.clientX, e.clientY);
        this._drag = { id: node.id, dx: w.x - node.x, dy: w.y - node.y, pid: e.pointerId };
        this.selectedNode = node.id;
        this.render();
        try { this.viewport.setPointerCapture(e.pointerId); } catch (err) {}
    },

    startConnect(nodeId, portId, e) {
        this._connect = { from: nodeId, fromPort: portId, cursor: this.screenToWorld(e.clientX, e.clientY), pid: e.pointerId };
        this.viewport.classList.add("connecting");
        this.redrawEdges();
        try { this.viewport.setPointerCapture(e.pointerId); } catch (err) {}
    },

    addBlockGroups() {
        const t = (k, fb) => (window.I18N && I18N.t(k)) || fb;
        const blk = (type, icon, color) => ({
            type,
            label: t(`blocks.${type}.label`, type),
            desc: t(`blocks.${type}.desc`, ""),
            icon,
            color,
        });
        return [
            { cat: t("blocks.cat.actions", "Действия"), items: [
                blk("request", "fa-bolt", "#00ba78"),
                blk("notify", "fa-paper-plane", "#0088cc"),
                blk("logmsg", "fa-comment-dots", "#7f8c8d"),
                blk("savefile", "fa-file-arrow-down", "#27ae60"),
            ]},
            { cat: t("blocks.cat.logic", "Логика"), items: [
                blk("condition", "fa-code-branch", "#e6a23c"),
                blk("filter", "fa-filter", "#d68910"),
                blk("foreach", "fa-list-ul", "#8e44ad"),
                blk("loop", "fa-rotate-right", "#9b59b6"),
                blk("variable", "fa-box-archive", "#16a085"),
                blk("subscenario", "fa-layer-group", "#34495e"),
            ]},
            { cat: t("blocks.cat.market", "Маркет"), items: [
                blk("checker", "fa-user-check", "#2980b9"),
                blk("sniper", "fa-crosshairs", "#c0392b"),
            ]},
            { cat: t("blocks.cat.settings", "Настройки и пауза"), items: [
                blk("proxy", "fa-shield-halved", "#607d8b"),
                blk("delay", "fa-clock", "#3594bc"),
                blk("stop", "fa-flag-checkered", "#ff5555"),
            ]},
        ];
    },

    rebuildAddBlockMenu() {
        const menu = document.getElementById("add-block-menu");
        if (!menu || menu.dataset.bound !== "1") return;
        const groups = this.addBlockGroups();
        menu.innerHTML = groups.map(g =>
            `<div class="add-block-cat">${g.cat}</div>` +
            g.items.map(it => `<div class="add-block-item" data-type="${it.type}">
                <span class="add-block-ico" style="color:${it.color};"><i class="fa-solid ${it.icon}"></i></span>
                <span class="add-block-txt"><b>${it.label}</b><small>${it.desc}</small></span>
            </div>`).join("")
        ).join("");
        menu.querySelectorAll(".add-block-item").forEach(it => {
            it.addEventListener("click", () => {
                if (window.LZTUi) window.LZTUi.hideFloatingMenu(menu);
                else menu.style.display = "none";
                this.addBlockAtCenter(it.dataset.type);
            });
        });
    },

    bindToolbar() {
        const addBtn = document.getElementById("btn-add-block");
        const menu = document.getElementById("add-block-menu");
        if (addBtn && menu) {
            menu.dataset.bound = "1";
            this.rebuildAddBlockMenu();
            addBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const open = menu.style.display !== "block" || !menu.classList.contains("ui-open");
                if (open) {
                    if (window.LZTUi) window.LZTUi.showFloatingMenu(menu);
                    else menu.style.display = "block";
                    if (window.LZTPanels) window.LZTPanels.positionMenu(menu, addBtn);
                } else if (window.LZTUi) {
                    window.LZTUi.hideFloatingMenu(menu);
                } else {
                    menu.style.display = "none";
                }
            });
            document.addEventListener("click", (e) => {
                if (!e.target.closest("#btn-add-block") && !e.target.closest("#add-block-menu")) {
                    if (window.LZTUi) window.LZTUi.hideFloatingMenu(menu);
                    else menu.style.display = "none";
                }
            });
        }
        document.getElementById("btn-fit-view")?.addEventListener("click", () => this.fitView());
        document.getElementById("btn-save-scenario")?.addEventListener("click", () => { this.saveCurrent(); });
        document.getElementById("btn-undo")?.addEventListener("click", () => this.undo());
        document.getElementById("btn-redo")?.addEventListener("click", () => this.redo());
        document.getElementById("btn-help-tour")?.addEventListener("click", () => this.startTour());
        const importInput = document.getElementById("import-scn-input");
        document.getElementById("btn-import-scn")?.addEventListener("click", () => importInput && importInput.click());
        importInput?.addEventListener("change", (e) => {
            const f = e.target.files && e.target.files[0];
            this.importFromFile(f);
            e.target.value = "";
        });
        document.getElementById("zoom-in")?.addEventListener("click", () => this.setZoom(this.scale * 1.15));
        document.getElementById("zoom-out")?.addEventListener("click", () => this.setZoom(this.scale / 1.15));
        document.getElementById("zoom-reset")?.addEventListener("click", () => { this.scale = 1; this.applyTransform(); this.redrawEdges(); });
    },

    // ==================== РЕДАКТОР УСЛОВИЯ / ЗАДЕРЖКИ ====================

    openPropEditor(node, clientX, clientY) {
        if (window.LZTUi) window.LZTUi.closeActiveFloatingPanel();
        else document.querySelectorAll(".node-popover, .floating-panel-backdrop").forEach(p => p.remove());
        const pop = document.createElement("div");
        pop.className = "node-popover";
        pop.style.left = Math.min(clientX, window.innerWidth - 320) + "px";
        pop.style.top = Math.min(clientY, window.innerHeight - 260) + "px";
        pop.addEventListener("mousedown", e => e.stopPropagation());
        pop.addEventListener("click", e => e.stopPropagation());
        const dismissPop = () => {
            if (typeof pop._close === "function") pop._close();
            else {
                pop.remove();
                document.querySelectorAll(".floating-panel-backdrop").forEach(b => b.remove());
            }
        };

        if (node.type === "start") {
            pop.classList.add("pop-wide");
            const token = (window.LZTToken && window.LZTToken.get()) || "";
            const st = node.start || { globalError: true };
            pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-key" style="color:#8e8e93;"></i> Старт — токен и ошибки</div>
                <div class="pop-intro">Bearer-токен Lolzteam для реальных запросов. Не попадает в экспорт сценария.</div>
                <button type="button" class="btn-get-token-pop" id="pop-get-token"><i class="fa-solid fa-arrow-up-right-from-square"></i> Где взять токен?</button>
                <label class="pop-label" style="margin-top:12px;">API Токен (Bearer)</label>
                <div class="pop-field-row">
                    <input type="password" class="form-control" id="pop-token" value="${this.esc(token)}" placeholder="Вставьте токен…">
                    <button type="button" class="btn-pick-field" id="pop-token-eye" title="Показать/скрыть"><i class="fa-solid fa-eye"></i></button>
                </div>
                <label class="rate-check" style="margin-top:12px;"><input type="checkbox" id="pop-global-err" ${st.globalError !== false ? "checked" : ""}> Глобальная обработка ошибок — если у запроса не подключён выход «Ошибка», идти по линии «Ошибка» от Старта</label>
                <div class="pop-sync"><button type="button" id="pop-sync" class="pop-sync-btn"><i class="fa-solid fa-rotate"></i> Обновить базу API</button><span id="pop-sync-status" class="pop-sync-status"></span></div>
                <div class="pop-actions"><button class="btn-save" id="pop-ok">Сохранить</button></div>`;
            document.body.appendChild(pop);
            const tokenInput = pop.querySelector("#pop-token");
            pop.querySelector("#pop-get-token").addEventListener("click", () => window.LZTToken && window.LZTToken.openGetPage());
            pop.querySelector("#pop-token-eye").addEventListener("click", () => {
                tokenInput.type = tokenInput.type === "password" ? "text" : "password";
            });
            pop.querySelector("#pop-sync").addEventListener("click", async () => {
                const stEl = pop.querySelector("#pop-sync-status");
                stEl.textContent = "синхронизация…";
                try {
                    const r = window.LZTSyncSpec ? await window.LZTSyncSpec() : { ok: false };
                    stEl.textContent = r.ok ? `обновлено (${r.count})` : "ошибка";
                } catch (e) { stEl.textContent = "ошибка сети"; }
            });
            pop.querySelector("#pop-ok").addEventListener("click", () => {
                if (window.LZTToken) window.LZTToken.set(tokenInput.value);
                node.start = node.start || {};
                node.start.globalError = pop.querySelector("#pop-global-err").checked;
                dismissPop(); this.refreshStartNode(); this.commit();
            });
        } else if (node.type === "request") {
            const req = node.request || {};
            const paramsText = this._reqParamsToText(req.params);
            pop.classList.add("pop-wide");
            pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-bolt" style="color:#00ba78;"></i> Запрос к API</div>
                <label class="pop-label">Название (в логе)</label>
                <input type="text" class="form-control" id="pop-req-title" spellcheck="false" autocomplete="off" value="${this.esc(req.title || "Запрос")}" placeholder="Поиск Steam до 100₽">
                <label class="pop-label" style="margin-top:10px;">Метод и URL</label>
                <div class="pop-filter-row">
                    <select class="form-control" id="pop-req-method" style="font-weight:700;color:var(--lzt-green);">
                        ${["GET", "POST", "PUT", "DELETE"].map(m => `<option value="${m}" ${req.method === m ? "selected" : ""}>${m}</option>`).join("")}
                    </select>
                    <input type="text" class="form-control" id="pop-req-url" spellcheck="false" autocomplete="off" value="${this.esc(req.url || "")}" placeholder="https://prod-api.lzt.market/steam">
                </div>
                <label class="pop-label" style="margin-top:10px;">Параметры</label>
                <span class="pop-label-hint">key=value, по одному на строку</span>
                <textarea class="form-control" id="pop-req-params" rows="4" spellcheck="false" autocomplete="off" placeholder="pmin=1&#10;pmax=100&#10;order_by=price_to_up">${this.esc(paramsText)}</textarea>
                <div class="pop-hint">Подстановки из прошлых блоков: <code>{{last.items.0.item_id}}</code> — в URL или параметрах.</div>
                <details class="pop-advanced" style="margin-top:10px;">
                    <summary>Дополнительно</summary>
                    <div class="pop-filter-row" style="margin-top:8px;">
                        <div><label class="mini-label">Повторов</label><input type="number" class="form-control" id="pop-req-retries" value="${req.retries != null ? req.retries : 0}" min="0" max="10"></div>
                        <div><label class="mini-label">Пауза, мс</label><input type="number" class="form-control" id="pop-req-delay" value="${req.retryDelay != null ? req.retryDelay : 1000}" min="0" step="100"></div>
                        <div><label class="mini-label">Тайм-аут, сек</label><input type="number" class="form-control" id="pop-req-timeout" value="${req.timeout != null ? req.timeout : 15}" min="1" max="120"></div>
                    </div>
                    <label class="rate-check" style="margin-top:8px;"><input type="checkbox" id="pop-req-rate" ${req.respectRateLimit !== false ? "checked" : ""}> Ждать при лимите LZT (429)</label>
                </details>
                <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
            document.body.appendChild(pop);
            this.editingNodeId = node.id;
            pop.querySelector("#pop-ok").addEventListener("click", () => {
                const num = (id, def) => { const n = parseInt(pop.querySelector(id)?.value); return isNaN(n) ? def : n; };
                node.request = {
                    method: pop.querySelector("#pop-req-method").value || "GET",
                    url: pop.querySelector("#pop-req-url").value.trim(),
                    params: this._reqTextToParams(pop.querySelector("#pop-req-params").value),
                    body: req.body || null,
                    headers: req.headers || {},
                    title: pop.querySelector("#pop-req-title").value.trim() || "Запрос",
                    retries: Math.max(0, num("#pop-req-retries", 0)),
                    retryDelay: Math.max(0, num("#pop-req-delay", 1000)),
                    timeout: Math.max(1, num("#pop-req-timeout", 15)),
                    respectRateLimit: pop.querySelector("#pop-req-rate").checked,
                };
                this.editingNodeId = null;
                dismissPop(); this.render(); this.regenScript(); this.commit();
            });
        } else if (node.type === "foreach") {
            const fe = node.foreach;
            pop.classList.add("pop-wide");
            pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-list-ul" style="color:#8e44ad;"></i> Для каждого</div>
                <label class="pop-label">Список (путь)</label>
                <input type="text" class="form-control" id="pop-source" value="${this.esc(fe.source)}" placeholder="last.items">
                <label class="pop-label" style="margin-top:10px;">Имя переменной элемента</label>
                <input type="text" class="form-control" id="pop-itemvar" value="${this.esc(fe.itemVar)}" placeholder="item">
                <label class="pop-label" style="margin-top:10px;">Имя переменной индекса</label>
                <input type="text" class="form-control" id="pop-idxvar" value="${this.esc(fe.indexVar || "i")}" placeholder="i">
                <div class="pop-hint">Тело подключите к выходу «Тело». После каждого элемента верните линию на вход блока.</div>
                <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
            document.body.appendChild(pop);
            pop.querySelector("#pop-ok").addEventListener("click", () => {
                fe.source = pop.querySelector("#pop-source").value.trim() || "last.items";
                fe.itemVar = pop.querySelector("#pop-itemvar").value.trim().replace(/[^\w]/g, "_") || "item";
                fe.indexVar = pop.querySelector("#pop-idxvar").value.trim().replace(/[^\w]/g, "_") || "i";
                dismissPop(); this.render(); this.regenScript(); this.commit();
            });
        } else if (node.type === "checker") {
            const c = node.checker;
            pop.classList.add("pop-wide");
            pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-user-check" style="color:#2980b9;"></i> Проверка аккаунта</div>
                <label class="pop-label">ID лота (путь или число)</label>
                <input type="text" class="form-control" id="pop-itempath" value="${this.esc(c.itemPath)}" placeholder="last.items.0.item_id">
                <label class="rate-check" style="margin-top:10px;"><input type="checkbox" id="pop-rejectsold" ${c.rejectSold !== false ? "checked" : ""}> Считать проданный/недоступный лот «битым»</label>
                <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
            document.body.appendChild(pop);
            pop.querySelector("#pop-ok").addEventListener("click", () => {
                c.itemPath = pop.querySelector("#pop-itempath").value.trim() || "last.items.0.item_id";
                c.rejectSold = pop.querySelector("#pop-rejectsold").checked;
                dismissPop(); this.render(); this.regenScript(); this.commit();
            });
        } else if (node.type === "sniper") {
            const sn = node.sniper;
            pop.classList.add("pop-wide");
            pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-crosshairs" style="color:#c0392b;"></i> Снайпер — автопокупка</div>
                <label class="pop-label">Список лотов (путь)</label>
                <input type="text" class="form-control" id="pop-source" value="${this.esc(sn.source)}" placeholder="last.items">
                <div class="reliability-row" style="margin-top:10px;">
                    <div><label class="mini-label">Макс. цена, ₽</label><input type="text" class="form-control" id="pop-maxp" value="${this.esc(sn.maxPrice)}"></div>
                    <div><label class="mini-label">Лимит трат, ₽</label><input type="text" class="form-control" id="pop-maxs" value="${this.esc(sn.maxSpend)}"></div>
                </div>
                <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
            document.body.appendChild(pop);
            pop.querySelector("#pop-ok").addEventListener("click", () => {
                sn.source = pop.querySelector("#pop-source").value.trim() || "last.items";
                sn.maxPrice = pop.querySelector("#pop-maxp").value.trim() || "100";
                sn.maxSpend = pop.querySelector("#pop-maxs").value.trim() || "5000";
                dismissPop(); this.render(); this.regenScript(); this.commit();
            });
        } else if (node.type === "subscenario") {
            const ss = node.subscenario;
            let opts = "";
            try {
                this._savedScenarios().forEach(t => {
                    opts += `<option value="${this.esc(t.id)}" ${ss.templateId === t.id ? "selected" : ""}>${this.esc(t.title)}</option>`;
                });
            } catch (e) {}
            pop.classList.add("pop-wide");
            pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-layer-group" style="color:#34495e;"></i> Под-сценарий</div>
                <label class="pop-label">Сохранённый сценарий</label>
                <select class="form-control" id="pop-tpl"><option value="">— выберите —</option>${opts}</select>
                <div class="pop-hint">Выполнит цепочку выбранного сценария с текущим контекстом переменных.</div>
                <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
            document.body.appendChild(pop);
            pop.querySelector("#pop-ok").addEventListener("click", () => {
                ss.templateId = pop.querySelector("#pop-tpl").value;
                dismissPop(); this.render(); this.regenScript(); this.commit();
            });
        } else if (node.type === "logmsg") {
            pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-comment-dots" style="color:#7f8c8d;"></i> Сообщение в лог</div>
                <label class="pop-label">Текст сообщения</label>
                <textarea class="form-control" id="pop-text" rows="3" placeholder="Найдено {{last.items.length}} лотов">${this.esc(node.logmsg.text)}</textarea>
                <div class="pop-hint">Можно вставлять данные из ответа: <code>{{last.items.length}}</code>, <code>{{vars.item_id}}</code>.</div>
                <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
            document.body.appendChild(pop);
            pop.querySelector("#pop-ok").addEventListener("click", () => {
                node.logmsg.text = pop.querySelector("#pop-text").value;
                dismissPop(); this.render(); this.regenScript(); this.commit();
            });
        } else if (node.type === "filter") {
            const f = node.filter;
            const ops = ["<=", "<", ">=", ">", "==", "!="].map(o => `<option value="${o}" ${f.op === o ? "selected" : ""}>${o} (${OP_LABELS[o]})</option>`).join("");
            pop.classList.add("pop-wide");
            pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-filter" style="color:#d68910;"></i> Фильтр списка</div>
                <div class="pop-intro">Берёт список из ответа и оставляет только те элементы, что подходят под условие. Результат сохраняется в переменную.</div>
                <label class="pop-label">Список (путь в ответе)</label>
                <input type="text" class="form-control" id="pop-source" value="${this.esc(f.source)}" placeholder="last.items">
                <label class="pop-label" style="margin-top:10px;">Оставить элементы, где</label>
                <div class="pop-filter-row">
                    <input type="text" class="form-control" id="pop-field" value="${this.esc(f.field)}" placeholder="price">
                    <select class="form-control" id="pop-op" style="max-width:120px;">${ops}</select>
                    <input type="text" class="form-control" id="pop-value" value="${this.esc(f.value)}" placeholder="1000">
                </div>
                <label class="pop-label" style="margin-top:10px;">Сохранить результат как</label>
                <input type="text" class="form-control" id="pop-saveas" value="${this.esc(f.saveAs)}" placeholder="filtered">
                <div class="pop-hint">Потом используйте <code id="pop-filter-usage">{{vars.${this.esc(f.saveAs)}}}</code>. Выход <b>«Есть»</b> — если что-то нашлось, <b>«Пусто»</b> — если ничего.</div>
                <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
            document.body.appendChild(pop);
            const saveAsInput = pop.querySelector("#pop-saveas");
            const usage = pop.querySelector("#pop-filter-usage");
            saveAsInput.addEventListener("input", () => { usage.textContent = `{{vars.${saveAsInput.value.trim().replace(/[^\w]/g, "_") || "filtered"}}}`; });
            pop.querySelector("#pop-ok").addEventListener("click", () => {
                f.source = pop.querySelector("#pop-source").value.trim() || "last.items";
                f.field = pop.querySelector("#pop-field").value.trim();
                f.op = pop.querySelector("#pop-op").value;
                f.value = pop.querySelector("#pop-value").value.trim();
                f.saveAs = saveAsInput.value.trim().replace(/[^\w]/g, "_") || "filtered";
                dismissPop(); this.render(); this.regenScript(); this.commit();
            });
        } else if (node.type === "savefile") {
            const s = node.savefile;
            pop.classList.add("pop-wide");
            pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-file-arrow-down" style="color:#27ae60;"></i> Сохранить в файл</div>
                <div class="pop-intro">Выгружает данные из ответа в файл. Список объектов удобно сохранять в CSV (откроется в Excel), любые данные — в JSON.</div>
                <label class="pop-label">Что сохранить (путь в ответе)</label>
                <input type="text" class="form-control" id="pop-source" value="${this.esc(s.source)}" placeholder="last.items или vars.filtered">
                <label class="pop-label" style="margin-top:10px;">Формат файла</label>
                <select class="form-control" id="pop-format">
                    <option value="csv" ${s.format === "csv" ? "selected" : ""}>CSV (таблица для Excel)</option>
                    <option value="json" ${s.format === "json" ? "selected" : ""}>JSON</option>
                </select>
                <label class="pop-label" style="margin-top:10px;">Имя файла (без расширения)</label>
                <input type="text" class="form-control" id="pop-filename" value="${this.esc(s.filename)}" placeholder="results">
                <div class="pop-hint">Файл скачается при выполнении сценария. Источник — список объектов, напр. <code>last.items</code> или <code>vars.filtered</code>.</div>
                <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
            document.body.appendChild(pop);
            pop.querySelector("#pop-ok").addEventListener("click", () => {
                s.source = pop.querySelector("#pop-source").value.trim() || "last.items";
                s.format = pop.querySelector("#pop-format").value;
                s.filename = (pop.querySelector("#pop-filename").value.trim() || "results").replace(/[^\w\-]+/g, "_");
                dismissPop(); this.render(); this.regenScript(); this.commit();
            });
        } else if (node.type === "proxy") {
            const p = node.proxy;
            pop.classList.add("pop-wide");
            pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-shield-halved" style="color:#607d8b;"></i> Прокси</div>
                <div class="pop-intro">Все запросы после этого блока пойдут через прокси. По одному на строку.</div>
                <label class="pop-label">Список прокси</label>
                <textarea class="form-control" id="pop-list" rows="4" placeholder="host:port&#10;host:port:user:pass&#10;http://user:pass@host:port">${this.esc(p.list)}</textarea>
                <label class="pop-label" style="margin-top:10px;">Как выбирать</label>
                <select class="form-control" id="pop-mode">
                    <option value="rotate" ${p.mode === "rotate" ? "selected" : ""}>По очереди (ротация)</option>
                    <option value="random" ${p.mode === "random" ? "selected" : ""}>Случайно</option>
                </select>
                <div class="pop-hint">Форматы: <code>host:port</code>, <code>host:port:логин:пароль</code> или <code>схема://...</code></div>
                <div id="pop-proxy-check" style="margin-top:8px;"></div>
                <div class="pop-actions"><button class="btn-token" id="pop-check"><i class="fa-solid fa-magnifying-glass"></i> Проверить</button><button class="btn-save" id="pop-ok">Готово</button></div>`;
            document.body.appendChild(pop);
            pop.querySelector("#pop-check").addEventListener("click", async () => {
                const list = pop.querySelector("#pop-list").value.split("\n").map(s => s.trim()).filter(Boolean);
                const box = pop.querySelector("#pop-proxy-check");
                if (!list.length) { box.innerHTML = '<span style="color:#e6a23c;font-size:12px;">Список пуст</span>'; return; }
                box.innerHTML = '<span style="font-size:12px;color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Проверяю ' + list.length + '…</span>';
                try {
                    const res = await fetch("/api/check-proxies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proxies: list }) });
                    const d = await res.json();
                    if (!d.success) { box.innerHTML = '<span style="color:#ff5555;font-size:12px;">' + this.esc(d.error || "Ошибка") + '</span>'; return; }
                    const rows = d.results.map(r => {
                        const ic = r.alive ? '<span style="color:#27ae60;">●</span>' : '<span style="color:#ff5555;">●</span>';
                        const info = r.alive ? `${r.ms}мс${r.ip ? " · " + this.esc(r.ip) : ""}` : this.esc(r.error || ("HTTP " + (r.status || "?")));
                        return `<div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;padding:2px 0;"><span>${ic} ${this.esc(r.proxy)}</span><span style="color:var(--text-muted);">${info}</span></div>`;
                    }).join("");
                    box.innerHTML = `<div style="font-size:12px;margin-bottom:4px;">Живых: <b style="color:#27ae60;">${d.alive}</b> / ${d.total} <button class="pop-inline-link" id="pop-keep-alive" style="float:right;">Оставить только живые</button></div><div style="max-height:140px;overflow:auto;background:var(--bg-input);border-radius:6px;padding:6px;">${rows}</div>`;
                    const keep = box.querySelector("#pop-keep-alive");
                    if (keep) keep.addEventListener("click", () => {
                        const aliveList = d.results.filter(r => r.alive).map(r => r.proxy);
                        pop.querySelector("#pop-list").value = aliveList.join("\n");
                    });
                } catch (e) {
                    box.innerHTML = '<span style="color:#ff5555;font-size:12px;">' + this.esc(String(e)) + '</span>';
                }
            });
            pop.querySelector("#pop-ok").addEventListener("click", () => {
                p.list = pop.querySelector("#pop-list").value;
                p.mode = pop.querySelector("#pop-mode").value;
                dismissPop(); this.render(); this.regenScript(); this.commit();
            });
        } else if (node.type === "notify") {
            const n = node.notify;
            pop.classList.add("pop-wide");
            pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-paper-plane" style="color:#0088cc;"></i> Уведомление</div>
                <div class="pop-intro">Отправит вам сообщение, когда сценарий дойдёт до этого блока. Удобно для «сообщи, когда нашёл дешёвый аккаунт».</div>
                <label class="pop-label">Куда отправлять</label>
                <select class="form-control" id="pop-channel">
                    <option value="telegram" ${n.channel === "telegram" ? "selected" : ""}>Telegram</option>
                    <option value="discord" ${n.channel === "discord" ? "selected" : ""}>Discord</option>
                    <option value="both" ${n.channel === "both" ? "selected" : ""}>Telegram + Discord</option>
                </select>
                <div id="pop-tg-fields">
                    <label class="pop-label" style="margin-top:10px;">Токен Telegram-бота <a href="#" id="pop-tg-help" class="pop-inline-link">(как получить?)</a></label>
                    <input type="text" class="form-control" id="pop-tgtoken" value="${this.esc(n.tgToken)}" placeholder="123456:ABC-DEF...">
                    <label class="pop-label" style="margin-top:8px;">Ваш chat_id</label>
                    <input type="text" class="form-control" id="pop-tgchat" value="${this.esc(n.tgChat)}" placeholder="напр. 123456789">
                </div>
                <div id="pop-dc-fields">
                    <label class="pop-label" style="margin-top:10px;">Discord Webhook URL</label>
                    <input type="text" class="form-control" id="pop-dcurl" value="${this.esc(n.discordUrl)}" placeholder="https://discord.com/api/webhooks/...">
                </div>
                <label class="pop-label" style="margin-top:10px;">Текст сообщения</label>
                <textarea class="form-control" id="pop-text" rows="2" placeholder="Найдено {{last.items.length}} лотов!">${this.esc(n.text)}</textarea>
                <div class="pop-hint">Можно вставлять <code>{{last...}}</code> и <code>{{vars...}}</code>.</div>
                <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
            document.body.appendChild(pop);
            const chSel = pop.querySelector("#pop-channel");
            const tgF = pop.querySelector("#pop-tg-fields");
            const dcF = pop.querySelector("#pop-dc-fields");
            const syncCh = () => {
                const c = chSel.value;
                tgF.style.display = (c === "telegram" || c === "both") ? "block" : "none";
                dcF.style.display = (c === "discord" || c === "both") ? "block" : "none";
            };
            chSel.addEventListener("change", syncCh);
            syncCh();
            pop.querySelector("#pop-tg-help").addEventListener("click", (e) => {
                e.preventDefault();
                fetch("/api/open-browser", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: "https://t.me/BotFather" }) });
            });
            pop.querySelector("#pop-ok").addEventListener("click", () => {
                n.channel = chSel.value;
                n.tgToken = pop.querySelector("#pop-tgtoken").value.trim();
                n.tgChat = pop.querySelector("#pop-tgchat").value.trim();
                n.discordUrl = pop.querySelector("#pop-dcurl").value.trim();
                n.text = pop.querySelector("#pop-text").value;
                dismissPop(); this.render(); this.regenScript(); this.commit();
            });
        } else if (node.type === "delay") {
            pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-clock" style="color:#3594bc;"></i> Задержка</div>
                <label class="pop-label">Пауза, миллисекунд</label>
                <input type="number" class="form-control" id="pop-ms" value="${node.delay.ms}" min="0" step="100">
                <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
            document.body.appendChild(pop);
            pop.querySelector("#pop-ok").addEventListener("click", () => {
                node.delay.ms = parseInt(pop.querySelector("#pop-ms").value) || 0;
                dismissPop(); this.render(); this.regenScript(); this.commit();
            });
        } else if (node.type === "loop") {
            pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-rotate-right" style="color:#9b59b6;"></i> Цикл</div>
                <label class="pop-label">Сколько раз повторить</label>
                <input type="number" class="form-control" id="pop-times" value="${node.loop.times}" min="1" step="1">
                <div class="pop-hint">Выход <b>«Тело»</b> выполнится указанное число раз (подключите его обратно к циклу), затем управление уйдёт в <b>«Готово»</b>.</div>
                <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
            document.body.appendChild(pop);
            pop.querySelector("#pop-ok").addEventListener("click", () => {
                node.loop.times = Math.max(1, parseInt(pop.querySelector("#pop-times").value) || 1);
                dismissPop(); this.render(); this.regenScript(); this.commit();
            });
        } else if (node.type === "variable") {
            pop.classList.add("pop-wide");
            pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-box-archive" style="color:#16a085;"></i> Запомнить значение</div>
                <div class="pop-intro">Этот блок берёт одно значение из ответа предыдущего запроса и сохраняет его под понятным именем — чтобы потом подставить в другие блоки.</div>

                <label class="pop-label"><span class="pop-step">1</span> Что запомнить из ответа?</label>
                <div class="pop-field-row">
                    <input type="text" class="form-control" id="pop-path" value="${this.esc(node.variable.path)}" placeholder="last.items.0.item_id">
                    <button type="button" class="btn-pick-field" id="pop-pick"><i class="fa-solid fa-wand-magic-sparkles"></i> Выбрать</button>
                </div>
                <div id="pop-field-list" class="pop-field-list" style="display:none;"></div>

                <label class="pop-label" style="margin-top:12px;"><span class="pop-step">2</span> Как назвать это значение?</label>
                <input type="text" class="form-control" id="pop-name" value="${this.esc(node.variable.name)}" placeholder="item_id">

                <div class="pop-usage">Готово! Теперь пишите <code id="pop-usage-code">{{vars.${this.esc(node.variable.name)}}}</code> в URL или параметрах любого блока.</div>
                <div class="pop-actions"><button class="btn-save" id="pop-ok">Сохранить</button></div>`;
            document.body.appendChild(pop);

            const nameInput = pop.querySelector("#pop-name");
            const pathInput = pop.querySelector("#pop-path");
            const usageCode = pop.querySelector("#pop-usage-code");
            const syncUsage = () => {
                const nm = (nameInput.value.trim().replace(/[^\w]/g, "_")) || "my_var";
                usageCode.textContent = `{{vars.${nm}}}`;
            };
            nameInput.addEventListener("input", syncUsage);

            // Выбор поля из ответа предыдущего блока
            const listBox = pop.querySelector("#pop-field-list");
            pop.querySelector("#pop-pick").addEventListener("click", () => {
                if (listBox.style.display === "block") { listBox.style.display = "none"; return; }
                this.editingNodeId = node.id;
                const sample = this.sampleForEditing();
                listBox.innerHTML = "";
                if (!sample) {
                    listBox.innerHTML = `<div class="pop-field-empty">Нет данных для выбора. Сначала <b>запустите сценарий</b> или проверьте предыдущий запрос — тогда здесь появятся поля из ответа. А пока можно вписать путь вручную.</div>`;
                    listBox.style.display = "block";
                    return;
                }
                const paths = this.flattenPaths(sample, "", [], 0);
                const search = document.createElement("input");
                search.type = "text";
                search.className = "form-control";
                search.placeholder = "Поиск поля…";
                search.style.cssText = "margin-bottom:6px;";
                listBox.appendChild(search);
                const rows = document.createElement("div");
                rows.className = "pop-field-rows";
                listBox.appendChild(rows);
                const draw = (q) => {
                    rows.innerHTML = "";
                    paths.filter(p => !q || p.path.toLowerCase().includes(q)).slice(0, 80).forEach(p => {
                        const it = document.createElement("div");
                        it.className = "pop-field-item";
                        const preview = p.val === null ? "null" : String(p.val);
                        it.innerHTML = `<code>last.${this.esc(p.path)}</code><span class="pop-field-preview">${this.esc(preview.slice(0, 40))}</span>`;
                        it.addEventListener("click", () => {
                            pathInput.value = `last.${p.path}`;
                            if (!nameInput.value.trim()) {
                                const parts = p.path.split(".").filter(x => !/^\d+$/.test(x));
                                nameInput.value = (parts[parts.length - 1] || "value").replace(/[^\w]/g, "_");
                                syncUsage();
                            }
                            listBox.style.display = "none";
                        });
                        rows.appendChild(it);
                    });
                    if (!rows.children.length) rows.innerHTML = `<div class="pop-field-empty">Ничего не найдено</div>`;
                };
                search.addEventListener("input", () => draw(search.value.trim().toLowerCase()));
                draw("");
                listBox.style.display = "block";
                setTimeout(() => search.focus(), 30);
            });

            pop.querySelector("#pop-ok").addEventListener("click", () => {
                const nm = nameInput.value.trim().replace(/[^\w]/g, "_") || "my_var";
                node.variable.name = nm;
                node.variable.path = pathInput.value.trim() || "last";
                dismissPop(); this.render(); this.regenScript(); this.commit();
            });
        } else if (node.type === "condition") {
            const c = node.condition;
            const ops = Object.keys(OP_LABELS).map(o => `<option value="${o}" ${c.op === o ? "selected" : ""}>${o === "exists" ? "существует" : o + " (" + OP_LABELS[o] + ")"}</option>`).join("");
            pop.innerHTML = `<div class="pop-title"><i class="fa-solid fa-code-branch" style="color:#e6a23c;"></i> Условие</div>
                <label class="pop-label">Поле из ответа предыдущего блока</label>
                <input type="text" class="form-control" id="pop-left" value="${this.esc(c.left)}" placeholder="last.items.length">
                <label class="pop-label" style="margin-top:8px;">Оператор</label>
                <select class="form-control" id="pop-op">${ops}</select>
                <label class="pop-label" id="pop-right-label" style="margin-top:8px;">Значение для сравнения</label>
                <input type="text" class="form-control" id="pop-right" value="${this.esc(c.right)}" placeholder="0">
                <div class="pop-hint">Напр. <code>last.items.length</code> больше <code>0</code> — есть ли лоты в ответе.</div>
                <div class="pop-actions"><button class="btn-save" id="pop-ok">Готово</button></div>`;
            document.body.appendChild(pop);
            const rightWrap = pop.querySelector("#pop-right");
            const rightLbl = pop.querySelector("#pop-right-label");
            const syncRight = () => {
                const hide = pop.querySelector("#pop-op").value === "exists";
                rightWrap.style.display = hide ? "none" : "block";
                rightLbl.style.display = hide ? "none" : "block";
            };
            pop.querySelector("#pop-op").addEventListener("change", syncRight);
            syncRight();
            pop.querySelector("#pop-ok").addEventListener("click", () => {
                c.left = pop.querySelector("#pop-left").value.trim() || "last";
                c.op = pop.querySelector("#pop-op").value;
                c.right = pop.querySelector("#pop-right").value.trim();
                dismissPop(); this.render(); this.regenScript(); this.commit();
            });
        }

        // Не даём поповеру уехать за нижний/правый край экрана
        requestAnimationFrame(() => {
            const r = pop.getBoundingClientRect();
            if (r.bottom > window.innerHeight - 10) {
                pop.style.top = Math.max(10, window.innerHeight - r.height - 10) + "px";
            }
            if (r.right > window.innerWidth - 10) {
                pop.style.left = Math.max(10, window.innerWidth - r.width - 10) + "px";
            }
        });

        if (window.LZTUi) window.LZTUi.mountFloatingPanel(pop);
    },

    sampleForEditing() {
        const preds = this.edges.filter(e => e.to === this.editingNodeId).map(e => e.from);
        for (const pid of preds) {
            if (this.lastRunData[pid] != null) return this.lastRunData[pid];
        }
        if (this.lastRunData.__latest != null) return this.lastRunData.__latest;
        if (typeof lastResponseData !== "undefined" && lastResponseData) return lastResponseData;
        return null;
    },

    flattenPaths(obj, prefix, out, depth) {
        out = out || [];
        depth = depth || 0;
        if (depth > 4 || out.length > 200) return out;
        if (Array.isArray(obj)) {
            obj.slice(0, 5).forEach((v, i) => {
                const p = prefix ? `${prefix}.${i}` : String(i);
                if (v !== null && typeof v === "object") this.flattenPaths(v, p, out, depth + 1);
                else out.push({ path: p, val: v });
            });
            if (prefix) out.push({ path: `${prefix}.length`, val: obj.length });
        } else if (obj && typeof obj === "object") {
            Object.entries(obj).forEach(([k, v]) => {
                const p = prefix ? `${prefix}.${k}` : k;
                if (v !== null && typeof v === "object") this.flattenPaths(v, p, out, depth + 1);
                else out.push({ path: p, val: v });
            });
        }
        return out;
    },

    _reqParamsToText(params) {
        return Object.entries(params || {}).map(([k, v]) => `${k}=${v}`).join("\n");
    },

    _reqTextToParams(text) {
        const params = {};
        String(text || "").split("\n").forEach(line => {
            line = line.trim();
            if (!line || line.startsWith("#")) return;
            const i = line.indexOf("=");
            if (i > 0) params[line.slice(0, i).trim()] = line.slice(i + 1).trim();
        });
        return params;
    },
};
