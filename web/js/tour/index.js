/** Spotlight-тур: shell — оркестрация шагов, render, task flow. */
(function () {
    "use strict";

    const { PAD, TASK_POLL_MS, PRAISE_HOLD_MS, t, esc } = window.TourUtil;
    const H = window.TourHelpers;
    const { STEP_META, steps, stepLabel } = window.TourSteps;
    const SP = window.TourSpotlight;
    const TT = window.TourTooltip;
    const MK = window.TourMarks;

    function start() {
        document.getElementById("tour-spotlight-root")?.remove();
        let i = 0;
        let taskDone = false;
        let pollTimer = null;

        let requestPopSeen = false;
        let requestPopOpen = false;
        let stepScrolled = false;
        let tipHovered = false;
        let lastSpotKey = "";
        let lastSpotVisKey = "";
        let spotVisualReady = false;
        let stepRingBumpDone = false;
        let repositionRaf = 0;
        let praiseTimer = null;
        let taskCompleting = false;
        const lastTipAnimStepRef = { value: -1 };

        const root = document.createElement("div");
        root.id = "tour-spotlight-root";
        root.className = "tour-spotlight-root tour-root-enter";
        root.innerHTML = `<div class="tour-spotlight-cutouts" id="tour-cutouts"></div>
            <div class="tour-spotlight-tooltip" id="tour-tooltip"></div>`;
        document.body.appendChild(root);
        document.body.classList.add("tour-active", "tour-fx-on");

        const cutoutsEl = root.querySelector("#tour-cutouts");
        const tip = root.querySelector("#tour-tooltip");
        SP.ensureSpotDom(cutoutsEl);

        tip.addEventListener("mouseenter", () => { tipHovered = true; });
        tip.addEventListener("mouseleave", () => { tipHovered = false; });

        const stopPoll = () => {
            if (pollTimer) {
                clearInterval(pollTimer);
                pollTimer = null;
            }
        };

        const stopPraiseTimer = () => {
            if (praiseTimer) {
                clearTimeout(praiseTimer);
                praiseTimer = null;
            }
        };

        const cancelReposition = () => {
            if (repositionRaf) {
                cancelAnimationFrame(repositionRaf);
                repositionRaf = 0;
            }
        };

        const tourCtx = () => ({ taskDone });

        const flushSpotlight = () => {
            lastSpotKey = "";
            lastSpotVisKey = "";
            spotVisualReady = false;
            stepRingBumpDone = false;
            MK.clearTourNodeMarks();
            SP.applySpotVisual(SP.ensureSpotDom(cutoutsEl), []);
        };

        const tryCompleteRequestPopStep = () => {
            const meta = STEP_META[i];
            if (!meta?.usesRequestPop || !requestPopSeen || H.isRequestPopoverOpen()) return false;
            H.dismissNodePopover();
            completeTask();
            return true;
        };

        const observerCtx = {
            tourCtx,
            getStepMeta: () => STEP_META[i],
            getRequestPopSeen: () => requestPopSeen,
            setRequestPopSeen: (v) => { requestPopSeen = v; },
            getRequestPopOpen: () => requestPopOpen,
            setRequestPopOpen: (v) => { requestPopOpen = v; },
            tryCompleteRequestPopStep,
            completeTask: () => completeTask(),
            scheduleReposition: (f) => scheduleReposition(f),
        };
        const observers = window.TourObservers.createObservers(observerCtx);

        const applyCutouts = (meta, els, force) => {
            let items = els.length
                ? els.map(el => SP.itemSpot(el, el.classList?.contains("sport") ? 0 : PAD, H.portSpot)).filter(Boolean)
                : [];

            const spot = SP.ensureSpotDom(cutoutsEl);

            if (!items.length) {
                lastSpotKey = "full";
                lastSpotVisKey = "";
                spotVisualReady = false;
                stepRingBumpDone = false;
                MK.clearTourNodeMarks();
                SP.applySpotVisual(spot, []);
                return null;
            }

            const geomKey = SP.spotKey(items);
            const spotOpts = SP.resolveSpotOpts(meta);
            const visKey = SP.spotVisKey(geomKey, spotOpts);
            const geomChanged = geomKey !== lastSpotKey;
            const visChanged = visKey !== lastSpotVisKey;
            const needsVisual = force || visChanged || !spotVisualReady || !SP.ringHasSpotVisual(spot);

            if (!visChanged && !needsVisual) {
                if (geomChanged) SP.applySpotGeometry(spot, items, true);
                if (meta.highlightPorts) MK.ensurePortMarks();
                MK.applyRequestHintIfNeeded(meta);
                return SP.unionRect(items.map(x => ({ top: x.top, left: x.left, width: x.width, height: x.height })));
            }

            if (needsVisual && visChanged) MK.clearTourNodeMarks();
            lastSpotKey = geomKey;
            lastSpotVisKey = visKey;

            const shouldBump = needsVisual && !spotOpts.glowOnly && (!stepRingBumpDone || visChanged);
            if (shouldBump) stepRingBumpDone = true;

            const union = SP.applySpotVisual(spot, items, {
                ...spotOpts,
                bump: shouldBump,
                soft: !needsVisual && geomChanged && !visChanged,
            });
            if (needsVisual) spotVisualReady = true;

            if (meta.highlightPorts) MK.ensurePortMarks();
            MK.applyRequestHintIfNeeded(meta);

            items.forEach(({ el, isPort }) => {
                if (isPort && el?.isConnected && !el.classList.contains("tour-port-active")) {
                    el.classList.add("tour-port-active");
                }
            });
            return union;
        };

        const reposition = (force) => {
            if (tipHovered && !force) return;
            if (tryCompleteRequestPopStep()) return;
            const list = steps();
            const meta = STEP_META[i];
            const s = list[i];
            const ctx = tourCtx();
            if (s.center) {
                MK.clearTourNodeMarks();
                tip.classList.remove("tour-tip-passive");
                lastSpotKey = "full";
                SP.renderFullDim(cutoutsEl);
                TT.placeTooltip(tip, null);
                return;
            }
            const els = SP.resolveTargets(meta, ctx);
            const union = applyCutouts(meta, els, force);
            const anchor = TT.tipAnchorRect(meta, ctx) || union;
            const avoidRects = typeof meta.tipAvoidRects === "function" ? meta.tipAvoidRects(ctx) : [];
            if (union) avoidRects.push(union);
            tip.classList.toggle("tour-tip-passive", !!meta.tipPassive);
            if (!anchor) {
                lastSpotKey = "full";
                SP.renderFullDim(cutoutsEl);
                TT.placeTooltip(tip, { top: window.innerHeight / 2 - 40, left: window.innerWidth / 2 - 140, width: 280, height: 80 }, "bottom", avoidRects);
                return;
            }
            TT.placeTooltip(tip, anchor, TT.tipPlacementFor(meta, s.placement, ctx), avoidRects);
            if (!stepScrolled && els[0]) {
                stepScrolled = true;
                els[0].scrollIntoView?.({ block: "nearest" });
            }
        };

        const scheduleReposition = (force) => {
            if (repositionRaf && !force) return;
            if (repositionRaf) cancelAnimationFrame(repositionRaf);
            repositionRaf = requestAnimationFrame(() => {
                repositionRaf = 0;
                reposition(force);
            });
        };

        const cleanupListeners = () => {
            stopPoll();
            observers.cleanup();
            stopPraiseTimer();
            cancelReposition();
        };

        const done = () => {
            cleanupListeners();
            document.removeEventListener("lzt-tour-panel-closed", onTourPanelClosed);
            MK.clearTourNodeMarks();
            window.removeEventListener("resize", onResize);
            localStorage.setItem("lzt_tour_done", "1");
            document.body.classList.remove("tour-active", "tour-fx-on");
            root.remove();
        };

        const advance = () => {
            const list = steps();
            if (i >= list.length - 1) done();
            else {
                taskDone = false;
                taskCompleting = false;
                i++;
                render();
            }
        };

        const finishTaskAdvance = () => {
            stopPraiseTimer();
            taskCompleting = false;
            taskDone = false;
            advance();
        };

        const bindPraiseActions = () => {
            tip.querySelector("#tour-skip")?.addEventListener("click", done);
            tip.querySelector("#tour-next")?.addEventListener("click", finishTaskAdvance);
        };

        const enterPraisePhase = () => {
            const meta = STEP_META[i];
            const s = steps()[i];
            const holdMs = meta.praiseHoldMs ?? PRAISE_HOLD_MS;
            taskDone = true;
            stopPoll();
            observers.stopDomObs();
            const waitEl = tip.querySelector(".tour-task-wait");
            if (waitEl) {
                waitEl.className = "tour-task-done";
                waitEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${esc(s.praise)}`;
            }
            const actions = tip.querySelector(".tour-actions");
            if (actions) {
                actions.innerHTML = `<button type="button" class="btn-token btn-token-sm" id="tour-skip">${t("tour.skip")}</button>
                    <div style="flex:1"></div>
                    <button type="button" class="btn-save btn-token-sm" id="tour-next">${t("tour.next")}</button>`;
                bindPraiseActions();
            }
            tip.classList.remove("tour-tooltip-praise");
            void tip.offsetWidth;
            tip.classList.add("tour-tooltip-praise");
            scheduleReposition(true);
            praiseTimer = setTimeout(finishTaskAdvance, holdMs);
        };

        function completeTask() {
            if (taskCompleting) return;
            const meta = STEP_META[i];
            const s = steps()[i];

            if (meta.usesRequestPop) {
                taskCompleting = true;
                cancelReposition();
                H.dismissNodePopover();
                try { meta.onComplete?.(); } catch (e) { /* ignore */ }
                flushSpotlight();
                stopPoll();
                finishTaskAdvance();
                return;
            }

            taskCompleting = true;
            cancelReposition();
            stopPoll();
            try { meta.onComplete?.(); } catch (e) { /* ignore */ }

            if (s.praise) {
                enterPraisePhase();
                return;
            }

            finishTaskAdvance();
        }

        observerCtx.completeTask = completeTask;

        const onTourPanelClosed = () => {
            const cur = STEP_META[i];
            if (!cur) return;
            cancelReposition();
            flushSpotlight();
            if (cur.usesRequestPop && requestPopSeen) {
                completeTask();
            } else if (!cur.usesRequestPop) {
                lastSpotKey = "";
                scheduleReposition(true);
            }
        };

        document.addEventListener("lzt-tour-panel-closed", onTourPanelClosed);

        const startTaskPoll = (meta) => {
            stopPoll();
            if (!meta.check && !meta.usesRequestPop) return;
            pollTimer = setInterval(() => {
                try {
                    if (meta.usesRequestPop) {
                        const open = H.isRequestPopoverOpen();
                        if (!open && requestPopSeen) {
                            completeTask();
                            return;
                        }
                        if (open !== requestPopOpen) {
                            requestPopOpen = open;
                            if (open) {
                                requestPopSeen = true;
                                scheduleReposition(true);
                            }
                        } else if (open) {
                            requestPopSeen = true;
                        }
                    } else if (meta.check?.() && !taskDone) {
                        completeTask();
                    }
                } catch (e) { /* ignore */ }
            }, TASK_POLL_MS);
        };

        const actionsHtml = (s, total, isLast) => {
            if (s.task && taskDone && s.praise) {
                return `<div class="tour-task-done"><i class="fa-solid fa-circle-check"></i> ${esc(s.praise)}</div>
                    <div class="tour-actions tour-actions--compact">
                        <button type="button" class="btn-token btn-token-sm" id="tour-skip">${t("tour.skip")}</button>
                        <div style="flex:1"></div>
                        <button type="button" class="btn-save btn-token-sm" id="tour-next">${t("tour.next")}</button>
                    </div>`;
            }
            if (s.task && !taskDone) {
                return `<div class="tour-task-wait"><i class="fa-solid fa-hand-pointer"></i> ${esc(s.hint)}</div>
                    <div class="tour-actions tour-actions--compact">
                        <button type="button" class="btn-token btn-token-sm" id="tour-skip">${t("tour.skip")}</button>
                    </div>`;
            }
            return `<div class="tour-actions tour-actions--compact">
                <button type="button" class="btn-token btn-token-sm" id="tour-skip">${t("tour.skip")}</button>
                <div style="flex:1"></div>
                ${i > 0 ? `<button type="button" class="btn-token btn-token-sm" id="tour-prev">${t("tour.back")}</button>` : ""}
                <button type="button" class="btn-save btn-token-sm" id="tour-next">${isLast ? t("tour.done") : t("tour.next")}</button>
            </div>`;
        };

        const render = () => {
            cleanupListeners();
            stepScrolled = false;
            lastSpotKey = "";
            lastSpotVisKey = "";
            spotVisualReady = false;
            stepRingBumpDone = false;
            lastTipAnimStepRef.value = -1;
            const list = steps();
            const meta = STEP_META[i];
            const s = list[i];
            const total = list.length;
            const isLast = i === total - 1;

            meta.onEnter?.();
            if (meta.usesRequestPop) {
                requestPopSeen = false;
                requestPopOpen = H.isRequestPopoverOpen();
            }

            if (s.center) {
                SP.renderFullDim(cutoutsEl);
                if (s.langPick) {
                    const cur = window.I18N?.lang || "ru";
                    tip.className = "tour-spotlight-tooltip tour-spotlight-tooltip--center";
                    tip.innerHTML = `<div class="tour-ico"><i class="fa-solid ${s.icon}"></i></div>
                        <div class="tour-title">${esc(s.title)}</div>
                        <div class="tour-text">${s.text}</div>
                        <div class="tour-lang-pick">
                            <button type="button" class="tour-lang-btn${cur === "ru" ? " active" : ""}" data-lang="ru">${t("tour.langRu")}</button>
                            <button type="button" class="tour-lang-btn${cur === "en" ? " active" : ""}" data-lang="en">${t("tour.langEn")}</button>
                        </div>
                        <div class="tour-progress">
                            <div class="tour-step-label">${stepLabel(i, total)}</div>
                            <div class="tour-dots">${list.map((_, k) => `<span class="${k === i ? "on" : ""}"></span>`).join("")}</div>
                        </div>
                        <div class="tour-actions">
                            <button type="button" class="btn-token" id="tour-skip">${t("tour.skip")}</button>
                            <div class="tour-actions-right">
                                <button type="button" class="btn-save" id="tour-next">${t("tour.next")}</button>
                            </div>
                        </div>`;
                    tip.querySelectorAll("[data-lang]").forEach(btn => {
                        btn.addEventListener("click", () => {
                            if (window.I18N) I18N.set(btn.dataset.lang);
                            const ls = document.getElementById("set-lang");
                            if (ls) ls.value = btn.dataset.lang;
                            render();
                        });
                    });
                } else {
                    tip.className = "tour-spotlight-tooltip tour-spotlight-tooltip--center";
                    tip.innerHTML = `<div class="tour-ico"><i class="fa-solid ${s.icon}"></i></div>
                        <div class="tour-title">${esc(s.title)}</div>
                        <div class="tour-text">${s.text}</div>
                        <div class="tour-progress">
                            <div class="tour-step-label">${stepLabel(i, total)}</div>
                            <div class="tour-dots">${list.map((_, k) => `<span class="${k === i ? "on" : ""}"></span>`).join("")}</div>
                        </div>
                        <div class="tour-actions">
                            <button type="button" class="btn-token" id="tour-skip">${t("tour.skip")}</button>
                            <div class="tour-actions-right">
                                ${i > 0 ? `<button type="button" class="btn-token" id="tour-prev">${t("tour.back")}</button>` : ""}
                                <button type="button" class="btn-save" id="tour-next">${isLast ? t("tour.done") : t("tour.next")}</button>
                            </div>
                        </div>`;
                }
            } else {
                tip.className = "tour-spotlight-tooltip" + (meta.tipPassive ? " tour-tip-passive" : "");
                tip.innerHTML = `<div class="tour-spotlight-tooltip-head">
                        <i class="fa-solid ${s.icon}"></i>
                        <span>${esc(s.title)}</span>
                    </div>
                    <div class="tour-text">${s.text}</div>
                    <div class="tour-step-label">${stepLabel(i, total)}</div>
                    ${actionsHtml(s, total, isLast)}`;
            }

            tip.querySelector("#tour-skip")?.addEventListener("click", done);
            tip.querySelector("#tour-prev")?.addEventListener("click", () => {
                taskDone = false;
                taskCompleting = false;
                stopPraiseTimer();
                i--;
                render();
            });
            tip.querySelector("#tour-next")?.addEventListener("click", () => {
                if (taskDone) finishTaskAdvance();
                else if (isLast) done();
                else advance();
            });

            TT.playTipEnter(tip, i, lastTipAnimStepRef, true);

            requestAnimationFrame(() => {
                scheduleReposition(true);
                if (!s.center) {
                    observers.bindTargetObserver(meta, SP.resolveTargets(meta, tourCtx()));
                    observers.bindDomObserver(meta);
                }
                if (s.task && !taskDone && !taskCompleting) {
                    if (meta.usesRequestPop) {
                        if (H.isRequestPopoverOpen()) requestPopSeen = true;
                    } else if (meta.check?.()) completeTask();
                    startTaskPoll(meta);
                }
                if (!s.center && (lastSpotKey === "full" || !spotVisualReady)) {
                    requestAnimationFrame(() => scheduleReposition(true));
                }
            });
        };

        const onResize = () => scheduleReposition(true);

        window.addEventListener("resize", onResize);
        root.addEventListener("click", (e) => {
            if (e.target === root && steps()[i]?.center) done();
        });

        render();
    }

    window.LZTTour = { start, steps };
})();
