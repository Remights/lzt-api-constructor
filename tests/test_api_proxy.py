"""Тесты нормализации строк прокси."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.api_proxy import normalize_proxy, _prepare_request_body


def test_host_port():
    assert normalize_proxy("1.2.3.4:8080") == "http://1.2.3.4:8080"


def test_host_port_user_pass():
    assert normalize_proxy("1.2.3.4:8080:user:pass") == "http://user:pass@1.2.3.4:8080"


def test_scheme_preserved():
    assert normalize_proxy("socks5://1.2.3.4:1080") == "socks5://1.2.3.4:1080"
    assert normalize_proxy("http://u:p@1.2.3.4:3128") == "http://u:p@1.2.3.4:3128"


def test_empty():
    assert normalize_proxy("") is None
    assert normalize_proxy("   ") is None


def test_prepare_json_body_default():
    kwargs, headers = _prepare_request_body({"a": 1}, {})
    assert kwargs == {"json": {"a": 1}}
    assert headers["Content-Type"] == "application/json"


def test_prepare_form_body_when_content_type_form():
    kwargs, headers = _prepare_request_body({"a": 1}, {"Content-Type": "application/x-www-form-urlencoded"})
    assert kwargs == {"data": {"a": 1}}
    assert "application/x-www-form-urlencoded" in headers["Content-Type"]
