"""Парсинг официальных OpenAPI-спецификаций LOLZTEAM (Market + Forum)
в компактный каталог эндпоинтов для конструктора запросов."""

import json
import os
import re

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPECS_DIR = os.path.join(BASE_DIR, "api", "specs")

METHODS = ("get", "post", "put", "delete", "patch")

SPEC_FILES = [
    ("market", "Market API", "market.json"),
    ("forum", "Forum API", "forum.json"),
]


def _resolve_ref(doc, ref):
    node = doc
    for part in ref.lstrip("#/").split("/"):
        if not isinstance(node, dict):
            return {}
        node = node.get(part, {})
    return node if isinstance(node, dict) else {}


def _norm_schema(doc, schema):
    if not isinstance(schema, dict):
        return {}
    if "$ref" in schema:
        schema = _resolve_ref(doc, schema["$ref"])
    return schema


def _clean_text(text, limit=240):
    text = re.sub(r"\s+", " ", (text or "")).strip()
    if len(text) > limit:
        text = text[: limit - 3] + "..."
    return text


def _norm_param(doc, raw, loc_override=None):
    if "$ref" in raw:
        raw = _resolve_ref(doc, raw["$ref"])
    schema = _norm_schema(doc, raw.get("schema", {}))

    ptype = schema.get("type", "string")
    if isinstance(ptype, list):  # OpenAPI 3.1: ["string", "null"]
        ptype = next((t for t in ptype if t != "null"), "string")

    item_schema = _norm_schema(doc, schema.get("items", {})) if ptype == "array" else {}
    enum = schema.get("enum") or item_schema.get("enum")
    enum_desc = schema.get("x-enumDescriptions") or item_schema.get("x-enumDescriptions") or {}

    param = {
        "name": raw.get("name", ""),
        "in": loc_override or raw.get("in", "query"),
        "required": bool(raw.get("required")),
        "type": ptype,
        "desc": _clean_text(raw.get("description") or schema.get("description")),
    }
    if ptype == "array":
        param["item_type"] = item_schema.get("type", "string")
    if ptype == "object":
        ap = schema.get("additionalProperties")
        param["value_type"] = ap.get("type", "string") if isinstance(ap, dict) else "string"
    if enum:
        param["enum"] = enum
    if enum_desc:
        param["enum_desc"] = {str(k): v for k, v in enum_desc.items()}
    for src, dst in (("minimum", "min"), ("maximum", "max"), ("default", "default")):
        if src in schema:
            param[dst] = schema[src]
    return param


def _body_params(doc, op):
    """Разворачивает requestBody (multipart/json) в плоский список параметров."""
    rb = op.get("requestBody")
    if not rb:
        return []
    if "$ref" in rb:
        rb = _resolve_ref(doc, rb["$ref"])
    content = rb.get("content", {})
    if not content:
        return []
    schema = _norm_schema(doc, next(iter(content.values())).get("schema", {}))
    if "oneOf" in schema and schema["oneOf"]:
        schema = _norm_schema(doc, schema["oneOf"][0])
    props = schema.get("properties", {})
    required = set(schema.get("required", []))
    out = []
    for name, prop_schema in props.items():
        raw = {
            "name": name,
            "required": name in required,
            "description": prop_schema.get("description", "") if isinstance(prop_schema, dict) else "",
            "schema": prop_schema if isinstance(prop_schema, dict) else {},
        }
        out.append(_norm_param(doc, raw, loc_override="body"))
    return out


def load_catalog(ru_overlay=None):
    """Возвращает каталог всех эндпоинтов обеих спецификаций.

    ru_overlay: словарь name -> русское описание, накладывается на параметры.
    """
    ru_overlay = ru_overlay or {}
    apis = {}

    for api_id, api_title, filename in SPEC_FILES:
        spec_path = os.path.join(SPECS_DIR, filename)
        if not os.path.exists(spec_path):
            continue
        with open(spec_path, encoding="utf-8") as f:
            doc = json.load(f)

        base_urls = [s.get("url") for s in doc.get("servers", []) if s.get("url")]
        endpoints = []

        for path, path_item in doc.get("paths", {}).items():
            common_params = path_item.get("parameters", [])
            for method in METHODS:
                op = path_item.get(method)
                if not isinstance(op, dict) or op.get("deprecated"):
                    continue

                params = [_norm_param(doc, p) for p in list(common_params) + op.get("parameters", [])]
                params += _body_params(doc, op)

                seen = set()
                unique_params = []
                for prm in params:
                    if not prm["name"] or prm["name"] in seen:
                        continue
                    seen.add(prm["name"])
                    if prm["name"] in ru_overlay:
                        prm["desc_ru"] = ru_overlay[prm["name"]]
                    unique_params.append(prm)

                endpoints.append({
                    "id": f"{api_id}:{method.upper()}:{path}",
                    "api": api_id,
                    "method": method.upper(),
                    "path": path,
                    "tag": (op.get("tags") or ["Other"])[0],
                    "summary": op.get("summary") or path,
                    "desc": _clean_text(op.get("description"), 300),
                    "params": unique_params,
                })

        apis[api_id] = {
            "id": api_id,
            "title": api_title,
            "base_urls": base_urls,
            "endpoints": endpoints,
        }

    return {"apis": apis}


def build_params_db(catalog, ru_overlay=None):
    """Плоская база параметров (name -> desc/category) для глобального поиска."""
    ru_overlay = ru_overlay or {}
    db = {}
    for api in catalog.get("apis", {}).values():
        for ep in api["endpoints"]:
            for prm in ep["params"]:
                name = prm["name"]
                if name in db:
                    continue
                desc = ru_overlay.get(name) or prm.get("desc") or f"Параметр {name}"
                db[name] = {
                    "desc": _clean_text(desc, 130),
                    "category": f"{api['title']}: {ep['tag']}",
                }
    return db
