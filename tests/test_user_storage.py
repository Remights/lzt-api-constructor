"""Tests for persistent user storage."""
import json
import os

import pytest

from backend import user_storage


@pytest.fixture
def storage_file(tmp_path, monkeypatch):
    path = tmp_path / "userdata.json"
    monkeypatch.setattr(user_storage, "_STORAGE_FILE", str(path))
    return path


def test_load_empty(storage_file):
    assert user_storage.load_all() == {}


def test_save_and_load_roundtrip(storage_file):
    user_storage.save_all({
        "lzt_api_token": "secret",
        "lzt_scenarios": "[]",
        "ignored": "x",
        "lzt_count": 123,
    })
    data = user_storage.load_all()
    assert data["lzt_api_token"] == "secret"
    assert data["lzt_scenarios"] == "[]"
    assert "ignored" not in data
    assert data["lzt_count"] == "123"
    assert storage_file.is_file()


def test_atomic_replace(storage_file):
    user_storage.save_all({"lzt_lang": "ru"})
    user_storage.save_all({"lzt_lang": "en", "lzt_theme": "dark"})
    raw = json.loads(storage_file.read_text(encoding="utf-8"))
    assert raw["lzt_lang"] == "en"
    assert raw["lzt_theme"] == "dark"
    assert not os.path.exists(str(storage_file) + ".tmp")
