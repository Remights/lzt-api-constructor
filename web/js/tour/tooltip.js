/** Позиционирование tooltip тура. */
(function () {
    "use strict";

    const { rectFor } = window.TourSpotlight;
    const { rectsOverlap } = window.TourSpotlight;

    function placeTooltip(tip, rect, placement, avoidRects) {
        avoidRects = avoidRects || [];
        if (!rect) {
            tip.style.top = "50%";
            tip.style.left = "50%";
            tip.style.transform = "translate(-50%, -50%)";
            tip.dataset.placement = "center";
            return;
        }
        const margin = 14;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const tw = Math.max(tip.offsetWidth || 0, 280);
        const th = Math.max(tip.offsetHeight || 0, 80);

        const posFor = (p) => {
            let top, left;
            if (p === "bottom") {
                top = rect.top + rect.height + margin;
                left = rect.left + rect.width / 2 - tw / 2;
            } else if (p === "top") {
                top = rect.top - th - margin;
                left = rect.left + rect.width / 2 - tw / 2;
            } else if (p === "left") {
                top = rect.top + rect.height / 2 - th / 2;
                left = rect.left - tw - margin;
            } else {
                top = rect.top + rect.height / 2 - th / 2;
                left = rect.left + rect.width + margin;
            }
            left = Math.max(12, Math.min(left, vw - tw - 12));
            top = Math.max(12, Math.min(top, vh - th - 12));
            return { top, left, p };
        };

        const tipRect = (cand) => ({ top: cand.top, left: cand.left, width: tw, height: th });
        const hitsAnchor = (cand) => rectsOverlap(tipRect(cand), rect, 8);
        const hitsAvoid = (cand) => avoidRects.some(ar => rectsOverlap(tipRect(cand), ar, 12));

        const order = [placement || "bottom", "bottom", "left", "top", "right"].filter((v, idx, a) => a.indexOf(v) === idx);
        let best = posFor(order[0]);
        for (const p of order) {
            const cand = posFor(p);
            if (!hitsAnchor(cand) && !hitsAvoid(cand)) { best = cand; break; }
            best = cand;
        }

        tip.style.top = best.top + "px";
        tip.style.left = best.left + "px";
        tip.style.removeProperty("transform");
        tip.dataset.placement = best.p;
    }

    function tipAnchorRect(meta, ctx) {
        const sel = typeof meta.tipAnchor === "function" ? meta.tipAnchor(ctx) : meta.tipAnchor;
        if (!sel) return null;
        if (sel instanceof Element) return rectFor(sel);
        if (typeof sel === "object" && "top" in sel && "left" in sel) return sel;
        const el = document.querySelector(sel);
        return el ? rectFor(el) : null;
    }

    function tipPlacementFor(meta, fallback, ctx) {
        if (typeof meta.tipPlacement === "function") return meta.tipPlacement(ctx);
        return meta.tipPlacement || fallback;
    }

    function playTipEnter(tip, stepIndex, lastTipAnimStepRef, force) {
        if (!force && lastTipAnimStepRef.value === stepIndex) return;
        lastTipAnimStepRef.value = stepIndex;
        tip.classList.remove("tour-tooltip-enter", "tour-tooltip-praise");
        void tip.offsetWidth;
        tip.classList.add("tour-tooltip-enter");
    }

    window.TourTooltip = { placeTooltip, tipAnchorRect, tipPlacementFor, playTipEnter };
})();
