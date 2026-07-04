"""Tests for on-disk scenario library."""
import json

import pytest

from backend import scenario_store


@pytest.fixture
def store_paths(tmp_path, monkeypatch):
    lib = tmp_path / "library.json"
    auto = tmp_path / "autosave.json"
    tabs = tmp_path / "tabs.json"
    monkeypatch.setattr(scenario_store, "_LIBRARY_FILE", str(lib))
    monkeypatch.setattr(scenario_store, "_AUTOSAVE_FILE", str(auto))
    monkeypatch.setattr(scenario_store, "_TABS_FILE", str(tabs))
    return lib, auto, tabs


def test_library_roundtrip(store_paths):
    lib, _, _ = store_paths
    items = [{"id": "sc_1", "title": "Test", "nodes": [], "edges": []}]
    scenario_store.save_library(items)
    assert scenario_store.load_library() == items
    assert json.loads(lib.read_text(encoding="utf-8")) == items


def test_autosave_and_tabs(store_paths):
    _, auto, tabs = store_paths
    draft = {"title": "Draft", "nodes": [{"id": "n1", "type": "start"}], "edges": []}
    scenario_store.save_autosave(draft)
    assert scenario_store.load_autosave() == draft
    state = {"tabs": [{"title": "A", "data": draft}], "active": 0}
    scenario_store.save_tabs(state)
    assert scenario_store.load_tabs() == state
    assert auto.is_file()
    assert tabs.is_file()
