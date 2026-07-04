"""WebView2: разрешение микрофона для голосового ввода."""
_MIC_HOOK_DONE = False


def patch_webview2_mic_permission():
    global _MIC_HOOK_DONE
    if _MIC_HOOK_DONE:
        return
    try:
        import clr
        clr.AddReference("Microsoft.Web.WebView2.Core")
        from Microsoft.Web.WebView2.Core import CoreWebView2PermissionKind, CoreWebView2PermissionState
        from webview.platforms import edgechromium as ec

        if getattr(ec, "_lzt_mic_patched", False):
            _MIC_HOOK_DONE = True
            return

        _orig_ready = ec.EdgeChrome.on_webview_ready

        def on_permission_requested(sender, args):
            try:
                kind = args.PermissionKind
                if kind in (
                    CoreWebView2PermissionKind.Microphone,
                    CoreWebView2PermissionKind.Camera,
                ):
                    args.State = CoreWebView2PermissionState.Allow
                    args.Handled = True
            except Exception as ex:
                print("LZT mic permission:", ex)

        def on_webview_ready(self, sender, args):
            _orig_ready(self, sender, args)
            if not args.IsSuccess:
                return
            try:
                core = sender.CoreWebView2
                if core is not None:
                    core.PermissionRequested += on_permission_requested
                    print("LZT: доступ к микрофону разрешён в WebView2")
            except Exception as e:
                print("LZT: mic permission hook:", e)

        ec.EdgeChrome.on_webview_ready = on_webview_ready
        ec._lzt_mic_patched = True
        _MIC_HOOK_DONE = True
    except Exception as e:
        print("LZT: mic patch unavailable:", e)
