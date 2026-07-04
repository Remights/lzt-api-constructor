// Сохранение/открытие файлов через нативный диалог PyWebView (с fallback на browser download).
(function () {
    "use strict";

    function hasNative() {
        return !!(window.pywebview && window.pywebview.api);
    }

    function fallbackDownload(filename, content, mime) {
        try {
            const blob = content instanceof Blob ? content : new Blob([content], { type: (mime || "application/octet-stream") + ";charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 120);
            return true;
        } catch (e) {
            return false;
        }
    }

    async function saveText(filename, content, mime) {
        if (hasNative() && window.pywebview.api.save_file) {
            try {
                const r = await window.pywebview.api.save_file(filename, content, mime || "text/plain");
                return !!(r && r.ok);
            } catch (e) { /* fallback */ }
        }
        return fallbackDownload(filename, content, mime);
    }

    async function saveBlob(filename, blob) {
        if (hasNative() && window.pywebview.api.save_file_b64) {
            try {
                const buf = await blob.arrayBuffer();
                const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
                const r = await window.pywebview.api.save_file_b64(filename, b64);
                return !!(r && r.ok);
            } catch (e) { /* fallback */ }
        }
        return fallbackDownload(filename, blob, blob.type);
    }

    async function openText(accept) {
        if (hasNative() && window.pywebview.api.open_file) {
            try {
                const r = await window.pywebview.api.open_file(accept || ".json");
                if (r && r.ok && r.content != null) return r;
            } catch (e) { /* fallback */ }
        }
        return new Promise((resolve) => {
            const inp = document.createElement("input");
            inp.type = "file";
            if (accept) inp.accept = accept;
            inp.style.display = "none";
            inp.addEventListener("change", () => {
                const f = inp.files && inp.files[0];
                if (!f) { resolve({ ok: false }); return; }
                const reader = new FileReader();
                reader.onload = () => resolve({ ok: true, path: f.name, content: reader.result });
                reader.onerror = () => resolve({ ok: false });
                reader.readAsText(f);
            });
            document.body.appendChild(inp);
            inp.click();
            setTimeout(() => inp.remove(), 60000);
        });
    }

    async function nativeNotify(title, message) {
        if (hasNative() && window.pywebview.api.native_notify) {
            try { await window.pywebview.api.native_notify(title || "LZT API Constructor", message || ""); return true; } catch (e) {}
        }
        return false;
    }

    window.LZTFS = { hasNative, saveText, saveBlob, openText, nativeNotify, fallbackDownload };
})();
