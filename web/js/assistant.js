// Доп. инструменты конструктора: импорт curl, AI-ассистент, прокси-чекер, история.
// Всё общается со сценарием через window.Scenario.
(function () {
    "use strict";

    // ==================== ПАРСЕР CURL ====================

    // Разбивает строку на аргументы с учётом кавычек ' и " и переносов со слэшем
    function tokenizeCurl(input) {
        const s = input.replace(/\\\r?\n/g, " ").trim();
        const tokens = [];
        let i = 0, cur = "", quote = null, has = false;
        while (i < s.length) {
            const ch = s[i];
            if (quote) {
                if (ch === quote) { quote = null; }
                else { cur += ch; }
            } else if (ch === "'" || ch === '"') {
                quote = ch; has = true;
            } else if (/\s/.test(ch)) {
                if (has || cur.length) { tokens.push(cur); cur = ""; has = false; }
            } else {
                cur += ch; has = true;
            }
            i++;
        }
        if (has || cur.length) tokens.push(cur);
        return tokens;
    }

    function splitUrlParams(rawUrl) {
        const params = {};
        let url = rawUrl;
        const qi = rawUrl.indexOf("?");
        if (qi >= 0) {
            url = rawUrl.slice(0, qi);
            const qs = rawUrl.slice(qi + 1);
            qs.split("&").forEach(pair => {
                if (!pair) return;
                const eq = pair.indexOf("=");
                const k = decodeURIComponent(eq >= 0 ? pair.slice(0, eq) : pair);
                const v = eq >= 0 ? decodeURIComponent(pair.slice(eq + 1)) : "";
                if (k) params[k] = v;
            });
        }
        return { url, params };
    }

    function parseBody(raw) {
        const t = (raw || "").trim();
        if (!t) return null;
        try {
            const j = JSON.parse(t);
            if (j && typeof j === "object") return j;
        } catch (e) { /* не JSON — пробуем форму */ }
        if (t.includes("=")) {
            const obj = {};
            t.split("&").forEach(pair => {
                const eq = pair.indexOf("=");
                if (eq < 0) return;
                const k = decodeURIComponent(pair.slice(0, eq));
                const v = decodeURIComponent(pair.slice(eq + 1));
                if (k) obj[k] = v;
            });
            if (Object.keys(obj).length) return obj;
        }
        return { raw_body: t };
    }

    function parseCurl(text) {
        const tokens = tokenizeCurl(text);
        if (!tokens.length || !/curl/i.test(tokens[0])) {
            throw new Error("Это не похоже на curl-команду (должна начинаться с curl).");
        }
        let method = null, url = "", body = null;
        const headers = {};
        const dataParts = [];
        for (let i = 1; i < tokens.length; i++) {
            const t = tokens[i];
            const next = () => tokens[++i];
            if (t === "-X" || t === "--request") { method = (next() || "GET").toUpperCase(); }
            else if (t === "-H" || t === "--header") {
                const h = next() || "";
                const ci = h.indexOf(":");
                if (ci > 0) headers[h.slice(0, ci).trim()] = h.slice(ci + 1).trim();
            }
            else if (t === "-d" || t === "--data" || t === "--data-raw" || t === "--data-binary" || t === "--data-ascii") { dataParts.push(next() || ""); }
            else if (t === "--data-urlencode") { dataParts.push(next() || ""); }
            else if (t === "-b" || t === "--cookie") { headers["Cookie"] = next() || ""; }
            else if (t === "-A" || t === "--user-agent") { headers["User-Agent"] = next() || ""; }
            else if (t === "-e" || t === "--referer") { headers["Referer"] = next() || ""; }
            else if (t === "-u" || t === "--user") { const c = next() || ""; try { headers["Authorization"] = "Basic " + btoa(c); } catch (e) {} }
            else if (t === "--url") { url = next() || ""; }
            else if (t === "--compressed" || t === "-s" || t === "--silent" || t === "-L" || t === "--location" || t === "-k" || t === "--insecure" || t === "-i" || t === "--include" || t === "-v" || t === "--verbose" || t === "-G" || t === "--get") { /* игнорируем флаги без значения */ if (t === "-G" || t === "--get") method = method || "GET"; }
            else if (t.startsWith("http://") || t.startsWith("https://")) { url = t; }
            else if (t === "curl") { /* skip */ }
        }
        if (!url) throw new Error("Не удалось найти URL в команде.");
        if (dataParts.length) body = parseBody(dataParts.join("&"));
        if (!method) method = body ? "POST" : "GET";
        const { url: cleanUrl, params } = splitUrlParams(url);
        // Токен из заголовка не тащим в блок (он задаётся в «Старте»)
        delete headers["Authorization"];
        delete headers["authorization"];
        let title = "Запрос";
        try { title = new URL(cleanUrl).pathname.split("/").filter(Boolean).pop() || "Запрос"; } catch (e) {}
        return { method, url: cleanUrl, params, body, headers, title };
    }

    function importCurl(text) {
        const req = parseCurl(text);
        const full = Object.assign({ retries: 0, retryDelay: 1000, timeout: 15, respectRateLimit: true }, req);
        // Добавляем блок-запрос и соединяем со «Стартом», если тот одинок
        const S = window.Scenario;
        const node = S.addNode("request", 360, 200, { request: full });
        const start = S.nodes.find(n => n.type === "start");
        if (start && !S.edges.some(e => e.from === start.id)) {
            S.addEdge(start.id, "out", node.id);
        }
        S.render();
        S.regenScript();
        S.commit();
        if (S.centerOn) S.centerOn(node.id);
        return node;
    }

    // ==================== ПРИВЯЗКА UI ====================

    function bindCurl() {
        const modal = document.getElementById("curl-modal");
        const input = document.getElementById("curl-input");
        const err = document.getElementById("curl-error");
        if (!modal) return;
        const open = () => { LZTUi.showOverlay(modal); err.style.display = "none"; input.value = ""; setTimeout(() => input.focus(), 50); };
        const close = () => LZTUi.hideOverlay(modal);
        document.getElementById("btn-import-curl")?.addEventListener("click", open);
        document.getElementById("curl-close-x")?.addEventListener("click", close);
        document.getElementById("curl-cancel")?.addEventListener("click", close);
        modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
        document.getElementById("curl-import")?.addEventListener("click", () => {
            try {
                importCurl(input.value);
                close();
                if (window.Scenario && Scenario.flash) Scenario.flash("Блок из curl создан", "ok");
            } catch (e) {
                err.textContent = e.message || String(e);
                err.style.display = "block";
            }
        });
    }

    // ==================== AI-АССИСТЕНТ ====================

    // Категории Маркета: ключевые слова → slug эндпоинта
    const CATEGORIES = [
        { slug: "steam", kw: ["стим", "steam", "кс2", "cs2", "кс го", "csgo", "counter"] },
        { slug: "telegram", kw: ["телеграм", "telegram", "тг", "tg"] },
        { slug: "fortnite", kw: ["фортнайт", "fortnite", "фн"] },
        { slug: "mihoyo", kw: ["геншин", "genshin", "mihoyo", "михоё", "хонкай", "honkai"] },
        { slug: "riot", kw: ["валорант", "valorant", "riot", "лига легенд", "league"] },
        { slug: "supercell", kw: ["brawl", "бравл", "clash", "клеш", "supercell"] },
        { slug: "origin", kw: ["origin", "ea", "ориджин"] },
        { slug: "uplay", kw: ["uplay", "ubisoft", "юплей"] },
        { slug: "socialclub", kw: ["social club", "rockstar", "гта", "gta"] },
        { slug: "battlenet", kw: ["battlenet", "battle.net", "blizzard", "близзард"] },
        { slug: "roblox", kw: ["роблокс", "roblox"] },
        { slug: "minecraft", kw: ["майнкрафт", "minecraft", "майн"] },
        { slug: "escape-from-tarkov", kw: ["тарков", "tarkov", "eft"] },
        { slug: "epicgames", kw: ["epic", "эпик"] },
        { slug: "discord", kw: ["дискорд", "discord", "нитро", "nitro"] },
        { slug: "tiktok", kw: ["тикток", "tiktok"] },
        { slug: "instagram", kw: ["инстаграм", "instagram", "инста"] },
        { slug: "vpn", kw: ["vpn", "впн"] },
        { slug: "chatgpt", kw: ["chatgpt", "openai", "гпт", "gpt", "нейрос"] },
    ];

    function detectNumberAfter(text, words) {
        const re = new RegExp("(?:" + words.join("|") + ")\\D{0,8}(\\d+)", "i");
        const m = text.match(re);
        return m ? parseInt(m[1]) : null;
    }

    function detectInterval(text) {
        // возвращает мс или null (в JS \w не матчит кириллицу — используем явные диапазоны)
        const m = text.match(/(?:кажд[а-яё]*|раз в|every|повтор[а-яё]*|через)\s*(\d+)?\s*(сек[а-яё]*|second|мин[а-яё]*|min|час[а-яё]*|hour)/i);
        if (m) {
            const n = m[1] ? parseInt(m[1]) : 1;
            const unit = m[2].toLowerCase();
            if (/сек|second/.test(unit)) return n * 1000;
            if (/час|hour/.test(unit)) return n * 3600000;
            return n * 60000; // минуты по умолчанию
        }
        if (/монитор|следи|мониторь|watch|постоянно/i.test(text)) return 300000; // 5 мин по умолчанию
        return null;
    }

    // Бесплатный локальный генератор сценария из описания
    function generateScenarioFromText(text) {
        const t = " " + text.toLowerCase() + " ";
        const wantNotifyTg = /(увед|пришл|шл[иёе]|отправ|напиш|сообщ|алерт|notif|оповест)/.test(t) && /(телеграм|telegram|тг|tg)/.test(t);
        const wantNotifyDs = /(увед|пришл|шл[иёе]|отправ|напиш|сообщ|алерт|notif|оповест)/.test(t) && /(дискорд|discord)/.test(t);
        const wantSave = /(csv|файл|сохран|excel|таблиц|выгруз|экспорт)/.test(t);
        const saveFmt = /json/.test(t) ? "json" : "csv";
        const wantFilter = /(фильтр|отфильтр|оставь|только те)/.test(t);
        const interval = detectInterval(t);

        // категория: notify-цель телеграма не должна съедать категорию
        let category = null;
        for (const c of CATEGORIES) {
            if (c.kw.some(k => t.includes(k))) {
                if ((c.slug === "telegram" || c.slug === "discord") && (wantNotifyTg || wantNotifyDs) && !/(ищ|найд|парс|поиск|купи|аккаунт\w* (telegram|телеграм))/.test(t)) continue;
                category = c.slug; break;
            }
        }
        const isBalance = /(баланс|профил|мой аккаунт|\bme\b|кошел)/.test(t);

        // короткие предлоги «до»/«от»/«мин» ограничиваем, чтобы не ловить «дороже»/«минут»
        const pmax = detectNumberAfter(t, ["дешевле", "до(?![а-яё])", "ниже", "меньше", "<=", "max", "макс"]);
        const pmin = detectNumberAfter(t, ["дороже", "от(?![а-яё])", "выше", "больше", ">=", "мин(?![а-яё])"]);

        // строим ноды
        const nodes = [];
        const edges = [];
        let seq = 1;
        const nid = () => "n" + (seq++);
        let eseq = 1;
        const eid = () => "e" + (eseq++);
        const link = (from, port, to) => edges.push({ id: eid(), from, fromPort: port, to });

        const start = { id: nid(), type: "start", x: 60, y: 260 };
        nodes.push(start);

        // запрос
        const params = {};
        if (pmax != null) params.pmax = String(pmax);
        if (pmin != null) params.pmin = String(pmin);
        if (!isBalance) params.order_by = "price_to_up";
        const url = isBalance ? "https://prod-api.lzt.market/me" : ("https://prod-api.lzt.market/" + (category || "steam"));
        const req = {
            id: nid(), type: "request", x: 340, y: 240,
            request: {
                method: "GET", url, params, body: null, headers: {},
                title: isBalance ? "Мой профиль/баланс" : ("Поиск " + (category || "steam")),
                retries: 2, retryDelay: 1500, timeout: 20, respectRateLimit: true
            }
        };
        nodes.push(req);
        link(start.id, "out", req.id);

        let lastId = req.id;
        let lastPort = "success";
        let x = 640;

        // фильтр
        let filterNode = null;
        if ((wantFilter || pmax != null) && !isBalance) {
            filterNode = {
                id: nid(), type: "filter", x, y: 240,
                filter: { source: "last.items", field: "price", op: pmax != null ? "<=" : ">=", value: String(pmax != null ? pmax : (pmin != null ? pmin : 1000)), saveAs: "filtered" }
            };
            nodes.push(filterNode);
            link(lastId, lastPort, filterNode.id);
            lastId = filterNode.id; lastPort = "found";
            x += 300;
        }

        // действия (уведомление / сохранение)
        const actionSrc = filterNode ? "vars.filtered" : "last.items";
        let y = 160;
        let chainId = lastId, chainPort = lastPort;
        const addAction = (node) => {
            nodes.push(node);
            link(chainId, chainPort, node.id);
            chainId = node.id; chainPort = "out";
            x += 300;
        };
        if (wantNotifyTg || (!wantNotifyDs && !wantSave && /(увед|пришл|шл[иёе]|оповест)/.test(t))) {
            addAction({ id: nid(), type: "notify", x, y,
                notify: { channel: "telegram", tgToken: "", tgChat: "", discordUrl: "", text: "Найдено {{" + actionSrc + ".length}} лотов!" } });
        }
        if (wantNotifyDs) {
            addAction({ id: nid(), type: "notify", x, y,
                notify: { channel: "discord", tgToken: "", tgChat: "", discordUrl: "", text: "Найдено {{" + actionSrc + ".length}} лотов!" } });
        }
        if (wantSave) {
            addAction({ id: nid(), type: "savefile", x, y,
                savefile: { source: actionSrc, format: saveFmt, filename: (category || "results") } });
        }

        // цикл по времени
        if (interval) {
            const delay = { id: nid(), type: "delay", x: 640, y: 460, delay: { ms: interval } };
            nodes.push(delay);
            // после действий → задержка → снова запрос
            link(chainId, chainPort, delay.id);
            if (filterNode) link(filterNode.id, "empty", delay.id);
            link(delay.id, "out", req.id);
        } else {
            const stop = { id: nid(), type: "stop", x, y: chainPort === "out" ? y : 240 };
            nodes.push(stop);
            link(chainId, chainPort, stop.id);
        }

        return validateScenarioObj({
            title: "AI: " + text.slice(0, 40),
            nodes, edges,
            view: { scale: 0.85, panX: 20, panY: 10 }
        }, { autoLayout: true });
    }

    // Системный промпт для API-режима: описываем схему scenario.json
    function aiSystemPrompt() {
        const schema = window.ScenarioNormalize?.scenarioJsonPrompt
            ? window.ScenarioNormalize.scenarioJsonPrompt()
            : "";
        return [
            "Ты — генератор scenario.json для визуального конструктора LOLZTEAM API.",
            "Верни СТРОГО один валидный JSON без markdown и пояснений.",
            schema,
            "Правила:",
            "- Всегда одна нода type:\"start\" (id n1 или n_start).",
            "- request.url: https://prod-api.lzt.market/<категория> или /me для баланса.",
            "- Категории Маркета: steam, telegram, discord, fortnite, mihoyo (Genshin), riot (Valorant), socialclub (GTA), roblox, minecraft, epicgames и др. — НЕ genshin-impact, gta5, valorant.",
            "- request: {method,url,params,body,headers,title,retries,retryDelay,timeout,respectRateLimit}.",
            "- filter: {source,field,op,value,saveAs}; notify: {channel,tgToken,tgChat,discordUrl,text}.",
            "- delay: {ms}; loop: {times}; variable: {name,path}; savefile: {source,format,filename}.",
            "- Соединяй edges логично: start.fromPort=\"out\" → request; request.fromPort=\"success\" → дальше.",
            "- Для мониторинга: ... → delay → обратно на request (цикл). Иначе заверши stop.",
            "- НЕ указывай x, y, view — раскладку сделает конструктор.",
            "- Уникальные id для nodes и edges (n1,n2… e1,e2…).",
        ].join("\n");
    }

    function repairJsonString(s) {
        return String(s || "")
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/,\s*([}\]])/g, "$1")
            .replace(/\/\/[^\n\r]*/g, "")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
    }

    function extractBalancedJson(s) {
        const start = s.indexOf("{");
        if (start < 0) return null;
        let depth = 0;
        let inStr = false;
        let esc = false;
        for (let i = start; i < s.length; i++) {
            const c = s[i];
            if (inStr) {
                if (esc) esc = false;
                else if (c === "\\") esc = true;
                else if (c === '"') inStr = false;
                continue;
            }
            if (c === '"') { inStr = true; continue; }
            if (c === "{") depth++;
            if (c === "}") {
                depth--;
                if (depth === 0) return s.slice(start, i + 1);
            }
        }
        return null;
    }

    function extractJson(text) {
        const src = String(text || "").trim();
        if (!src) throw new Error("AI вернул пустой ответ");

        const candidates = [];
        const fence = src.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fence) candidates.push(fence[1].trim());
        candidates.push(src);
        const a = src.indexOf("{"), b = src.lastIndexOf("}");
        if (a >= 0 && b > a) candidates.push(src.slice(a, b + 1));
        const balanced = extractBalancedJson(src);
        if (balanced) candidates.push(balanced);

        const uniq = [...new Set(candidates.filter(Boolean))];
        let lastErr = "некорректный JSON";
        for (const raw of uniq) {
            for (const attempt of [raw, repairJsonString(raw)]) {
                try {
                    return JSON.parse(attempt);
                } catch (e) {
                    lastErr = e.message || lastErr;
                }
                const inner = extractBalancedJson(attempt);
                if (inner && inner !== attempt) {
                    for (const fixed of [inner, repairJsonString(inner)]) {
                        try {
                            return JSON.parse(fixed);
                        } catch (e2) {
                            lastErr = e2.message || lastErr;
                        }
                    }
                }
            }
        }
        throw new Error("AI вернул некорректный JSON: " + lastErr + ". Попробуйте короче команду или режим «Свой ключ» с более мощной моделью.");
    }

    // Бесплатный AI через серверную прокладку (ключи Groq только на сервере)
    let lztClientFp = "LZTConstruct/1.0.0";
    let freeAiUrl = "/api/ai/free";
    let freeAiLimit = 15;
    let freeAiRemaining = null;
    const DEFAULT_FREE_MODELS = [
        { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant" },
        { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
        { id: "llama-3.1-70b-versatile", label: "Llama 3.1 70B" },
        { id: "gemma2-9b-it", label: "Gemma 2 9B" },
        { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
    ];
    let freeGroqModels = DEFAULT_FREE_MODELS.slice();

    function populateFreeModels(models, defaultModel) {
        const sel = document.getElementById("ai-free-model");
        if (!sel || !models?.length) return;
        freeGroqModels = models;
        sel.innerHTML = models.map(m =>
            `<option value="${m.id}">${m.label || m.id}</option>`
        ).join("");
        const saved = localStorage.getItem("lzt_ai_free_model");
        const pick = (saved && models.some(m => m.id === saved)) ? saved : (defaultModel || models[0].id);
        sel.value = pick;
    }

    function getFreeModel() {
        const sel = document.getElementById("ai-free-model");
        return sel?.value || freeGroqModels[0]?.id || "llama-3.1-8b-instant";
    }

    async function loadAiConfig() {
        try {
            const r = await fetch("/api/config", {
                headers: { "X-LZT-Client": lztClientFp },
            });
            const c = await r.json();
            if (c.client_fp) lztClientFp = c.client_fp;
            if (c.free_ai_url) {
                freeAiUrl = /^https?:\/\//i.test(c.free_ai_url) ? "/api/ai/free" : c.free_ai_url;
            }
            if (c.free_ai_limit) freeAiLimit = c.free_ai_limit;
            if (Array.isArray(c.free_models) && c.free_models.length) {
                populateFreeModels(c.free_models, c.free_default_model);
            } else {
                populateFreeModels(DEFAULT_FREE_MODELS, "llama-3.1-8b-instant");
            }
            if (freeAiUrl) applyFreeAiQuota(c);
            await refreshFreeAiQuota();
        } catch (e) {
            populateFreeModels(DEFAULT_FREE_MODELS, "llama-3.1-8b-instant");
        }
    }

    function resolveFreeAiUrl() {
        const path = /^https?:\/\//i.test(freeAiUrl) ? "/api/ai/free" : (freeAiUrl || "/api/ai/free");
        return window.location.origin + (path.startsWith("/") ? path : `/${path}`);
    }

    function resolveFreeAiStatusUrl() {
        return `${window.location.origin}/api/ai/free/status`;
    }

    function applyFreeAiQuota(data) {
        if (data?.remaining != null) freeAiRemaining = data.remaining;
        if (data?.limit != null) freeAiLimit = data.limit;
    }

    async function refreshFreeAiQuota() {
        try {
            const r = await fetch(resolveFreeAiStatusUrl(), {
                headers: { "X-LZT-Client": lztClientFp },
            });
            const data = await r.json();
            if (data.success) applyFreeAiQuota(data);
        } catch (e) { /* старая прокладка без /status */ }
    }

    async function aiCallFree(prompt, system) {
        const res = await fetch(resolveFreeAiUrl(), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-LZT-Client": lztClientFp,
            },
            body: JSON.stringify({
                prompt,
                system: system || aiSystemPrompt(),
                model: getFreeModel(),
            }),
        });
        const data = await res.json();
        applyFreeAiQuota(data);
        if (!data.success) {
            throw new Error(mapAiError(data.error || "Ошибка бесплатного AI"));
        }
        return data.content;
    }

    async function aiGenerateFree(prompt) {
        return extractJson(await aiCallFree(prompt, aiSystemPrompt()));
    }

    function escHtml(s) {
        return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function normalizeApiKey(raw) {
        return String(raw || "")
            .trim()
            .replace(/[\u200B-\u200D\uFEFF]/g, "")
            .replace(/^["']|["']$/g, "");
    }

    function mapAiError(msg) {
        const m = String(msg || "").toLowerCase();
        if (m.includes("invalid api key") || m.includes("invalid_api_key")) {
            return "Неверный API-ключ. Проверьте ключ и endpoint провайдера, вставьте заново без пробелов.";
        }
        if (m.includes("model") && (m.includes("not found") || m.includes("does not exist"))) {
            return "Модель не найдена у провайдера. Проверьте название модели в настройках.";
        }
        if (m.includes("rate limit") || m.includes("429") || m.includes("лимит")) {
            return msg.includes("час") ? msg : "Лимит запросов. Подождите или переключитесь на режим «Свой ключ».";
        }
        return msg || "Ошибка AI";
    }

    function validateAiCredentials(base, key, model) {
        if (!key) throw new Error("Введите API-ключ");
        if (!base) throw new Error("Введите endpoint провайдера");
        if (!model) throw new Error("Введите модель");
    }

    async function aiCallRaw(prompt, system) {
        const base = (document.getElementById("ai-base-url").value || "").trim().replace(/\/+$/, "");
        const key = normalizeApiKey(document.getElementById("ai-api-key").value);
        const model = (document.getElementById("ai-model").value || "").trim();
        validateAiCredentials(base, key, model);
        localStorage.setItem("lzt_ai_cfg", JSON.stringify({ base, model }));
        localStorage.setItem("lzt_ai_key", key);
        const res = await fetch("/api/ai", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base_url: base, api_key: key, model, system: system || "You are a helpful assistant.", prompt })
        });
        const data = await res.json();
        if (!data.success) {
            throw new Error(mapAiError(data.error));
        }
        return data.content;
    }

    async function aiGenerateApi(prompt) {
        return extractJson(await aiCallRaw(prompt, aiSystemPrompt()));
    }

    function validateScenarioObj(sc, opts) {
        if (window.ScenarioNormalize?.validateScenarioObj) {
            return window.ScenarioNormalize.validateScenarioObj(sc, opts);
        }
        if (!sc || !Array.isArray(sc.nodes) || !sc.nodes.length) throw new Error("AI вернул пустой сценарий");
        if (!sc.nodes.some(n => n.type === "start")) {
            sc.nodes.unshift({ id: "n_start", type: "start", x: 60, y: 240 });
        }
        sc.edges = Array.isArray(sc.edges) ? sc.edges : [];
        return sc;
    }

    function bindAi() {
        const modal = document.getElementById("ai-modal");
        if (!modal) return;
        const input = document.getElementById("ai-input");
        const status = document.getElementById("ai-status");
        const apiBox = document.getElementById("ai-api-settings");
        const freeBox = document.getElementById("ai-free-settings");
        const limitInfo = document.getElementById("ai-limit-info");

        const syncModePanels = () => {
            const mode = modal.querySelector('input[name="ai-mode"]:checked')?.value || "free";
            if (apiBox) apiBox.style.display = mode === "api" ? "block" : "none";
            if (freeBox) freeBox.style.display = mode === "free" ? "block" : "none";
        };

        // восстановить сохранённые настройки API
        try {
            const cfg = JSON.parse(localStorage.getItem("lzt_ai_cfg") || "{}");
            if (cfg.base) document.getElementById("ai-base-url").value = cfg.base;
            if (cfg.model) document.getElementById("ai-model").value = cfg.model;
        } catch (e) {}
        const savedKey = localStorage.getItem("lzt_ai_key");
        if (savedKey) document.getElementById("ai-api-key").value = savedKey;

        const keyHint = document.getElementById("ai-key-hint");
        const updateKeyHint = () => {
            if (!keyHint) return;
            const k = normalizeApiKey(document.getElementById("ai-api-key").value);
            if (!k) { keyHint.textContent = ""; return; }
            keyHint.textContent = `Ключ: ${k.slice(0, 6)}… (${k.length} симв.)`;
        };
        document.getElementById("ai-api-key")?.addEventListener("input", updateKeyHint);
        updateKeyHint();

        const updateLimit = () => {
            if (!limitInfo) return;
            const mode = modal.querySelector('input[name="ai-mode"]:checked').value;
            if (mode === "free") {
                if (freeAiRemaining != null) {
                    const tone = freeAiRemaining === 0 ? "#ff5555" : "var(--text-muted)";
                    limitInfo.style.color = tone;
                    limitInfo.textContent = freeAiRemaining === 0
                        ? `Лимит исчерпан: 0 из ${freeAiLimit} запросов/час (общая прокладка или ваш IP)`
                        : `Бесплатно: ${freeAiRemaining} из ${freeAiLimit} запросов/час`;
                } else {
                    limitInfo.style.color = "var(--text-muted)";
                    limitInfo.textContent = `Бесплатно: до ${freeAiLimit} запросов/час на IP`;
                }
                limitInfo.style.display = "";
            } else {
                limitInfo.style.display = "none";
            }
        };

        const autoResizeAiInput = () => {
            if (!input) return;
            input.style.height = "auto";
            const minH = 48;
            let h = input.scrollHeight;
            if (!(input.value || "").trim() && input.placeholder) {
                const cs = getComputedStyle(input);
                const mirror = document.createElement("div");
                mirror.style.cssText = [
                    "position:absolute",
                    "visibility:hidden",
                    "pointer-events:none",
                    "white-space:pre-wrap",
                    "word-wrap:break-word",
                    "box-sizing:border-box",
                    `width:${input.clientWidth}px`,
                    `font:${cs.font}`,
                    `line-height:${cs.lineHeight}`,
                    `padding:${cs.padding}`,
                ].join(";");
                mirror.textContent = input.placeholder;
                document.body.appendChild(mirror);
                h = Math.max(h, mirror.offsetHeight);
                mirror.remove();
            }
            input.style.height = Math.max(minH, h) + "px";
        };

        const syncAiComposerMode = () => {
            const row = document.querySelector(".ai-composer-row");
            const genBtn = document.getElementById("ai-generate");
            if (!input || !row) return;
            const empty = !(input.value || "").trim();
            row.classList.toggle("ai-composer-empty", empty);
            row.classList.toggle("ai-composer-filled", !empty);
            if (genBtn && empty && !genBtn.classList.contains("recording") && !genBtn.classList.contains("processing")) {
                const t = window.AiVoice?.ui?.()?.btnTitle || "Голосовой ввод";
                genBtn.title = t;
                genBtn.setAttribute("aria-label", t);
            } else if (genBtn && !empty && !genBtn.classList.contains("recording") && !genBtn.classList.contains("processing")) {
                const label = genBtn.dataset.sendLabel || "Отправить";
                genBtn.title = label;
                genBtn.setAttribute("aria-label", label);
            }
        };
        window.syncAiComposerMode = syncAiComposerMode;

        input?.addEventListener("input", () => {
            autoResizeAiInput();
            syncAiComposerMode();
        });
        input?.addEventListener("keydown", (e) => {
            if (e.key !== "Enter") return;
            if (e.shiftKey) return;
            e.preventDefault();
            document.getElementById("ai-generate")?.click();
        });

        modal.querySelectorAll(".ai-ex").forEach((btn) => {
            btn.addEventListener("click", () => {
                const text = (btn.getAttribute("data-ex") || btn.textContent || "").trim();
                if (!text || !input) return;
                input.value = text;
                input.dispatchEvent(new Event("input", { bubbles: true }));
                autoResizeAiInput();
                syncAiComposerMode();
                input.focus();
            });
        });

        loadAiConfig().then(() => { syncModePanels(); updateLimit(); });
        document.getElementById("ai-free-model")?.addEventListener("change", (e) => {
            localStorage.setItem("lzt_ai_free_model", e.target.value);
        });
        const open = () => {
            LZTUi.showOverlay(modal);
            status.textContent = "";
            if (window.initAiPlus) window.initAiPlus();
            loadAiConfig().then(() => { syncModePanels(); updateLimit(); });
            setTimeout(() => { input.focus(); autoResizeAiInput(); syncAiComposerMode(); }, 50);
        };
        const close = () => LZTUi.hideOverlay(modal);
        document.getElementById("btn-ai-assistant")?.addEventListener("click", open);
        document.getElementById("ai-close-x")?.addEventListener("click", close);
        modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
        modal.querySelectorAll('input[name="ai-mode"]').forEach(r => r.addEventListener("change", () => {
            syncModePanels();
            updateLimit();
        }));
        document.getElementById("ai-generate")?.addEventListener("click", async () => {
            const text = (input.value || "").trim();
            if (!text) {
                if (window.startAiVoiceInput) {
                    window.startAiVoiceInput();
                    return;
                }
                status.innerHTML = '<span style="color:#ff5555;">Опишите задачу</span>';
                return;
            }
            const mode = modal.querySelector('input[name="ai-mode"]:checked').value;
            input.value = "";
            syncAiComposerMode();
            autoResizeAiInput();
            const S = window.Scenario;
            try {
                let sc;
                if (mode === "api") {
                    status.innerHTML = '<span style="color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Генерирую через API…</span>';
                    sc = validateScenarioObj(await aiGenerateApi(text), { autoLayout: true });
                } else {
                    status.innerHTML = '<span style="color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Генерирую…</span>';
                    sc = validateScenarioObj(await aiGenerateFree(text), { autoLayout: true });
                    updateLimit();
                }
                if (S.hasMeaningfulWork && S.hasMeaningfulWork() && !await LZTDialog.confirm("Заменить текущий сценарий сгенерированным?", { title: "AI-сценарий", okText: "Заменить", danger: true })) return;
                S.load(sc);
                close();
                if (S.flash) S.flash("Сценарий собран AI-ассистентом", "ok");
                if (mode === "free" && (/(телеграм|telegram|тг|discord|дискорд)/i.test(text))) {
                    setTimeout(() => S.flash && S.flash("Не забудьте вписать токен/чат в блоке «Уведомление»", "ok"), 2800);
                }
            } catch (e) {
                updateLimit();
                status.innerHTML = `<span style="color:#ff5555;">${escHtml(e.message || String(e))}</span>`;
            }
        });

        window.Assistant.autoResizeAiInput = autoResizeAiInput;
        autoResizeAiInput();
    }

    // экспорт для повторного использования (AI и тесты)
    window.Assistant = { parseCurl, importCurl, generateScenarioFromText, extractJson, validateScenarioObj, normalizeApiKey, mapAiError, validateAiCredentials, aiCallRaw, aiCallFree, aiGenerateFree, loadAiConfig, getClientFp: () => lztClientFp };

    document.addEventListener("DOMContentLoaded", () => {
        bindCurl();
        bindAi();
    });
})();
