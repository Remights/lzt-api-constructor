// Простой i18n: переключение RU/EN для основного интерфейса + тема.
// Строки статичной верстки помечены атрибутами data-i18n / data-i18n-title / data-i18n-ph.
(function () {
    const DICT = {
        ru: {
            "app.title": "LZT API Constructor",
            "search.ph": "Поиск параметров или эндпоинтов...",
            "token.setup": "Настроить API Токен",
            "win.min": "Свернуть", "win.max": "Развернуть", "win.close": "Закрыть",
            "sidebar.new": "+ Новый сценарий",
            "sidebar.docs": "Справочник LOLZ API",
            "sidebar.examplesApi": "Примеры API",
            "sidebar.readyScenarios": "Готовые сценарии",
            "sidebar.blocksMarket": "Блоки-запросы: Маркет",
            "sidebar.blocksForum": "Блоки-запросы: Форум (Zelenka)",
            "sidebar.myScenarios": "Мои сценарии",
            "sidebar.saveCurrent": "Сохранить текущий сценарий",
            "toolbar.undo": "Отменить (Ctrl+Z)",
            "toolbar.redo": "Повторить (Ctrl+Y)",
            "toolbar.addBlock": "Добавить блок",
            "toolbar.fit": "Показать весь сценарий",
            "toolbar.export": "Экспорт сценария в файл .json",
            "toolbar.import": "Импорт сценария из файла .json",
            "toolbar.help": "Как пользоваться (обучение)",
            "toolbar.rename": "Переименовать сценарий",
            "toolbar.renameHint": "Двойной клик — переименовать",
            "toolbar.settings": "Настройки",
            "search.block": "Поиск блока…",
            "run.title": "Запуск сценария",
            "run.start": "Запустить",
            "run.stop": "Остановить",
            "run.stepMode": "Пошаговый режим (пауза после каждого блока)",
            "run.hint": "Соберите цепочку блоков и нажмите «Запустить» — здесь будут шаги сценария.",
            "run.progress": "Ход выполнения",
            "run.debugTitle": "Debug / ответ API",
            "run.debugHint": "HTTP-запросы, коды ответов и таблица данных появятся здесь при запуске.",
            "bot.title": "Скрипт",
            "settings.title": "Настройки",
            "settings.language": "Язык интерфейса",
            "settings.theme": "Тема оформления",
            "settings.themeDark": "Тёмная", "settings.themeLight": "Светлая",
            "settings.replayTour": "Показать обучение снова",
            "settings.close": "Закрыть",
            "settings.encryptToken": "Шифровать API-токен в localStorage",
            "settings.encryptPassPh": "Пароль для шифрования",
            "settings.soundAlerts": "Звук при завершении сценария",
            "settings.nativeNotify": "Windows-уведомления",
            "settings.trayMinimize": "Сворачивать в трей (фоновый режим)",
            "settings.trayHint": "Трей недоступен — установите: pip install pystray Pillow",
            "tour.skip": "Пропустить",
            "tour.back": "Назад",
            "tour.next": "Далее",
            "tour.done": "Понятно, начать!",
            "tour.langRu": "Русский",
            "tour.langEn": "English",
            "tour.s0.title": "Шаг 1 — язык",
            "tour.s0.text": "Выберите язык интерфейса. Его можно сменить позже в <b>⚙ Настройки</b>.",
            "tour.s1.title": "Шаг 2 — API-токен",
            "tour.s1.text": "Нажмите блок <b>«Старт»</b> и вставьте свой API-токен LOLZTEAM. Без него запросы к Маркету/Форуму работать не будут. Кнопка «где взять токен» — внутри блока.",
            "tour.s2.title": "Шаг 3 — добавьте блоки",
            "tour.s2.text": "Кнопка <b>«Добавить блок»</b> вверху. Блоки разбиты по категориям: <b>Действия</b> (запрос, уведомление, сохранение), <b>Логика</b> (условие, фильтр, цикл) и <b>Настройки</b> (прокси, задержка).",
            "tour.s3.title": "Шаг 4 — соедините линиями",
            "tour.s3.text": "Тяните мышкой от кружка-порта одного блока ко входу другого. Так задаётся порядок: <b>Старт → Запрос → …</b>. У условий и фильтров два выхода (Да/Нет, Есть/Пусто).",
            "tour.s4.title": "Шаг 5 — запустите",
            "tour.s4.text": "Кнопка <b>«Запустить»</b> справа выполнит сценарий вживую — шаги подсветятся, ответы и таблицы появятся в логе.",
            "tour.s5.title": "Шаг 6 — заберите бота",
            "tour.s5.text": "Внизу справа автоматически генерируется готовый <b>скрипт-бот</b> на Python, JS, Go и др. Скопируйте — и он работает без этой программы. А сам сценарий можно выгрузить в файл и переслать.",
            "tour.s6.title": "Совет",
            "tour.s6.text": "Не хотите собирать с нуля — возьмите <b>готовый шаблон</b> в сайдбаре слева (мониторинг Steam, выгрузка в CSV, автопокупка). Всё редактируется.",
            "scenario.new": "Новый сценарий",
            "scenario.tab": "Сценарий {n}",
            "scenario.myDefault": "Мой сценарий",
            "run.status.running": "выполняется…",
            "run.status.step": "пошагово…",
            "run.status.done": "готово",
            "token.connected": "Токен подключен",
            "profit.session": "Потрачено (сессия)",
            "profit.total": "Всего (учёт)",
            "dialog.rename.title": "Переименовать сценарий",
            "dialog.rename.ok": "Сохранить",
            "dialog.rename.prompt": "Название сценария:",
            "dialog.save.title": "Сохранить сценарий",
            "dialog.save.prompt": "Название сценария:",
            "blocks.cat.actions": "Действия",
            "blocks.cat.logic": "Логика",
            "blocks.cat.market": "Маркет",
            "blocks.cat.settings": "Настройки и пауза",
            "blocks.request.label": "Запрос к API",
            "blocks.request.desc": "Получить лоты, купить, любой запрос",
            "blocks.notify.label": "Уведомление",
            "blocks.notify.desc": "Написать себе в Telegram / Discord",
            "blocks.logmsg.label": "Сообщение в лог",
            "blocks.logmsg.desc": "Показать свой текст при запуске",
            "blocks.savefile.label": "Сохранить в файл",
            "blocks.savefile.desc": "Выгрузить результат в CSV или JSON",
            "blocks.condition.label": "Условие (Да / Нет)",
            "blocks.condition.desc": "Развилка по значению из ответа",
            "blocks.filter.label": "Фильтр списка",
            "blocks.filter.desc": "Оставить только подходящее (цена ≤ X)",
            "blocks.foreach.label": "Для каждого",
            "blocks.foreach.desc": "Пройти по каждому элементу списка",
            "blocks.loop.label": "Цикл",
            "blocks.loop.desc": "Повторить блоки N раз",
            "blocks.variable.label": "Переменная",
            "blocks.variable.desc": "Запомнить значение из ответа",
            "blocks.subscenario.label": "Под-сценарий",
            "blocks.subscenario.desc": "Вызвать сохранённый сценарий",
            "blocks.checker.label": "Проверка аккаунта",
            "blocks.checker.desc": "Проверить лот на валидность",
            "blocks.sniper.label": "Снайпер (автопокупка)",
            "blocks.sniper.desc": "Купить первый подходящий лот",
            "blocks.proxy.label": "Прокси",
            "blocks.proxy.desc": "Слать запросы через прокси",
            "blocks.delay.label": "Задержка",
            "blocks.delay.desc": "Подождать перед следующим блоком",
            "blocks.stop.label": "Стоп",
            "blocks.stop.desc": "Завершить сценарий",
            "canvas.hint.noToken": "Сначала нажмите блок <b>«Старт»</b> и вставьте API-токен — без него запросы к LZT не работают · потом <b>«Добавить блок»</b> и соедините линиями",
            "canvas.hint.hasToken": "1) Нажмите <b>«Добавить блок»</b> → выберите <b>Запрос</b> · 2) соедините линией от <b>Старт</b> · 3) нажмите <b>Запустить</b> справа · или возьмите шаблон слева в сайдбаре",
            "run.step": "Шаг",
            "run.stepTitle": "Пошаговое выполнение",
            "run.schedule": "Повторять каждые",
            "run.scheduleMin": "мин",
            "run.scheduleSec": "сек",
            "run.scheduleHour": "час",
            "toolbar.exportBtn": "Экспорт",
            "toolbar.exportTitle": "Экспорт и шаринг сценария",
            "share.cat.files": "Файлы",
            "share.json.label": "Сценарий (.json)",
            "share.json.desc": "Сохранить/переслать сценарий",
            "share.png.label": "Картинка (.png)",
            "share.png.desc": "Скриншот схемы для форума",
            "share.zip.label": "Python-проект (.zip)",
            "share.zip.desc": "bot.py + requirements + README",
            "share.cat.sharing": "Шаринг",
            "share.code.label": "Код сценария",
            "share.code.desc": "Скопировать короткий код для форума",
            "share.qr.label": "QR-код сценария",
            "share.qr.desc": "Отсканировать телефоном",
            "share.importCode.label": "Импорт по коду",
            "share.importCode.desc": "Вставить код из галереи",
            "bot.copy": "Копировать",
            "bot.copyTitle": "Скопировать код",
            "bot.copied": "Готово",
            "bot.placeholder": "# Соберите сценарий из блоков — здесь появится готовый скрипт.",
            "zoom.in": "Приблизить",
            "zoom.out": "Отдалить",
            "zoom.reset": "Сбросить масштаб",
            "minimap.title": "Миникарта — клик для перехода",
        },
        en: {
            "app.title": "LZT API Constructor",
            "search.ph": "Search params or endpoints...",
            "token.setup": "Set up API Token",
            "win.min": "Minimize", "win.max": "Maximize", "win.close": "Close",
            "sidebar.new": "+ New scenario",
            "sidebar.docs": "LOLZ API Reference",
            "sidebar.examplesApi": "API Examples",
            "sidebar.readyScenarios": "Ready-made scenarios",
            "sidebar.blocksMarket": "Request blocks: Market",
            "sidebar.blocksForum": "Request blocks: Forum (Zelenka)",
            "sidebar.myScenarios": "My scenarios",
            "sidebar.saveCurrent": "Save current scenario",
            "toolbar.undo": "Undo (Ctrl+Z)",
            "toolbar.redo": "Redo (Ctrl+Y)",
            "toolbar.addBlock": "Add block",
            "toolbar.fit": "Fit whole scenario",
            "toolbar.export": "Export scenario to .json file",
            "toolbar.import": "Import scenario from .json file",
            "toolbar.help": "How to use (tutorial)",
            "toolbar.rename": "Rename scenario",
            "toolbar.renameHint": "Double-click to rename",
            "toolbar.settings": "Settings",
            "search.block": "Find a block…",
            "run.title": "Run scenario",
            "run.start": "Run",
            "run.stop": "Stop",
            "run.stepMode": "Step mode (pause after each block)",
            "run.hint": "Build a chain of blocks and press “Run” — scenario steps will appear here.",
            "run.progress": "Progress",
            "run.debugTitle": "Debug / API response",
            "run.debugHint": "HTTP requests, status codes and data tables appear here when you run.",
            "bot.title": "Script",
            "settings.title": "Settings",
            "settings.language": "Interface language",
            "settings.theme": "Theme",
            "settings.themeDark": "Dark", "settings.themeLight": "Light",
            "settings.replayTour": "Show tutorial again",
            "settings.close": "Close",
            "settings.encryptToken": "Encrypt API token in localStorage",
            "settings.encryptPassPh": "Encryption password",
            "settings.soundAlerts": "Sound when scenario finishes",
            "settings.nativeNotify": "Windows notifications",
            "settings.trayMinimize": "Minimize to tray (background)",
            "settings.trayHint": "Tray unavailable — run: pip install pystray Pillow",
            "tour.skip": "Skip",
            "tour.back": "Back",
            "tour.next": "Next",
            "tour.done": "Got it, let's go!",
            "tour.langRu": "Русский",
            "tour.langEn": "English",
            "tour.s0.title": "Step 1 — language",
            "tour.s0.text": "Choose the interface language. You can change it later in <b>⚙ Settings</b>.",
            "tour.s1.title": "Step 2 — API token",
            "tour.s1.text": "Click the <b>Start</b> block and paste your LOLZTEAM API token. Market/Forum requests won't work without it. Use “where to get token” inside the block.",
            "tour.s2.title": "Step 3 — add blocks",
            "tour.s2.text": "Use <b>Add block</b> at the top. Blocks are grouped: <b>Actions</b> (request, notify, save), <b>Logic</b> (condition, filter, loop), <b>Settings</b> (proxy, delay).",
            "tour.s3.title": "Step 4 — connect with lines",
            "tour.s3.text": "Drag from one block's port to another's input. Order: <b>Start → Request → …</b>. Conditions and filters have two outputs (Yes/No, Has/Empty).",
            "tour.s4.title": "Step 5 — run",
            "tour.s4.text": "Press <b>Run</b> on the right to execute live — steps highlight and responses appear in the log.",
            "tour.s5.title": "Step 6 — export the bot",
            "tour.s5.text": "The panel below generates a ready <b>bot script</b> in Python, JS, Go, etc. Copy it — it runs without this app. You can also export the scenario as JSON.",
            "tour.s6.title": "Tip",
            "tour.s6.text": "Don't want to build from scratch — pick a <b>ready template</b> in the left sidebar (Steam monitor, CSV export, auto-buy). Everything is editable.",
            "scenario.new": "New scenario",
            "scenario.tab": "Scenario {n}",
            "scenario.myDefault": "My scenario",
            "run.status.running": "running…",
            "run.status.step": "step mode…",
            "run.status.done": "done",
            "token.connected": "Token connected",
            "profit.session": "Spent (session)",
            "profit.total": "Total (tracked)",
            "dialog.rename.title": "Rename scenario",
            "dialog.rename.ok": "Save",
            "dialog.rename.prompt": "Scenario name:",
            "dialog.save.title": "Save scenario",
            "dialog.save.prompt": "Scenario name:",
            "blocks.cat.actions": "Actions",
            "blocks.cat.logic": "Logic",
            "blocks.cat.market": "Market",
            "blocks.cat.settings": "Settings & pause",
            "blocks.request.label": "API request",
            "blocks.request.desc": "Fetch listings, buy, any API call",
            "blocks.notify.label": "Notification",
            "blocks.notify.desc": "Send to Telegram / Discord",
            "blocks.logmsg.label": "Log message",
            "blocks.logmsg.desc": "Show custom text when running",
            "blocks.savefile.label": "Save to file",
            "blocks.savefile.desc": "Export results to CSV or JSON",
            "blocks.condition.label": "Condition (Yes / No)",
            "blocks.condition.desc": "Branch on a value from the response",
            "blocks.filter.label": "List filter",
            "blocks.filter.desc": "Keep only matching items (price ≤ X)",
            "blocks.foreach.label": "For each",
            "blocks.foreach.desc": "Iterate over every list item",
            "blocks.loop.label": "Loop",
            "blocks.loop.desc": "Repeat blocks N times",
            "blocks.variable.label": "Variable",
            "blocks.variable.desc": "Store a value from the response",
            "blocks.subscenario.label": "Sub-scenario",
            "blocks.subscenario.desc": "Call a saved scenario",
            "blocks.checker.label": "Account checker",
            "blocks.checker.desc": "Validate a listing",
            "blocks.sniper.label": "Sniper (auto-buy)",
            "blocks.sniper.desc": "Buy the first matching listing",
            "blocks.proxy.label": "Proxy",
            "blocks.proxy.desc": "Send requests through proxies",
            "blocks.delay.label": "Delay",
            "blocks.delay.desc": "Wait before the next block",
            "blocks.stop.label": "Stop",
            "blocks.stop.desc": "End the scenario",
            "canvas.hint.noToken": "First click the <b>Start</b> block and paste your API token — LZT requests won't work without it · then <b>Add block</b> and connect with lines",
            "canvas.hint.hasToken": "1) Click <b>Add block</b> → pick <b>Request</b> · 2) connect from <b>Start</b> · 3) press <b>Run</b> on the right · or pick a template in the left sidebar",
            "run.step": "Step",
            "run.stepTitle": "Step-by-step execution",
            "run.schedule": "Repeat every",
            "run.scheduleMin": "min",
            "run.scheduleSec": "sec",
            "run.scheduleHour": "hour",
            "toolbar.exportBtn": "Export",
            "toolbar.exportTitle": "Export and share scenario",
            "share.cat.files": "Files",
            "share.json.label": "Scenario (.json)",
            "share.json.desc": "Save or share the scenario",
            "share.png.label": "Image (.png)",
            "share.png.desc": "Diagram screenshot for the forum",
            "share.zip.label": "Python project (.zip)",
            "share.zip.desc": "bot.py + requirements + README",
            "share.cat.sharing": "Sharing",
            "share.code.label": "Scenario code",
            "share.code.desc": "Copy a short code for the forum",
            "share.qr.label": "Scenario QR code",
            "share.qr.desc": "Scan with your phone",
            "share.importCode.label": "Import by code",
            "share.importCode.desc": "Paste a code from the gallery",
            "bot.copy": "Copy",
            "bot.copyTitle": "Copy code",
            "bot.copied": "Done",
            "bot.placeholder": "# Build a scenario from blocks — the bot script will appear here.",
            "zoom.in": "Zoom in",
            "zoom.out": "Zoom out",
            "zoom.reset": "Reset zoom",
            "minimap.title": "Minimap — click to jump",
        }
    };

    const I18N = {
        lang: localStorage.getItem("lzt_lang") || "ru",
        t(key) {
            const d = DICT[this.lang] || DICT.ru;
            return d[key] != null ? d[key] : (DICT.ru[key] != null ? DICT.ru[key] : key);
        },
        apply() {
            document.documentElement.lang = this.lang;
            document.querySelectorAll("[data-i18n]").forEach(el => {
                const k = el.getAttribute("data-i18n");
                const v = this.t(k);
                if (v != null) el.textContent = v;
            });
            document.querySelectorAll("[data-i18n-title]").forEach(el => {
                el.title = this.t(el.getAttribute("data-i18n-title"));
            });
            document.querySelectorAll("[data-i18n-ph]").forEach(el => {
                el.placeholder = this.t(el.getAttribute("data-i18n-ph"));
            });
            if (typeof window.refreshSettingsI18n === "function") window.refreshSettingsI18n();
            if (window.Scenario?.updateTitle) Scenario.updateTitle();
            if (window.Scenario?.rebuildAddBlockMenu) Scenario.rebuildAddBlockMenu();
            if (typeof window.refreshTokenStatus === "function") window.refreshTokenStatus();
            if (typeof window.rebuildShareMenu === "function") window.rebuildShareMenu();
            document.querySelectorAll("[data-i18n-html]").forEach(el => {
                const v = this.t(el.getAttribute("data-i18n-html"));
                if (v != null) el.innerHTML = v;
            });
        },
        set(lang) {
            this.lang = lang;
            localStorage.setItem("lzt_lang", lang);
            this.apply();
        }
    };

    const THEME = {
        current: localStorage.getItem("lzt_theme") || "dark",
        apply() {
            document.documentElement.setAttribute("data-theme", this.current);
        },
        set(t) {
            this.current = t;
            localStorage.setItem("lzt_theme", t);
            this.apply();
        }
    };

    window.I18N = I18N;
    window.Theme = THEME;

    document.addEventListener("DOMContentLoaded", () => {
        THEME.apply();
        I18N.apply();
        bindSettings();
    });

    function bindSettings() {
        const btn = document.getElementById("btn-settings");
        const modal = document.getElementById("settings-modal");
        if (!btn || !modal) return;
        const open = () => {
            LZTUi.showOverlay(modal);
            const ls = modal.querySelector("#set-lang");
            const ts = modal.querySelector("#set-theme");
            if (ls) ls.value = I18N.lang;
            if (ts) ts.value = THEME.current;
            if (typeof window.refreshTrayStatus === "function") window.refreshTrayStatus();
            if (typeof window.refreshSettingsI18n === "function") window.refreshSettingsI18n();
        };
        const close = () => LZTUi.hideOverlay(modal);
        btn.addEventListener("click", open);
        modal.querySelector("#set-close")?.addEventListener("click", close);
        modal.querySelector("#set-close-x")?.addEventListener("click", close);
        modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
        modal.querySelector("#set-lang")?.addEventListener("change", (e) => I18N.set(e.target.value));
        modal.querySelector("#set-theme")?.addEventListener("change", (e) => Theme.set(e.target.value));
        modal.querySelector("#set-replay-tour")?.addEventListener("click", () => {
            close();
            localStorage.removeItem("lzt_tour_done");
            if (window.Scenario && Scenario.startTour) Scenario.startTour();
        });
    }
})();
