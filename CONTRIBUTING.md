# Contributing

## Запуск

```bash
pip install -r requirements.txt -r requirements-dev.txt
python main.py
```

Windows: `start.bat`.

## Тесты

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_tests.ps1
```

Или `pytest` и node-suite из README.

## Стиль

- Python: модули в `backend/`, тонкий `main.py`
- JS: логика сценария в `web/js/scenario/`; engine и validate покрыты node-тестами
- Не коммитьте `.env`, ключи API, `backend/local_build.py`

## Pull requests

1. Ветка от `main`
2. Тесты проходят локально
3. Описание изменения и причины
