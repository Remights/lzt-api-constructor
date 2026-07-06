# DEV-only: release-сборка .exe для пользователей

**Собирай exe только из этой папки**, не из публичной копии на GitHub.

## Что здесь приватно (не для GitHub)

| Файл / папка | Назначение |
|---|---|
| `backend/local_build.py` | URL бесплатной AI-прокладки → зашивается в `.exe` |
| `deploy/` | Код и конфиг VPS-прокладки (Groq) |

Публичная папка `LZT API Constructor` — только исходники для GitHub, **без IP и без `deploy/`**.

## Сборка exe для раздачи

```bat
build_exe.bat
```

Должно появиться: `[release] backend\local_build.py найден`.

Готовый файл: `dist\LZT API Constructor.exe`

## VPS (бесплатная нейронка)

```bash
pip install -r deploy/requirements-ai.txt
# GROQ_KEYS=... в .env на сервере
uvicorn deploy.ai_proxy_server:app --host 0.0.0.0 --port 8787
```

Подробнее: `deploy/README.md`
