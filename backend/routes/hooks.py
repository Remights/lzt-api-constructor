"""Webhook-шлюз и запуск локальных hook-скриптов."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from typing import Any, Optional

from fastapi import APIRouter, Header, Query, Request
from pydantic import BaseModel, Field

from backend import hooks_store
from backend.config import HOST, PORT, USER_DATA_DIR

router = APIRouter(tags=["hooks"])

_HOOKS_DIR = os.path.join(USER_DATA_DIR, "hooks")

_EXAMPLE_PY = '''# hook_example.py — пример для блока «Скрипт»
# stdin: JSON { hook, last, vars, event }
# stdout: JSON (попадёт в vars.script_out)
import json, sys

inp = json.load(sys.stdin)
hook = inp.get("hook") or {}
out = {
    "ok": True,
    "echo": hook,
    "title": hook.get("title") or "from hook",
    "price": hook.get("price"),
}
print(json.dumps(out, ensure_ascii=False))
'''


def _ensure_hooks_dir() -> None:
    os.makedirs(_HOOKS_DIR, exist_ok=True)
    example = os.path.join(_HOOKS_DIR, "hook_example.py")
    if not os.path.isfile(example):
        try:
            with open(example, "w", encoding="utf-8") as f:
                f.write(_EXAMPLE_PY)
        except OSError:
            pass


class HookEventPayload(BaseModel):
    event: str = "event"
    data: Any = Field(default_factory=dict)
    scenario_id: str = ""
    wait: bool = True
    timeout: int = 45


class HookCompletePayload(BaseModel):
    ok: bool = True
    result: Any = None
    error: str = ""


class HookScriptPayload(BaseModel):
    filename: str
    payload: Any = Field(default_factory=dict)
    timeout: int = 30


def _is_loopback(request: Request) -> bool:
    host = (request.client.host if request and request.client else "") or ""
    return host in ("127.0.0.1", "::1", "localhost", "testclient")


def _auth(secret_h: Optional[str], secret_q: Optional[str]) -> Optional[dict]:
    if not hooks_store.is_enabled():
        return {"ok": False, "error": "hooks выключены в настройках", "code": "disabled"}
    if not hooks_store.check_secret(secret_h, secret_q):
        return {"ok": False, "error": "неверный X-LZT-Hook-Secret", "code": "unauthorized"}
    return None


def _auth_pending_complete(
    request: Request,
    secret_h: Optional[str],
    secret_q: Optional[str],
) -> Optional[dict]:
    """pending/complete: secret предпочтителен; loopback UI допускается без secret."""
    if not hooks_store.is_enabled():
        return {"ok": False, "error": "hooks выключены в настройках", "code": "disabled"}
    if hooks_store.check_secret(secret_h, secret_q):
        return None
    if _is_loopback(request):
        return None
    return {"ok": False, "error": "неверный X-LZT-Hook-Secret", "code": "unauthorized"}


@router.get("/api/hooks/info")
def hooks_info():
    _ensure_hooks_dir()
    secret = hooks_store.ensure_secret()
    base = f"http://{HOST}:{PORT}"
    return {
        "ok": True,
        "enabled": hooks_store.is_enabled(),
        "url": f"{base}/api/hooks/event",
        "secret": secret,
        "hooks_dir": _HOOKS_DIR,
        "stats": hooks_store.stats(),
        "hint": "POST JSON {event, data, scenario_id?, wait?} + заголовок X-LZT-Hook-Secret. pending/complete тоже с secret (кроме 127.0.0.1).",
        "warning": "Не открывайте порт hooks наружу без secret. /event ограничен rate-limit.",
    }


@router.post("/api/hooks/settings")
async def hooks_settings(request: Request):
    try:
        body = await request.json()
    except Exception:
        return {"ok": False, "error": "invalid json"}
    if not isinstance(body, dict):
        return {"ok": False, "error": "expected object"}
    if "enabled" in body:
        hooks_store.set_enabled(bool(body["enabled"]))
    if body.get("secret"):
        hooks_store.set_secret(str(body["secret"]))
    elif body.get("rotate_secret"):
        hooks_store.set_secret("")
        hooks_store.ensure_secret()
    return hooks_info()


@router.post("/api/hooks/event")
def hooks_event(
    payload: HookEventPayload,
    request: Request,
    x_lzt_hook_secret: Optional[str] = Header(None),
    secret: Optional[str] = Query(None),
):
    err = _auth(x_lzt_hook_secret, secret)
    if err:
        return err

    client_ip = request.client.host if request.client else "unknown"
    ok_rl, retry_after = hooks_store.check_event_rate(client_ip)
    if not ok_rl:
        return {
            "ok": False,
            "error": "rate limit — слишком много webhook-событий",
            "code": "rate_limit",
            "retry_after": retry_after,
        }

    data = payload.data
    if data is None:
        data = {}
    if not isinstance(data, dict):
        data = {"value": data}

    job_id = hooks_store.create_job(data, payload.event, payload.scenario_id)
    if not payload.wait:
        return {"ok": True, "job_id": job_id, "status": "pending", "async": True}

    timeout = min(max(int(payload.timeout or 45), 1), 120)
    ok, result = hooks_store.wait_job(job_id, timeout)
    if not ok and result.get("code") == "timeout":
        return result
    return result


@router.get("/api/hooks/pending")
def hooks_pending(
    request: Request,
    x_lzt_hook_secret: Optional[str] = Header(None),
    secret: Optional[str] = Query(None),
):
    """Забирает одну задачу для UI-воркера."""
    err = _auth_pending_complete(request, x_lzt_hook_secret, secret)
    if err:
        return err
    job = hooks_store.pop_pending()
    if not job:
        return {"ok": True, "job": None}
    return {"ok": True, "job": job}


@router.post("/api/hooks/complete/{job_id}")
def hooks_complete(
    job_id: str,
    payload: HookCompletePayload,
    request: Request,
    x_lzt_hook_secret: Optional[str] = Header(None),
    secret: Optional[str] = Query(None),
):
    err = _auth_pending_complete(request, x_lzt_hook_secret, secret)
    if err:
        return err
    if not hooks_store.complete_job(job_id, payload.ok, payload.result, payload.error):
        return {"ok": False, "error": "job not found"}
    return {"ok": True}


@router.get("/api/hooks/status/{job_id}")
def hooks_status(
    job_id: str,
    x_lzt_hook_secret: Optional[str] = Header(None),
    secret: Optional[str] = Query(None),
):
    err = _auth(x_lzt_hook_secret, secret)
    if err:
        return err
    st = hooks_store.job_status(job_id)
    if not st:
        return {"ok": False, "error": "job not found", "code": "not_found"}
    return st


def _safe_script_path(filename: str) -> Optional[str]:
    name = os.path.basename((filename or "").strip())
    if not name or name.startswith("."):
        return None
    ext = os.path.splitext(name)[1].lower()
    if ext not in (".py", ".js", ".mjs"):
        return None
    _ensure_hooks_dir()
    root = os.path.normcase(os.path.abspath(_HOOKS_DIR))
    path = os.path.normcase(os.path.abspath(os.path.join(_HOOKS_DIR, name)))
    if not path.startswith(root + os.sep):
        return None
    if not os.path.isfile(path):
        return None
    return path


@router.get("/api/hooks/scripts")
def hooks_scripts_list():
    _ensure_hooks_dir()
    files = []
    for name in sorted(os.listdir(_HOOKS_DIR)):
        if os.path.splitext(name)[1].lower() in (".py", ".js", ".mjs"):
            files.append(name)
    return {"ok": True, "dir": _HOOKS_DIR, "files": files}


@router.post("/api/hooks/script")
def hooks_run_script(payload: HookScriptPayload):
    path = _safe_script_path(payload.filename)
    if not path:
        return {
            "ok": False,
            "error": f"Скрипт не найден в {_HOOKS_DIR} (только .py / .js)",
            "code": "not_found",
        }
    timeout = min(max(int(payload.timeout or 30), 1), 120)
    stdin_data = json.dumps(payload.payload if payload.payload is not None else {}, ensure_ascii=False)
    ext = os.path.splitext(path)[1].lower()
    if ext == ".py":
        cmd = [sys.executable, path]
    else:
        cmd = ["node", path]

    try:
        proc = subprocess.run(
            cmd,
            input=stdin_data,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=_HOOKS_DIR,
            encoding="utf-8",
            errors="replace",
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": f"timeout {timeout}s", "code": "timeout"}
    except FileNotFoundError as e:
        return {"ok": False, "error": str(e), "code": "exec"}
    except Exception as e:
        return {"ok": False, "error": str(e), "code": "exec"}

    out = (proc.stdout or "").strip()
    err = (proc.stderr or "").strip()
    parsed = None
    if out:
        try:
            parsed = json.loads(out)
        except json.JSONDecodeError:
            parsed = {"raw": out}

    if proc.returncode != 0:
        return {
            "ok": False,
            "error": err or f"exit {proc.returncode}",
            "stdout": parsed,
            "code": "script_error",
        }
    return {"ok": True, "result": parsed if parsed is not None else {}, "stderr": err or None}
