"""Синхронизация localStorage с диском (%APPDATA%/LZT API Constructor/userdata.json)."""
from fastapi import APIRouter, Request

from backend.user_storage import load_all, save_all

router = APIRouter(tags=["storage"])


@router.get("/api/user-storage")
def get_user_storage():
    return load_all()


@router.post("/api/user-storage")
async def post_user_storage(request: Request):
    try:
        data = await request.json()
    except Exception:
        return {"ok": False, "error": "invalid json"}
    if not isinstance(data, dict):
        return {"ok": False, "error": "expected object"}
    save_all(data)
    return {"ok": True, "count": len(data)}
