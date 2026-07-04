"""Тесты SSRF-валидации исходящих URL."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.security import is_safe_url


def test_public_urls_allowed():
    for url in [
        "https://prod-api.lzt.market/steam",
        "https://api.lzt.market/me",
        "https://api.ipify.org?format=json",
    ]:
        ok, _ = is_safe_url(url)
        assert ok is True, url


def test_localhost_blocked():
    for url in [
        "http://localhost:8000/admin",
        "http://127.0.0.1/secret",
        "https://something.local/",
    ]:
        ok, _ = is_safe_url(url)
        assert ok is False, url


def test_private_ranges_blocked():
    for url in [
        "http://192.168.1.1/",
        "http://10.0.0.5/",
        "http://172.16.0.1/",
        "http://169.254.169.254/latest/meta-data/",  # облачный метадата-эндпоинт
    ]:
        ok, _ = is_safe_url(url)
        assert ok is False, url


def test_bad_scheme_blocked():
    for url in ["ftp://example.com/", "file:///etc/passwd", "", "not a url"]:
        ok, _ = is_safe_url(url)
        assert ok is False, url


def test_discord_webhook_internal_blocked():
    ok, _ = is_safe_url("http://127.0.0.1/api/webhooks/1/token")
    assert ok is False


def test_discord_webhook_valid_host():
    from backend.security import is_safe_discord_webhook

    ok, _ = is_safe_discord_webhook("https://discord.com/api/webhooks/123456789/abcdef")
    assert ok is True


def test_discord_webhook_random_host_blocked():
    from backend.security import is_safe_discord_webhook

    ok, _ = is_safe_discord_webhook("https://evil.com/api/webhooks/1/x")
    assert ok is False
