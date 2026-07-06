// Кастомные диалоги и тосты в стиле LZT API Constructor (замена alert/confirm/prompt).
(function () {
    "use strict";

    let zIndex = 12000;
    const UI_ANIM_MS = 220;

    function showOverlay(el) {
        if (!el) return;
        el.style.display = "flex";
        el.classList.remove("ui-closing");
        void el.offsetWidth;
        requestAnimationFrame(() => el.classList.add("ui-open"));
    }

    function hideOverlay(el, opts) {
        opts = opts || {};
        if (!el || el.style.display === "none" || el.classList.contains("ui-closing")) return;
        el.classList.remove("ui-open");
        el.classList.add("ui-closing");
        window.setTimeout(() => {
            el.classList.remove("ui-closing");
            if (opts.remove) el.remove();
            else el.style.display = "none";
        }, UI_ANIM_MS);
    }

    function portalFloatingMenu(el) {
        if (!el || el.dataset.portaled === "1") return;
        document.body.appendChild(el);
        el.dataset.portaled = "1";
    }

    function showFloatingMenu(el) {
        if (!el) return;
        portalFloatingMenu(el);
        el.style.display = "block";
        el.classList.remove("ui-closing");
        void el.offsetWidth;
        requestAnimationFrame(() => el.classList.add("ui-open"));
    }

    function hideFloatingMenu(el) {
        if (!el || el.style.display === "none" || el.classList.contains("ui-closing")) return;
        if (document.body.classList.contains("tour-active")) {
            el.style.display = "none";
            el.classList.remove("ui-open", "ui-closing");
            document.dispatchEvent(new CustomEvent("lzt-tour-panel-closed"));
            return;
        }
        el.classList.remove("ui-open");
        el.classList.add("ui-closing");
        window.setTimeout(() => {
            el.style.display = "none";
            el.classList.remove("ui-closing");
        }, UI_ANIM_MS);
    }

    function animateCloseFloatingPanel(pop, backdrop, onEsc) {
        if (!pop || pop.classList.contains("ui-closing")) return;
        if (document.body.classList.contains("tour-active")) {
            if (onEsc) document.removeEventListener("keydown", onEsc);
            backdrop?.remove();
            pop.remove();
            if (pop._close) delete pop._close;
            document.dispatchEvent(new CustomEvent("lzt-tour-panel-closed"));
            return;
        }
        pop.classList.remove("ui-open");
        backdrop?.classList.remove("ui-open");
        pop.classList.add("ui-closing");
        backdrop?.classList.add("ui-closing");
        if (onEsc) document.removeEventListener("keydown", onEsc);
        window.setTimeout(() => {
            backdrop?.remove();
            pop.remove();
            if (pop._close) delete pop._close;
        }, UI_ANIM_MS);
    }

    function esc(s) {
        return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function ensureHost() {
        let host = document.getElementById("lzt-dialog-host");
        if (!host) {
            host = document.createElement("div");
            host.id = "lzt-dialog-host";
            document.body.appendChild(host);
        }
        return host;
    }

    function showDialog(opts) {
        opts = Object.assign({
            type: "alert",
            title: "LZT API Constructor",
            message: "",
            defaultValue: "",
            okText: "OK",
            cancelText: "Отмена",
            icon: "fa-circle-info",
            danger: false
        }, opts || {});

        return new Promise((resolve) => {
            const host = ensureHost();
            const ov = document.createElement("div");
            ov.className = "lzt-dialog-overlay";
            ov.style.zIndex = String(++zIndex);

            const isConfirm = opts.type === "confirm";
            const isPrompt = opts.type === "prompt";
            const msgHtml = esc(opts.message).replace(/\n/g, "<br>");

            ov.innerHTML = `<div class="lzt-dialog-box" role="dialog">
                <div class="lzt-dialog-header">
                    <span class="lzt-dialog-title"><i class="fa-solid ${opts.icon}"></i> ${esc(opts.title)}</span>
                    <button type="button" class="lzt-dialog-x" aria-label="Закрыть"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="lzt-dialog-body">${msgHtml}${isPrompt ? `<input type="text" class="form-control lzt-dialog-input" value="${esc(opts.defaultValue)}">` : ""}</div>
                <div class="lzt-dialog-footer">
                    ${isConfirm || isPrompt ? `<button type="button" class="btn-token lzt-dialog-cancel">${esc(opts.cancelText)}</button>` : ""}
                    <button type="button" class="btn-save lzt-dialog-ok">${esc(opts.okText)}</button>
                </div>
            </div>`;

            const close = (result) => {
                ov.classList.add("lzt-dialog-out");
                setTimeout(() => ov.remove(), UI_ANIM_MS);
                resolve(result);
            };

            const okBtn = ov.querySelector(".lzt-dialog-ok");
            const cancelBtn = ov.querySelector(".lzt-dialog-cancel");
            const inputEl = ov.querySelector(".lzt-dialog-input");
            if (opts.danger) okBtn.classList.add("lzt-dialog-danger");

            okBtn.addEventListener("click", () => {
                if (isPrompt) close(inputEl.value);
                else if (isConfirm) close(true);
                else close(true);
            });
            cancelBtn?.addEventListener("click", () => close(isPrompt ? null : false));
            ov.querySelector(".lzt-dialog-x").addEventListener("click", () => close(isPrompt ? null : isConfirm ? false : true));
            ov.addEventListener("click", (e) => { if (e.target === ov) close(isPrompt ? null : isConfirm ? false : true); });

            const onKey = (e) => {
                if (e.key === "Escape") { document.removeEventListener("keydown", onKey); close(isPrompt ? null : isConfirm ? false : true); }
                if (e.key === "Enter" && (!isPrompt || document.activeElement === inputEl)) {
                    document.removeEventListener("keydown", onKey);
                    if (isPrompt) close(inputEl.value);
                    else close(isConfirm ? true : true);
                }
            };
            document.addEventListener("keydown", onKey);

            host.appendChild(ov);
            requestAnimationFrame(() => {
                ov.classList.add("lzt-dialog-in");
                if (inputEl) { inputEl.focus(); inputEl.select(); }
                else okBtn.focus();
            });
        });
    }

    function toastContainer() {
        let c = document.getElementById("lzt-toast-host");
        if (!c) {
            c = document.createElement("div");
            c.id = "lzt-toast-host";
            document.body.appendChild(c);
        }
        return c;
    }

    function toast(title, message, opts) {
        opts = Object.assign({ type: "info", duration: 4500 }, opts || {});
        const icons = { info: "fa-circle-info", success: "fa-circle-check", warn: "fa-triangle-exclamation", error: "fa-circle-xmark" };
        const c = toastContainer();
        const el = document.createElement("div");
        el.className = "lzt-toast lzt-toast-" + opts.type;
        el.innerHTML = `<div class="lzt-toast-ico"><i class="fa-solid ${icons[opts.type] || icons.info}"></i></div>
            <div class="lzt-toast-text"><b>${esc(title)}</b><span>${esc(message)}</span></div>
            <button type="button" class="lzt-toast-x"><i class="fa-solid fa-xmark"></i></button>`;
        const remove = () => { el.classList.add("lzt-toast-out"); setTimeout(() => el.remove(), UI_ANIM_MS); };
        el.querySelector(".lzt-toast-x").addEventListener("click", remove);
        c.appendChild(el);
        requestAnimationFrame(() => el.classList.add("lzt-toast-in"));
        if (opts.duration > 0) setTimeout(remove, opts.duration);
    }

    function closeActiveFloatingPanel() {
        const pop = document.querySelector(".node-popover");
        if (!pop) return false;
        const backdrop = document.querySelector(".floating-panel-backdrop");
        if (typeof pop._close === "function") {
            pop._close();
        } else {
            animateCloseFloatingPanel(pop, backdrop);
        }
        return true;
    }

    function mountFloatingPanel(pop) {
        if (!pop) return () => {};
        document.querySelectorAll(".floating-panel-backdrop").forEach(b => b.remove());
        document.querySelectorAll(".node-popover").forEach(p => { if (p !== pop) p.remove(); });
        if (!pop.parentNode) document.body.appendChild(pop);

        const backdrop = document.createElement("div");
        backdrop.className = "floating-panel-backdrop";
        backdrop.setAttribute("aria-hidden", "true");
        document.body.appendChild(backdrop);

        pop.classList.remove("ui-closing");
        backdrop.classList.remove("ui-closing");
        requestAnimationFrame(() => {
            pop.classList.add("ui-open");
            backdrop.classList.add("ui-open");
        });

        const onEsc = (e) => {
            if (e.key === "Escape") close();
        };

        const close = () => {
            if (pop._close !== close) return;
            animateCloseFloatingPanel(pop, backdrop, onEsc);
        };

        pop._close = close;
        setTimeout(() => backdrop.addEventListener("pointerdown", (e) => {
            if (document.body.classList.contains("tour-active")) return;
            close();
        }), 0);
        document.addEventListener("keydown", onEsc);
        return close;
    }

    function dismissModalOverlay(ov) {
        if (!ov) return;
        if (ov.style.display === "none" || ov.classList.contains("ui-closing")) return;
        hideOverlay(ov, { remove: !ov.id });
    }

    function initGlobalDismiss() {
        document.body.addEventListener("click", (e) => {
            const ov = e.target.closest(".modal-overlay");
            if (ov && e.target === ov) dismissModalOverlay(ov);
        });
    }

    window.LZTUi = {
        UI_ANIM_MS,
        showOverlay,
        hideOverlay,
        portalFloatingMenu,
        showFloatingMenu,
        hideFloatingMenu,
        mountFloatingPanel,
        closeActiveFloatingPanel,
        dismissModalOverlay,
        initGlobalDismiss
    };

    document.addEventListener("DOMContentLoaded", initGlobalDismiss);

    window.LZTDialog = {
        alert(message, opts) {
            opts = Object.assign({ type: "alert", okText: "OK", icon: "fa-circle-info" }, opts || {}, { message });
            return showDialog(opts).then(() => {});
        },
        confirm(message, opts) {
            opts = Object.assign({ type: "confirm", okText: "OK", cancelText: "Отмена", icon: "fa-circle-question" }, opts || {}, { message });
            return showDialog(opts);
        },
        prompt(message, defaultValue, opts) {
            if (typeof defaultValue === "object" && defaultValue !== null) {
                opts = defaultValue;
                defaultValue = "";
            }
            opts = Object.assign({ type: "prompt", okText: "OK", cancelText: "Отмена", icon: "fa-pen", defaultValue: defaultValue || "" }, opts || {}, { message });
            return showDialog(opts);
        },
        toast
    };
    window.LZTToast = toast;
})();
