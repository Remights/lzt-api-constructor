/**
 * Валидация графа сценария (без DOM) — для runtime и node-тестов.
 */
(function () {
    function edgeTarget(edges, nodeId, port) {
        const e = edges.find(x => x.from === nodeId && x.fromPort === port);
        return e ? e.to : null;
    }

    const OPTIONAL_OUT_PORTS = new Set(["error", "onerror", "fail", "false", "empty", "skip", "done"]);

    function validate(nodes, edges, opts) {
        opts = opts || {};
        const NODE_TYPES = opts.nodeTypes || (window.ScenarioConstants && window.ScenarioConstants.NODE_TYPES) || {};
        const errors = [];
        const warnings = [];
        const start = nodes.find(n => n.type === "start");
        if (!start) {
            errors.push("Нет блока «Старт».");
            return { errors, warnings };
        }
        if (!edgeTarget(edges, start.id, "out")) {
            errors.push("К блоку «Старт» ничего не подключено.");
        }

        const reachable = new Set();
        const walk = (id) => {
            if (!id || reachable.has(id)) return;
            reachable.add(id);
            edges.filter(e => e.from === id).forEach(e => walk(e.to));
        };
        walk(start.id);

        if (nodes.some(n => n.type === "request") && opts.hasToken === false) {
            warnings.push("Токен не задан — реальные запросы к API не пройдут. Откройте блок «Старт» и вставьте токен.");
        }

        nodes.forEach(n => {
            if (n.type === "start") return;
            const def = NODE_TYPES[n.type] || { title: n.type, outs: [] };
            if (!reachable.has(n.id)) {
                warnings.push(`Блок «${def.title}» ни к чему не подключён — он не выполнится.`);
                return;
            }
            (def.outs || []).forEach(o => {
                if (OPTIONAL_OUT_PORTS.has(o.id)) return;
                if (!edgeTarget(edges, n.id, o.id) && n.type !== "stop") {
                    const lbl = o.label ? `«${o.label}»` : "выход";
                    warnings.push(`У блока «${def.title}» ${lbl} ни к чему не ведёт.`);
                }
            });
            if (n.type === "request" && !(n.request && n.request.url)) {
                warnings.push("В блоке «Запрос» не задан URL.");
            }
            if (n.type === "notify" && n.notify) {
                const nt = n.notify;
                if ((nt.channel === "telegram" || nt.channel === "both") && (!nt.tgToken || !nt.tgChat)) {
                    warnings.push("В «Уведомлении» не заполнены токен Telegram-бота и chat_id.");
                }
                if ((nt.channel === "discord" || nt.channel === "both") && !nt.discordUrl) {
                    warnings.push("В «Уведомлении» не задан Discord webhook.");
                }
            }
        });
        return { errors, warnings };
    }

    window.ScenarioValidate = { validate, edgeTarget };
})();
