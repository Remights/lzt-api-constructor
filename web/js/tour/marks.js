/** Подсветка портов и hint на блоках сценария во время тура. */
(function () {
    "use strict";

    const { isVisible } = window.TourUtil;
    const { connectPortEls, isRequestPopoverOpen } = window.TourHelpers;

    function clearPortMarks() {
        document.querySelectorAll(".sport.tour-port-active").forEach(el => el.classList.remove("tour-port-active"));
    }

    function clearRequestHintMark() {
        document.querySelectorAll(".snode-edit-hint.tour-hint-blink").forEach(el => el.classList.remove("tour-hint-blink"));
    }

    function clearTourNodeMarks() {
        clearPortMarks();
        clearRequestHintMark();
    }

    function ensurePortMarks() {
        connectPortEls().filter(el => isVisible(el)).forEach(el => {
            if (!el.classList.contains("tour-port-active")) el.classList.add("tour-port-active");
        });
    }

    function applyRequestHintMark() {
        clearRequestHintMark();
        const hint = document.querySelector(".snode-request .snode-edit-hint");
        if (hint) hint.classList.add("tour-hint-blink");
    }

    function applyRequestHintIfNeeded(meta) {
        if (meta.highlightRequestHint && !isRequestPopoverOpen()) applyRequestHintMark();
    }

    window.TourMarks = {
        clearPortMarks,
        clearRequestHintMark,
        clearTourNodeMarks,
        ensurePortMarks,
        applyRequestHintMark,
        applyRequestHintIfNeeded,
    };
})();
