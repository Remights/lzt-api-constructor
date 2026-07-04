@echo off
chcp 65001 > nul
echo ========================================================
echo   Zapusk LZT API Constructor
echo ========================================================

set PYTHON_CMD="python"

if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set PYTHON_CMD="%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
)

echo Starting server and application...
%PYTHON_CMD% main.py
pause
