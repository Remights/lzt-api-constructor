# Contributing

Спасибо за интерес к проекту!

## Запуск

```bash
pip install -r requirements.txt -r requirements-dev.txt
python main.py
```

Windows: двойной клик `start.bat`.

## Тесты

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_tests.ps1
```

Или вручную: `pytest` + пять `node tests/*.test.js` (см. README).

## Стиль

- Python: модули в `backend/`, тонкий `main.py`
- JS: логика сценария в `web/js/scenario/` (engine, validate — с node-тестами)
- Не коммитьте `.env` и ключи API

## Pull requests

1. Ветка от `main`
2. Зелёные тесты локально
3. Краткое описание «зачем», не «что»
