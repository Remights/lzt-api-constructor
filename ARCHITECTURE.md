# Архитектура LZT API Constructor

Документ для жюри конкурса и разработчиков: как устроен проект и где что лежит.

## Обзор

```
┌─────────────────────────────────────────────────────────────┐
│  PyWebView (desktop)  ←→  FastAPI @ 127.0.0.1:8484          │
│       │                        │                            │
│  JsApi (файлы, окно)     StaticFiles /web + REST API        │
│  Win32 hooks (frameless)     │                              │
│  System tray                 ├─ /api/test  → api_proxy      │
│                              ├─ /api/ai    → ai_gateway     │
│                              └─ security.is_safe_url (SSRF) │
└─────────────────────────────────────────────────────────────┘
```

Приложение — **локальный desktop-first клиент**: UI в WebView, бэкенд только на `127.0.0.1`, исходящие запросы проходят SSRF-проверку.

## Backend (Python)

| Модуль | Назначение |
|--------|------------|
| `main.py` | Точка входа (~46 строк): uvicorn + webview |
| `backend/app_factory.py` | Сборка FastAPI, CORS, mount static |
| `backend/config.py` | Версия, пути, константы окна |
| `backend/schemas.py` | Pydantic-модели запросов |
| `backend/routes/market.py` | `/api/test`, notify, proxies, open-browser |
| `backend/routes/ai_routes.py` | AI, STT, config, version |
| `backend/routes/catalog.py` | OpenAPI-каталог |
| `backend/routes/window.py` | HTTP-fallback управления окном |
| `backend/desktop/win32.py` | Frameless resize, drag, minimize |
| `backend/desktop/js_api.py` | PyWebView JS API (save/open/notify) |
| `backend/desktop/tray.py` | Системный трей |
| `backend/security.py` | SSRF-валидация URL |
| `backend/api_proxy.py` | Прокси HTTP, Telegram/Discord |
| `backend/ai_gateway.py` | Бесплатный Groq, STT, rate limit |

## Frontend (JavaScript, без bundler)

Сборка через **mixins** (осознанный компромисс для PyWebView без webpack):

```javascript
Object.assign(Scenario, window.ScenarioHistoryMixin, window.ScenarioEditorMixin, window.ScenarioRuntimeMixin);
```

| Модуль | Строк | Назначение |
|--------|------:|------------|
| `scenario/constants.js` | ~22 | Типы блоков (`NODE_TYPES`) |
| `scenario/engine.js` | ~80 | Чистая логика: condition, filter, loop, foreach — **тестируется в Node** |
| `scenario/validate.js` | ~70 | Валидация графа перед запуском — **тестируется в Node** |
| `scenario/history.js` | ~40 | Undo/redo, автосейв |
| `scenario/editor.js` | ~1100 | Холст, рендер, редакторы блоков |
| `scenario/runtime.js` | ~600 | Запуск, `_execNode`, лог (использует `ScenarioEngine`) |
| `scenario.js` | ~850 | init, serialize, load, примеры, утилиты |
| `scenario_normalize.js` | ~90 | Нормализация AI-сценариев |
| `scenario_codegen.js` | — | Генерация бота на 7 языков |

`runtime.js` делегирует filter/loop/foreach в `ScenarioEngine`, чтобы не дублировать логику с тестами.

## Безопасность

1. **SSRF** — все исходящие URL через `is_safe_url()` (localhost, private, link-local блокируются).
2. **Токен** — только `localStorage`; опционально AES-GCM с паролем (настройки).
3. **AI-ключ** — не сохраняется на сервере; бесплатный tier — rate limit по fingerprint/IP.
4. **CORS** — по умолчанию только localhost.

## Тесты и CI

**53 автотеста** (локально и в CI):

| Suite | Файл | Тестов |
|-------|------|--------:|
| pytest | `test_security.py` | 4 |
| pytest | `test_api_proxy.py` | 4 |
| pytest | `test_ai_gateway.py` | 6 |
| pytest | `test_routes.py` | 9 |
| node | `js_generators.test.js` | 12 |
| node | `features_share.test.js` | 4 |
| node | `scenario_normalize.test.js` | 4 |
| node | `scenario_engine.test.js` | 6 |
| node | `scenario_validate.test.js` | 4 |

Запуск: `scripts/run_tests.ps1` или `pytest` + пять node-suite. CI: `.github/workflows/ci.yml`.

Зависимости тестов: `requirements-dev.txt` (`httpx<0.28` для совместимости со `starlette.TestClient`).

## Офлайн

`web/vendor/`: Font Awesome (css + **webfonts/*.woff2**), QRCode (`qrcode@1.2.2`).  
Скачивание: `scripts/download_vendor.ps1`. Шрифт UI — system stack (без Google Fonts CDN).

## Дальнейшее развитие (post-contest)

- TypeScript + ES-модули (опционально, с bundler)
- E2E-тесты PyWebView
- Дальнейшее дробление `editor.js` (canvas / prop-editors / request-modal)
