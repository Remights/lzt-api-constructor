/** ResizeObserver, MutationObserver, canvas pointer/wheel для тура. */
(function () {
    "use strict";

    const { isVisible } = window.TourUtil;
    const { connectNodeEls, isRequestPopoverOpen, isRequestPopoverClosing, dismissNodePopover } = window.TourHelpers;

    function isTourSelfMutation(m) {
        const t = m.target;
        if (!(t instanceof Element)) return false;
        if (t.closest("#tour-spotlight-root")) return true;
        if (m.type !== "attributes" || m.attributeName !== "class") return false;
        if (!t.classList.contains("sport") && !t.classList.contains("snode-edit-hint")) return false;
        const strip = (s) => s.replace(/\btour-port-active\b/g, "").replace(/\btour-hint-blink\b/g, "").replace(/\s+/g, " ").trim();
        const prev = strip(m.oldValue || "");
        const next = strip([...t.classList].join(" "));
        return prev === next;
    }

    function createObservers(ctx) {
        let targetObs = null;
        let domObs = null;
        let domObsBump = 0;
        let portTrackOff = null;

        const stopTargetObs = () => {
            if (targetObs) {
                targetObs.disconnect();
                targetObs = null;
            }
        };

        const stopDomObs = () => {
            if (domObs) {
                domObs.disconnect();
                domObs = null;
            }
        };

        const stopPortTrack = () => {
            if (portTrackOff) {
                portTrackOff();
                portTrackOff = null;
            }
        };

        const bindDomObserver = (meta) => {
            stopDomObs();
            if (!meta?.liveDom) return;
            domObs = new MutationObserver((mutations) => {
                if (mutations.every(isTourSelfMutation)) return;
                const now = Date.now();
                if (now - domObsBump < 60) return;
                domObsBump = now;
                const cur = ctx.getStepMeta();
                if (cur?.usesRequestPop) {
                    if (isRequestPopoverClosing()) {
                        dismissNodePopover();
                        ctx.setRequestPopOpen(false);
                        if (ctx.getRequestPopSeen()) {
                            ctx.completeTask();
                            return;
                        }
                    }
                    const open = isRequestPopoverOpen();
                    if (open) {
                        ctx.setRequestPopSeen(true);
                        if (!ctx.getRequestPopOpen()) {
                            ctx.setRequestPopOpen(true);
                            ctx.scheduleReposition(false);
                            return;
                        }
                    } else {
                        ctx.setRequestPopOpen(false);
                    }
                }
                if (ctx.tryCompleteRequestPopStep()) return;
                ctx.scheduleReposition(false);
            });
            domObs.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["class", "style"],
                attributeOldValue: true,
            });
        };

        const bindTargetObserver = (meta, els) => {
            stopTargetObs();
            stopPortTrack();
            const tourCtx = ctx.tourCtx();

            if (!els.length && !meta?.highlightPorts) {
                let el = typeof meta.target === "function" ? meta.target(tourCtx) : document.querySelector(meta.target);
                if ((!el || !isVisible(el)) && meta.fallbackTarget) {
                    el = typeof meta.fallbackTarget === "function"
                        ? meta.fallbackTarget(tourCtx)
                        : document.querySelector(meta.fallbackTarget);
                }
                if (el && typeof ResizeObserver !== "undefined") {
                    let roBump = 0;
                    targetObs = new ResizeObserver(() => {
                        const now = Date.now();
                        if (now - roBump < 100) return;
                        roBump = now;
                        ctx.scheduleReposition(false);
                    });
                    targetObs.observe(el);
                }
                return;
            }
            if (typeof ResizeObserver !== "undefined") {
                let roBump = 0;
                targetObs = new ResizeObserver(() => {
                    const now = Date.now();
                    if (now - roBump < 100) return;
                    roBump = now;
                    ctx.scheduleReposition(false);
                });
                els.forEach(el => targetObs.observe(el));
                const panel = els[0]?.closest?.(".panel-left, .panel-right, .add-block-menu, .node-popover");
                if (panel) targetObs.observe(panel);
            }
            if (meta?.highlightPorts) {
                connectNodeEls().forEach(el => targetObs?.observe(el));
                const vp = document.getElementById("canvas-viewport");
                if (vp) {
                    let lastBump = 0;
                    const bump = (e) => {
                        if (e?.type === "pointermove" && !(e.buttons & 1) && !(e.buttons & 2) && !(e.buttons & 4)) return;
                        const now = Date.now();
                        if (now - lastBump < 120) return;
                        lastBump = now;
                        ctx.scheduleReposition(false);
                    };
                    vp.addEventListener("pointermove", bump, { passive: true });
                    vp.addEventListener("wheel", bump, { passive: true });
                    portTrackOff = () => {
                        vp.removeEventListener("pointermove", bump);
                        vp.removeEventListener("wheel", bump);
                    };
                }
            }
        };

        const cleanup = () => {
            stopTargetObs();
            stopPortTrack();
            stopDomObs();
        };

        return { bindDomObserver, bindTargetObserver, cleanup, stopDomObs };
    }

    window.TourObservers = { createObservers, isTourSelfMutation };
})();
