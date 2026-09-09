@echo off
title FoodLink AI Launcher
cd /d "%~dp0"

echo ========================================
echo        Starting FoodLink AI
echo ========================================
echo.

echo Starting backend...
start "FoodLink Backend" cmd /k "cd /d "%~dp0code" && ..\.venv\Scripts\python.exe -m uvicorn foodlink.main:app --reload"

echo Starting frontend...
start "FoodLink Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Backend and frontend are starting in separate windows.
echo Website: http://localhost:5173
echo Backend: http://127.0.0.1:8000
echo.
echo Keep both terminal windows open while using FoodLink.
echo You can close this launcher window.
echo.

timeout /t 3 /nobreak >nul
start "" "http://localhost:5173/"
