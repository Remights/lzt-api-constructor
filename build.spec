# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec для LZT API Constructor.
# Собирает один .exe со встроенными веб-файлами и спецификациями API.
# Запуск:  pyinstaller build.spec

import os
from PyInstaller.utils.hooks import collect_submodules

block_cipher = None

# Ресурсы, которые нужно упаковать внутрь .exe (source, dest_dir_внутри_бандла)
datas = [
    ("web", "web"),
    ("api/specs", "api/specs"),
]

# webview на Windows тянет edgechromium/mshtml — соберём его подмодули на всякий случай
hidden = collect_submodules("webview") + [
    "uvicorn.logging",
    "uvicorn.loops.auto",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan.on",
    "aiohttp",
]
if os.path.isfile(os.path.join("backend", "local_build.py")):
    hidden.append("backend.local_build")

a = Analysis(
    ["main.py"],
    pathex=[os.path.abspath(".")],
    binaries=[],
    datas=datas,
    hiddenimports=hidden,
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="LZT API Constructor",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,           # без чёрного окна консоли
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon="web/icon.ico" if os.path.exists("web/icon.ico") else None,
)
