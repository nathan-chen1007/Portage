@echo off
REM Portage backend: one double-click to set up, test and run. Output also goes to backend\logs\.
cd /d "%~dp0"
if not exist logs mkdir logs

if not exist .venv\Scripts\python.exe (
  echo Creating virtual environment...
  python -m venv .venv || (echo Python not found on PATH & pause & exit /b 1)
)
if not exist .env copy .env.example .env >nul

echo Installing requirements...
.venv\Scripts\python.exe -m pip install -q -r requirements.txt > logs\install.log 2>&1
if errorlevel 1 (type logs\install.log & echo INSTALL FAILED & pause & exit /b 1)

echo Running tests...
.venv\Scripts\python.exe -m pytest -q > logs\tests.log 2>&1
type logs\tests.log

echo.
echo Starting API on http://localhost:8000  (Ctrl+C to stop; auto-reloads on code changes)
.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000 --reload > logs\server.log 2>&1
