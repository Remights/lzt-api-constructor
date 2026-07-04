"""Постоянное хранилище настроек приложения (localStorage → JSON на диске)."""
from __future__ import annotations

import json
import os
import threading
from typing import Any

from backend.config import USER_DATA_DIR

_STORAGE_FILE = os.path.join(USER_DATA_DIR, "userdata.json")
_LOCK = threading.Lock()
_PREFIX = "lzt_"


def _empty() -> dict[str, str]:
    return {}


def load_all() -> dict[str, str]:
    with _LOCK:
        if not os.path.isfile(_STORAGE_FILE):
            return _empty()
        try:
            with open(_STORAGE_FILE, "r", encoding="utf-8") as f:
                raw = json.load(f)
        except (OSError, json.JSONDecodeError):
            return _empty()
        if not isinstance(raw, dict):
            return _empty()
        out: dict[str, str] = {}
        for k, v in raw.items():
            if not isinstance(k, str) or not k.startswith(_PREFIX):
                continue
            if v is None:
                continue
            out[k] = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)
        return out


def save_all(data: dict[str, Any]) -> None:
    if not isinstance(data, dict):
        return
    cleaned: dict[str, str] = {}
    for k, v in data.items():
        if not isinstance(k, str) or not k.startswith(_PREFIX):
            continue
        if v is None:
            continue
        cleaned[k] = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)
    with _LOCK:
        os.makedirs(os.path.dirname(_STORAGE_FILE), exist_ok=True)
        tmp = _STORAGE_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(cleaned, f, ensure_ascii=False, indent=2)
        os.replace(tmp, _STORAGE_FILE)
