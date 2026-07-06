/** Оболочка popover-редактора свойств блока (делегирует в ScenarioPropEditorRegistry). */
(function () {
    "use strict";

    function mountPropEditor(scenario, node, clientX, clientY) {
        if (window.LZTUi) window.LZTUi.closeActiveFloatingPanel();
        else document.querySelectorAll(".node-popover, .floating-panel-backdrop").forEach(p => p.remove());

        const editor = window.ScenarioPropEditorRegistry && ScenarioPropEditorRegistry.get(node.type);
        if (!editor) return;

        const pop = document.createElement("div");
        pop.className = "node-popover";
        pop.style.left = Math.min(clientX, window.innerWidth - 320) + "px";
        pop.style.top = Math.min(clientY, window.innerHeight - 260) + "px";
        pop.addEventListener("mousedown", e => e.stopPropagation());
        pop.addEventListener("click", e => e.stopPropagation());

        const dismissPop = () => {
            if (typeof pop._close === "function") pop._close();
            else {
                pop.remove();
                document.querySelectorAll(".floating-panel-backdrop").forEach(b => b.remove());
            }
        };

        const ctx = {
            sc: scenario,
            node,
            pop,
            dismiss: dismissPop,
            esc: (s) => scenario.esc(s),
            save: () => {
                scenario.editingNodeId = null;
                dismissPop();
                scenario.render();
                scenario.regenScript();
                scenario.commit();
            },
            OP_LABELS: (window.ScenarioConstants && window.ScenarioConstants.OP_LABELS) || {},
        };

        editor(ctx);

        requestAnimationFrame(() => {
            const r = pop.getBoundingClientRect();
            if (r.bottom > window.innerHeight - 10) {
                pop.style.top = Math.max(10, window.innerHeight - r.height - 10) + "px";
            }
            if (r.right > window.innerWidth - 10) {
                pop.style.left = Math.max(10, window.innerWidth - r.width - 10) + "px";
            }
        });

        if (window.LZTUi) window.LZTUi.mountFloatingPanel(pop);
    }

    window.ScenarioPropEditorHost = { mount: mountPropEditor };
})();
