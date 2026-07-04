# LZT API Constructor — конкурс LOLZTEAM

## Суть

No-code конструктор сценариев для Market/Forum API: прогон в приложении, экспорт бота на 7 языков.

Аудитория: селлеры и автоматизаторы LZT (снайперы, мониторинг, уведомления).

## Показатели

| Параметр | Значение |
|----------|----------|
| Автотесты | 53 (pytest + node) |
| CI | GitHub Actions |
| Backend | FastAPI + PyWebView |
| Frontend | Модули scenario (engine, validate, editor, runtime) |
| SSRF | Тесты в pytest |
| Офлайн UI | `web/vendor/` |

## Отличие от Postman / curl

- Граф с условиями, циклами, снайпером, checker
- Codegen всего сценария, не одного запроса
- Блоки под LZT Market
- Desktop: трей, frameless, native save

## Быстрая проверка

1. `scripts/run_tests.ps1` — 53 теста
2. `python main.py` → шаблон «монитор Steam» → Запустить
3. Справа — сгенерированный Python-бот
4. [ARCHITECTURE.md](ARCHITECTURE.md)
5. [SECURITY.md](SECURITY.md)

## Ограничения

- Специализация под LZT, не универсальный REST-клиент
- Токен в localStorage (есть опция шифрования)

## Лицензия

MIT — [LICENSE](LICENSE)
