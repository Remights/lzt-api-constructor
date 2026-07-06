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
        const mini = document.getElementById("canvas-minimap");
        if (mini) {
            const empty = this.nodes.length <= 1;
            mini.style.display = (this.nodes.length >= 5 && !empty) ? "block" : "none";
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
            if (["start", "request", "condition", "delay", "loop", "variable", "filter", "notify", "logmsg", "savefile", "proxy", "foreach", "checker", "sniper", "ai", "subscenario"].includes(node.type)) {
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
            const opLabels = (window.ScenarioConstants && window.ScenarioConstants.OP_LABELS) || {};
            const opTxt = opLabels[c.op] || c.op;
            const right = c.op === "exists" ? "" : ` <b>${this.esc(c.right)}</b>`;
            return `<div class="snode-cond"><code>${this.esc(c.left)}</code> ${opTxt}${right}</div>`;
        }
        if (node.type === "filter") {
            const f = node.filter;
            const opLabels = (window.ScenarioConstants && window.ScenarioConstants.OP_LABELS) || {};
            const opTxt = opLabels[f.op] || f.op;
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
        if (node.type === "ai") {
            const a = node.ai || {};
            return `<div class="snode-strong"><i class="fa-solid fa-brain"></i> ${a.batch !== false ? "пакет" : "один"} · ${this.esc(a.outputVar || "ai_result")}</div>
                <div class="snode-muted">из <code>${this.esc(a.source || "last.items")}</code></div>
                <div class="snode-edit-hint"><i class="fa-solid fa-pen"></i> нажмите, чтобы настроить</div>`;
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

    scheduleRedrawEdges() {
        if (this._edgeRaf) return;
        this._edgeRaf = requestAnimationFrame(() => {
            this._edgeRaf = 0;
            this.redrawEdges();
        });
    },

    flushCanvasInteraction() {
        if (this._edgeRaf) {
            cancelAnimationFrame(this._edgeRaf);
            this._edgeRaf = 0;
        }
        this.redrawEdges();
        this.viewport?.classList.remove("panning", "dragging-nodes");
        if (this.world) this.world.style.willChange = "";
        this.applyTransform();
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
            const wasPan = !!this._pan;
            this._pan = null;
            this.viewport.classList.remove("panning");
            if (e) try { this.viewport.releasePointerCapture(e.pointerId); } catch (err) {}
            if (wasPan) this.flushCanvasInteraction();
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
                this.applyTransform({ skipMinimap: true });
            } else if (this._drag) {
                if (this._drag.pid != null && e.pointerId !== this._drag.pid) return;
                const w = this.screenToWorld(e.clientX, e.clientY);
                const n = this.getNode(this._drag.id);
                if (n) {
                    n.x = Math.round(w.x - this._drag.dx);
                    n.y = Math.round(w.y - this._drag.dy);
                    const el = this.nodesLayer.querySelector(`[data-node="${n.id}"]`);
                    if (el) { el.style.left = n.x + "px"; el.style.top = n.y + "px"; }
                    this.scheduleRedrawEdges();
                }
            } else if (this._connect) {
                if (this._connect.pid != null && e.pointerId !== this._connect.pid) return;
                this._connect.cursor = this.screenToWorld(e.clientX, e.clientY);
                this.scheduleRedrawEdges();
            }
        });

        this.viewport.addEventListener("pointerup", (e) => {
            endPan(e);
            if (this._drag && (this._drag.pid == null || e.pointerId === this._drag.pid)) {
                this._drag = null;
                this.flushCanvasInteraction();
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
            if (this._drag) {
                this._drag = null;
                this.flushCanvasInteraction();
            }
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
        if (this.selectedNode !== node.id) {
            this.selectedNode = node.id;
            this.nodesLayer.querySelectorAll(".snode.selected").forEach(n => n.classList.remove("selected"));
            this.nodesLayer.querySelector(`[data-node="${node.id}"]`)?.classList.add("selected");
        }
        this.viewport.classList.add("dragging-nodes");
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
                blk("ai", "fa-brain", "#9b59b6"),
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
                    if (this._connect) {
                        this._connect = null;
                        this.viewport?.classList.remove("connecting");
                        this.redrawEdges();
                    }
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
                if (e.target.closest("#btn-add-block") || e.target.closest("#add-block-menu") || e.target.closest("#tour-spotlight-root")) return;
                if (window.LZTUi) window.LZTUi.hideFloatingMenu(menu);
                else menu.style.display = "none";
            });
        }
        document.getElementById("btn-fit-view")?.addEventListener("click", () => this.fitView());
        document.getElementById("btn-save-scenario")?.addEventListener("click", () => { this.saveCurrent(); });
        document.getElementById("btn-undo")?.addEventListener("click", () => this.undo());
        document.getElementById("btn-redo")?.addEventListener("click", () => this.redo());
        document.getElementById("btn-help-tour")?.addEventListener("click", () => this.startTour());
        if (this.viewport && !this.viewport.dataset.urlPasteBound) {
            this.viewport.dataset.urlPasteBound = "1";
            this.viewport.addEventListener("paste", (e) => {
                const t = (e.clipboardData?.getData("text") || "").trim();
                const id = window.LZTPriceAnalyzer?.parseItemIdFromText?.(t);
                if (!id) return;
                e.preventDefault();
                const node = this.addBlockAtCenter("request");
                if (node.request) {
                    node.request.method = "GET";
                    node.request.url = `https://prod-api.lzt.market/${id}`;
                    node.request.title = `Лот #${id}`;
                }
                this.render();
                this.regenScript();
                this.commit();
                this.flash?.(`Блок «Запрос» для лота #${id}`, "ok");
            });
        }
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

    // ==================== РЕДАКТОР СВОЙСТВ БЛОКА (делегирует в prop_editors/*) ====================

    openPropEditor(node, clientX, clientY) {
        if (window.ScenarioPropEditorHost) {
            window.ScenarioPropEditorHost.mount(this, node, clientX, clientY);
        }
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
