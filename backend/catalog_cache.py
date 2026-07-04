"""Кэш каталога OpenAPI-эндпоинтов."""
from backend.ru_overlay import RU_PARAMS
from backend.spec_parser import build_params_db, load_catalog

_catalog_cache = None


def get_catalog():
    global _catalog_cache
    if _catalog_cache is None:
        _catalog_cache = load_catalog(ru_overlay=RU_PARAMS)
    return _catalog_cache


def sync_spec():
    import time

    return {
        "status": "ok",
        "synced_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "params": build_params_db(get_catalog(), ru_overlay=RU_PARAMS),
    }
