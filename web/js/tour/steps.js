/** Мета-данные шагов spotlight-тура. */
(function () {
    "use strict";

    const { t } = window.TourUtil;
    const H = window.TourHelpers;

    const STEP_META = [
        { id: "lang", center: true, langPick: true, icon: "fa-language", titleKey: "tour.s0.title", textKey: "tour.s0.text" },
        { id: "welcome", center: true, icon: "fa-hand-sparkles", titleKey: "tour.welcome.title", textKey: "tour.welcome.text" },
        {
            id: "canvas", target: "#canvas-viewport", placement: "right", icon: "fa-diagram-project",
            titleKey: "tour.canvas.title", textKey: "tour.canvas.text", pulse: true,
        },
        {
            id: "addBlockOpen", task: true, target: H.addBlockOpenTarget, placement: "bottom",
            fallbackTarget: "#btn-add-block",
            tipAnchor: H.menuTipAnchor, tipPlacement: H.menuTipPlacement, icon: "fa-plus", pulse: true,
            tipPassive: true, liveDom: true,
            titleKey: "tour.task.addOpen.title", textKey: "tour.task.addOpen.text",
            hintKey: "tour.task.addOpen.hint", praiseKey: "tour.task.addOpen.praise",
            praiseHoldMs: 1700,
            check: H.isAddBlockMenuOpen,
        },
        {
            id: "addBlockPick", task: true,
            target: H.addBlockPickTarget,
            fallbackTarget: "#add-block-menu", placement: "bottom",
            tipAnchor: H.pickTipAnchor, tipPlacement: H.pickTipPlacement, icon: "fa-bolt", pulse: true,
            tipPassive: true, liveDom: true,
            titleKey: "tour.task.addPick.title", textKey: "tour.task.addPick.text",
            hintKey: "tour.task.addPick.hint", praiseKey: "tour.task.addPick.praise",
            praiseHoldMs: 1500,
            check: () => H.hasBlockType("request"),
            onComplete: H.layoutTourBlocks,
            onEnter: H.openAddBlockMenu,
        },
        {
            id: "requestEdit", task: true,
            target: H.requestEditTarget,
            fallbackTarget: ".snode-request", placement: "right",
            tipAnchor: H.requestEditTarget,
            tipPlacement: () => "right",
            icon: "fa-bolt", pulse: true,
            spotStyle: H.requestEditSpotStyle,
            highlightRequestHint: true,
            tipPassive: true, liveDom: true,
            titleKey: "tour.task.requestEdit.title", textKey: "tour.task.requestEdit.text",
            hintKey: "tour.task.requestEdit.hint", praiseKey: "tour.task.requestEdit.praise",
            onEnter: H.prepareRequestForTour,
            onComplete: () => {
                H.dismissNodePopover();
                H.layoutTourBlocks();
            },
            usesRequestPop: true,
        },
        {
            id: "connect", task: true,
            multiTarget: true, targets: H.connectSpotTargets,
            fallbackTarget: "#canvas-viewport", placement: "bottom",
            tipAnchor: H.connectTipAnchor, tipPlacement: "bottom",
            tipAvoidRects: H.connectAvoidRects,
            icon: "fa-arrow-right-arrow-left", pulse: true,
            highlightPorts: true, tipPassive: true, liveDom: true,
            titleKey: "tour.connect.title", textKey: "tour.connect.text",
            hintKey: "tour.task.connect.hint", praiseKey: "tour.task.connect.praise",
            check: H.hasStartToRequestEdge,
            onEnter: () => {
                H.dismissNodePopover();
                H.layoutTourBlocks();
                requestAnimationFrame(() => window.TourUtil.S()?.fitView?.());
            },
        },
        {
            id: "demo", task: true,
            target: H.demoScenarioRow,
            fallbackTarget: "#scenario-examples-list", placement: "right", icon: "fa-flask", pulse: true,
            titleKey: "tour.demo.title", textKey: "tour.demo.text",
            hintKey: "tour.task.demo.hint", praiseKey: "tour.task.demo.praise",
            tipAnchor: "#panel-left", tipPlacement: "right",
            onEnter: () => {
                H.clearDemoExampleActive();
                H.scrollDemoRow();
            },
            check: H.isDemoExamplePickedThisStep,
        },
        {
            id: "run", target: "#btn-run-scenario", placement: "left", icon: "fa-play",
            titleKey: "tour.run.title", textKey: "tour.run.text", pulse: true,
        },
        {
            id: "log", target: "#run-log", placement: "left", icon: "fa-list-check",
            titleKey: "tour.log.title", textKey: "tour.log.text", pulse: true,
        },
        {
            id: "debug", target: "#run-debug", placement: "left", icon: "fa-table",
            titleKey: "tour.debug.title", textKey: "tour.debug.text", pulse: true,
        },
        {
            id: "script", target: "#right-pane-script", placement: "left", icon: "fa-robot",
            titleKey: "tour.script.title", textKey: "tour.script.text", pulse: true,
        },
        { id: "done", center: true, icon: "fa-circle-check", titleKey: "tour.done.title", textKey: "tour.done.text" },
    ];

    function steps() {
        return STEP_META.map(m => ({
            ...m,
            title: t(m.titleKey),
            text: t(m.textKey),
            hint: m.hintKey ? t(m.hintKey) : "",
            praise: m.praiseKey ? t(m.praiseKey) : "",
        }));
    }

    function stepLabel(i, total) {
        return t("tour.stepOf", "Шаг {n} из {total}").replace("{n}", i + 1).replace("{total}", total);
    }

    window.TourSteps = { STEP_META, steps, stepLabel };
})();
