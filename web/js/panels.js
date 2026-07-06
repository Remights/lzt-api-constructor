// IDE-раскладка: перетаскиваемые разделители между 3 панелями + правая колонка (вертикально).
(function () {
    "use strict";

    const LS_LEFT = "lzt_panel_left_w";
    const LS_RIGHT = "lzt_panel_right_w";
    const LS_RUN_H = "lzt_right_run_h";
    const LS_DEBUG_H = "lzt_right_debug_h";
    const LS_PRICE_H = "lzt_right_price_h";
    const LS_VISIBLE = "lzt_panel_visible";

    const PANEL_PARTS = {
        debug: { pane: "right-pane-debug", split: "split-run-debug" },
        price: { pane: "right-pane-price", split: "split-debug-price" },
        script: { pane: "right-pane-script", split: "split-price-script" },
    };

    const DEFAULT_H = { run: 152, debug: 100, price: 80 };
    const DEFAULT_VISIBLE = { debug: true, price: false, script: true };
    const PANE_MIN = { run: 56, debug: 40, price: 36, script: 48 };
    const PANE_ORDER = ["run", "debug", "price"];
    const SPLITTER_H = 6;
    const STACK_GAP = 2;

    let layoutDragLock = 0;

    function beginLayoutDrag() { layoutDragLock++; }
    function endLayoutDrag() { layoutDragLock = Math.max(0, layoutDragLock - 1); }

    function applyWidths(left, right) {
        document.documentElement.style.setProperty("--panel-left-w", left + "px");
        document.documentElement.style.setProperty("--panel-right-w", right + "px");
    }

    function loadWidths() {
        const l = parseInt(localStorage.getItem(LS_LEFT) || "270", 10);
        const r = parseInt(localStorage.getItem(LS_RIGHT) || "380", 10);
        applyWidths(l, r);
        return { left: l, right: r };
    }

    function readStoredHeights() {
        return {
            run: parseInt(localStorage.getItem(LS_RUN_H) || String(DEFAULT_H.run), 10) || DEFAULT_H.run,
            debug: parseInt(localStorage.getItem(LS_DEBUG_H) || String(DEFAULT_H.debug), 10) || DEFAULT_H.debug,
            price: parseInt(localStorage.getItem(LS_PRICE_H) || String(DEFAULT_H.price), 10) || DEFAULT_H.price,
        };
    }

    function getPanelVisibility() {
        try {
            return Object.assign({}, DEFAULT_VISIBLE, JSON.parse(localStorage.getItem(LS_VISIBLE) || "{}"));
        } catch (e) {
            return Object.assign({}, DEFAULT_VISIBLE);
        }
    }

    function isPaneVisible(name) {
        if (name === "run") return true;
        return getPanelVisibility()[name] !== false;
    }

    function pickGrowPane(vis) {
        vis = vis || getPanelVisibility();
        if (vis.script !== false) return document.getElementById("right-pane-script");
        if (vis.price !== false) return document.getElementById("right-pane-price");
        if (vis.debug !== false) return document.getElementById("right-pane-debug");
        return document.getElementById("right-pane-run");
    }

    function prevVisiblePane(fromEl) {
        let el = fromEl?.previousElementSibling;
        while (el) {
            if (el.classList.contains("right-panel-pane") && !el.classList.contains("right-panel-pane-hidden")) {
                return el;
            }
            el = el.previousElementSibling;
        }
        return null;
    }

    /** Если верхняя панель сплиттера скрыта (Price) — тянем за видимую (Debug/Run). */
    function resolveSplitterPanes(topPane, bottomPane) {
        let top = topPane;
        let bottom = bottomPane;
        if (top.classList.contains("right-panel-pane-hidden")) {
            top = prevVisiblePane(bottom) || top;
        }
        if (top.classList.contains("right-panel-pane-grow")) {
            top = prevVisiblePane(top) || top;
        }
        if (bottom.classList.contains("right-panel-pane-hidden")) {
            const next = bottom.nextElementSibling;
            if (next?.classList?.contains("right-panel-pane") && !next.classList.contains("right-panel-pane-hidden")) {
                bottom = next;
            }
        }
        return { top, bottom };
    }

    function applyPanelVisibility(vis) {
        vis = vis || getPanelVisibility();
        Object.entries(PANEL_PARTS).forEach(([key, ids]) => {
            const show = vis[key] !== false;
            document.getElementById(ids.pane)?.classList.toggle("right-panel-pane-hidden", !show);
            document.getElementById(ids.split)?.classList.toggle("panel-splitter-hidden", !show);
        });
        // Сплиттер перед Script нужен, даже если Price скрыт
        const scriptOn = vis.script !== false;
        const priceSplit = document.getElementById("split-price-script");
        if (priceSplit && scriptOn) {
            priceSplit.classList.remove("panel-splitter-hidden");
            const priceHidden = vis.price === false;
            priceSplit.title = priceHidden
                ? "Потяните — изменить высоту Debug (Скрипт станет меньше/больше)"
                : "Потяните — изменить высоту";
        }
        document.querySelectorAll(".right-panel-pane").forEach(p => p.classList.remove("right-panel-pane-grow"));
        const grow = pickGrowPane(vis);
        if (grow && !grow.classList.contains("right-panel-pane-hidden")) {
            grow.classList.add("right-panel-pane-grow");
        }
        clampRightPanelLayout(false);
    }

    function savePanelVisibility(vis) {
        localStorage.setItem(LS_VISIBLE, JSON.stringify(vis));
        applyPanelVisibility(vis);
    }

    function syncPanelSettingsUI() {
        const vis = getPanelVisibility();
        ["debug", "price", "script"].forEach(k => {
            const el = document.getElementById(`set-panel-${k}`);
            if (el) el.checked = vis[k] !== false;
        });
    }

    function bindPanelSettings() {
        syncPanelSettingsUI();
        ["debug", "price", "script"].forEach(k => {
            const el = document.getElementById(`set-panel-${k}`);
            if (!el || el.dataset.bound === "1") return;
            el.dataset.bound = "1";
            el.addEventListener("change", () => {
                const vis = getPanelVisibility();
                vis[k] = el.checked;
                savePanelVisibility(vis);
            });
        });
    }

    function applyRightHeights(run, debug, price) {
        document.documentElement.style.setProperty("--right-run-h", run + "px");
        document.documentElement.style.setProperty("--right-debug-h", debug + "px");
        document.documentElement.style.setProperty("--right-price-h", price + "px");
    }

    function persistHeights(run, debug, price) {
        localStorage.setItem(LS_RUN_H, String(run));
        localStorage.setItem(LS_DEBUG_H, String(debug));
        localStorage.setItem(LS_PRICE_H, String(price));
    }

    function paneHeightFromDOM(pane) {
        if (!pane || pane.classList.contains("right-panel-pane-hidden")) return 0;
        if (pane.classList.contains("right-panel-pane-grow")) return 0;
        const h = Math.round(pane.getBoundingClientRect().height);
        return h > 0 ? h : 0;
    }

    /** Текущие высоты с экрана — чтобы после drag не откатывать к старому localStorage. */
    function readVisualHeights() {
        const stored = readStoredHeights();
        ["run", "debug", "price"].forEach((name) => {
            const pane = document.querySelector(`.right-panel-pane[data-pane="${name}"]`);
            const h = paneHeightFromDOM(pane);
            if (h >= (PANE_MIN[name] || 48)) stored[name] = h;
        });
        return stored;
    }

    function storedPaneHeight(pane) {
        if (!pane || pane.classList.contains("right-panel-pane-grow")) return 0;
        const name = pane.dataset.pane;
        const stored = readStoredHeights();
        const h = stored[name];
        if (h > 0) return h;
        return paneHeightFromDOM(pane);
    }

    function applyHeights(run, debug, price, persist) {
        const clamped = clampHeights(run, debug, price);
        applyRightHeights(clamped.run, clamped.debug, clamped.price);
        syncPaneStyles(clamped.run, clamped.debug, clamped.price);
        if (persist) persistHeights(clamped.run, clamped.debug, clamped.price);
        return clamped;
    }

    function getStackOverhead() {
        const stack = document.getElementById("right-panel-stack");
        if (!stack) return { overhead: 100, stackH: 600, avail: 500 };
        const stackH = stack.clientHeight || 600;
        const splitters = stack.querySelectorAll(".panel-splitter-v:not(.panel-splitter-hidden)").length;
        const visiblePanes = stack.querySelectorAll(".right-panel-pane:not(.right-panel-pane-hidden)").length;
        const gaps = Math.max(0, visiblePanes + splitters - 1);
        const grow = document.querySelector(".right-panel-pane-grow:not(.right-panel-pane-hidden)");
        const growMin = grow ? (PANE_MIN[grow.dataset.pane] || PANE_MIN.script) : 0;
        const overhead = splitters * SPLITTER_H + gaps * STACK_GAP + growMin;
        return { overhead, stackH, avail: Math.max(PANE_MIN.run, stackH - overhead), growMin };
    }

    /** Ужать run/debug/price, чтобы grow-панель всегда помещалась. */
    function clampHeights(run, debug, price) {
        const { avail } = getStackOverhead();
        let r = run;
        let d = isPaneVisible("debug") ? debug : 0;
        let p = isPaneVisible("price") ? price : 0;
        const grow = document.querySelector(".right-panel-pane-grow:not(.right-panel-pane-hidden)");
        const growPane = grow?.dataset?.pane;

        if (growPane === "run") {
            return { run: Math.max(PANE_MIN.run, Math.min(run, avail)), debug: 0, price: 0 };
        }
        if (growPane === "debug") d = 0;
        if (growPane === "price") p = 0;

        let total = r + d + p;
        if (total <= avail) return { run: r, debug: d, price: p };

        const minSum = PANE_MIN.run
            + (d > 0 ? PANE_MIN.debug : 0)
            + (p > 0 ? PANE_MIN.price : 0);
        if (avail <= minSum) {
            const parts = [{ key: "run", val: r }, { key: "debug", val: d }, { key: "price", val: p }]
                .filter(x => x.val > 0);
            const sumMin = parts.reduce((s, x) => s + (PANE_MIN[x.key] || 48), 0);
            const s = avail / Math.max(sumMin, 1);
            return {
                run: (d > 0 || p > 0) ? Math.max(48, Math.floor(PANE_MIN.run * s)) : Math.min(run, avail),
                debug: d > 0 ? Math.max(40, Math.floor(PANE_MIN.debug * s)) : 0,
                price: p > 0 ? Math.max(36, Math.floor(PANE_MIN.price * s)) : 0,
            };
        }

        const scale = avail / total;
        r = Math.max(PANE_MIN.run, Math.floor(r * scale));
        d = d > 0 ? Math.max(PANE_MIN.debug, Math.floor(d * scale)) : 0;
        p = p > 0 ? Math.max(PANE_MIN.price, Math.floor(p * scale)) : 0;
        total = r + d + p;

        const order = [
            { key: "run", get: () => r, set: (v) => { r = v; } },
            { key: "debug", get: () => d, set: (v) => { d = v; } },
            { key: "price", get: () => p, set: (v) => { p = v; } },
        ].filter(x => x.get() > 0).sort((a, b) => b.get() - a.get());

        while (total > avail) {
            let reduced = false;
            for (const item of order) {
                const min = PANE_MIN[item.key];
                if (item.get() > min) {
                    item.set(item.get() - 1);
                    total--;
                    reduced = true;
                    if (total <= avail) break;
                }
            }
            if (!reduced) break;
        }

        return { run: r, debug: d, price: p };
    }

    function syncPaneStyles(run, debug, price) {
        const grow = document.querySelector(".right-panel-pane-grow:not(.right-panel-pane-hidden)");
        const map = { run, debug, price };
        Object.keys(map).forEach((name) => {
            const pane = document.querySelector(`.right-panel-pane[data-pane="${name}"]`);
            if (!pane || pane.classList.contains("right-panel-pane-hidden")) return;
            if (pane === grow) {
                pane.style.flex = "1 1 0";
                pane.style.height = "";
                pane.style.maxHeight = "";
                return;
            }
            const h = map[name];
            if (!h) return;
            pane.style.flex = `0 0 ${h}px`;
            pane.style.height = `${h}px`;
            pane.style.maxHeight = `${h}px`;
        });
        const scriptPane = document.getElementById("right-pane-script");
        if (scriptPane && !scriptPane.classList.contains("right-panel-pane-hidden") && scriptPane === grow) {
            scriptPane.style.flex = "1 1 0";
            scriptPane.style.height = "";
            scriptPane.style.maxHeight = "";
        }
    }

    function clampRightPanelLayout(persist) {
        if (layoutDragLock > 0) return null;
        const stored = readStoredHeights();
        return applyHeights(stored.run, stored.debug, stored.price, persist);
    }

    function loadRightHeights() {
        return clampRightPanelLayout(false);
    }

    function setPaneHeight(pane, h, partnerPane, partnerH) {
        if (!pane || pane.dataset.pane === "script") return;
        const name = pane.dataset.pane;
        const stored = readStoredHeights();
        stored[name] = h;
        if (partnerPane && partnerPane.dataset.pane !== "script" && partnerH != null) {
            stored[partnerPane.dataset.pane] = partnerH;
        }
        applyHeights(stored.run, stored.debug, stored.price, true);
    }

    function fixedPaneActive(name) {
        if (name === "run") return true;
        return isPaneVisible(name);
    }

    /** Сжать панели выше — чтобы нижняя (у сплиттера) могла продолжить расти. */
    function absorbShrinkFromAbove(belowName, amount, stored) {
        if (amount <= 0) return;
        let left = amount;
        const idx = PANE_ORDER.indexOf(belowName);
        for (let i = idx - 1; i >= 0 && left > 0; i--) {
            const n = PANE_ORDER[i];
            if (!fixedPaneActive(n)) continue;
            const cur = stored[n] || 0;
            if (cur <= 0) continue;
            const room = cur - PANE_MIN[n];
            if (room <= 0) continue;
            const take = Math.min(left, room);
            stored[n] = cur - take;
            left -= take;
        }
    }

    /** Сжать панели ниже — чтобы верхняя могла продолжить расти. */
    function absorbShrinkFromBelow(aboveName, amount, stored) {
        if (amount <= 0) return;
        let left = amount;
        const idx = PANE_ORDER.indexOf(aboveName);
        for (let i = idx + 1; i < PANE_ORDER.length && left > 0; i++) {
            const n = PANE_ORDER[i];
            if (!fixedPaneActive(n)) continue;
            const cur = stored[n] || 0;
            if (cur <= 0) continue;
            const room = cur - PANE_MIN[n];
            if (room <= 0) continue;
            const take = Math.min(left, room);
            stored[n] = cur - take;
            left -= take;
        }
    }

    /** Нижняя панель — grow (Скрипт): тянем сплиттер вниз → верхняя растёт, скрипт сжимается; у min — каскад вверх. */
    function solveGrowBottom(topName, dy, start) {
        const stored = Object.assign({}, start);
        const min = PANE_MIN[topName];
        const want = start[topName] + dy;
        if (want >= min) {
            stored[topName] = Math.round(want);
            return stored;
        }
        stored[topName] = min;
        absorbShrinkFromAbove(topName, min - want, stored);
        return stored;
    }

    /** Верхняя — grow: тянем вниз → нижняя фикс. растёт; у min — каскад вниз. */
    function solveGrowTop(bottomName, dy, start) {
        const stored = Object.assign({}, start);
        const min = PANE_MIN[bottomName];
        const want = start[bottomName] + dy;
        if (want >= min) {
            stored[bottomName] = Math.round(want);
            return stored;
        }
        stored[bottomName] = min;
        absorbShrinkFromBelow(bottomName, min - want, stored);
        return stored;
    }

    /** Две фиксированные панели: каскад в обе стороны при упоре в min. */
    function solvePair(topName, bottomName, dy, start) {
        const stored = Object.assign({}, start);
        const tMin = PANE_MIN[topName];
        const bMin = PANE_MIN[bottomName];
        const sum = start[topName] + start[bottomName];
        const wantTop = start[topName] + dy;
        const wantBot = start[bottomName] - dy;

        if (wantTop >= tMin && wantBot >= bMin) {
            stored[topName] = Math.round(wantTop);
            stored[bottomName] = Math.round(wantBot);
            return stored;
        }
        if (wantTop < tMin) {
            stored[topName] = tMin;
            const pairBot = sum - tMin;
            if (wantBot > pairBot) {
                absorbShrinkFromAbove(topName, wantBot - pairBot, stored);
                stored[bottomName] = Math.round(wantBot);
            } else {
                stored[bottomName] = Math.round(Math.max(bMin, wantBot));
            }
            return stored;
        }
        stored[bottomName] = bMin;
        const pairTop = sum - bMin;
        if (wantTop > pairTop) {
            absorbShrinkFromBelow(bottomName, wantTop - pairTop, stored);
            stored[topName] = Math.round(wantTop);
        } else {
            stored[topName] = Math.round(Math.max(tMin, wantTop));
        }
        return stored;
    }

    function bindSplitter(id, side) {
        const el = document.getElementById(id);
        if (!el) return;
        let startX = 0, startW = 0, dragging = false, pid = null;

        const onMove = (e) => {
            if (!dragging || (pid != null && e.pointerId !== pid)) return;
            const dx = e.clientX - startX;
            if (side === "left") {
                const w = Math.min(480, Math.max(180, startW + dx));
                applyWidths(w, parseInt(getComputedStyle(document.documentElement).getPropertyValue("--panel-right-w"), 10) || 400);
                localStorage.setItem(LS_LEFT, String(w));
            } else {
                const w = Math.min(620, Math.max(260, startW - dx));
                applyWidths(parseInt(getComputedStyle(document.documentElement).getPropertyValue("--panel-left-w"), 10) || 270, w);
                localStorage.setItem(LS_RIGHT, String(w));
            }
        };

        const stop = (e) => {
            if (pid != null && e && e.pointerId !== pid) return;
            if (!dragging) return;
            dragging = false;
            pid = null;
            el.classList.remove("dragging");
            document.body.classList.remove("panel-resizing");
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", stop);
            window.removeEventListener("pointercancel", stop);
            endLayoutDrag();
            clampRightPanelLayout(false);
        };

        el.addEventListener("pointerdown", (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            dragging = true;
            pid = e.pointerId;
            startX = e.clientX;
            const cs = getComputedStyle(document.documentElement);
            startW = side === "left"
                ? parseInt(cs.getPropertyValue("--panel-left-w"), 10) || 270
                : parseInt(cs.getPropertyValue("--panel-right-w"), 10) || 400;
            el.classList.add("dragging");
            document.body.classList.add("panel-resizing");
            beginLayoutDrag();
            try { el.setPointerCapture(e.pointerId); } catch (err) {}
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", stop);
            window.addEventListener("pointercancel", stop);
        });
    }

    function bindVerticalSplitter(splitId, topPaneId, bottomPaneId) {
        const el = document.getElementById(splitId);
        const topPane = document.getElementById(topPaneId);
        const bottomPane = document.getElementById(bottomPaneId);
        if (!el || !topPane || !bottomPane) return;

        let startY = 0, dragging = false, pid = null;
        let dragTop = topPane;
        let dragBottom = bottomPane;
        let dragStart = null;

        const onMove = (e) => {
            if (!dragging || (pid != null && e.pointerId !== pid) || !dragStart) return;
            if (el.classList.contains("panel-splitter-hidden")) return;
            const dy = e.clientY - startY;
            const topName = dragTop.dataset.pane;
            const bottomName = dragBottom.dataset.pane;
            const topIsGrow = dragTop.classList.contains("right-panel-pane-grow");
            const bottomIsGrow = dragBottom.classList.contains("right-panel-pane-grow");
            let next;

            if (bottomIsGrow && topName && topName !== "script" && !topIsGrow) {
                next = solveGrowBottom(topName, dy, dragStart);
            } else if (topIsGrow && bottomName && bottomName !== "script") {
                next = solveGrowTop(bottomName, dy, dragStart);
            } else if (topName && bottomName && topName !== "script" && bottomName !== "script") {
                next = solvePair(topName, bottomName, dy, dragStart);
            } else {
                return;
            }
            applyHeights(next.run, next.debug, next.price, true);
        };

        const stop = (e) => {
            if (pid != null && e && e.pointerId !== pid) return;
            if (!dragging) return;
            dragging = false;
            pid = null;
            el.classList.remove("dragging");
            document.body.classList.remove("panel-resizing-v");
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", stop);
            window.removeEventListener("pointercancel", stop);
            endLayoutDrag();
            const vis = readVisualHeights();
            applyHeights(vis.run, vis.debug, vis.price, true);
        };

        el.addEventListener("pointerdown", (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            dragging = true;
            pid = e.pointerId;
            startY = e.clientY;
            const resolved = resolveSplitterPanes(topPane, bottomPane);
            dragTop = resolved.top;
            dragBottom = resolved.bottom;
            dragStart = readStoredHeights();
            applyHeights(dragStart.run, dragStart.debug, dragStart.price, false);
            el.classList.add("dragging");
            document.body.classList.add("panel-resizing-v");
            beginLayoutDrag();
            try { el.setPointerCapture(e.pointerId); } catch (err) {}
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", stop);
            window.addEventListener("pointercancel", stop);
        });
    }

    function bindRightPanelResizeGuard() {
        const stack = document.getElementById("right-panel-stack");
        if (!stack) return;
        const rerun = () => clampRightPanelLayout(false);
        if (typeof ResizeObserver !== "undefined") {
            const ro = new ResizeObserver(rerun);
            ro.observe(stack);
            const main = document.getElementById("main-panels");
            if (main) ro.observe(main);
        }
        window.addEventListener("resize", rerun);
    }

    function positionMenu(menu, anchor) {
        if (!menu || !anchor) return;
        if (window.LZTUi?.portalFloatingMenu) window.LZTUi.portalFloatingMenu(menu);
        const r = anchor.getBoundingClientRect();
        const mw = menu.offsetWidth || 320;
        const mh = menu.offsetHeight || 200;
        let left = Math.min(r.right - mw, window.innerWidth - mw - 8);
        let top = r.bottom + 6;
        left = Math.max(8, left);
        if (top + mh > window.innerHeight - 8) {
            top = Math.max(8, r.top - mh - 6);
        }
        menu.style.left = left + "px";
        menu.style.top = top + "px";
        menu.style.maxHeight = Math.max(120, window.innerHeight - top - 12) + "px";
        menu.style.overflowY = "auto";
    }

    function bindFloatingMenus() {
        const shareBtn = document.getElementById("btn-share");
        const shareMenu = document.getElementById("share-menu");
        if (shareBtn && shareMenu) {
            shareBtn.addEventListener("click", () => {
                if (shareMenu.style.display === "block" || shareMenu.classList.contains("ui-open")) {
                    positionMenu(shareMenu, shareBtn);
                }
            });
        }
        const addBtn = document.getElementById("btn-add-block");
        const addMenu = document.getElementById("add-block-menu");
        if (addBtn && addMenu) {
            addBtn.addEventListener("click", () => {
                if (addMenu.style.display === "block" || addMenu.classList.contains("ui-open")) {
                    positionMenu(addMenu, addBtn);
                }
            });
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        loadWidths();
        applyPanelVisibility();
        bindPanelSettings();
        loadRightHeights();
        bindSplitter("split-left", "left");
        bindSplitter("split-right", "right");
        bindVerticalSplitter("split-run-debug", "right-pane-run", "right-pane-debug");
        bindVerticalSplitter("split-debug-price", "right-pane-debug", "right-pane-price");
        bindVerticalSplitter("split-price-script", "right-pane-price", "right-pane-script");
        bindRightPanelResizeGuard();
        bindFloatingMenus();
        requestAnimationFrame(() => clampRightPanelLayout(false));
    });

    window.LZTPanels = {
        positionMenu,
        loadWidths,
        loadRightHeights,
        clampRightPanelLayout,
        getPanelVisibility,
        applyPanelVisibility,
        syncPanelSettingsUI,
    };
})();
