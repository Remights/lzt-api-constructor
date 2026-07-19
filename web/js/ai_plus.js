// AI+: редактирование, объяснение, голосовой ввод.
(function () {
    "use strict";

    const VOICE_I18N = {
        ru: {
            title: "Голосовой ввод",
            btnTitle: "Голосовой ввод (нажмите — говорите, нажмите снова — стоп)",
            confirm: "Приложение запросит доступ к микрофону для распознавания речи.\n\nРежим «Авто»: русский и English.\n\nРазрешить?",
            allow: "Разрешить",
            block: "Блокировать",
            unsupported: "Голосовой ввод недоступен в этом окне.\n\nПопробуйте перезапустить приложение или используйте режим «Свой ключ» с GROQ_KEYS в .env.",
            micBlocked: "Доступ к микрофону заблокирован.\n\nРазрешите микрофон в Windows → Параметры → Конфиденциальность → Микрофон, затем перезапустите приложение.",
            micBlockedShort: "Микрофон заблокирован. Разрешите доступ в настройках Windows.",
            recognizeFail: "Не удалось распознать речь",
            startFail: "Не удалось запустить микрофон",
            listening: "Слушаю…",
            processing: "Распознаю…",
        },
        en: {
            title: "Voice input",
            btnTitle: "Voice input (click to start, click again to stop)",
            confirm: "The app will request microphone access for speech recognition.\n\nAuto mode: Russian and English.\n\nAllow?",
            allow: "Allow",
            block: "Block",
            unsupported: "Voice input is not available in this window.\n\nTry restarting the app or set GROQ_KEYS in .env for server-side recognition.",
            micBlocked: "Microphone access is blocked.\n\nAllow the mic in Windows → Settings → Privacy → Microphone, then restart the app.",
            micBlockedShort: "Microphone blocked. Allow access in Windows settings.",
            recognizeFail: "Could not recognize speech",
            startFail: "Could not start microphone",
            listening: "Listening…",
            processing: "Recognizing…",
        },
    };

    function voiceUi() {
        const lang = (window.I18N && I18N.lang === "en") ? "en" : "ru";
        return VOICE_I18N[lang] || VOICE_I18N.ru;
    }

    function voiceRecLangList() {
        return ["ru-RU", "en-US"];
    }

    function voiceRecLang() {
        return voiceRecLangList()[0];
    }

    function voiceSttLang() {
        return "auto";
    }

    function aiSystemBase() {
        const schema = window.ScenarioNormalize?.scenarioJsonPrompt
            ? "\n" + window.ScenarioNormalize.scenarioJsonPrompt()
            : "";
        const S = window.Scenario;
        const vars = (window.LZTPathPicker?.collectKnownVars?.(S) || []).map(v => "vars." + v.name).join(", ");
        const ctx = vars ? `\nИзвестные переменные сценария: ${vars}.` : "";
        return `Ты — эксперт по LOLZTEAM Market API (prod-api.lzt.market) и Forum API (api.lolz.live / api.zelenka.guru). Отвечай на русском.${schema}
Форум: темы в last.threads, посты в last.posts; маркет: лоты в last.items. Не путай items и threads.${ctx}
Правила JSON: nodes + edges {from, fromPort, to}. Координаты x/y не указывай — конструктор расставит блоки сам.`;
    }

    async function callAi(prompt, system) {
        const mode = document.querySelector('#ai-modal input[name="ai-mode"]:checked')?.value || "free";
        if (mode === "api") {
            const base = (document.getElementById("ai-base-url").value || "").trim().replace(/\/+$/, "");
            const key = window.Assistant?.normalizeApiKey
                ? window.Assistant.normalizeApiKey(document.getElementById("ai-api-key").value)
                : (document.getElementById("ai-api-key").value || "").trim();
            const model = (document.getElementById("ai-model").value || "").trim();
            if (window.Assistant?.validateAiCredentials) window.Assistant.validateAiCredentials(base, key, model);
            const res = await fetch("/api/ai", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ base_url: base, api_key: key, model, system: system || aiSystemBase(), prompt })
            });
            const data = await res.json();
            if (!data.success) {
                const err = window.Assistant?.mapAiError ? window.Assistant.mapAiError(data.error) : (data.error || "AI error");
                throw new Error(err);
            }
            return data.content;
        }
        if (window.Assistant?.aiCallFree) {
            return window.Assistant.aiCallFree(prompt, system || aiSystemBase());
        }
        if (window.Assistant && window.Assistant.generateScenarioFromText) {
            if (/объясни|explain|ошибк|провер/i.test(prompt)) {
                return explainLocally(window.Scenario ? window.Scenario.serialize() : {});
            }
            return JSON.stringify(window.Assistant.generateScenarioFromText(prompt), null, 2);
        }
        throw new Error("Бесплатный AI недоступен");
    }

    function describeNode(n) {
        switch (n.type) {
            case "request": {
                const r = n.request || {};
                const url = (r.url || "").replace(/^https?:\/\/[^/]+/, "") || "API";
                return `идёт запрос ${r.method || "GET"} ${url}${r.title ? ` («${r.title}»)` : ""}`;
            }
            case "filter": {
                const f = n.filter || {};
                return `фильтрует по ${f.field || "?"} ${f.op || ""} ${f.value ?? ""}`.trim();
            }
            case "notify":
                return `шлёт уведомление в ${n.notify?.channel || "telegram"}`;
            case "delay":
                return `ждёт ${Math.round((n.delay?.ms || 0) / 1000) || "?"} сек`;
            case "condition":
                return `проверяет условие ${n.condition?.left || "?"} ${n.condition?.op || ""} ${n.condition?.right ?? ""}`;
            case "loop":
                return `повторяет ${n.loop?.times || "?"} раз`;
            case "stop":
                return "останавливается";
            case "logmsg":
                return `пишет в лог «${(n.logmsg?.text || "").slice(0, 50)}»`;
            case "savefile":
                return `сохраняет результат в ${n.savefile?.format || "файл"}`;
            case "foreach":
                return "перебирает каждый элемент списка";
            case "checker":
                return "проверяет аккаунт/лот";
            case "sniper":
                return "реагирует на лот (sniper)";
            default:
                return `выполняет блок «${n.type}»`;
        }
    }

    function buildScenarioStory(scn) {
        const nodes = scn.nodes || [];
        const edges = scn.edges || [];
        const start = nodes.find(n => n.type === "start");
        if (!start) return "Сценарий не начинается с блока «Старт» — запуск невозможен.";

        const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
        const outs = {};
        edges.forEach(e => { (outs[e.from] ||= []).push(e); });

        const parts = [];
        const seen = new Set();
        let id = start.id;
        for (let i = 0; i < 25 && id; i++) {
            if (seen.has(id)) { parts.push("после этого сценарий зацикливается"); break; }
            seen.add(id);
            const n = byId[id];
            if (!n) break;
            if (n.type !== "start") parts.push(describeNode(n));
            if (n.type === "stop") break;
            const next = (outs[id] || []).find(e => /^(out|success|found|body|true)$/i.test(e.fromPort || "")) || outs[id]?.[0];
            id = next?.to;
        }
        if (!parts.length) return "Блоки есть, но цепочка не связана — сценарий не пойдёт дальше «Старта».";
        return "Когда вы нажимаете «Запустить», сценарий " + parts.join(", затем ") + ".";
    }

    const BLOCK_DOC = {
        start: "начальный блок, запускает выполнение",
        request: "отправляет HTTP-запрос к LOLZTEAM Market API",
        condition: "проверяет условие и ведёт по ветке true/false",
        filter: "фильтрует массив результатов по полю",
        delay: "ждёт указанное время перед следующим шагом",
        loop: "повторяет вложенную ветку заданное число раз",
        notify: "отправляет сообщение в Telegram/Discord",
        logmsg: "выводит текст в лог выполнения",
        savefile: "сохраняет данные в CSV/JSON файл",
        stop: "завершает сценарий",
        foreach: "перебирает элементы списка по одному",
        checker: "проверяет аккаунт или лот перед действием",
        sniper: "быстрая реакция на появление лота",
        variable: "достаёт значение из ответа в переменную",
        proxy: "маршрутизирует запросы через прокси",
    };

    function buildBlocksMarkdown(scn, compact) {
        const types = [...new Set((scn.nodes || []).map(n => n.type))];
        return types.map(t => {
            const doc = BLOCK_DOC[t] || "блок сценария";
            return compact ? `- **${t}** — ${doc}` : `- **${t}** — ${doc}`;
        }).join("\n");
    }

    function explainSystemExtra(mode) {
        if (mode === "short") {
            return [
                " Сократи отчёт примерно в 1.5–2 раза, но сохрани всю суть и конкретику.",
                "Запрещено: абстрактные фразы («взаимодействует с API», «обрабатывает данные») без деталей.",
                "Обязательно оставь: какие запросы, фильтры, паузы, уведомления, циклы — по факту из сценария.",
                "Структура markdown:",
                "## Название",
                "### Как работает (2–4 предложения, по шагам: сначала… потом…)",
                "### Блоки (список: **тип** — одна строка описания роли, как в справочнике)",
                "### Замечания (только реальные проблемы; если нет — «Критичных проблем не видно»)",
                "Без json, без «Советов».",
            ].join("\n");
        }
        if (mode === "question") {
            return [
                " Пользователь задал конкретный вопрос о текущем сценарии.",
                "Ответь только на этот вопрос — кратко и по делу.",
                "Не пересказывай весь сценарий и не перечисляй все блоки, если об этом не спрашивали.",
                "Используй факты из JSON. Markdown допустим. Обычно достаточно 2–6 предложений.",
            ].join("\n");
        }
        return [
            " Объясни сценарий человеческим языком — расскажи историю: что происходит шаг за шагом после «Запустить».",
            "Используй конкретику из JSON: URL запросов, фильтры, каналы уведомлений, задержки, циклы.",
            "Структура markdown:",
            "## Название сценария",
            "### Как работает (5–8 предложений, живым текстом: «сначала…», «если…», «потом…»)",
            "### Блоки (список: **тип** — краткое описание роли блока, как в документации; по одной строке на тип)",
            "### Замечания (только реальные дыры: пустой URL, нет токена, обрыв цепочки; иначе — «Критичных проблем не видно»)",
            "Не вставляй json. Не пиши общие советы про изучение API.",
        ].join("\n");
    }

    function isFullOverviewRequest(q) {
        if (!q) return false;
        return /^(объясни|разбери|опиши|покажи|расскажи|проверь)\b/i.test(q) &&
            /(сценарий|схем|бот|целиком|полностью|весь|все блоки)/i.test(q);
    }

    function explainLocally(scn) {
        const nodes = scn.nodes || [];
        const issues = [];
        if (!nodes.some(n => n.type === "start")) issues.push("Нет блока «Старт»");
        const start = nodes.find(n => n.type === "start");
        if (start && !window.LZTToken?.get?.()) issues.push("Не задан API-токен");
        nodes.filter(n => n.type === "request").forEach(n => {
            if (!n.request?.url) issues.push(`Запрос «${n.request?.title || n.id}»: пустой URL`);
        });
        nodes.filter(n => n.type === "notify").forEach(n => {
            if (!n.notify?.text) issues.push("Блок уведомления без текста");
        });
        nodes.filter(n => n.type === "logmsg").forEach(n => {
            if (!n.logmsg?.text) issues.push("Блок логирования без текста");
        });
        return renderExplainLocally(scn, issues);
    }

    function escHtml(s) {
        return String(s || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    const NODE_ICONS = {
        start: "fa-play", request: "fa-cloud-arrow-up", condition: "fa-code-branch",
        filter: "fa-filter", loop: "fa-rotate", delay: "fa-clock", notify: "fa-bell",
        savefile: "fa-floppy-disk", logmsg: "fa-terminal", stop: "fa-stop", checker: "fa-shield",
        foreach: "fa-list-ul", sniper: "fa-crosshairs", variable: "fa-variable",
    };

    function renderExplainLocally(scn, issues) {
        const nodes = scn.nodes || [];
        const edges = scn.edges || [];
        const types = {};
        nodes.forEach(n => { types[n.type] = (types[n.type] || 0) + 1; });

        const stats = Object.entries(types).map(([t, n]) =>
            `<span class="ai-explain-chip"><i class="fa-solid ${NODE_ICONS[t] || "fa-cube"}"></i>${escHtml(t)} <b>${n}</b></span>`
        ).join("");

        const list = [...new Set(nodes.map(n => n.type))].map(t =>
            `<li><span class="ai-ex-node-type">${escHtml(t)}</span> ${escHtml(BLOCK_DOC[t] || "блок сценария")}</li>`
        ).join("");

        let issuesBlock = "";
        if (issues.length) {
            issuesBlock = `<div class="ai-explain-warn">
                <div class="ai-explain-warn-title"><i class="fa-solid fa-triangle-exclamation"></i> Замечания (${issues.length})</div>
                <ul class="ai-md-ul">${issues.map(i => `<li>${escHtml(i)}</li>`).join("")}</ul>
            </div>`;
        } else {
            issuesBlock = `<div class="ai-explain-ok"><i class="fa-solid fa-circle-check"></i> Критичных ошибок не найдено</div>`;
        }

        return `<div class="ai-explain-card">
            <div class="ai-explain-head">
                <div class="ai-explain-icon"><i class="fa-solid fa-diagram-project"></i></div>
                <div>
                    <h3 class="ai-explain-title">${escHtml(scn.title || "Сценарий")}</h3>
                    <p class="ai-explain-meta">${nodes.length} блоков · ${edges.length} связей</p>
                </div>
            </div>
            <h4 class="ai-md-h3">Как работает</h4>
            <p class="ai-md-p ai-explain-story">${escHtml(buildScenarioStory(scn))}</p>
            <div class="ai-explain-stats">${stats || `<span class="ai-explain-chip">пусто</span>`}</div>
            <h4 class="ai-md-h3">Блоки</h4>
            <ul class="ai-md-ul ai-explain-nodes">${list || "<li>Блоков нет</li>"}</ul>
            ${issuesBlock}
        </div>`;
    }

    function sanitizeExplainMd(text) {
        return String(text || "")
            .replace(/```json[\s\S]*?```/gi, "_(полный JSON скрыт — смотрите на холсте)_")
            .replace(/```[\s\S]*?```/g, (block) => block.length > 800 ? "_(большой фрагмент кода скрыт)_" : block);
    }

    function renderMarkdownReport(md) {
        let src = sanitizeExplainMd(md);
        const codes = [];
        src = src.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
            const i = codes.length;
            codes.push({ lang: (lang || "").trim(), code: code.trim() });
            return `\x00CODE${i}\x00`;
        });
        src = escHtml(src);
        src = src.replace(/\x00CODE(\d+)\x00/g, (_, i) => {
            const c = codes[+i];
            const label = c.lang ? `<span class="ai-md-code-lang">${escHtml(c.lang)}</span>` : "";
            return `<pre class="ai-md-pre">${label}<code>${escHtml(c.code)}</code></pre>`;
        });
        src = src.replace(/^### (.+)$/gm, '<h4 class="ai-md-h3">$1</h4>');
        src = src.replace(/^## (.+)$/gm, '<h3 class="ai-md-h2">$1</h3>');
        src = src.replace(/^# (.+)$/gm, '<h3 class="ai-md-h2">$1</h3>');
        src = src.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        src = src.replace(/`([^`\n]+)`/g, '<code class="ai-md-inline">$1</code>');
        src = src.replace(/^[-*•]\s+(.+)$/gm, "<li>$1</li>");
        src = src.replace(/((?:<li>[\s\S]*?<\/li>\s*)+)/g, (m) => `<ul class="ai-md-ul">${m}</ul>`);
        src = src.split(/\n{2,}/).map(p => {
            p = p.trim();
            if (!p) return "";
            if (/^<(h[34]|ul|pre|div)/.test(p)) return p;
            return `<p class="ai-md-p">${p.replace(/\n/g, "<br>")}</p>`;
        }).join("");
        return `<div class="ai-explain-card ai-explain-ai">${src}</div>`;
    }

    function explainLocallyShort(scn) {
        const nodes = scn.nodes || [];
        const issues = [];
        if (!nodes.some(n => n.type === "start")) issues.push("нет блока «Старт»");
        if (!window.LZTToken?.get?.()) issues.push("не задан API-токен");
        nodes.filter(n => n.type === "request" && !n.request?.url).forEach(n => {
            issues.push(`пустой URL у «${n.request?.title || n.id}»`);
        });
        const types = [...new Set(nodes.map(n => n.type))];
        const blocksList = types.map(t => `<li><span class="ai-ex-node-type">${escHtml(t)}</span> ${escHtml(BLOCK_DOC[t] || "блок сценария")}</li>`).join("");
        let issuesBlock = issues.length
            ? `<h4 class="ai-md-h3">Замечания</h4><ul class="ai-md-ul">${issues.map(i => `<li>${escHtml(i)}</li>`).join("")}</ul>`
            : `<p class="ai-md-p" style="color:var(--lzt-green); margin-top:8px;">Критичных проблем не видно.</p>`;
        return `<div class="ai-explain-card ai-explain-short">
            <h3 class="ai-explain-title">${escHtml(scn.title || "Сценарий")}</h3>
            <h4 class="ai-md-h3">Как работает</h4>
            <p class="ai-md-p ai-explain-story">${escHtml(buildScenarioStory(scn))}</p>
            <h4 class="ai-md-h3">Блоки</h4>
            <ul class="ai-md-ul ai-explain-nodes">${blocksList}</ul>
            ${issuesBlock}
        </div>`;
    }

    function initAiPlus() {
        const modal = document.getElementById("ai-modal");
        if (!modal || modal.dataset.aiPlusReady === "1") return;

        const tabs = document.getElementById("ai-tabs");
        const genBtn = document.getElementById("ai-generate");
        const input = document.getElementById("ai-input");
        const statusEl = document.getElementById("ai-status");
        if (!tabs || !genBtn || !input || !statusEl) {
            console.error("ai_plus: не найдены элементы модалки (#ai-tabs, #ai-generate, #ai-input, #ai-status)");
            return;
        }

        const body = modal.querySelector(".modal-body");
        const scrollArea = modal.querySelector(".ai-modal-scroll") || body;

        let explainBox = document.getElementById("ai-explain-box");
        if (!explainBox) {
            explainBox = document.createElement("div");
            explainBox.id = "ai-explain-box";
            explainBox.className = "ai-explain-box";
            explainBox.style.display = "none";
            scrollArea.insertBefore(explainBox, statusEl);
        }

        let explainBar = document.getElementById("ai-explain-bar");
        if (!explainBar) {
            explainBar = document.createElement("div");
            explainBar.id = "ai-explain-bar";
            explainBar.className = "ai-explain-bar";
            explainBar.style.display = "none";
            explainBar.innerHTML =
                '<button type="button" id="ai-explain-full" class="btn-token ai-explain-full-btn" title="Полный разбор всего сценария"><i class="fa-solid fa-diagram-project"></i> <span>Полный разбор</span></button>' +
                '<button type="button" id="ai-explain-shorter" class="btn-token ai-explain-shorter-btn" title="Сократить текст, сохранив суть и детали"><i class="fa-solid fa-compress"></i> <span>Короче</span></button>';
            explainBox.insertAdjacentElement("afterend", explainBar);
        }

        let activeTab = "create";
        let explainHasResult = false;
        let lastExplainText = "";

        function setSendAction(label) {
            genBtn.dataset.sendLabel = label;
            if ((input.value || "").trim()) {
                genBtn.title = label;
                genBtn.setAttribute("aria-label", label);
            }
        }
        const shorterBtn = document.getElementById("ai-explain-shorter");
        const fullBtn = document.getElementById("ai-explain-full");

        function explainUiLabel(key) {
            const en = window.I18N && I18N.lang === "en";
            if (key === "shorter") return en ? "Shorter" : "Короче";
            if (key === "full") return en ? "Full review" : "Полный разбор";
            if (key === "hint") return en
                ? "Ask about the scenario or click «Full review»."
                : "Задайте вопрос о сценарии или нажмите «Полный разбор».";
            if (key === "empty") return en
                ? "Type a question about the scenario first."
                : "Сначала задайте вопрос о сценарии.";
            if (key === "loading") return en ? "Analyzing…" : "Думаю…";
            if (key === "shortLoading") return en ? "Shortening…" : "Сокращаю…";
            if (key === "questionLoading") return en ? "Answering…" : "Отвечаю…";
            return key;
        }

        function renderExplainHint() {
            explainBox.innerHTML = `<div class="ai-explain-hint"><i class="fa-solid fa-circle-info"></i> ${explainUiLabel("hint")}</div>`;
        }

        function syncTabUI() {
            const isExplain = activeTab === "explain";
            const isCreate = activeTab === "create";
            const intro = document.querySelector(".ai-modal-intro");

            explainBox.style.display = isExplain ? "block" : "none";
            if (isExplain && !explainBox.innerHTML.trim()) renderExplainHint();

            if (isExplain) {
                statusEl.textContent = "";
                statusEl.innerHTML = "";
            }
            if (intro) intro.style.display = isExplain ? "none" : "block";
            const disclaimer = document.getElementById("ai-modal-disclaimer");
            if (disclaimer) disclaimer.style.display = isExplain ? "none" : "flex";
            document.querySelector(".ai-mode-row").style.display = "flex";
            document.querySelector(".ai-examples").style.display = isCreate ? "flex" : "none";
            syncExplainBar();
        }

        function syncExplainBar() {
            if (!explainBar) return;
            const fullSpan = fullBtn?.querySelector("span");
            const shortSpan = shorterBtn?.querySelector("span");
            if (fullSpan) fullSpan.textContent = explainUiLabel("full");
            if (shortSpan) shortSpan.textContent = explainUiLabel("shorter");
            explainBar.style.display = activeTab === "explain" ? "flex" : "none";
            if (fullBtn) fullBtn.style.display = activeTab === "explain" ? "inline-flex" : "none";
            if (shorterBtn) shorterBtn.style.display = (activeTab === "explain" && explainHasResult) ? "inline-flex" : "none";
        }

        async function runExplain(shortMode, forceFull) {
            const S = window.Scenario;
            const q = (input.value || "").trim();

            if (!shortMode && !forceFull && !q) {
                renderExplainHint();
                return;
            }

            const mode = shortMode ? "short" : (forceFull || isFullOverviewRequest(q) ? "full" : "question");
            const base = S.serialize();
            let prompt;
            if (shortMode && lastExplainText) {
                prompt = "Сократи отчёт ниже примерно в 2 раза. Сохрани конкретные шаги, URL, фильтры, уведомления и реальные замечания. Не заменяй на общие фразы.\n\n" + lastExplainText;
            } else if (mode === "question") {
                prompt = `Вопрос пользователя о сценарии: ${q}\n\nJSON сценария:\n${JSON.stringify(base)}`;
            } else if (mode === "full") {
                prompt = q
                    ? `${q}\n\nJSON сценария:\n${JSON.stringify(base)}`
                    : "Объясни сценарий простым языком и найди ошибки:\n" + JSON.stringify(base);
            } else {
                prompt = q || ("Объясни сценарий по шагам:\n" + JSON.stringify(base));
            }

            const loadingLabel = shortMode ? "shortLoading" : (mode === "question" ? "questionLoading" : "loading");
            explainBox.innerHTML = `<div class="ai-explain-loading"><i class="fa-solid fa-spinner fa-spin"></i> ${explainUiLabel(loadingLabel)}</div>`;
            statusEl.textContent = "";
            if (q) {
                input.value = "";
                if (window.syncAiComposerMode) window.syncAiComposerMode();
                if (window.Assistant?.autoResizeAiInput) window.Assistant.autoResizeAiInput();
            }
            explainHasResult = false;
            syncExplainBar();
            if (shorterBtn) shorterBtn.disabled = true;
            if (fullBtn) fullBtn.disabled = true;

            try {
                const text = await callAi(prompt, aiSystemBase() + explainSystemExtra(mode));
                lastExplainText = text;
                explainBox.innerHTML = renderMarkdownReport(text);
            } catch (err) {
                if (mode === "question") {
                    explainBox.innerHTML = `<div class="ai-explain-warn"><div class="ai-explain-warn-title"><i class="fa-solid fa-circle-xmark"></i> Не удалось ответить</div><p class="ai-md-p">${escHtml(err.message || String(err))}</p></div>`;
                } else {
                    explainBox.innerHTML = shortMode ? explainLocallyShort(S.serialize()) : explainLocally(S.serialize());
                }
                lastExplainText = mode === "question" ? "" : explainBox.innerHTML;
            }

            explainHasResult = true;
            if (shorterBtn) shorterBtn.disabled = false;
            if (fullBtn) fullBtn.disabled = false;
            syncExplainBar();
        }

        shorterBtn?.addEventListener("click", () => runExplain(true, false));
        fullBtn?.addEventListener("click", () => runExplain(false, true));

        tabs.querySelectorAll(".ai-tab").forEach(btn => {
            btn.addEventListener("click", () => {
                activeTab = btn.dataset.tab;
                tabs.querySelectorAll(".ai-tab").forEach(b => b.classList.toggle("active", b === btn));
                if (activeTab === "edit") {
                    input.placeholder = "Что изменить? Например: «добавь задержку 5 сек после покупки»";
                    setSendAction("Применить изменения");
                } else if (activeTab === "explain") {
                    input.placeholder = "Спросите про сценарий: «зачем пауза?», «где ошибка?», «что делает фильтр?»…";
                    setSendAction("Ответить");
                } else {
                    input.placeholder = "Опишите, что должен делать сценарий…";
                    setSendAction("Собрать сценарий");
                }
                syncTabUI();
                if (window.syncAiComposerMode) window.syncAiComposerMode();
                if (window.Assistant?.autoResizeAiInput) window.Assistant.autoResizeAiInput();
            });
        });

        genBtn.addEventListener("click", async function aiPlusHandler(e) {
            if (!tabs.isConnected) return;
            const status = document.getElementById("ai-status");
            const S = window.Scenario;
            if (activeTab === "explain") {
                e.stopImmediatePropagation();
                const q = (input.value || "").trim();
                if (!q) {
                    if (window.startAiVoiceInput) window.startAiVoiceInput();
                    else renderExplainHint();
                    return;
                }
                await runExplain(false, false);
                return;
            }
            if (activeTab === "edit") {
                e.stopImmediatePropagation();
                const cmd = (input.value || "").trim();
                if (!cmd) {
                    if (window.startAiVoiceInput) window.startAiVoiceInput();
                    return;
                }
                status.innerHTML = '<div class="ai-explain-loading"><i class="fa-solid fa-spinner fa-spin"></i> Редактирую сценарий…</div>';
                input.value = "";
                if (window.syncAiComposerMode) window.syncAiComposerMode();
                if (window.Assistant?.autoResizeAiInput) window.Assistant.autoResizeAiInput();
                try {
                    const current = S.serialize();
                    const prompt = `Текущий scenario.json:\n${JSON.stringify(current)}\n\nИзмени по команде: ${cmd}\n\nВерни ТОЛЬКО валидный JSON сценария. Без markdown. Сохраняй id существующих нод где возможно. Не указывай x/y — раскладку сделает конструктор.`;
                    const raw = await callAi(prompt, aiSystemBase() + " Ответ — только JSON, одна строка, без trailing comma.");
                    let sc = window.Assistant?.extractJson ? window.Assistant.extractJson(raw) : JSON.parse(raw);
                    if (window.Assistant?.validateScenarioObj) sc = window.Assistant.validateScenarioObj(sc, { autoLayout: true });
                    S.load(sc);
                    status.innerHTML = '<div class="ai-explain-ok"><i class="fa-solid fa-circle-check"></i> Сценарий обновлён</div>';
                    if (S.flash) S.flash("Сценарий изменён AI", "ok");
                } catch (err) {
                    status.innerHTML = `<div class="ai-explain-warn"><div class="ai-explain-warn-title"><i class="fa-solid fa-circle-xmark"></i> Не удалось применить</div><p class="ai-md-p">${escHtml(err.message || String(err))}</p></div>`;
                }
                return;
            }
        }, true);

        // Голосовой ввод: Whisper (если есть GROQ_KEYS) или Web Speech API
        let voiceRec = null;
        let voiceBusy = false;
        let voiceTimer = null;
        let voiceGotResult = false;
        let mediaRecorder = null;
        let mediaStream = null;
        let silenceTimer = null;
        let sttAvailable = false;
        const MIC_CONSENT_KEY = "lzt_mic_consent";

        const appendVoiceText = (text) => {
            if (!text) return;
            const cur = (input.value || "").trim();
            input.value = cur ? cur + " " + text : text;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.focus();
            if (window.Assistant?.autoResizeAiInput) window.Assistant.autoResizeAiInput();
            if (window.syncAiComposerMode) window.syncAiComposerMode();
        };

        const finishVoice = () => {
            voiceBusy = false;
            voiceGotResult = false;
            genBtn.classList.remove("recording", "processing");
            if (window.syncAiComposerMode) window.syncAiComposerMode();
            if (voiceTimer) { clearTimeout(voiceTimer); voiceTimer = null; }
            if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
            if (voiceRec) {
                try {
                    voiceRec.onresult = voiceRec.onerror = voiceRec.onend = null;
                    voiceRec.abort();
                } catch (e) {}
                voiceRec = null;
            }
            if (mediaRecorder && mediaRecorder.state !== "inactive") {
                try { mediaRecorder.stop(); } catch (e) {}
            }
            if (mediaStream) {
                mediaStream.getTracks().forEach(t => t.stop());
                mediaStream = null;
            }
            mediaRecorder = null;
        };

        const stopRecordingOnly = () => {
            genBtn.classList.remove("recording");
            genBtn.classList.add("processing");
            genBtn.title = voiceUi().processing;
            genBtn.setAttribute("aria-label", voiceUi().processing);
            if (voiceTimer) { clearTimeout(voiceTimer); voiceTimer = null; }
            if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
            if (voiceRec) {
                try { voiceRec.stop(); } catch (e) {}
            }
            if (mediaRecorder && mediaRecorder.state === "recording") {
                try { mediaRecorder.stop(); } catch (e) {}
            }
        };

        async function checkSttAvailable() {
            try {
                const r = await fetch("/api/config");
                const d = await r.json();
                sttAvailable = !!d.stt_enabled;
            } catch (e) {
                sttAvailable = false;
            }
            return sttAvailable;
        }

        function attachSilenceStop(stream, onDone, maxMs = 45000) {
            let ctx = null;
            let raf = null;
            let started = Date.now();
            let silentSince = null;
            let heardSpeech = false;
            const threshold = 0.012;
            const silenceMs = 1100;

            const cleanup = () => {
                if (raf) cancelAnimationFrame(raf);
                if (ctx) ctx.close().catch(() => {});
                raf = null;
                ctx = null;
            };

            try {
                ctx = new (window.AudioContext || window.webkitAudioContext)();
                const src = ctx.createMediaStreamSource(stream);
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 512;
                src.connect(analyser);

                const tick = () => {
                    if (!voiceBusy) { cleanup(); return; }
                    const buf = new Uint8Array(analyser.fftSize);
                    analyser.getByteTimeDomainData(buf);
                    let sum = 0;
                    for (let i = 0; i < buf.length; i++) {
                        const n = (buf[i] - 128) / 128;
                        sum += n * n;
                    }
                    const rms = Math.sqrt(sum / buf.length);
                    if (rms > threshold) {
                        heardSpeech = true;
                        silentSince = null;
                    } else if (heardSpeech) {
                        if (!silentSince) silentSince = Date.now();
                        else if (Date.now() - silentSince >= silenceMs) {
                            cleanup();
                            onDone();
                            return;
                        }
                    }
                    if (Date.now() - started >= maxMs) {
                        cleanup();
                        onDone();
                        return;
                    }
                    raf = requestAnimationFrame(tick);
                };
                raf = requestAnimationFrame(tick);
            } catch (e) {
                cleanup();
                silenceTimer = setTimeout(onDone, 12000);
            }
        }

        async function requestMicAccess() {
            if (!navigator.mediaDevices?.getUserMedia) return true;
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(t => t.stop());
                return true;
            } catch (e) {
                return e.name !== "NotAllowedError" && e.name !== "PermissionDeniedError";
            }
        }

        async function ensureMicConsent() {
            if (localStorage.getItem(MIC_CONSENT_KEY) === "1") return true;
            const ui = voiceUi();
            const allowed = await LZTDialog.confirm(ui.confirm, {
                title: ui.title,
                okText: ui.allow,
                cancelText: ui.block,
                icon: "fa-microphone",
            });
            if (allowed) localStorage.setItem(MIC_CONSENT_KEY, "1");
            return allowed;
        }

        async function transcribeViaServer(blob) {
            const ui = voiceUi();
            stopRecordingOnly();
            try {
                const fd = new FormData();
                const ext = (blob.type || "").includes("ogg") ? "voice.ogg"
                    : (blob.type || "").includes("mp4") ? "voice.m4a" : "voice.webm";
                fd.append("file", blob, ext);
                fd.append("lang", voiceSttLang());
                const res = await fetch("/api/stt", { method: "POST", body: fd });
                let data = {};
                try { data = await res.json(); } catch (e) { /* не JSON */ }
                if (!res.ok || !data.success) {
                    throw new Error(data.error || `HTTP ${res.status}`);
                }
                if (data.text) {
                    appendVoiceText(String(data.text).trim());
                    return;
                }
                throw new Error(data.error || ui.recognizeFail);
            } finally {
                finishVoice();
            }
        }

        async function startMediaRecorder() {
            const ui = voiceUi();
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", ""];
            let mime = "";
            for (const m of mimeCandidates) {
                if (!m || MediaRecorder.isTypeSupported(m)) { mime = m; break; }
            }
            const chunks = [];
            mediaRecorder = mime
                ? new MediaRecorder(mediaStream, { mimeType: mime })
                : new MediaRecorder(mediaStream);
            mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
            mediaRecorder.onstop = async () => {
                const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
                if (mediaStream) {
                    mediaStream.getTracks().forEach(t => t.stop());
                    mediaStream = null;
                }
                mediaRecorder = null;
                if (!blob.size) {
                    finishVoice();
                    return;
                }
                try {
                    await transcribeViaServer(blob);
                } catch (err) {
                    finishVoice();
                    await LZTDialog.alert(String(err.message || err), { title: ui.title, icon: "fa-microphone-slash" });
                }
            };
            mediaRecorder.onerror = async () => {
                finishVoice();
                await LZTDialog.alert(ui.recognizeFail, { title: ui.title, icon: "fa-microphone-slash" });
            };
            mediaRecorder.start();
            genBtn.title = ui.listening;
            genBtn.setAttribute("aria-label", ui.listening);
            attachSilenceStop(mediaStream, () => {
                if (voiceBusy && mediaRecorder && mediaRecorder.state === "recording") {
                    stopRecordingOnly();
                    try { mediaRecorder.stop(); } catch (e) { finishVoice(); }
                }
            });
            voiceTimer = setTimeout(() => {
                if (voiceBusy && mediaRecorder && mediaRecorder.state === "recording") {
                    stopRecordingOnly();
                    try { mediaRecorder.stop(); } catch (e) { finishVoice(); }
                }
            }, 45000);
        }

        function startWebSpeech() {
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SR) return false;
            const ui = voiceUi();
            const langs = voiceRecLangList();
            let langIdx = 0;
            let accumulated = "";

            const abortRec = () => {
                if (!voiceRec) return;
                try {
                    voiceRec.onresult = voiceRec.onerror = voiceRec.onend = null;
                    voiceRec.abort();
                } catch (e) {}
                voiceRec = null;
            };

            const runLang = () => {
                if (langIdx >= langs.length) {
                    finishVoice();
                    return;
                }
                abortRec();
                voiceGotResult = false;
                accumulated = "";
                voiceRec = new SR();
                voiceRec.lang = langs[langIdx];
                voiceRec.continuous = true;
                voiceRec.interimResults = true;
                voiceRec.maxAlternatives = 1;

                voiceRec.onresult = (ev) => {
                    for (let i = ev.resultIndex; i < ev.results.length; i++) {
                        const r = ev.results[i];
                        const t = (r[0] && r[0].transcript) ? r[0].transcript.trim() : "";
                        if (!t) continue;
                        if (r.isFinal) {
                            accumulated = accumulated ? `${accumulated} ${t}` : t;
                            voiceGotResult = true;
                        }
                    }
                };

                voiceRec.onerror = async (ev) => {
                    const err = ev.error || "";
                    if (err === "not-allowed" || err === "service-not-allowed") {
                        finishVoice();
                        await LZTDialog.alert(ui.micBlockedShort, { title: ui.title, icon: "fa-microphone-slash" });
                        return;
                    }
                    if (err === "aborted") return;
                    if ((err === "no-speech" || err === "language-not-supported") && langIdx + 1 < langs.length) {
                        langIdx++;
                        runLang();
                        return;
                    }
                    if (err === "no-speech") {
                        finishVoice();
                        return;
                    }
                    finishVoice();
                    try {
                        voiceBusy = true;
                        genBtn.classList.add("recording");
                        await startMediaRecorder();
                    } catch (e) {
                        finishVoice();
                        await LZTDialog.alert(ui.recognizeFail + (err ? ": " + err : ""), { title: ui.title });
                    }
                };

                voiceRec.onend = () => {
                    const text = accumulated.trim();
                    if (text) {
                        appendVoiceText(text);
                        finishVoice();
                        return;
                    }
                    if (langIdx + 1 < langs.length) {
                        langIdx++;
                        runLang();
                        return;
                    }
                    finishVoice();
                };

                try {
                    voiceRec.start();
                    genBtn.title = `${ui.listening} (${langs[langIdx]})`;
                    genBtn.setAttribute("aria-label", genBtn.title);
                } catch (e) {
                    voiceRec = null;
                    if (langIdx + 1 < langs.length) {
                        langIdx++;
                        runLang();
                    } else {
                        finishVoice();
                    }
                }
            };

            runLang();
            voiceTimer = setTimeout(() => {
                if (voiceBusy && voiceRec) {
                    stopRecordingOnly();
                    try { voiceRec.stop(); } catch (e) { finishVoice(); }
                }
            }, 45000);
            return true;
        }

        async function startAiVoiceInput() {
            const ui = voiceUi();

            if (voiceBusy) {
                stopRecordingOnly();
                if (voiceRec) {
                    try { voiceRec.stop(); } catch (e) { finishVoice(); }
                } else if (mediaRecorder && mediaRecorder.state === "recording") {
                    try { mediaRecorder.stop(); } catch (e) { finishVoice(); }
                } else {
                    finishVoice();
                }
                return;
            }

            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            const hasMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
            if (!SR && !hasMedia) {
                await LZTDialog.alert(ui.unsupported, { title: ui.title });
                return;
            }

            const allowed = await ensureMicConsent();
            if (!allowed) return;

            voiceBusy = true;
            genBtn.classList.add("recording");
            genBtn.title = ui.listening;
            genBtn.setAttribute("aria-label", ui.listening);

            const micOk = await requestMicAccess();
            if (!micOk) {
                finishVoice();
                await LZTDialog.alert(ui.micBlocked, { title: ui.title, icon: "fa-microphone-slash" });
                return;
            }

            try {
                const useServerStt = await checkSttAvailable();
                if (hasMedia && useServerStt) {
                    await startMediaRecorder();
                    return;
                }
                if (SR && startWebSpeech()) return;
                finishVoice();
                await LZTDialog.alert(ui.unsupported, { title: ui.title });
            } catch (e) {
                finishVoice();
                await LZTDialog.alert(ui.startFail + ": " + (e.message || e), { title: ui.title });
            }
        }

        window.startAiVoiceInput = startAiVoiceInput;
        window.AiVoice = { ui: voiceUi };
        setSendAction("Собрать сценарий");
        syncTabUI();
        if (window.syncAiComposerMode) window.syncAiComposerMode();
        modal.dataset.aiPlusReady = "1";
    }

    function bootAiPlus() {
        try { initAiPlus(); } catch (e) { console.error("ai_plus init:", e); }
    }

    document.addEventListener("DOMContentLoaded", bootAiPlus);
    window.initAiPlus = bootAiPlus;
})();
