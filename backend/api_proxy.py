import json
import time
import requests
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, Optional, List, Tuple

from backend.security import is_safe_discord_webhook


def normalize_proxy(proxy: str) -> Optional[str]:
    """Приводит строку прокси к виду схема://[user:pass@]host:port. host:port, host:port:user:pass или схема://..."""
    p = (proxy or "").strip()
    if not p:
        return None
    if "://" not in p:
        parts = p.split(":")
        if len(parts) == 4:
            host, port, user, pwd = parts
            p = f"http://{user}:{pwd}@{host}:{port}"
        else:
            p = f"http://{p}"
    return p


def _prepare_request_body(body: Any, headers: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Dict → JSON (по умолчанию), строка → raw data, с учётом Content-Type."""
    h = dict(headers or {})
    if body is None:
        return {}, h
    ct = (h.get("Content-Type") or h.get("content-type") or "").lower()
    if isinstance(body, (dict, list)):
        if not ct or "application/json" in ct:
            if not ct:
                h["Content-Type"] = "application/json"
            return {"json": body}, h
        return {"data": body}, h
    if isinstance(body, str):
        if not ct:
            h["Content-Type"] = "application/json"
            try:
                return {"json": json.loads(body)}, h
            except (TypeError, ValueError):
                h["Content-Type"] = "text/plain; charset=utf-8"
                return {"data": body}, h
        return {"data": body}, h
    return {"data": body}, h


def execute_proxy_request(url: str, method: str, params: Dict[str, Any], headers: Dict[str, Any], body: Dict[str, Any] = None, proxy: Optional[str] = None, timeout: Optional[int] = 15) -> Dict[str, Any]:
    try:
        req_headers = dict(headers or {})
        proxies = None
        if proxy:
            p = normalize_proxy(proxy)
            if p:
                proxies = {"http": p, "https": p}

        m = method.upper()
        kwargs = {"headers": req_headers, "params": params, "timeout": timeout or 15}
        if proxies:
            kwargs["proxies"] = proxies
        if m in ["POST", "PUT", "PATCH", "DELETE"] and body is not None:
            body_kwargs, req_headers = _prepare_request_body(body, req_headers)
            kwargs.update(body_kwargs)
            kwargs["headers"] = req_headers

        response = requests.request(m, url, allow_redirects=False, **kwargs)

        try:
            data = response.json()
        except ValueError:
            data = {"raw_text": response.text}

        return {
            "success": True,
            "status_code": response.status_code,
            "data": data,
            "headers": dict(response.headers)
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def check_one_proxy(raw: str, test_url: str = "https://api.ipify.org?format=json", timeout: int = 8) -> Dict[str, Any]:
    p = normalize_proxy(raw)
    if not p:
        return {"proxy": raw, "alive": False, "error": "пустая строка"}
    proxies = {"http": p, "https": p}
    t0 = time.time()
    try:
        r = requests.get(test_url, proxies=proxies, timeout=timeout)
        ms = int((time.time() - t0) * 1000)
        ip = None
        try:
            ip = r.json().get("ip")
        except Exception:
            pass
        return {"proxy": raw, "alive": r.ok, "status": r.status_code, "ms": ms, "ip": ip}
    except Exception as e:
        return {"proxy": raw, "alive": False, "error": type(e).__name__}


def check_proxies(proxies: List[str], test_url: str = "https://api.ipify.org?format=json", timeout: int = 8) -> Dict[str, Any]:
    """Параллельно проверяет список прокси на живость и латентность."""
    items = [p for p in (proxies or []) if p and p.strip()]
    if not items:
        return {"success": False, "error": "Список прокси пуст"}
    if len(items) > 100:
        items = items[:100]
    results = []
    with ThreadPoolExecutor(max_workers=min(20, len(items))) as ex:
        for res in ex.map(lambda p: check_one_proxy(p, test_url, timeout), items):
            results.append(res)
    alive = sum(1 for r in results if r.get("alive"))
    return {"success": True, "total": len(results), "alive": alive, "dead": len(results) - alive, "results": results}


def send_notification(channel: str, text: str, tg_token: str = "", tg_chat: str = "", discord_url: str = "") -> Dict[str, Any]:
    """Отправка уведомления в Telegram и/или Discord. Возвращает статус по каналам."""
    results = {}
    try:
        if channel in ("telegram", "both") and tg_token and tg_chat:
            r = requests.post(
                f"https://api.telegram.org/bot{tg_token}/sendMessage",
                json={"chat_id": tg_chat, "text": text, "parse_mode": "HTML"},
                timeout=15,
            )
            results["telegram"] = {"ok": r.ok, "status": r.status_code}
        if channel in ("discord", "both") and discord_url:
            ok, reason = is_safe_discord_webhook(discord_url)
            if not ok:
                return {"success": False, "error": f"Discord webhook: {reason}"}
            r = requests.post(discord_url, json={"content": text}, timeout=15, allow_redirects=False)
            results["discord"] = {"ok": r.ok, "status": r.status_code}

        if not results:
            return {"success": False, "error": "Не заданы данные канала (токен/chat_id или webhook)"}
        any_ok = any(v.get("ok") for v in results.values())
        return {"success": any_ok, "results": results}
    except Exception as e:
        return {"success": False, "error": str(e)}
