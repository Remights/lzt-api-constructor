/**
 * Валидация графа сценария (без DOM) — для runtime и node-тестов.
 */
(function () {
    function edgeTarget(edges, nodeId, port) {
        const e = edges.find(x => x.from === nodeId && x.fromPort === port);
        return e ? e.to : null;
    }

    const OPTIONAL_OUT_PORTS = new Set(["error", "onerror", "fail", "false", "empty", "skip", "done"]);

    function _hasThreadId(req) {
        const params = req.params || {};
        if (params.thread_id != null && String(params.thread_id).trim() !== "") return true;
        const blob = JSON.stringify(params) + "\n" + JSON.stringify(req.body || "");
        return /thread_id/i.test(blob);
    }

    function _needsForumThreadId(req) {
        const method = String(req.method || "GET").toUpperCase();
        if (method === "GET" || method === "HEAD") return false;
        const url = String(req.url || "").toLowerCase();
        return /\/(posts|comments|threads)\b/.test(url)
            || (/api\.(lolz|zelenka)/.test(url) && /(posts|comments)/.test(url));
    }

    /**
     * Готовность конфигурации одной ноды (светофор).
     * @returns {{ status: "ok"|"warn"|"skip", hint: string }}
     */
    function nodeReadiness(node, opts) {
        opts = opts || {};
        if (!node || !node.type) return { status: "skip", hint: "" };

        if (node.type === "start") {
            if (opts.demoMode) return { status: "ok", hint: "Демо-режим" };
            const hasToken = opts.hasToken != null
                ? !!opts.hasToken
                : !!(typeof window !== "undefined" && window.LZTToken && window.LZTToken.get());
            if (!hasToken) return { status: "warn", hint: "Укажите API-токен в блоке «Старт»" };
            return { status: "ok", hint: "Токен задан" };
        }

        if (node.type === "request") {
            const req = node.request || {};
            const url = String(req.url || "").trim();
            if (!url) return { status: "warn", hint: "Укажите URL запроса" };
            if (_needsForumThreadId(req) && !_hasThreadId(req)) {
                return { status: "warn", hint: "Для POST укажите thread_id в Params или Body" };
            }
            return { status: "ok", hint: "Запрос настроен" };
        }

        if (node.type === "notify") {
            const nt = node.notify || {};
            const ch = nt.channel || "telegram";
            if ((ch === "telegram" || ch === "both") && (!nt.tgToken || !nt.tgChat)) {
                return { status: "warn", hint: "Заполните токен Telegram-бота и chat_id" };
            }
            if ((ch === "discord" || ch === "both") && !nt.discordUrl) {
                return { status: "warn", hint: "Укажите Discord webhook URL" };
            }
            return { status: "ok", hint: "Уведомление настроено" };
        }

        if (node.type === "ai") {
            const a = node.ai || {};
            if (!String(a.source || "").trim()) return { status: "warn", hint: "Укажите путь к списку (source)" };
            if (!String(a.prompt || "").trim()) return { status: "warn", hint: "Заполните промпт ИИ" };
            return { status: "ok", hint: "ИИ настроен" };
        }

        if (node.type === "sniper") {
            const sn = node.sniper || {};
            if (!String(sn.source || "").trim()) return { status: "warn", hint: "Укажите список лотов (source)" };
            return { status: "ok", hint: sn.dryRun ? "Снайпер (dry-run)" : "Снайпер настроен" };
        }

        return { status: "skip", hint: "" };
    }

    function annotateNodes(nodes, opts) {
        const map = new Map();
        (nodes || []).forEach((n) => {
            map.set(n.id, nodeReadiness(n, opts));
        });
        return map;
    }

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

        if (nodes.some(n => n.type === "request") && opts.hasToken === false && !opts.demoMode) {
            warnings.push("Токен не задан — реальные запросы к API не пройдут. Откройте блок «Старт» и вставьте токен или откройте «Демо: поиск → снайпер» слева.");
        }

        const hasAi = nodes.some(n => n.type === "ai" && reachable.has(n.id));
        if (hasAi) {
            warnings.push("Блок «ИИ» может ошибаться в оценке — не покупайте «вслепую» по вердикту buy.");
        }
        if (hasAi && !opts.demoMode) {
            const aiKey = (typeof localStorage !== "undefined" && localStorage.getItem("lzt_ai_key") || "").trim();
            if (!aiKey) {
                warnings.push("Блок «ИИ» без своего ключа — попробует бесплатный AI (если доступен на сервере).");
            }
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
            if (n.type === "sniper" && n.sniper && !n.sniper.dryRun) {
                warnings.push("Снайпер без Dry-run — возможна реальная покупка. Перед первым buy будет подтверждение, если включено.");
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
            if ((n.type === "loop" || n.type === "foreach") && reachable.has(n.id)) {
                const bodyTo = edgeTarget(edges, n.id, "body");
                if (bodyTo) {
                    const seen = new Set();
                    const stack = [bodyTo];
                    let returns = false;
                    while (stack.length) {
                        const id = stack.pop();
                        if (!id || seen.has(id)) continue;
                        seen.add(id);
                        if (id === n.id) { returns = true; break; }
                        edges.filter((e) => e.from === id).forEach((e) => stack.push(e.to));
                    }
                    if (!returns) {
                        warnings.push(`У блока «${def.title}» тело цикла не возвращается в него — выполнится один раз.`);
                    }
                }
            }
        });
        return { errors, warnings };
    }

    window.ScenarioValidate = { validate, edgeTarget, nodeReadiness, annotateNodes };
})();
