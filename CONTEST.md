# LZT API Constructor — для жюри конкурса LOLZTEAM

## В двух словах

**No-code конструктор сценариев** для Market/Forum API → **живой прогон** в приложении → **экспорт бота на 7 языков**.

Целевая аудитория: селлеры и автоматизаторы LZT, которым нужны снайперы, мониторинг цен и уведомления без написания кода с нуля.

## Метрики качества

| Метрика | Значение |
|---------|----------|
| Автотесты | **53** (23 pytest + 30 node) |
| CI | GitHub Actions на push/PR |
| Backend | Модульный FastAPI + PyWebView (~46 строк `main.py`) |
| Frontend | 7 модулей scenario (engine/validate/history/editor/runtime + core) |
| SSRF | Покрыто тестами |
| Офлайн UI | `web/vendor/` (Font Awesome + QRCode) |

## Чем отличается от Postman / curl

- Визуальный **граф** с условиями, циклами, снайпером, checker
- **Codegen всего сценария**, не одного запроса
- Блоки под **LZT Market** (fast-buy, фильтры лотов, трекер трат)
- **Desktop-first**: трей, frameless, native save

## Быстрая проверка жюри (5 мин)

1. `powershell -ExecutionPolicy Bypass -File scripts/run_tests.ps1` — **53 теста**
2. `python main.py` → шаблон «монитор Steam» → **Запустить**
3. Справа внизу — сгенерированный Python-бот
4. [ARCHITECTURE.md](ARCHITECTURE.md) — схема модулей
5. [SECURITY.md](SECURITY.md) — SSRF и токен

## Демо-сценарии

Готовые шаблоны в левой панели: мониторинг Steam, CSV-выгрузка, автопокупка.

## Ограничения (честно)

- Ниша LZT, не универсальный REST-клиент
- TypeScript / E2E — в roadmap post-contest
- Токен в localStorage (с опцией шифрования)

## Лицензия

MIT — см. [LICENSE](LICENSE)
