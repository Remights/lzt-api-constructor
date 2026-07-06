# Локальные зависимости UI (офлайн-first)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/download_vendor.ps1
```

Скачивает Font Awesome (CSS + webfonts) и QRCode (`qrcode@1.2.2`) в `web/vendor/`.

Иконка для `.exe`:

```powershell
pip install -r requirements-dev.txt
python scripts/generate_icon.py
```

Приложение работает и без vendor (fallback на CDN в `index.html`), но для полного офлайна нужен первый шаг.
