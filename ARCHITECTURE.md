# Архитектура

## Обзор

```
PyWebView (desktop)  <->  FastAPI @ 127.0.0.1:8484
       |                        |
  JsApi, Win32, tray      StaticFiles /web + REST
                               |
                          /api/test, /api/ai, ...
                          security.is_safe_url (SSRF)
```

Desktop-first: UI в WebView, бэкенд только на localhost, исходящие URL проверяются на SSRF.

## Backend

| Модуль | Назначение |
|--------|------------|
| `main.py` | uvicorn + webview |
| `backend/app_factory.py` | FastAPI, CORS, static |
| `backend/config.py` | Версия, пути |
| `backend/schemas.py` | Pydantic-модели |
| `backend/routes/market.py` | test, notify, proxies, open-browser |
| `backend/routes/ai_routes.py` | AI, STT, config, version |
| `backend/routes/catalog.py` | OpenAPI-каталог |
| `backend/routes/window.py` | Управление окном |
| `backend/desktop/` | Win32, tray, JsApi, WebView2 mic |
| `backend/security.py` | SSRF |
| `backend/api_proxy.py` | HTTP-прокси, уведомления |
| `backend/ai_gateway.py` | Бесплатный AI, STT, rate limit |

## Frontend

Без bundler. Сценарий собирается через mixins:

```javascript
Object.assign(Scenario, window.ScenarioHistoryMixin, window.ScenarioEditorMixin, window.ScenarioRuntimeMixin);
```

| Модуль | Назначение |
|--------|------------|
| `scenario/constants.js` | Типы блоков |
| `scenario/engine.js` | condition, filter, loop, foreach (node-тесты) |
| `scenario/validate.js` | Валидация графа (node-тесты) |
| `scenario/history.js` | undo/redo |
| `scenario/editor.js` | Холст и редакторы |
| `scenario/runtime.js` | Прогон сценария |
| `scenario.js` | init, serialize, load |
| `scenario_normalize.js` | Нормализация AI-сценариев |
| `scenario_codegen.js` | Генерация бота |

`runtime.js` использует `ScenarioEngine` для filter/loop/foreach.

## Безопасность

1. SSRF — `is_safe_url()` для всех исходящих URL.
2. Токен — localStorage; опционально AES-GCM.
3. AI-ключ — не на сервере; бесплатный tier — лимит по fingerprint/IP.
4. CORS — localhost.

## Тесты

53 теста: pytest (security, proxy, ai, routes) и пять node-suite (codegen, share, normalize, engine, validate).

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_tests.ps1
```

CI: `.github/workflows/ci.yml`.

## Офлайн

`web/vendor/` — Font Awesome, QRCode. Скрипт: `scripts/download_vendor.ps1`.
