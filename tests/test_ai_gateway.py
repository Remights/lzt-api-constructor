"""Тесты AI-шлюза: fingerprint и лимит."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend import ai_gateway


def test_fingerprint_accepts_lztconstruct():
    ok, _ = ai_gateway.validate_fingerprint("LZTConstruct/1.0.0")
    assert ok is True


def test_fingerprint_rejects_prefix_only():
    ok, _ = ai_gateway.validate_fingerprint("LZTConstruct/99.9.9-hacked")
    assert ok is False


def test_fingerprint_rejects_unknown():
    ok, err = ai_gateway.validate_fingerprint("SomeOtherApp/1.0")
    assert ok is False
    assert "клиент" in err.lower() or "Неизвест" in err


def test_fingerprint_rejects_empty():
    ok, _ = ai_gateway.validate_fingerprint("")
    assert ok is False


def test_resolve_client_ip_from_forwarded():
    class H:
        def __init__(self, data):
            self._data = {k.lower(): v for k, v in data.items()}

        def get(self, key, default=None):
            return self._data.get(key.lower(), default)

    class R:
        def __init__(self, headers, host="127.0.0.1"):
            self.headers = H(headers)
            self.client = type("C", (), {"host": host})()

    assert ai_gateway.resolve_client_ip(R({"X-Forwarded-For": "203.0.113.5, 10.0.0.1"})) == "203.0.113.5"
    assert ai_gateway.resolve_client_ip(R({"X-Real-IP": "198.51.100.2"})) == "198.51.100.2"
    assert ai_gateway.resolve_client_ip(R({}, host="10.1.2.3")) == "10.1.2.3"


def test_rate_limit_in_memory():
    ai_gateway._rate_buckets.clear()
    ip, fp = "127.0.0.1", "LZTConstruct/1.0.0"
    limit = ai_gateway.FREE_LIMIT_PER_HOUR
    for i in range(limit):
        ok, rem, _ = ai_gateway.rate_limit_status(ip, fp)
        assert ok is True
        ai_gateway.record_usage(ip, fp)
    ok, rem, _ = ai_gateway.rate_limit_status(ip, fp)
    assert ok is False
    assert rem == 0


def test_resolve_model_allowed():
    model, err = ai_gateway.resolve_model("llama-3.1-8b-instant")
    assert err is None
    assert model == "llama-3.1-8b-instant"


def test_resolve_model_rejects_unknown():
    model, err = ai_gateway.resolve_model("gpt-4o")
    assert model == ""
    assert err and "недоступна" in err.lower()
