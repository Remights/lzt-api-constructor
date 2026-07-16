"""Сборка FastAPI-приложения."""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.config import BASE_DIR
from backend.routes import ai_routes, catalog, hooks, market, scenarios, storage, window


def create_app() -> FastAPI:
    app = FastAPI(title="LZT API Constructor")

    cors_raw = os.environ.get(
        "LZT_CORS",
        "http://127.0.0.1:8484,http://localhost:8484",
    )
    cors_origins = ["*"] if cors_raw.strip() == "*" else [o.strip() for o in cors_raw.split(",") if o.strip()]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(market.router)
    app.include_router(ai_routes.router)
    app.include_router(catalog.router)
    app.include_router(window.router)
    app.include_router(storage.router)
    app.include_router(scenarios.router)
    app.include_router(hooks.router)

    app.mount("/", StaticFiles(directory=os.path.join(BASE_DIR, "web"), html=True), name="web")
    return app
