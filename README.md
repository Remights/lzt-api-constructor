# LZT API Constructor

Десктопное приложение для работы с Market и Forum API LOLZTEAM. Визуальный конструктор сценариев: блоки на холсте, запуск внутри приложения, экспорт скрипта на несколько языков.

**Репозиторий:** https://github.com/Remights/lzt-api-constructor  
**Лицензия:** MIT  
**Python:** 3.10+

## Возможности

<img width="1794" height="909" alt="image" src="https://github.com/user-attachments/assets/8f8988e6-d6e3-47e3-8d8d-72b8a4e224c7" />


### Редактор сценариев

Холст с блоками, связями, панорамированием и масштабом.

| Блок | Назначение |
|------|------------|
| Старт | Точка входа, хранение API-токена |
| Запрос | HTTP-запрос (метод, URL, параметры, тело, заголовки) |
| Условие | Ветвление по значению из ответа |
| Фильтр | Отбор элементов списка по условию |
| Цикл | Повтор блока N раз |
| Переменная | Сохранение значения из ответа |
| Задержка | Пауза между шагами |
| Уведомление | Telegram / Discord |
| Сохранить в файл | Экспорт в CSV / JSON |
| Прокси | Установка или ротация прокси |
| Лог | Сообщение в журнал выполнения |
| Стоп | Завершение сценария |
| Для каждого | Итерация по списку (`last.items` → `{{vars.item}}`) |
| Проверка аккаунта | GET лота — валидность / статус продажи |
| Снайпер | Автопокупка первого подходящего лота |
| Под-сценарий | Вызов сохранённого шаблона |

Подстановки между блоками: `{{last.items.length}}`, `{{vars.filtered}}` и аналогичные выражения.

У блока «Старт» есть выход «Ошибка» для глобальной обработки сбоев, если у запроса не задан свой выход «Ошибка».

### Интерфейс

- Три панели с изменяемыми разделителями: примеры, холст, запуск и генерация кода
- Несколько вкладок сценариев
- Сохранение через системный диалог (JSON, CSV, ZIP, PNG)
- Сворачивание в системный трей

### AI

Три режима: создание сценария, редактирование, объяснение. Голосовой ввод.

- Бесплатный режим — локальный прокси без ключа (с лимитом)
- Режим «Свой ключ» — OpenAI-совместимый провайдер (OpenRouter, OpenAI и др.)

### Экспорт и обмен

- Код сценария `LZT1:…`
- QR-код для импорта на другом ПК
- PNG-схема, Python-проект (.zip)

### Маркет

- Трекер трат при прогоне и снайпере
- Windows-уведомления и звук по завершению
- Шифрование API-токена (AES-GCM, пароль в настройках)
- Проверка обновлений через GitHub Releases

### Генерация кода

Полный скрипт из сценария: Python (`requests`), Python async (`aiohttp`), Node.js (`axios`), Bash (`curl`), PHP, C#, Go. Обработка повторов, тайм-аутов и ответа 429.

Отдельно — сниппет одного запроса из блока «Запрос» (`web/js/codegen.js`, `web/js/scenario_codegen.js`).

### Прочее

- Импорт из curl
- Проверка списка прокси
- Запуск по расписанию
- История запусков
- Пошаговый режим отладки
- Экспорт/импорт JSON, undo/redo, автосохранение
- RU/EN, тёмная и светлая тема

## Безопасность

- Локальный сервер на `127.0.0.1`, CORS ограничен локальными источниками
- Исходящие запросы проходят проверку SSRF (`backend/security.py`): блокируются localhost, private, link-local; разрешены только `http`/`https`
- API-токен и ключ AI хранятся локально и не отправляются третьим сторонам, кроме выбранного API

Токен по умолчанию в localStorage приложения. Не используйте на общих или недоверенных машинах. Подробнее: [SECURITY.md](SECURITY.md).

## Установка

```bash
pip install -r requirements.txt
python main.py
```

Откроется окно PyWebView, сервер на порту `8484`.

### Сборка exe (Windows)

```bash
pip install pyinstaller
pyinstaller build.spec
```

Или `build_exe.bat`. Результат: `dist/LZT API Constructor.exe`.

В этом репозитории нет VPS-прокладки. Для бесплатного AI в exe: `backend/local_build.py.example` → `backend/local_build.py` с вашим URL, либо режим «Свой ключ» в приложении.

## Структура проекта

```
├── main.py
├── backend/           FastAPI, desktop, security, ai_gateway
├── api/specs/         OpenAPI Market и Forum
├── web/               UI (HTML, CSS, JS)
├── tests/             pytest и node-тесты
├── scripts/           vendor, иконка, тесты
├── build.spec
└── requirements.txt
```

Подробнее: [ARCHITECTURE.md](ARCHITECTURE.md).

## HTTP API (локально)

| Метод | Путь | Назначение |
|-------|------|-----------|
| POST | `/api/test` | Запрос к внешнему API |
| POST | `/api/notify` | Telegram / Discord |
| POST | `/api/check-proxies` | Проверка прокси |
| POST | `/api/ai` | Прокси к OpenAI-совместимому провайдеру |
| GET | `/api/catalog` | Каталог эндпоинтов |

## Тесты

```bash
pip install -r requirements.txt -r requirements-dev.txt
pytest
node tests/js_generators.test.js
node tests/features_share.test.js
node tests/scenario_normalize.test.js
node tests/scenario_engine.test.js
node tests/scenario_validate.test.js
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_tests.ps1
```

CI: `.github/workflows/ci.yml`.

### Офлайн-ассеты

```powershell
powershell -ExecutionPolicy Bypass -File scripts/download_vendor.ps1
python scripts/generate_icon.py
```

## Документация

- [ARCHITECTURE.md](ARCHITECTURE.md) — модули и поток данных
- [CONTRIBUTING.md](CONTRIBUTING.md) — разработка и PR
- [SECURITY.md](SECURITY.md) — модель угроз
- [CONTEST.md](CONTEST.md) — краткое описание для конкурса LOLZTEAM
