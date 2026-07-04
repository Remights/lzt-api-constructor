@echo off
REM ============================================================
REM  Сборка LZT API Constructor в один .exe (Windows)
REM  Требуется установленный Python 3.9+ и pip.
REM ============================================================

echo [1/5] Установка зависимостей...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip install -r requirements-dev.txt
python -m pip install pyinstaller

echo.
echo [2/5] Офлайн-ассеты UI (Font Awesome, QRCode)...
powershell -ExecutionPolicy Bypass -File scripts\download_vendor.ps1

echo.
echo [3/5] Иконка для .exe (из web\icon.svg)...
python scripts\generate_icon.py
if errorlevel 1 (
    echo ОШИБКА: не удалось собрать icon.ico из web\icon.svg
    pause
    exit /b 1
)

echo.
if exist backend\local_build.py (
    echo [release] backend\local_build.py найден — URL/ключи попадут в .exe
) else (
    echo [release] backend\local_build.py НЕ найден — скопируйте local_build.py.example
    echo          Бесплатный AI в exe будет только через свой ключ пользователя.
)

echo.
echo [4/5] Очистка старой сборки...
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist

echo.
echo [5/5] Сборка .exe (PyInstaller)...
python -m PyInstaller build.spec --noconfirm

echo.
if exist "dist\LZT API Constructor.exe" (
    echo ГОТОВО! Файл: dist\LZT API Constructor.exe
) else (
    echo Сборка завершилась с ошибкой. Проверьте вывод выше.
)
pause
