"""Каталог эндпоинтов LZT API."""
from fastapi import APIRouter

from backend.catalog_cache import get_catalog, sync_spec

router = APIRouter(tags=["catalog"])


@router.get("/api/catalog")
def catalog_endpoint():
    return get_catalog()


@router.get("/api/sync-spec")
def sync_spec_endpoint():
    return sync_spec()
