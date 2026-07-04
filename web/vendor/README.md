# Локальные зависимости UI

```powershell
powershell -ExecutionPolicy Bypass -File scripts/download_vendor.ps1
```

Font Awesome (CSS + webfonts) и QRCode в `web/vendor/`.

Иконка для exe:

```powershell
pip install -r requirements-dev.txt
python scripts/generate_icon.py
```

Без vendor возможен fallback на CDN из `index.html`; для офлайна нужен первый шаг.
