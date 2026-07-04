"""Валидация исходящих запросов — защита от SSRF.

Приложение по своей сути ходит на внешние публичные API (Маркет/Форум LZT
и любые указанные пользователем эндпоинты), поэтому мы не ограничиваем список
доменов, но блокируем обращения к внутренним/приватным адресам, чтобы локально
запущенный сервер нельзя было использовать как прокси во внутреннюю сеть.
"""
import ipaddress
import socket
from urllib.parse import urlparse
from typing import Tuple

ALLOWED_SCHEMES = {"http", "https"}


def _is_blocked_ip(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return True  # не смогли распарсить — считаем небезопасным
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def is_safe_url(url: str) -> Tuple[bool, str]:
    """Проверяет, что URL можно безопасно запросить. Возвращает (ok, причина)."""
    if not url or not isinstance(url, str):
        return False, "Пустой URL"
    parsed = urlparse(url.strip())
    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        return False, "Разрешены только http/https"
    host = parsed.hostname
    if not host:
        return False, "Не указан хост"
    low = host.lower()
    if low == "localhost" or low.endswith(".local") or low.endswith(".internal") or low.endswith(".localhost"):
        return False, "Обращение к локальным адресам запрещено"
    # Чисто числовой host (2130706433 = 127.0.0.1) — блокируем до резолва
    if host.isdigit():
        return False, "Обращение к внутренним/приватным адресам запрещено"
    # Резолвим все адреса и проверяем каждый
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False, "Не удалось разрешить хост"
    for info in infos:
        ip_str = info[4][0]
        if _is_blocked_ip(ip_str):
            return False, "Обращение к внутренним/приватным адресам запрещено"
    return True, ""


def is_safe_discord_webhook(url: str) -> Tuple[bool, str]:
    """Discord webhook — только публичные discord.com/api/webhooks/…"""
    ok, reason = is_safe_url(url)
    if not ok:
        return ok, reason
    parsed = urlparse(url.strip())
    host = (parsed.hostname or "").lower()
    if host not in ("discord.com", "discordapp.com", "ptb.discord.com", "canary.discord.com"):
        return False, "Разрешены только webhook URL Discord"
    if "/api/webhooks/" not in (parsed.path or ""):
        return False, "Некорректный путь Discord webhook"
    return True, ""
