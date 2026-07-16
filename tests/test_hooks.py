"""Тесты webhook-шлюза."""
import os
import sys
import threading
import time

import pytest
from starlette.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app_factory import create_app
from backend import hooks_store

app = create_app()


@pytest.fixture
def client():
    hooks_store.set_enabled(True)
    hooks_store.set_secret("test-secret-hooks-1")
    with TestClient(app) as c:
        yield c


def test_hooks_info(client):
    r = client.get("/api/hooks/info")
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert "/api/hooks/event" in data["url"]
    assert data["secret"]


def test_hooks_unauthorized(client):
    r = client.post("/api/hooks/event", json={"event": "x", "data": {"a": 1}, "wait": False})
    assert r.json().get("code") == "unauthorized"


def test_hooks_async_and_complete(client):
    r = client.post(
        "/api/hooks/event",
        json={"event": "test", "data": {"price": 10}, "wait": False},
        headers={"X-LZT-Hook-Secret": "test-secret-hooks-1"},
    )
    data = r.json()
    assert data["ok"] is True
    job_id = data["job_id"]

    pend = client.get("/api/hooks/pending").json()
    assert pend["job"]["id"] == job_id
    assert pend["job"]["payload"]["price"] == 10

    done = client.post(
        f"/api/hooks/complete/{job_id}",
        json={"ok": True, "result": {"listed": True}},
    )
    assert done.json()["ok"] is True

    st = client.get(
        f"/api/hooks/status/{job_id}",
        headers={"X-LZT-Hook-Secret": "test-secret-hooks-1"},
    ).json()
    assert st["ok"] is True
    assert st["result"]["listed"] is True


def test_hooks_wait_sync(client):
    def worker():
        time.sleep(0.3)
        pend = client.get("/api/hooks/pending").json()
        job = pend.get("job")
        if job:
            client.post(
                f"/api/hooks/complete/{job['id']}",
                json={"ok": True, "result": {"echo": job["payload"]}},
            )

    t = threading.Thread(target=worker, daemon=True)
    t.start()
    r = client.post(
        "/api/hooks/event",
        json={"event": "sync", "data": {"x": 1}, "wait": True, "timeout": 10},
        headers={"X-LZT-Hook-Secret": "test-secret-hooks-1"},
    )
    data = r.json()
    assert data.get("ok") is True
    assert data.get("result", {}).get("echo", {}).get("x") == 1


def test_hooks_script_example(client):
    lst = client.get("/api/hooks/scripts").json()
    assert "hook_example.py" in lst.get("files", [])
    r = client.post(
        "/api/hooks/script",
        json={"filename": "hook_example.py", "payload": {"hook": {"title": "t", "price": 99}}},
    )
    data = r.json()
    assert data["ok"] is True
    assert data["result"]["ok"] is True
    assert data["result"]["price"] == 99
