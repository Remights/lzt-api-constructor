"""Прокси-запросы, уведомления, проверка прокси."""
import webbrowser

from fastapi import APIRouter

from backend.api_proxy import check_proxies, execute_proxy_request, send_notification
from backend.schemas import NotifyPayload, ProxyCheckPayload, RequestPayload, UrlPayload
from backend.security import is_safe_discord_webhook, is_safe_url

router = APIRouter(tags=["market"])


@router.post("/api/test")
def test_endpoint(payload: RequestPayload):
    ok, reason = is_safe_url(payload.url)
    if not ok:
        return {"success": False, "error": f"Запрос заблокирован: {reason}"}
    return execute_proxy_request(
        payload.url,
        payload.method,
        payload.params,
        payload.headers,
        payload.body,
        payload.proxy,
        min(max(payload.timeout or 15, 1), 120),
    )


@router.post("/api/notify")
def notify_endpoint(payload: NotifyPayload):
    if payload.channel in ("discord", "both") and payload.discord_url:
        ok, reason = is_safe_discord_webhook(payload.discord_url)
        if not ok:
            return {"success": False, "error": reason}
    return send_notification(
        payload.channel,
        payload.text,
        payload.tg_token,
        payload.tg_chat,
        payload.discord_url,
    )


@router.post("/api/check-proxies")
def check_proxies_endpoint(payload: ProxyCheckPayload):
    ok, reason = is_safe_url(payload.test_url)
    if not ok:
        return {"success": False, "error": f"Небезопасный тестовый URL: {reason}"}
    return check_proxies(payload.proxies, payload.test_url, min(max(payload.timeout or 8, 1), 120))


@router.post("/api/import-url")
def import_url_endpoint(payload: UrlPayload):
    """Скачать JSON/LZT1 сценарий по URL (SSRF-safe)."""
    import requests as req_lib

    ok, reason = is_safe_url(payload.url)
    if not ok:
        return {"ok": False, "error": reason}
    try:
        r = req_lib.get(payload.url.strip(), timeout=20, headers={"Accept": "application/json,text/plain,*/*"})
        text = r.text or ""
        if r.status_code >= 400:
            return {"ok": False, "error": f"HTTP {r.status_code}"}
        return {"ok": True, "content": text[:2_000_000], "content_type": r.headers.get("content-type", "")}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.post("/api/open-browser")
def open_browser_endpoint(payload: UrlPayload):
    ok, reason = is_safe_url(payload.url)
    if not ok:
        return {"status": "error", "error": reason}
    webbrowser.open(payload.url)
    return {"status": "ok"}
