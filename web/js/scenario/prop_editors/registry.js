/** Реестр popover-редакторов свойств блоков сценария. */
(function () {
    "use strict";
    const editors = {};

    window.ScenarioPropEditorRegistry = {
        register(type, fn) {
            if (typeof fn === "function") editors[type] = fn;
        },
        get(type) {
            return editors[type] || null;
        },
        has(type) {
            return !!editors[type];
        },
    };
})();
