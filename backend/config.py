"""Константы приложения и пути к ресурсам."""
import os
import sys

APP_VERSION = "1.2.0"
GITHUB_RELEASES = "https://api.github.com/repos/Remights/lzt-api-constructor/releases/latest"
WINDOW_TITLE = "LZT API Constructor — Визуальный конструктор и генератор кода для LOLZTEAM"
HOST = "127.0.0.1"
PORT = 8484


def resolve_base_dir() -> str:
    if getattr(sys, "frozen", False):
        return getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def resolve_user_data_dir() -> str:
    """Постоянные данные пользователя (настройки, сценарии) — вне read-only _MEIPASS."""
    if sys.platform == "win32":
        base = os.environ.get("APPDATA") or os.path.expanduser("~")
    elif sys.platform == "darwin":
        base = os.path.join(os.path.expanduser("~"), "Library", "Application Support")
    else:
        base = os.environ.get("XDG_DATA_HOME") or os.path.join(os.path.expanduser("~"), ".local", "share")
    path = os.path.join(base, "LZT API Constructor")
    os.makedirs(path, exist_ok=True)
    return path


BASE_DIR = resolve_base_dir()
USER_DATA_DIR = resolve_user_data_dir()

# Release-сборка (.exe): backend/local_build.py (gitignore, см. .example)
BUILD_PUBLIC_FREE_AI_URL = ""
BUILD_GROQ_KEYS = ""
try:
    from backend import local_build as _local_build

    BUILD_PUBLIC_FREE_AI_URL = (getattr(_local_build, "PUBLIC_FREE_AI_URL", "") or "").strip()
    BUILD_GROQ_KEYS = (getattr(_local_build, "GROQ_KEYS", "") or "").strip()
except ImportError:
    pass


def apply_build_env_defaults() -> None:
    """Подставляет значения из local_build.py, если env не задан (для frozen .exe)."""
    if BUILD_GROQ_KEYS and not os.environ.get("GROQ_KEYS") and not os.environ.get("GROQ_API_KEY"):
        os.environ["GROQ_KEYS"] = BUILD_GROQ_KEYS
