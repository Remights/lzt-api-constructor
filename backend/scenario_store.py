"""Библиотека «Мои сценарии» на диске (не только localStorage)."""
from __future__ import annotations

import json
import os
import threading
from typing import Any

from backend.config import USER_DATA_DIR

_SCENARIOS_DIR = os.path.join(USER_DATA_DIR, "scenarios")
_LIBRARY_FILE = os.path.join(_SCENARIOS_DIR, "library.json")
_AUTOSAVE_FILE = os.path.join(_SCENARIOS_DIR, "autosave.json")
_TABS_FILE = os.path.join(_SCENARIOS_DIR, "tabs.json")
_LOCK = threading.Lock()


def _read_json(path: str, default: Any):
    if not os.path.isfile(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return default


def _write_json(path: str, data: Any) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def load_library() -> list:
    with _LOCK:
        data = _read_json(_LIBRARY_FILE, [])
    return data if isinstance(data, list) else []


def save_library(items: list) -> None:
    if not isinstance(items, list):
        return
    with _LOCK:
        _write_json(_LIBRARY_FILE, items)


def load_autosave():
    with _LOCK:
        return _read_json(_AUTOSAVE_FILE, None)


def save_autosave(data) -> None:
    if data is None:
        with _LOCK:
            if os.path.isfile(_AUTOSAVE_FILE):
                try:
                    os.remove(_AUTOSAVE_FILE)
                except OSError:
                    pass
        return
    with _LOCK:
        _write_json(_AUTOSAVE_FILE, data)


def load_tabs():
    with _LOCK:
        return _read_json(_TABS_FILE, None)


def save_tabs(data) -> None:
    if data is None:
        return
    with _LOCK:
        _write_json(_TABS_FILE, data)
