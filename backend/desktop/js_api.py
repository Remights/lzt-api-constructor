"""JS API pywebview: файлы, окно, уведомления."""
import base64
import os

import webview

from backend.config import APP_VERSION, WINDOW_TITLE
from backend.user_storage import load_all, save_all
from backend.desktop import state
from backend.desktop.win32 import (
    close_window,
    drag_window,
    get_hwnd,
    hide_window,
    maximize_window,
    minimize_window,
    move_window_by,
    show_window,
)


class JsApi:
    def get_window_bounds(self):
        try:
            import ctypes
            from ctypes import wintypes
            user32 = ctypes.windll.user32
            hwnd = get_hwnd() or user32.FindWindowW(None, WINDOW_TITLE)
            if not hwnd or user32.IsZoomed(hwnd):
                return {"ok": False}
            rect = wintypes.RECT()
            user32.GetWindowRect(hwnd, ctypes.byref(rect))
            return {
                "ok": True,
                "left": int(rect.left),
                "top": int(rect.top),
                "width": int(rect.right - rect.left),
                "height": int(rect.bottom - rect.top),
            }
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def set_window_bounds(self, left, top, width, height):
        try:
            import ctypes
            user32 = ctypes.windll.user32
            hwnd = get_hwnd() or user32.FindWindowW(None, WINDOW_TITLE)
            if not hwnd or user32.IsZoomed(hwnd):
                return {"ok": False}
            width = max(1100, int(width))
            height = max(700, int(height))
            SWP_NOZORDER = 0x0004
            SWP_NOACTIVATE = 0x0010
            user32.SetWindowPos(hwnd, 0, int(left), int(top), width, height, SWP_NOZORDER | SWP_NOACTIVATE)
            return {"ok": True}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def begin_window_resize(self, hit_code):
        try:
            import ctypes
            user32 = ctypes.windll.user32
            hwnd = user32.FindWindowW(None, WINDOW_TITLE)
            if not hwnd or user32.IsZoomed(hwnd):
                return {"ok": False}
            hit = int(hit_code)
            if hit < 10 or hit > 17:
                return {"ok": False, "error": "bad hit code"}
            user32.ReleaseCapture()
            user32.SendMessageW(hwnd, 0x00A1, hit, 0)
            return {"ok": True}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def save_file(self, filename, content, mime="text/plain"):
        try:
            win = state.window_ref
            if not win:
                return {"ok": False, "error": "no window"}
            ext = os.path.splitext(filename)[1].lower()
            types = ("All files (*.*)",)
            if ext == ".json":
                types = ("JSON (*.json)", "All files (*.*)")
            elif ext == ".csv":
                types = ("CSV (*.csv)", "All files (*.*)")
            elif ext == ".zip":
                types = ("ZIP (*.zip)", "All files (*.*)")
            elif ext == ".png":
                types = ("PNG (*.png)", "All files (*.*)")
            path = win.create_file_dialog(webview.SAVE_DIALOG, save_filename=filename, file_types=types)
            if not path:
                return {"ok": False}
            path = path if isinstance(path, str) else (path[0] if path else None)
            if not path:
                return {"ok": False}
            mode = "wb" if isinstance(content, (bytes, bytearray)) else "w"
            with open(path, mode, encoding=None if mode == "wb" else "utf-8") as f:
                f.write(content)
            return {"ok": True, "path": path}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def save_file_b64(self, filename, content_b64):
        try:
            raw = base64.b64decode(content_b64)
            return self.save_file(filename, raw, "application/octet-stream")
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def open_file(self, accept=".json"):
        try:
            win = state.window_ref
            if not win:
                return {"ok": False}
            types = ("JSON (*.json)", "All files (*.*)") if ".json" in str(accept) else ("All files (*.*)",)
            path = win.create_file_dialog(webview.OPEN_DIALOG, file_types=types)
            if not path:
                return {"ok": False}
            path = path[0] if isinstance(path, (list, tuple)) else path
            with open(path, "r", encoding="utf-8") as f:
                return {"ok": True, "path": path, "content": f.read()}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def native_notify(self, title, message):
        try:
            from plyer import notification
            notification.notify(
                title=title or "LZT API Constructor",
                message=message or "",
                app_name="LZT API Constructor",
                timeout=5,
            )
            return True
        except Exception:
            return False

    def tray_available(self):
        from backend.desktop import state

        if getattr(state, "_tray_icon", None) is not None:
            return True
        try:
            import pystray  # noqa: F401
            from PIL import Image  # noqa: F401
            return True
        except ImportError:
            return False

    def get_version(self):
        return APP_VERSION

    def storage_load(self):
        try:
            return {"ok": True, "data": load_all()}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def storage_save(self, data):
        try:
            if not isinstance(data, dict):
                return {"ok": False, "error": "expected object"}
            save_all(data)
            return {"ok": True, "count": len(data)}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def minimize_to_tray(self):
        return hide_window()

    def show_window(self):
        return show_window()

    def move_by(self, dx, dy):
        move_window_by(dx, dy)
        return True

    def minimize(self):
        return minimize_window()

    def maximize(self):
        return maximize_window()

    def close(self):
        return close_window()

    def drag(self):
        drag_window()
