"""Очередь webhook-задач: внешний софт → конструктор → ответ."""
from __future__ import annotations

import secrets
import threading
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

_LOCK = threading.Lock()
_JOBS: Dict[str, dict] = {}
_PENDING: List[str] = []
_SECRET: Optional[str] = None
_ENABLED = True
_MAX_JOBS = 80
_DEFAULT_WAIT = 45
_MAX_WAIT = 120


def ensure_secret() -> str:
    global _SECRET
    with _LOCK:
        if not _SECRET:
            _SECRET = secrets.token_hex(16)
        return _SECRET


def set_secret(secret: str) -> None:
    global _SECRET
    with _LOCK:
        _SECRET = (secret or "").strip() or secrets.token_hex(16)


def get_secret() -> str:
    return ensure_secret()


def set_enabled(on: bool) -> None:
    global _ENABLED
    with _LOCK:
        _ENABLED = bool(on)


def is_enabled() -> bool:
    with _LOCK:
        return _ENABLED


def check_secret(header: Optional[str], query: Optional[str] = None) -> bool:
    expected = get_secret()
    got = (header or query or "").strip()
    if not expected or not got:
        return False
    return secrets.compare_digest(got, expected)


def _gc_locked(now: float) -> None:
    dead = [jid for jid, j in _JOBS.items() if now - j.get("created", now) > 600]
    for jid in dead:
        _JOBS.pop(jid, None)
        if jid in _PENDING:
            _PENDING.remove(jid)
    while len(_JOBS) > _MAX_JOBS:
        oldest = min(_JOBS.items(), key=lambda kv: kv[1].get("created", 0))[0]
        _JOBS.pop(oldest, None)
        if oldest in _PENDING:
            _PENDING.remove(oldest)


def create_job(payload: dict, event: str = "event", scenario_id: str = "") -> str:
    now = time.time()
    jid = uuid.uuid4().hex[:16]
    with _LOCK:
        _gc_locked(now)
        _JOBS[jid] = {
            "id": jid,
            "event": event or "event",
            "scenario_id": scenario_id or "",
            "payload": payload if isinstance(payload, dict) else {"value": payload},
            "status": "pending",
            "created": now,
            "result": None,
            "error": None,
            "event_done": threading.Event(),
        }
        _PENDING.append(jid)
    return jid


def pop_pending() -> Optional[dict]:
    with _LOCK:
        while _PENDING:
            jid = _PENDING.pop(0)
            job = _JOBS.get(jid)
            if not job or job["status"] != "pending":
                continue
            job["status"] = "running"
            return {
                "id": job["id"],
                "event": job["event"],
                "scenario_id": job["scenario_id"],
                "payload": job["payload"],
            }
    return None


def complete_job(job_id: str, ok: bool, result: Any = None, error: str = "") -> bool:
    with _LOCK:
        job = _JOBS.get(job_id)
        if not job:
            return False
        # не перезаписываем уже истёкший/завершённый job
        if job["status"] not in ("pending", "running"):
            return False
        job["status"] = "done" if ok else "error"
        job["result"] = result
        job["error"] = error or None
        job["event_done"].set()
        return True


def wait_job(job_id: str, timeout: float) -> Tuple[bool, dict]:
    with _LOCK:
        job = _JOBS.get(job_id)
        if not job:
            return False, {"error": "job not found", "code": "not_found"}
        ev = job["event_done"]
    ok_wait = ev.wait(timeout=max(1.0, min(timeout, _MAX_WAIT)))
    with _LOCK:
        job = _JOBS.get(job_id)
        if not job:
            return False, {"error": "job not found", "code": "not_found"}
        if not ok_wait and job["status"] in ("pending", "running"):
            job["status"] = "error"
            job["error"] = "timeout — приложение не обработало webhook (открой конструктор)"
            job["result"] = None
            if job_id in _PENDING:
                _PENDING.remove(job_id)
            job["event_done"].set()
            return False, {
                "ok": False,
                "job_id": job_id,
                "error": job["error"],
                "code": "timeout",
                "status": "error",
            }
        return True, {
            "ok": job["status"] == "done",
            "job_id": job_id,
            "status": job["status"],
            "result": job.get("result"),
            "error": job.get("error"),
            "event": job.get("event"),
        }


def job_status(job_id: str) -> Optional[dict]:
    with _LOCK:
        job = _JOBS.get(job_id)
        if not job:
            return None
        return {
            "ok": job["status"] == "done",
            "job_id": job_id,
            "status": job["status"],
            "result": job.get("result"),
            "error": job.get("error"),
            "event": job.get("event"),
        }


def stats() -> dict:
    with _LOCK:
        return {
            "enabled": _ENABLED,
            "pending": sum(1 for j in _JOBS.values() if j["status"] == "pending"),
            "running": sum(1 for j in _JOBS.values() if j["status"] == "running"),
            "total": len(_JOBS),
        }
