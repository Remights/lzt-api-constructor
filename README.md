# LZT API Constructor — визуальный конструктор сценариев и генератор ботов для LOLZTEAM

![Tests](https://img.shields.io/badge/tests-53%20passed-2cb674?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

![LOLZTEAM](https://img.shields.io/badge/LOLZTEAM-Market%20%26%20Forum-2cb674?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-3.10+-blue?style=for-the-badge&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi)
![PyWebView](https://img.shields.io/badge/PyWebView-Desktop%20App-ff69b4?style=for-the-badge)

**LZT API Constructor** — десктопное приложение с открытым исходным кодом для работы с **Market** и **Forum** API LOLZTEAM. Это не просто генератор запросов, а **визуальный конструктор сценариев (no-code)**: вы собираете логику бота из блоков на холсте (как в BAS/Node-RED), запускаете её прямо в приложении и одним кликом получаете готовый скрипт-бот на 7 языках. Не аффилировано с LOLZTEAM / LZT Market. Неофициальный инструмент сообщества.

Цель — сделать автоматизацию Маркета доступной как для разработчиков, так и для селлеров, которые «не шарят за код».

<img width="1794" height="909" alt="image" src="https://github.com/user-attachments/assets/8f8988e6-d6e3-47e3-8d8d-72b8a4e224c7" />

---

## Возможности

### Визуальный редактор сценариев
Холст с блоками, соединениями, панорамированием и зумом. Доступные блоки:

| Блок | Назначение |
|------|-----------|
| **Старт** | Точка входа + хранение API-токена |
| **Запрос** | HTTP-запрос к API (метод, URL, параметры, тело, заголовки) |
| **Условие** | Ветвление по значению из ответа |
| **Фильтр** | Оставить элементы списка по условию (например, `price <= 100`) |
| **Цикл** | Повтор блока N раз |
| **Переменная** | Сохранить значение из ответа для дальнейшего использования |
| **Задержка** | Пауза между шагами |
| **Уведомление** | Отправка в Telegram / Discord |
| **Сохранить в файл** | Экспорт результатов в CSV / JSON |
| **Прокси** | Установка/ротация прокси для последующих запросов |
| **Лог** | Произвольное сообщение в журнал выполнения |
| **Стоп** | Завершение сценария |
| **Для каждого** | Итерация по списку из ответа (`last.items` → `{{vars.item}}`) |
| **Проверка аккаунта** | GET лота — валидность / не продан |
| **Снайпер** | Автопокупка первого подходящего лота (лимит цены и трат) |
| **Под-сценарий** | Вызов сохранённого шаблона как функции |

Подстановка данных между блоками: `{{last.items.length}}`, `{{vars.filtered}}` и т.п.

**Глобальная обработка ошибок:** у блока «Старт» есть выход «Ошибка» — если у запроса не подключён свой выход «Ошибка», сценарий идёт по этой линии.

### IDE-интерфейс
- **3 панели** с перетаскиваемыми разделителями (как VS Code): примеры слева, холст по центру, запуск+бот справа
- **Мульти-вкладки** сценариев над холстом
- **Сохранение через диалог** «Сохранить как» (PyWebView) для JSON, CSV, ZIP, PNG
- **Системный трей** — сворачивание в фон (настройка в ⚙)

### AI+ (3 режима)
- **Создать** — собрать сценарий с нуля (бесплатно / API)
- **Редактировать** — изменить текущий сценарий по команде
- **Объяснить** — разбор сценария и поиск ошибок
- **Голосовой ввод** (🎤)

### Шаринг и экспорт
- **Код сценария** `LZT1:…` — для форума / чата
- **QR-код** — отсканировать и импортировать на другом ПК
- PNG-схема, Python-проект (.zip), импорт по коду

### Маркет-фичи
- **Трекер трат** — виджет «Потрачено» при прогоне и снайпере
- **Windows-уведомления** и звук по завершению
- **Шифрование API-токена** (AES-GCM + пароль в настройках)
- **Автообновление** — баннер при новой версии на GitHub

### Генерация кода в один клик
- **Полный скрипт-бот из всего сценария** — 7 языков: Python (`requests`), Python (async/`aiohttp`), Node.js (`axios`), Bash (`curl`), PHP (cURL), C# (`HttpClient`), Go (`net/http`). Со встроенной обработкой ретраев, тайм-аутов и лимитов (429).
- **Сниппет одиночного запроса** — «Моментальный генератор» в редакторе блока «Запрос» (8 вариантов, включая `fetch`/`axios`).

Вся кодогенерация выполняется на клиенте — единый источник (`web/js/codegen.js` и `web/js/scenario_codegen.js`).

### AI-ассистент
Опишите задачу простым языком — ассистент соберёт сценарий из блоков. Два режима:
- **Бесплатный** — локальный генератор без ключа (с дневным лимитом), работает офлайн.
- **API** — ваш ключ любого OpenAI-совместимого провайдера (OpenRouter, OpenAI и др.) для более умной генерации.

### Инструменты для автоматизации
- **Импорт из curl** — вставьте команду (например, *Copy as cURL* из DevTools) → получите готовый блок «Запрос».
- **Прокси-чекер** — параллельная проверка списка прокси на живость и скорость, кнопка «оставить только живые».
- **Запуск по расписанию** — повтор сценария каждые N секунд/минут/часов.
- **История запусков** — дашборд со статистикой: % успешных, среднее число запросов и время.
- **Пошаговый режим (debug)** — пауза после каждого блока с подсветкой.

### Песочница и надёжность
- Реальные запросы к API прямо из приложения с красивым просмотром JSON и таблицы результатов.
- На блоке «Запрос»: повторы при ошибке, задержка между повторами, тайм-аут, уважение лимита LZT (`429` → `Retry-After`).

### Удобство
- Экспорт/импорт сценариев в `.json`, копирование/вставка/дублирование блоков (`Ctrl+C/V/D`), undo/redo, автосохранение.
- Миникарта, поиск по блокам, обучающий тур, готовые шаблоны.
- Интернационализация (RU/EN) и темы (тёмная/светлая).

---

## Безопасность
- Локальный сервер слушает только `127.0.0.1`, CORS ограничен локальными источниками.
- Все исходящие запросы (`/api/test`, `/api/ai`, `/api/check-proxies`, `/api/open-browser`) проходят проверку **против SSRF**: блокируются `localhost`, приватные, loopback, link-local и зарезервированные адреса (`backend/security.py`), разрешены только `http/https`.
- API-токен и ключ AI хранятся **только локально** (в `localStorage` браузерного движка) и не отправляются никуда, кроме целевого API.

> ⚠️ Токен хранится в открытом виде в локальном хранилище приложения — не запускайте приложение на общих/недоверенных машинах.

---

## 🛠 Установка и запуск

**Требования:** Python 3.10+

```bash
pip install -r requirements.txt
python main.py
```

Приложение поднимет локальный сервер (порт `8484`) и откроется в нативном фреймлесс-окне PyWebView с тёмной темой LOLZTEAM.

### Сборка standalone `.exe` (Windows)
```bash
pip install pyinstaller
pyinstaller build.spec
```
Или запустите `build_exe.bat`. Готовый исполняемый файл появится в папке `dist/`.

---

## Структура проекта

```
LZT API Constructor/
├── main.py                     # Точка входа: uvicorn + PyWebView (~45 строк)
├── CONTEST.md                  # кратко для жюри
├── ARCHITECTURE.md             # архитектура для жюри и разработчиков
├── LICENSE / CONTRIBUTING.md / SECURITY.md
├── backend/
│   ├── app_factory.py          # Сборка FastAPI
│   ├── config.py               # Константы, пути
│   ├── schemas.py              # Pydantic-модели
│   ├── routes/                 # HTTP-маршруты (market, ai, catalog, window)
│   ├── desktop/                # Win32, трей, JsApi, WebView2 mic
│   ├── api_proxy.py            # прокси-запросы, уведомления, прокси-чекер
│   ├── security.py             # SSRF-валидация исходящих запросов
│   ├── ai_gateway.py           # бесплатный AI, STT, rate limit
│   ├── spec_parser.py          # разбор OpenAPI-спецификаций
│   └── ru_overlay.py           # русские подписи параметров
├── api/specs/                  # OpenAPI спецификации Market/Forum
├── web/
│   ├── vendor/                 # Font Awesome, QRCode (офлайн; scripts/download_vendor.ps1)
│   ├── index.html
│   ├── css/lzt_style.css
│   └── js/
│       ├── scenario/
│       │   ├── constants.js    # типы блоков (NODE_TYPES)
│       │   ├── engine.js       # condition, filter, loop, foreach (unit-тесты)
│       │   ├── validate.js     # валидация графа перед запуском
│       │   ├── history.js      # undo/redo
│       │   ├── editor.js       # холст, рендер, редакторы блоков
│       │   └── runtime.js      # прогон сценария, лог
│       ├── scenario_normalize.js   # нормализация AI-сценариев
│       ├── scenario.js             # ядро: init, serialize, load
│       ├── scenario_codegen.js     # генерация скрипта-бота (7 языков)
│       ├── codegen.js              # сниппет одиночного запроса
│       ├── assistant.js            # curl + AI
│       ├── ai_plus.js              # AI+: edit / explain / voice
│       └── …
├── tests/                      # pytest + node-тесты
├── .github/workflows/ci.yml    # CI на push/PR
├── scripts/download_vendor.ps1 # офлайн-ассеты UI
├── build.spec / build_exe.bat
└── requirements.txt
```

---

## Основные HTTP-эндпоинты (локально)

| Метод | Путь | Назначение |
|-------|------|-----------|
| POST | `/api/test` | Выполнить запрос к API (с проверкой SSRF, поддержкой прокси/тайм-аута) |
| POST | `/api/notify` | Отправить уведомление в Telegram/Discord |
| POST | `/api/check-proxies` | Проверить список прокси |
| POST | `/api/ai` | Прокси к OpenAI-совместимому провайдеру (AI-режим) |
| GET  | `/api/catalog` | Каталог эндпоинтов из OpenAPI |

---

## Тесты

Установка dev-зависимостей и запуск **53 тестов**:

```bash
pip install -r requirements.txt -r requirements-dev.txt
pytest
node tests/js_generators.test.js
node tests/features_share.test.js
node tests/scenario_normalize.test.js
node tests/scenario_engine.test.js
node tests/scenario_validate.test.js
```

Или одной командой (Windows): `powershell -ExecutionPolicy Bypass -File scripts/run_tests.ps1`

| Suite | Что покрыто |
|-------|-------------|
| pytest (23) | SSRF, прокси, AI gateway, FastAPI routes |
| js_generators (12) | codegen, curl, AI-генератор |
| features_share (4) | шаринг `LZT1:` |
| scenario_normalize (4) | нормализация AI-сценариев |
| scenario_engine (6) | condition, filter, loop, foreach |
| scenario_validate (4) | граф сценария перед запуском |

CI: `.github/workflows/ci.yml` — все suite на каждый push/PR (нужен push в GitHub).

### Офлайн-ассеты UI
```powershell
powershell -ExecutionPolicy Bypass -File scripts/download_vendor.ps1
python scripts/generate_icon.py   # web/icon.ico для build_exe
```
Скачивает Font Awesome (CSS + webfonts) и QRCode в `web/vendor/` (без CDN).

---

## 🏆 Про конкурс

Проект для конкурса опенсорс-проектов **LOLZTEAM**.

**Что подчеркнуть:**
- No-code сценарии + codegen на 7 языков + блоки под Market (снайпер, checker, фильтры)
- **53 автотеста**, CI, модульная архитектура ([ARCHITECTURE.md](ARCHITECTURE.md))
- SSRF-защита ([SECURITY.md](SECURITY.md)), шифрование токена AES-GCM, офлайн UI
- MIT License, CONTRIBUTING, git-история

Подробнее об архитектуре: [ARCHITECTURE.md](ARCHITECTURE.md)
