/** DOM-хелперы шагов тура (меню блоков, canvas, demo). */
(function () {
    "use strict";

    const { S, isVisible } = window.TourUtil;

    function isAddBlockMenuOpen() {
        const menu = document.getElementById("add-block-menu");
        if (!menu || menu.classList.contains("ui-closing")) return false;
        return menu.classList.contains("ui-open") || menu.style.display === "block";
    }

    function hasBlockType(type) {
        const sc = S();
        return !!(sc && sc.nodes.some(n => n.type === type));
    }

    function hasStartToRequestEdge() {
        const sc = S();
        if (!sc) return false;
        const start = sc.nodes.find(n => n.type === "start");
        const req = sc.nodes.find(n => n.type === "request");
        if (!start || !req) return false;
        return sc.edges.some(e => e.from === start.id && e.to === req.id);
    }

    function portSpot(el) {
        if (!el || !isVisible(el)) return null;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const rad = Math.max(18, Math.max(r.width, r.height) / 2 + 10);
        return {
            el, isPort: true, cx, cy, rad,
            top: cy - rad,
            left: cx - rad,
            width: rad * 2,
            height: rad * 2,
        };
    }

    function connectPortEls() {
        const out = document.querySelector('.snode-start .sport[data-port="out"][data-dir="out"]');
        const inn = document.querySelector('.snode-request .sport[data-port="in"][data-dir="in"]');
        return [out, inn].filter(Boolean);
    }

    function layoutTourBlocks() {
        const sc = S();
        if (!sc) return;
        const start = sc.nodes.find(n => n.type === "start");
        const req = sc.nodes.find(n => n.type === "request");
        if (!start || !req) return;
        start.x = 80;
        start.y = 220;
        req.x = 380;
        req.y = 200;
        sc.render();
        sc.redrawEdges?.();
        sc.commit?.();
        const menu = document.getElementById("add-block-menu");
        if (menu && window.LZTUi) window.LZTUi.hideFloatingMenu(menu);
        else if (menu) menu.style.display = "none";
    }

    function addBlockPickTarget(ctx) {
        if (ctx?.taskDone || hasBlockType("request")) {
            return document.querySelector(".snode-request");
        }
        const item = document.querySelector('#add-block-menu .add-block-item[data-type="request"]');
        if (item && isVisible(item)) return item;
        const menu = document.getElementById("add-block-menu");
        if (menu && isVisible(menu)) return menu;
        return document.querySelector(".snode-request");
    }

    function pickTipAnchor(ctx) {
        if (ctx?.taskDone || hasBlockType("request")) return "#canvas-viewport";
        return menuTipAnchor();
    }

    function pickTipPlacement(ctx) {
        if (ctx?.taskDone || hasBlockType("request")) return "bottom";
        return menuTipPlacement();
    }

    function addBlockOpenTarget() {
        if (isAddBlockMenuOpen()) {
            const menu = document.getElementById("add-block-menu");
            if (menu && isVisible(menu)) return menu;
        }
        return document.querySelector("#btn-add-block");
    }

    function openAddBlockMenu() {
        const menu = document.getElementById("add-block-menu");
        const btn = document.getElementById("btn-add-block");
        if (!menu) return;
        if (!isAddBlockMenuOpen()) {
            if (window.LZTUi) window.LZTUi.showFloatingMenu(menu);
            else menu.style.display = "block";
        }
        if (btn && window.LZTPanels?.positionMenu) window.LZTPanels.positionMenu(menu, btn);
    }

    function menuTipAnchor() {
        return isAddBlockMenuOpen() ? "#add-block-menu" : "#btn-add-block";
    }

    function menuTipPlacement() {
        return isAddBlockMenuOpen() ? "left" : "bottom";
    }

    function dismissNodePopover() {
        document.querySelectorAll(".node-popover, .floating-panel-backdrop").forEach(p => p.remove());
    }

    function requestEditSpotStyle() {
        if (isRequestPopoverOpen()) return { pulse: true, glowOnly: false };
        return { pulse: false, glowOnly: true };
    }

    function isRequestPopoverOpen() {
        const pop = document.querySelector(".node-popover");
        if (!pop || pop.classList.contains("ui-closing")) return false;
        return pop.classList.contains("ui-open");
    }

    function isRequestPopoverClosing() {
        const pop = document.querySelector(".node-popover");
        return !!(pop && pop.classList.contains("ui-closing"));
    }

    function requestEditTarget() {
        const pop = document.querySelector(".node-popover");
        if (pop && pop.classList.contains("ui-open") && !pop.classList.contains("ui-closing")) return pop;
        const node = document.querySelector(".snode-request");
        return node && isVisible(node) ? node : null;
    }

    function prepareRequestForTour() {
        layoutTourBlocks();
        const sc = S();
        const node = sc?.nodes.find(n => n.type === "request");
        if (!node) return;
        node.request = node.request || {};
        if (!node.request.url) node.request.url = "https://prod-api.lzt.market/";
        if (!node.request.method) node.request.method = "GET";
        if (!node.request.params || !Object.keys(node.request.params).length) {
            node.request.params = { pmin: "1", pmax: "100", order_by: "price_to_up" };
        }
        if (!node.request.title) node.request.title = "Новый запрос";
        sc.render();
        sc.regenScript?.();
    }

    function connectNodeEls() {
        return [
            document.querySelector(".snode-start"),
            document.querySelector(".snode-request"),
        ].filter(el => el && isVisible(el));
    }

    function connectSpotTargets() {
        const nodes = connectNodeEls();
        if (nodes.length) return nodes;
        const vp = document.querySelector("#canvas-viewport");
        return vp ? [vp] : [];
    }

    function connectTipAnchor() {
        return document.querySelector(".canvas-toolbar")
            || document.querySelector("#btn-add-block")
            || document.querySelector("#canvas-viewport");
    }

    function connectAvoidRects() {
        const { rectFor } = window.TourSpotlight;
        const rects = connectNodeEls().map(el => rectFor(el, 4)).filter(Boolean);
        connectPortEls().forEach(el => {
            const ps = portSpot(el);
            if (ps) rects.push({ top: ps.top, left: ps.left, width: ps.width, height: ps.height });
        });
        return rects;
    }

    function demoScenarioRow() {
        return document.querySelector('#scenario-examples-list .tpl-row[data-tour-id="demo"]')
            || document.querySelector("#scenario-examples-list .tpl-row");
    }

    function scrollDemoRow() {
        demoScenarioRow()?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    }

    function clearDemoExampleActive() {
        document.querySelectorAll("#scenario-examples-list .tpl-row").forEach(el => el.classList.remove("active"));
    }

    function isDemoScenarioLoaded() {
        const sc = S();
        return !!(sc && sc._scenarioIsDemo);
    }

    function isDemoExamplePickedThisStep() {
        if (!isDemoScenarioLoaded()) return false;
        return !!document.querySelector('#scenario-examples-list .tpl-row[data-tour-id="demo"].active');
    }

    window.TourHelpers = {
        isAddBlockMenuOpen,
        hasBlockType,
        hasStartToRequestEdge,
        portSpot,
        connectPortEls,
        layoutTourBlocks,
        addBlockPickTarget,
        pickTipAnchor,
        pickTipPlacement,
        addBlockOpenTarget,
        openAddBlockMenu,
        menuTipAnchor,
        menuTipPlacement,
        dismissNodePopover,
        requestEditSpotStyle,
        isRequestPopoverOpen,
        isRequestPopoverClosing,
        requestEditTarget,
        prepareRequestForTour,
        connectNodeEls,
        connectSpotTargets,
        connectTipAnchor,
        connectAvoidRects,
        demoScenarioRow,
        scrollDemoRow,
        clearDemoExampleActive,
        isDemoScenarioLoaded,
        isDemoExamplePickedThisStep,
    };
})();
