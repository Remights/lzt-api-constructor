"""Win32: frameless-окно, ресайз, перемещение."""
import time

from backend.config import WINDOW_TITLE
from backend.desktop import state

_old_wnd_proc = None
_new_wnd_proc = None


def get_hwnd():
    try:
        import ctypes
        return ctypes.windll.user32.FindWindowW(None, WINDOW_TITLE)
    except Exception:
        return None


def hide_window():
    hwnd = get_hwnd()
    if hwnd:
        try:
            import ctypes
            ctypes.windll.user32.ShowWindow(hwnd, 0)
            return True
        except Exception:
            pass
    return False


def show_window():
    hwnd = get_hwnd()
    if hwnd:
        try:
            import ctypes
            user32 = ctypes.windll.user32
            user32.ShowWindow(hwnd, 9)
            user32.SetForegroundWindow(hwnd)
            return True
        except Exception:
            pass
    if state.window_ref:
        try:
            state.window_ref.show()
            return True
        except Exception:
            pass
    return False


def move_window_by(dx, dy):
    try:
        import ctypes
        from ctypes import wintypes
        user32 = ctypes.windll.user32
        hwnd = user32.FindWindowW(None, WINDOW_TITLE)
        if not hwnd or user32.IsZoomed(hwnd):
            return
        rect = wintypes.RECT()
        user32.GetWindowRect(hwnd, ctypes.byref(rect))
        SWP_NOSIZE = 0x0001
        SWP_NOZORDER = 0x0004
        SWP_NOACTIVATE = 0x0010
        user32.SetWindowPos(
            hwnd, 0, rect.left + int(dx), rect.top + int(dy), 0, 0,
            SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
        )
    except Exception:
        pass


def minimize_window():
    hwnd = get_hwnd()
    if hwnd:
        try:
            import ctypes
            ctypes.windll.user32.ShowWindow(hwnd, 6)
            return True
        except Exception:
            pass
    if state.window_ref:
        try:
            state.window_ref.minimize()
            return True
        except Exception:
            pass
    return False


def maximize_window():
    hwnd = get_hwnd()
    if hwnd:
        try:
            import ctypes
            user32 = ctypes.windll.user32
            user32.ShowWindow(hwnd, 9 if user32.IsZoomed(hwnd) else 3)
            return True
        except Exception:
            pass
    if state.window_ref:
        try:
            state.window_ref.toggle_fullscreen()
            return True
        except Exception:
            pass
    return False


def close_window():
    if state.window_ref:
        try:
            state.window_ref.destroy()
            return True
        except Exception:
            pass
    hwnd = get_hwnd()
    if hwnd:
        try:
            import ctypes
            ctypes.windll.user32.PostMessageW(hwnd, 0x0010, 0, 0)
        except Exception:
            pass
    return False


def drag_window():
    try:
        import ctypes
        user32 = ctypes.windll.user32
        hwnd = user32.FindWindowW(None, WINDOW_TITLE)
        if hwnd:
            user32.ReleaseCapture()
            user32.SendMessageW(hwnd, 0x00A1, 2, 0)
    except Exception:
        pass


def install_resize_hook():
    global _old_wnd_proc, _new_wnd_proc
    try:
        import ctypes
        from ctypes import wintypes
        user32 = ctypes.windll.user32

        FindWindowW = ctypes.WINFUNCTYPE(wintypes.HWND, ctypes.c_wchar_p, ctypes.c_wchar_p)(("FindWindowW", user32))
        GetWindowRect = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, ctypes.POINTER(wintypes.RECT))(("GetWindowRect", user32))
        SetWindowPos = ctypes.WINFUNCTYPE(
            wintypes.BOOL, wintypes.HWND, wintypes.HWND, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, wintypes.UINT
        )(("SetWindowPos", user32))
        CallWindowProcW = ctypes.WINFUNCTYPE(
            wintypes.LPARAM, wintypes.LPARAM, wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM
        )(("CallWindowProcW", user32))

        hwnd = FindWindowW(None, WINDOW_TITLE)
        if not hwnd:
            return False

        try:
            SetWindowLongPtrW = ctypes.WINFUNCTYPE(wintypes.LPARAM, wintypes.HWND, ctypes.c_int, wintypes.LPARAM)(("SetWindowLongPtrW", user32))
            GetWindowLongPtrW = ctypes.WINFUNCTYPE(wintypes.LPARAM, wintypes.HWND, ctypes.c_int)(("GetWindowLongPtrW", user32))
        except AttributeError:
            SetWindowLongPtrW = ctypes.WINFUNCTYPE(wintypes.LPARAM, wintypes.HWND, ctypes.c_int, wintypes.LPARAM)(("SetWindowLongW", user32))
            GetWindowLongPtrW = ctypes.WINFUNCTYPE(wintypes.LPARAM, wintypes.HWND, ctypes.c_int)(("GetWindowLongW", user32))

        GWL_STYLE = -16
        GWLP_WNDPROC = -4
        WS_THICKFRAME = 0x00040000
        WS_MINIMIZEBOX = 0x00020000
        WS_MAXIMIZEBOX = 0x00010000

        style = GetWindowLongPtrW(hwnd, GWL_STYLE)
        style = (style & ~0x00C00000) | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX
        SetWindowLongPtrW(hwnd, GWL_STYLE, style)

        try:
            dwmapi = ctypes.windll.dwmapi
            DwmSetWindowAttribute = ctypes.WINFUNCTYPE(
                ctypes.c_long, wintypes.HWND, wintypes.DWORD, ctypes.c_void_p, wintypes.DWORD
            )(("DwmSetWindowAttribute", dwmapi))
            val_true = ctypes.c_int(1)
            DwmSetWindowAttribute(hwnd, 19, ctypes.byref(val_true), ctypes.sizeof(val_true))
            DwmSetWindowAttribute(hwnd, 20, ctypes.byref(val_true), ctypes.sizeof(val_true))
            val_none = ctypes.c_int(-2)
            DwmSetWindowAttribute(hwnd, 34, ctypes.byref(val_none), ctypes.sizeof(val_none))
            val_dark = ctypes.c_int(0x141414)
            DwmSetWindowAttribute(hwnd, 34, ctypes.byref(val_dark), ctypes.sizeof(val_dark))
        except Exception:
            pass

        WNDPROC = ctypes.WINFUNCTYPE(wintypes.LPARAM, wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM)
        HEADER_H = 54
        BORDER = 18

        def hook_proc(h, msg, wparam, lparam):
            if msg == 0x0083 and wparam:
                rects = ctypes.cast(lparam, ctypes.POINTER(wintypes.RECT))
                if user32.IsZoomed(h):
                    cx = user32.GetSystemMetrics(32)
                    cy = user32.GetSystemMetrics(33)
                    pad = user32.GetSystemMetrics(92)
                    rects[0].left += cx + pad
                    rects[0].top += cy + pad
                    rects[0].right -= cx + pad
                    rects[0].bottom -= cy + pad
                return 0

            if msg == 0x0084:
                x = lparam & 0xFFFF
                if x >= 0x8000:
                    x -= 0x10000
                y = (lparam >> 16) & 0xFFFF
                if y >= 0x8000:
                    y -= 0x10000

                rect = wintypes.RECT()
                GetWindowRect(h, ctypes.byref(rect))

                left = x < (rect.left + BORDER)
                right = x >= (rect.right - BORDER)
                top = y < (rect.top + BORDER)
                bottom = y >= (rect.bottom - BORDER)

                if not user32.IsZoomed(h):
                    if top and left:
                        return 13
                    if top and right:
                        return 14
                    if bottom and left:
                        return 16
                    if bottom and right:
                        return 17
                    if left:
                        return 10
                    if right:
                        return 11
                    if top:
                        return 12
                    if bottom:
                        return 15

                rel_x = x - rect.left
                rel_y = y - rect.top
                win_width = rect.right - rect.left

                if BORDER <= rel_y <= HEADER_H:
                    search_l = win_width // 2 - 230
                    search_r = win_width // 2 + 130
                    controls_l = win_width - 320
                    if search_l <= rel_x <= search_r:
                        return 1
                    if rel_x >= controls_l:
                        return 1
                    return 2

                return 1
            return CallWindowProcW(_old_wnd_proc, h, msg, wparam, lparam)

        _new_wnd_proc = WNDPROC(hook_proc)
        func_ptr = ctypes.cast(_new_wnd_proc, ctypes.c_void_p).value
        _old_wnd_proc = SetWindowLongPtrW(hwnd, GWLP_WNDPROC, func_ptr)

        SWP_FRAMECHANGED = 0x0020
        SWP_NOMOVE = 0x0002
        SWP_NOSIZE = 0x0001
        SWP_NOZORDER = 0x0004
        SetWindowPos(hwnd, 0, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED)
        return True
    except Exception as e:
        print("Resize error:", e)
        return False


def enable_resizing():
    for attempt in range(12):
        time.sleep(0.35 if attempt == 0 else 0.55)
        if install_resize_hook():
            return
