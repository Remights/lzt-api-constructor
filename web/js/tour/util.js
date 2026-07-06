/** Общие утилиты spotlight-тура. */
(function () {
    "use strict";

    const PAD = 8;
    const TASK_POLL_MS = 500;
    const PRAISE_HOLD_MS = 3000;

    function t(key, fb) {
        return (window.I18N && I18N.t(key)) || fb || key;
    }

    function esc(s) {
        return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function S() {
        return window.Scenario;
    }

    function isVisible(el) {
        if (!el || !el.isConnected) return false;
        if (el.classList.contains("ui-closing")) return false;
        const st = getComputedStyle(el);
        if (st.display === "none" || st.visibility === "hidden") return false;
        const r = el.getBoundingClientRect();
        if (r.width <= 1 || r.height <= 1) return false;
        if (el.classList.contains("node-popover") && !el.classList.contains("ui-open")) return false;
        if (el.classList.contains("add-block-menu") && !el.classList.contains("ui-open") && el.style.display !== "block") return false;
        if (Number(st.opacity) === 0 && !el.classList.contains("ui-open")) return false;
        return r.bottom > 0 && r.right > 0;
    }

    window.TourUtil = { PAD, TASK_POLL_MS, PRAISE_HOLD_MS, t, esc, S, isVisible };
})();
