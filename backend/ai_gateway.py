"""Бесплатный AI-шлюз: fingerprint клиента, in-memory лимит, ротация Groq-ключей.

Ключи только в переменных окружения (GROQ_KEYS). БД не нужна.
"""
from __future__ import annotations

import os
import threading
import time
from collections import deque
from typing import Deque, Dict, List, Optional, Tuple

import requests

APP_VERSION = os.environ.get("LZT_APP_VERSION", "1.0.0")
DEFAULT_FINGERPRINT_PREFIX = "LZTConstruct/"
DEFAULT_MODEL = os.environ.get("GROQ_FREE_MODEL", "llama-3.1-8b-instant")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_STT_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
STT_MODEL = os.environ.get("GROQ_STT_MODEL", "whisper-large-v3-turbo")
FREE_LIMIT_PER_HOUR = int(os.environ.get("LZT_FREE_AI_LIMIT", "15"))
WINDOW_SEC = 3600

# Белый список моделей Groq для бесплатного режима (можно сузить через GROQ_FREE_MODELS)
DEFAULT_FREE_MODELS = [
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile",
    "llama-3.1-70b-versatile",
    "gemma2-9b-it",
    "mixtral-8x7b-32768",
]

MODEL_LABELS = {
    "llama-3.1-8b-instant": "Llama 3.1 8B Instant",
    "llama-3.3-70b-versatile": "Llama 3.3 70B",
    "llama-3.1-70b-versatile": "Llama 3.1 70B",
    "gemma2-9b-it": "Gemma 2 9B",
    "mixtral-8x7b-32768": "Mixtral 8x7B",
}

_key_lock = threading.Lock()
_key_idx = 0
_rate_lock = threading.Lock()
_rate_buckets: Dict[str, Deque[float]] = {}


def expected_fingerprints() -> List[str]:
    """Допустимые значения заголовка X-LZT-Client."""
    raw = os.environ.get("LZT_CLIENT_FP", "")
    if raw.strip():
        return [x.strip() for x in raw.split(",") if x.strip()]
    ver = os.environ.get("LZT_APP_VERSION", APP_VERSION)
    return [f"LZTConstruct/{ver}", f"LZTConstruct/{ver.split('.')[0]}.0.0"]


def groq_keys() -> List[str]:
    raw = os.environ.get("GROQ_KEYS", "") or os.environ.get("GROQ_API_KEY", "")
    keys = [k.strip() for k in raw.split(",") if k.strip()]
    return keys


def allowed_models() -> List[str]:
    raw = os.environ.get("GROQ_FREE_MODELS", "")
    if raw.strip():
        return [m.strip() for m in raw.split(",") if m.strip()]
    return list(DEFAULT_FREE_MODELS)


def default_free_model() -> str:
    d = DEFAULT_MODEL
    allowed = allowed_models()
    if d in allowed:
        return d
    return allowed[0] if allowed else d


def models_for_client() -> List[dict]:
    return [{"id": m, "label": MODEL_LABELS.get(m, m)} for m in allowed_models()]


def resolve_model(requested: Optional[str]) -> Tuple[str, Optional[str]]:
    allowed = allowed_models()
    if not allowed:
        return "", "Список моделей Groq не настроен на сервере"
    model = (requested or "").strip() or default_free_model()
    if model not in allowed:
        return "", f"Модель «{model}» недоступна. Выберите: {', '.join(allowed)}"
    return model, None


def validate_fingerprint(header: Optional[str]) -> Tuple[bool, str]:
    fp = (header or "").strip()
    if not fp:
        return False, "Нет заголовка X-LZT-Client"
    allowed = expected_fingerprints()
    if fp in allowed:
        return True, ""
    return False, f"Неизвестный клиент: {fp}"


def resolve_client_ip(request) -> str:
    """IP клиента с учётом reverse proxy (nginx X-Forwarded-For / X-Real-IP)."""
    if request is None:
        return "unknown"
    forwarded = (request.headers.get("x-forwarded-for") or "").strip()
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = (request.headers.get("x-real-ip") or "").strip()
    if real_ip:
        return real_ip
    if request.client:
        return request.client.host or "unknown"
    return "unknown"


def _rate_key(client_ip: str, fingerprint: str) -> str:
    return f"{client_ip}|{fingerprint}"


def rate_limit_status(client_ip: str, fingerprint: str) -> Tuple[bool, int, int]:
    """Возвращает (ok, remaining, limit)."""
    now = time.time()
    key = _rate_key(client_ip, fingerprint)
    with _rate_lock:
        bucket = _rate_buckets.setdefault(key, deque())
        while bucket and bucket[0] <= now - WINDOW_SEC:
            bucket.popleft()
        used = len(bucket)
        remaining = max(0, FREE_LIMIT_PER_HOUR - used)
        if used >= FREE_LIMIT_PER_HOUR:
            return False, 0, FREE_LIMIT_PER_HOUR
        return True, remaining, FREE_LIMIT_PER_HOUR


def consume_rate_slot(client_ip: str, fingerprint: str) -> Tuple[bool, int, int]:
    """Атомарно занимает один слот лимита. Returns (ok, remaining, limit)."""
    now = time.time()
    key = _rate_key(client_ip, fingerprint)
    with _rate_lock:
        bucket = _rate_buckets.setdefault(key, deque())
        while bucket and bucket[0] <= now - WINDOW_SEC:
            bucket.popleft()
        if len(bucket) >= FREE_LIMIT_PER_HOUR:
            return False, 0, FREE_LIMIT_PER_HOUR
        bucket.append(now)
        remaining = max(0, FREE_LIMIT_PER_HOUR - len(bucket))
        return True, remaining, FREE_LIMIT_PER_HOUR


def record_usage(client_ip: str, fingerprint: str) -> None:
    now = time.time()
    key = _rate_key(client_ip, fingerprint)
    with _rate_lock:
        bucket = _rate_buckets.setdefault(key, deque())
        while bucket and bucket[0] <= now - WINDOW_SEC:
            bucket.popleft()
        bucket.append(now)


def _next_key() -> str:
    global _key_idx
    keys = groq_keys()
    if not keys:
        raise RuntimeError("GROQ_KEYS не задан на сервере")
    with _key_lock:
        key = keys[_key_idx % len(keys)]
        _key_idx += 1
    return key


def chat_free(prompt: str, system: str, client_ip: str, fingerprint: str, model: Optional[str] = None) -> Tuple[bool, dict]:
    ok_fp, err_fp = validate_fingerprint(fingerprint)
    if not ok_fp:
        return False, {"error": err_fp, "code": "bad_client"}

    resolved, err_model = resolve_model(model)
    if err_model:
        return False, {"error": err_model, "code": "bad_model"}

    ok_rl, remaining, limit = consume_rate_slot(client_ip, fingerprint)
    if not ok_rl:
        return False, {
            "error": f"Лимит бесплатного AI: {limit} запросов в час. Попробуйте позже или переключитесь на «Свой ключ».",
            "code": "rate_limit",
            "limit": limit,
            "remaining": 0,
        }

    keys = groq_keys()
    if not keys:
        return False, {"error": "Бесплатный AI временно недоступен (ключи не настроены на сервере).", "code": "no_keys"}

    payload = {
        "model": resolved,
        "messages": [
            {"role": "system", "content": system or "You are a helpful assistant."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
    }

    last_err = "Groq error"
    for attempt in range(min(len(keys), 3)):
        key = _next_key()
        try:
            r = requests.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json=payload,
                timeout=60,
            )
            data = r.json()
            if r.status_code == 429:
                last_err = "Groq rate limit (429)"
                continue
            if r.status_code >= 400:
                msg = data.get("error", {}).get("message") if isinstance(data.get("error"), dict) else data.get("error")
                last_err = msg or f"HTTP {r.status_code}"
                continue
            content = data["choices"][0]["message"]["content"]
            _, rem_after, lim = rate_limit_status(client_ip, fingerprint)
            return True, {
                "content": content,
                "remaining": rem_after,
                "limit": lim,
                "model": resolved,
            }
        except Exception as e:
            last_err = str(e)

    return False, {"error": last_err, "code": "upstream"}


def _audio_mime(filename: str) -> str:
    ext = (filename or "").rsplit(".", 1)[-1].lower()
    return {
        "webm": "audio/webm",
        "ogg": "audio/ogg",
        "m4a": "audio/mp4",
        "mp4": "audio/mp4",
        "wav": "audio/wav",
        "mp3": "audio/mpeg",
    }.get(ext, "audio/webm")


def transcribe_audio(file_bytes: bytes, filename: str, lang: str = "ru") -> Tuple[bool, dict]:
    """Распознавание речи через Groq Whisper (fallback, если Web Speech API недоступен)."""
    if not file_bytes:
        return False, {"error": "Пустой аудиофайл", "code": "empty"}
    if len(file_bytes) > 25 * 1024 * 1024:
        return False, {"error": "Аудио слишком большое (макс. 25 МБ)", "code": "too_large"}

    keys = groq_keys()
    if not keys:
        return False, {"error": "STT недоступен (GROQ_KEYS не задан)", "code": "no_keys"}

    lang_code = (lang or "ru").strip().lower()[:2]
    use_auto_lang = lang_code == "au" or (lang or "").strip().lower() == "auto"
    allowed_langs = ("ru", "en", "uk", "de", "fr", "es", "it", "pt", "pl", "tr", "zh", "ja", "ko")
    if not use_auto_lang and lang_code not in allowed_langs:
        lang_code = "ru"

    last_err = "STT error"
    for attempt in range(min(len(keys), 3)):
        key = _next_key()
        try:
            form = {"model": STT_MODEL, "response_format": "json"}
            if not use_auto_lang:
                form["language"] = lang_code
            r = requests.post(
                GROQ_STT_URL,
                headers={"Authorization": f"Bearer {key}"},
                files={"file": (filename or "voice.webm", file_bytes, _audio_mime(filename))},
                data=form,
                timeout=90,
            )
            data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
            if r.status_code == 429:
                last_err = "Groq rate limit (429)"
                continue
            if r.status_code >= 400:
                msg = data.get("error", {}).get("message") if isinstance(data.get("error"), dict) else data.get("error")
                last_err = msg or f"HTTP {r.status_code}"
                continue
            text = (data.get("text") or "").strip()
            if not text:
                return False, {"error": "Речь не распознана", "code": "no_text"}
            return True, {"text": text, "language": lang_code if not use_auto_lang else "auto"}
        except Exception as e:
            last_err = str(e)

    return False, {"error": last_err, "code": "upstream"}
