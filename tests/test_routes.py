"""Интеграционные тесты FastAPI-маршрутов."""
import os
import sys

import pytest
from starlette.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app_factory import create_app
from backend import ai_gateway

app = create_app()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_config_returns_version(client):
    r = client.get("/api/config")
    assert r.status_code == 200
    data = r.json()
    assert "app_version" in data
    assert "free_ai_limit" in data
    assert "free_ai_url" in data


def test_config_returns_remaining_with_fingerprint(client):
    ai_gateway._rate_buckets.clear()
    fp = "LZTConstruct/1.2.0"
    r = client.get("/api/config", headers={"X-LZT-Client": fp})
    assert r.status_code == 200
    data = r.json()
    assert data.get("free_ai_remaining") == ai_gateway.FREE_LIMIT_PER_HOUR


def test_free_ai_status(client, monkeypatch):
    ai_gateway._rate_buckets.clear()
    monkeypatch.setattr(ai_gateway, "groq_keys", lambda: ["test-key"])
    fp = "LZTConstruct/1.2.0"
    r = client.get("/api/ai/free/status", headers={"X-LZT-Client": fp})
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["remaining"] == ai_gateway.FREE_LIMIT_PER_HOUR


def test_catalog_not_empty(client):
    r = client.get("/api/catalog")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, (list, dict))
    assert len(data) > 0


def test_sync_spec_ok(client):
    r = client.get("/api/sync-spec")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_ssrf_blocks_localhost_on_test(client):
    r = client.post("/api/test", json={"url": "http://127.0.0.1/admin", "method": "GET"})
    assert r.status_code == 200
    assert r.json()["success"] is False


def test_ssrf_blocks_private_on_proxy_check(client):
    r = client.post("/api/check-proxies", json={"proxies": [], "test_url": "http://192.168.1.1/"})
    assert r.status_code == 200
    assert r.json()["success"] is False


def test_open_browser_rejects_file_scheme(client):
    r = client.post("/api/open-browser", json={"url": "file:///etc/passwd"})
    assert r.status_code == 200
    assert r.json()["status"] == "error"


def test_ai_requires_key(client):
    r = client.post("/api/ai", json={"prompt": "hi", "api_key": ""})
    assert r.status_code == 200
    assert r.json()["success"] is False


def test_version_endpoint(client):
    r = client.get("/api/version")
    assert r.status_code == 200
    assert "version" in r.json()


def test_static_index(client):
    r = client.get("/")
    assert r.status_code == 200
    assert "LZT API Constructor" in r.text


def test_user_storage_roundtrip(client, tmp_path, monkeypatch):
    from backend import user_storage

    path = tmp_path / "userdata.json"
    monkeypatch.setattr(user_storage, "_STORAGE_FILE", str(path))
    assert client.get("/api/user-storage").json() == {}
    r = client.post("/api/user-storage", json={"lzt_lang": "en", "lzt_api_token": "x", "other": "nope"})
    assert r.status_code == 200
    assert r.json()["ok"] is True
    data = client.get("/api/user-storage").json()
    assert data["lzt_lang"] == "en"
    assert data["lzt_api_token"] == "x"
    assert "other" not in data
