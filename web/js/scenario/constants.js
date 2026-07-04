/** Типы блоков сценария и подписи операторов (единый источник). */
window.ScenarioConstants = {
    NODE_TYPES: {
        start:     { title: "Старт",    icon: "fa-play",            color: "#8e8e93", ins: [],                       outs: [{ id: "out", label: "Далее" }, { id: "onerror", label: "Ошибка" }] },
        request:   { title: "Запрос",   icon: "fa-bolt",            color: "#00ba78", ins: [{ id: "in" }],          outs: [{ id: "success", label: "Успех" }, { id: "error", label: "Ошибка" }] },
        condition: { title: "Условие",  icon: "fa-code-branch",     color: "#e6a23c", ins: [{ id: "in" }],          outs: [{ id: "true", label: "Да" }, { id: "false", label: "Нет" }] },
        filter:    { title: "Фильтр",   icon: "fa-filter",          color: "#d68910", ins: [{ id: "in" }],          outs: [{ id: "found", label: "Есть" }, { id: "empty", label: "Пусто" }] },
        loop:      { title: "Цикл",     icon: "fa-rotate-right",    color: "#9b59b6", ins: [{ id: "in" }],          outs: [{ id: "body", label: "Тело" }, { id: "done", label: "Готово" }] },
        variable:  { title: "Переменная", icon: "fa-box-archive",   color: "#16a085", ins: [{ id: "in" }],          outs: [{ id: "out", label: "" }] },
        notify:    { title: "Уведомление", icon: "fa-paper-plane",  color: "#0088cc", ins: [{ id: "in" }],          outs: [{ id: "out", label: "" }] },
        logmsg:    { title: "Сообщение", icon: "fa-comment-dots",   color: "#7f8c8d", ins: [{ id: "in" }],          outs: [{ id: "out", label: "" }] },
        savefile:  { title: "Сохранить в файл", icon: "fa-file-arrow-down", color: "#27ae60", ins: [{ id: "in" }],  outs: [{ id: "out", label: "" }] },
        proxy:     { title: "Прокси",   icon: "fa-shield-halved",   color: "#607d8b", ins: [{ id: "in" }],          outs: [{ id: "out", label: "" }] },
        delay:     { title: "Задержка", icon: "fa-clock",           color: "#3594bc", ins: [{ id: "in" }],          outs: [{ id: "out", label: "" }] },
        stop:      { title: "Стоп",     icon: "fa-flag-checkered",  color: "#ff5555", ins: [{ id: "in" }],          outs: [] },
        foreach:   { title: "Для каждого", icon: "fa-list-ul",     color: "#8e44ad", ins: [{ id: "in" }],          outs: [{ id: "body", label: "Тело" }, { id: "done", label: "Готово" }] },
        checker:   { title: "Проверка аккаунта", icon: "fa-user-check", color: "#2980b9", ins: [{ id: "in" }],   outs: [{ id: "ok", label: "OK" }, { id: "fail", label: "Битый" }] },
        sniper:    { title: "Снайпер",  icon: "fa-crosshairs",      color: "#c0392b", ins: [{ id: "in" }],          outs: [{ id: "bought", label: "Купил" }, { id: "skip", label: "Пропуск" }, { id: "fail", label: "Ошибка" }] },
        subscenario: { title: "Под-сценарий", icon: "fa-layer-group", color: "#34495e", ins: [{ id: "in" }],      outs: [{ id: "out", label: "" }] },
    },
    OP_LABELS: { ">": "больше", "<": "меньше", ">=": "≥", "<=": "≤", "==": "равно", "!=": "не равно", "exists": "существует" },
};
