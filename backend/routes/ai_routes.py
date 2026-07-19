"""AI, STT, конфиг и версия."""
import os

import requests
from fastapi import APIRouter, File, Form, Request, UploadFile

from backend import ai_gateway
from backend.config import APP_VERSION, BUILD_PUBLIC_FREE_AI_URL, GITHUB_RELEASES
from backend.schemas import AiPayload, FreeAiPayload
from backend.security import is_safe_url

router = APIRouter(tags=["ai"])


def resolve_free_ai_url() -> str:
    """URL бесплатного AI: env → local_build.py (exe) → локальный Groq → пусто."""
    explicit = os.environ.get("LZT_FREE_AI_URL", "").strip()
    if explicit:
        return explicit
    public = os.environ.get("LZT_PUBLIC_FREE_AI_URL", "").strip()
    if public:
        return public
    if BUILD_PUBLIC_FREE_AI_URL:
        return BUILD_PUBLIC_FREE_AI_URL
    if ai_gateway.groq_keys():
        return "/api/ai/free"
    return ""


def resolve_stt_url(free_url: str = "") -> str:
    """URL STT на VPS (только для server-side proxy). Пусто = локальный Groq."""
    if ai_gateway.groq_keys():
        return ""
    url = (free_url or resolve_free_ai_url()).strip()
    if url.startswith("http"):
        base = url.rstrip("/")
        if base.lower().endswith("/api/ai/free"):
            base = base[: -len("/api/ai/free")].rstrip("/")
        return f"{base}/api/stt"
    return ""


def stt_available(free_url: str = "") -> bool:
    return bool(ai_gateway.groq_keys()) or bool(resolve_stt_url(free_url))


def client_free_ai_url(free_url: str = "") -> str:
    """URL для UI — всегда локальный, без cross-origin на VPS."""
    url = (free_url or resolve_free_ai_url()).strip()
    return "/api/ai/free" if url else ""


def _proxy_json(method: str, url: str, *, headers=None, json_body=None, timeout=60):
    ok_url, reason = is_safe_url(url)
    if not ok_url:
        return {"success": False, "error": reason}
    try:
        r = requests.request(method, url, headers=headers or {}, json=json_body, timeout=timeout)
        try:
            data = r.json()
        except ValueError:
            snippet = (r.text or "")[:300]
            return {"success": False, "error": f"HTTP {r.status_code}: {snippet or 'нет JSON'}"}
        if r.status_code >= 400 and not isinstance(data, dict):
            return {"success": False, "error": f"HTTP {r.status_code}"}
        if r.status_code >= 400 and data.get("success") is not False:
            err = data.get("error") if isinstance(data, dict) else None
            return {"success": False, "error": err or f"HTTP {r.status_code}"}
        return data
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/api/ai")
def ai_endpoint(payload: AiPayload):
    if not payload.api_key:
        return {"success": False, "error": "Не указан API-ключ"}
    base = payload.base_url.rstrip("/")
    url = base + "/chat/completions"
    ok, reason = is_safe_url(url)
    if not ok:
        return {"success": False, "error": f"Небезопасный endpoint: {reason}"}
    try:
        r = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {payload.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": payload.model,
                "messages": [
                    {"role": "system", "content": payload.system},
                    {"role": "user", "content": payload.prompt},
                ],
                "temperature": 0.2,
            },
            timeout=60,
        )
        data = r.json()
        if r.status_code >= 400:
            msg = data.get("error", {}).get("message") if isinstance(data.get("error"), dict) else data.get("error")
            return {"success": False, "error": msg or f"HTTP {r.status_code}"}
        choices = data.get("choices") or []
        if not choices or not isinstance(choices[0], dict):
            return {"success": False, "error": "Пустой ответ провайдера AI"}
        message = choices[0].get("message") or {}
        content = message.get("content")
        if content is None:
            return {"success": False, "error": "Провайдер AI не вернул content"}
        return {"success": True, "content": content}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/api/config")
def config_endpoint(request: Request):
    ver = os.environ.get("LZT_APP_VERSION", APP_VERSION)
    free_url = resolve_free_ai_url()
    payload = {
        "client_fp": f"LZTConstruct/{ver}",
        "free_ai_url": client_free_ai_url(free_url),
        "free_ai_limit": ai_gateway.FREE_LIMIT_PER_HOUR,
        "free_models": ai_gateway.models_for_client(),
        "free_default_model": ai_gateway.default_free_model(),
        "app_version": ver,
        "stt_enabled": stt_available(free_url),
        "stt_url": "/api/stt" if stt_available(free_url) else "",
        "free_ai_local": bool(ai_gateway.groq_keys()),
    }
    fp = request.headers.get("x-lzt-client") or request.headers.get("X-LZT-Client")
    if fp:
        ok_fp, _ = ai_gateway.validate_fingerprint(fp)
        if ok_fp:
            ip = ai_gateway.resolve_client_ip(request)
            _, remaining, limit = ai_gateway.rate_limit_status(ip, fp)
            payload["free_ai_remaining"] = remaining
            payload["free_ai_limit"] = limit
    return payload


@router.get("/api/ai/free/status")
def ai_free_status_endpoint(request: Request):
    fp = request.headers.get("x-lzt-client") or request.headers.get("X-LZT-Client")
    remote = resolve_free_ai_url()
    if not ai_gateway.groq_keys() and remote.startswith("http"):
        base = remote.rstrip("/")
        if base.lower().endswith("/api/ai/free"):
            base = base[: -len("/api/ai/free")].rstrip("/")
        return _proxy_json("GET", f"{base}/api/ai/free/status", headers={"X-LZT-Client": fp or ""}, timeout=10)

    ok_fp, err_fp = ai_gateway.validate_fingerprint(fp)
    if not ok_fp:
        return {"success": False, "error": err_fp, "code": "bad_client"}
    ip = ai_gateway.resolve_client_ip(request)
    ok, remaining, limit = ai_gateway.rate_limit_status(ip, fp)
    return {
        "success": True,
        "remaining": remaining,
        "limit": limit,
        "exhausted": not ok,
    }


@router.post("/api/ai/free")
def ai_free_endpoint(payload: FreeAiPayload, request: Request):
    fp = request.headers.get("x-lzt-client") or request.headers.get("X-LZT-Client")
    remote = resolve_free_ai_url()

    if ai_gateway.groq_keys():
        client_ip = ai_gateway.resolve_client_ip(request)
        ok, data = ai_gateway.chat_free(payload.prompt, payload.system, client_ip, fp, payload.model, payload.license_key)
        if ok:
            return {
                "success": True,
                "content": data["content"],
                "remaining": data.get("remaining"),
                "limit": data.get("limit"),
                "model": data.get("model"),
                "pro": ai_gateway.check_pro_license(payload.license_key),
            }
        return {
            "success": False,
            "error": data.get("error", "Ошибка"),
            "code": data.get("code"),
            "remaining": data.get("remaining"),
            "limit": data.get("limit"),
        }

    if remote.startswith("http"):
        return _proxy_json(
            "POST",
            remote,
            headers={"Content-Type": "application/json", "X-LZT-Client": fp or ""},
            json_body={"prompt": payload.prompt, "system": payload.system, "model": payload.model, "license_key": payload.license_key},
        )

    return {"success": False, "error": "Бесплатный AI недоступен", "code": "no_url"}


@router.post("/api/stt")
async def stt_endpoint(request: Request, file: UploadFile = File(...), lang: str = Form("ru")):
    try:
        data = await file.read()
    except Exception as e:
        return {"success": False, "error": str(e)}

    filename = file.filename or "voice.webm"
    if not data:
        return {"success": False, "error": "Пустой аудиофайл", "code": "empty"}
    if len(data) > 25 * 1024 * 1024:
        return {"success": False, "error": "Аудио слишком большое (макс. 25 МБ)", "code": "too_large"}

    fp = request.headers.get("x-lzt-client") or request.headers.get("X-LZT-Client")

    if ai_gateway.groq_keys():
        ok_fp, err_fp = ai_gateway.validate_fingerprint(fp)
        if not ok_fp:
            return {"success": False, "error": err_fp, "code": "bad_client"}
        client_ip = ai_gateway.resolve_client_ip(request)
        ok_rl, remaining, limit = ai_gateway.rate_limit_status(client_ip, fp)
        if not ok_rl:
            return {
                "success": False,
                "error": f"Лимит STT/AI: {limit} запросов в час.",
                "code": "rate_limit",
                "remaining": 0,
                "limit": limit,
            }
        ok, result = ai_gateway.transcribe_audio(data, filename, lang)
        if ok:
            ai_gateway.record_usage(client_ip, fp)
            return {"success": True, "text": result["text"], "language": result.get("language")}
        return {"success": False, "error": result.get("error", "Ошибка STT"), "code": result.get("code")}

    remote = resolve_stt_url()
    if not remote:
        return {"success": False, "error": "STT недоступен", "code": "no_keys"}

    ok_url, reason = is_safe_url(remote)
    if not ok_url:
        return {"success": False, "error": f"Небезопасный STT endpoint: {reason}"}

    from backend.ai_gateway import _audio_mime

    try:
        r = requests.post(
            remote,
            files={"file": (filename, data, _audio_mime(filename))},
            data={"lang": lang},
            timeout=90,
        )
        try:
            body = r.json()
        except ValueError:
            snippet = (r.text or "")[:300]
            return {"success": False, "error": f"HTTP {r.status_code}: {snippet or 'нет JSON'}"}
        if r.status_code >= 400 and body.get("success") is not False:
            return {"success": False, "error": body.get("error") or f"HTTP {r.status_code}"}
        return body
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/api/version")
def version_endpoint():
    latest = APP_VERSION
    download_url = ""
    try:
        r = requests.get(GITHUB_RELEASES, timeout=4, headers={"Accept": "application/vnd.github+json"})
        if r.status_code == 200:
            data = r.json()
            latest = (data.get("tag_name") or APP_VERSION).lstrip("v")
            assets = data.get("assets") or []
            exe = next((a for a in assets if str(a.get("name", "")).lower().endswith(".exe")), None)
            download_url = (exe or {}).get("browser_download_url") or data.get("html_url") or ""
    except Exception:
        pass
    return {"version": APP_VERSION, "latest": latest, "download_url": download_url}
