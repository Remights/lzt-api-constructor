"""Точка входа: локальный HTTP-сервер + PyWebView."""
import multiprocessing
import os
import threading
import time

import uvicorn
import webview

from backend.app_factory import create_app
from backend.config import HOST, PORT, USER_DATA_DIR, WINDOW_TITLE, apply_build_env_defaults
from backend.desktop import state
from backend.desktop.js_api import JsApi
from backend.desktop.tray import setup_tray
from backend.desktop.webview2_mic import patch_webview2_mic_permission
from backend.desktop.win32 import enable_resizing

app = create_app()


def run_server():
    uvicorn.run(app, host=HOST, port=PORT, log_level="warning")


if __name__ == "__main__":
    multiprocessing.freeze_support()
    apply_build_env_defaults()

    threading.Thread(target=run_server, daemon=True).start()
    time.sleep(0.5)

    print("Запуск окна LZT API Constructor...")
    patch_webview2_mic_permission()
    state.window_ref = webview.create_window(
        title=WINDOW_TITLE,
        url=f"http://{HOST}:{PORT}",
        width=1366,
        height=850,
        min_size=(1100, 700),
        background_color="#18181a",
        resizable=True,
        frameless=True,
        easy_drag=False,
        js_api=JsApi(),
    )
    threading.Thread(target=lambda: (time.sleep(1.2), setup_tray()), daemon=True).start()
    webview.start(enable_resizing, storage_path=os.path.join(USER_DATA_DIR, "webview"))
