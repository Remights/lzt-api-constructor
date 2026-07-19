"""Pydantic-модели HTTP API."""
from typing import Any, Dict, Optional

from pydantic import BaseModel


class RequestPayload(BaseModel):
    url: str
    method: str = "GET"
    params: Dict[str, Any] = {}
    headers: Dict[str, Any] = {}
    body: Optional[Any] = None
    proxy: Optional[str] = None
    timeout: Optional[int] = 15


class UrlPayload(BaseModel):
    url: str


class NotifyPayload(BaseModel):
    channel: str = "telegram"
    text: str = ""
    tg_token: str = ""
    tg_chat: str = ""
    discord_url: str = ""


class ProxyCheckPayload(BaseModel):
    proxies: list = []
    test_url: str = "https://api.ipify.org?format=json"
    timeout: int = 8


class AiPayload(BaseModel):
    base_url: str = "https://openrouter.ai/api/v1"
    api_key: str = ""
    model: str = "openai/gpt-4o-mini"
    system: str = ""
    prompt: str = ""


class FreeAiPayload(BaseModel):
    prompt: str = ""
    system: str = ""
    model: str = ""
    license_key: str = ""


class MovePayload(BaseModel):
    dx: float = 0
    dy: float = 0
