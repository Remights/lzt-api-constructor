"""API библиотеки сценариев и черновиков."""
from fastapi import APIRouter, Request

from backend.scenario_store import (
    load_autosave,
    load_library,
    load_tabs,
    save_autosave,
    save_library,
    save_tabs,
)

router = APIRouter(tags=["scenarios"])


@router.get("/api/scenarios/library")
def get_library():
    return {"ok": True, "items": load_library()}


@router.put("/api/scenarios/library")
async def put_library(request: Request):
    try:
        body = await request.json()
    except Exception:
        return {"ok": False, "error": "invalid json"}
    items = body.get("items") if isinstance(body, dict) else body
    if not isinstance(items, list):
        return {"ok": False, "error": "expected list"}
    save_library(items)
    return {"ok": True, "count": len(items)}


@router.get("/api/scenarios/autosave")
def get_autosave():
    data = load_autosave()
    return {"ok": True, "data": data}


@router.put("/api/scenarios/autosave")
async def put_autosave(request: Request):
    try:
        body = await request.json()
    except Exception:
        return {"ok": False, "error": "invalid json"}
    if not isinstance(body, dict) or "data" not in body:
        return {"ok": False, "error": "expected { \"data\": ... }"}
    data = body.get("data")
    if data is not None and not isinstance(data, dict):
        return {"ok": False, "error": "data must be object or null"}
    save_autosave(data)
    return {"ok": True}


@router.get("/api/scenarios/tabs")
def get_tabs():
    return {"ok": True, "state": load_tabs()}


@router.put("/api/scenarios/tabs")
async def put_tabs(request: Request):
    try:
        body = await request.json()
    except Exception:
        return {"ok": False, "error": "invalid json"}
    state = body.get("state") if isinstance(body, dict) else None
    if state is None:
        return {"ok": False, "error": "expected { \"state\": ... }"}
    save_tabs(state)
    return {"ok": True}
