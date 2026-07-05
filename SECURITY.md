# Security

## Модель угроз

Локальный desktop-клиент. Сервер слушает только `127.0.0.1`.

| Риск | Митигация |
|------|-----------|
| SSRF через `/api/test` | `backend/security.py` — блок private/localhost URL |
| Утечка API-токена | localStorage; опционально AES-GCM |
| Утечка AI-ключа | Не хранится на сервере; только запрос к выбранному провайдеру |
| Произвольные ссылки | `/api/open-browser` — только http/https |

## Сообщить об уязвимости

Issue на GitHub с меткой `security` или личное сообщение автору [на форуме LOLZTEAM]((https://lolz.live/posts/63962780/)).

Не публикуйте exploit до исправления.
