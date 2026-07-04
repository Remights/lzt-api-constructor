"""HTTP-управление окном (fallback для pywebview)."""
from fastapi import APIRouter

from backend.desktop import state, win32
from backend.schemas import MovePayload

router = APIRouter(tags=["window"])


@router.post("/api/window/minimize")
def window_minimize():
    if win32.minimize_window():
        return {"status": "ok"}
    return {"status": "ok"}


@router.post("/api/window/maximize")
def window_maximize():
    win32.maximize_window()
    return {"status": "ok"}


@router.post("/api/window/close")
def window_close():
    win32.close_window()
    return {"status": "ok"}


@router.post("/api/window/drag")
def window_drag():
    win32.drag_window()
    return {"status": "ok"}


@router.post("/api/window/move-by")
def window_move_by(payload: MovePayload):
    win32.move_window_by(payload.dx, payload.dy)
    return {"status": "ok"}
