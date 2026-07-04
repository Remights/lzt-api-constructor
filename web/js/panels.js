// IDE-раскладка: перетаскиваемые разделители между 3 панелями + позиционирование выпадающих меню.
(function () {
    "use strict";

    const LS_LEFT = "lzt_panel_left_w";
    const LS_RIGHT = "lzt_panel_right_w";

    function applyWidths(left, right) {
        document.documentElement.style.setProperty("--panel-left-w", left + "px");
        document.documentElement.style.setProperty("--panel-right-w", right + "px");
    }

    function loadWidths() {
        const l = parseInt(localStorage.getItem(LS_LEFT) || "270", 10);
        const r = parseInt(localStorage.getItem(LS_RIGHT) || "400", 10);
        applyWidths(l, r);
        return { left: l, right: r };
    }

    function bindSplitter(id, side) {
        const el = document.getElementById(id);
        if (!el) return;
        let startX = 0, startW = 0, dragging = false;

        const onMove = (e) => {
            if (!dragging) return;
            const dx = e.clientX - startX;
            const main = document.getElementById("main-panels");
            const maxRight = main ? main.clientWidth - 560 : 1200;
            if (side === "left") {
                const w = Math.min(480, Math.max(180, startW + dx));
                applyWidths(w, parseInt(getComputedStyle(document.documentElement).getPropertyValue("--panel-right-w"), 10) || 400);
                localStorage.setItem(LS_LEFT, String(w));
            } else {
                const w = Math.min(620, Math.max(260, startW - dx));
                applyWidths(parseInt(getComputedStyle(document.documentElement).getPropertyValue("--panel-left-w"), 10) || 270, w);
                localStorage.setItem(LS_RIGHT, String(w));
            }
            if (main && main.clientWidth < 900) { /* узкое окно — ok */ }
        };

        const stop = () => {
            dragging = false;
            el.classList.remove("dragging");
            document.body.classList.remove("panel-resizing");
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", stop);
        };

        el.addEventListener("mousedown", (e) => {
            e.preventDefault();
            dragging = true;
            startX = e.clientX;
            const cs = getComputedStyle(document.documentElement);
            startW = side === "left"
                ? parseInt(cs.getPropertyValue("--panel-left-w"), 10) || 270
                : parseInt(cs.getPropertyValue("--panel-right-w"), 10) || 400;
            el.classList.add("dragging");
            document.body.classList.add("panel-resizing");
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", stop);
        });
    }

    function positionMenu(menu, anchor) {
        if (!menu || !anchor) return;
        const r = anchor.getBoundingClientRect();
        menu.style.left = Math.min(r.right - 320, window.innerWidth - 330) + "px";
        menu.style.top = (r.bottom + 6) + "px";
    }

    function bindFloatingMenus() {
        const shareBtn = document.getElementById("btn-share");
        const shareMenu = document.getElementById("share-menu");
        if (shareBtn && shareMenu) {
            shareBtn.addEventListener("click", () => {
                if (shareMenu.style.display === "block") positionMenu(shareMenu, shareBtn);
            });
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        loadWidths();
        bindSplitter("split-left", "left");
        bindSplitter("split-right", "right");
        bindFloatingMenus();
    });

    window.LZTPanels = { positionMenu, loadWidths };
})();
