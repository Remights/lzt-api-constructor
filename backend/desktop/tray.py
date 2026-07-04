"""Системный трей Windows."""
import threading

from backend.desktop import state
from backend.desktop.win32 import show_window


def setup_tray():
    try:
        import pystray
        from PIL import Image, ImageDraw

        def _icon_image():
            img = Image.new("RGB", (64, 64), (24, 24, 26))
            d = ImageDraw.Draw(img)
            d.ellipse((10, 10, 54, 54), fill=(0, 186, 120))
            return img

        def _show(_icon=None, _item=None):
            show_window()

        def _quit(_icon=None, _item=None):
            if state.window_ref:
                try:
                    state.window_ref.destroy()
                except Exception:
                    pass
            if state._tray_icon:
                try:
                    state._tray_icon.stop()
                except Exception:
                    pass

        menu = pystray.Menu(
            pystray.MenuItem("Открыть", _show, default=True),
            pystray.MenuItem("Выход", _quit),
        )
        state._tray_icon = pystray.Icon("lzt_constructor", _icon_image(), "LZT API Constructor", menu)
        threading.Thread(target=state._tray_icon.run, daemon=True).start()
    except Exception as e:
        print("Tray unavailable (pip install pystray Pillow):", e)
