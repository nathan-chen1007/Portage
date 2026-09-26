@echo off
REM Portage frontend: one double-click to install, test and run. Output also goes to frontend\logs\.
REM Start the backend first (backend\run.bat) so the app shows "Live data".
cd /d "%~dp0"
if not exist logs mkdir logs

where npm >nul 2>&1 || (echo Node.js/npm not found on PATH. Install Node 20+ from nodejs.org & pause & exit /b 1)

echo Installing packages (first run takes a minute)...
call npm install --no-audit --no-fund > logs\install.log 2>&1
if errorlevel 1 (type logs\install.log & echo INSTALL FAILED & pause & exit /b 1)

echo Running tests...
call npm test > logs\tests.log 2>&1
type logs\tests.log

echo.
echo Starting the app on http://localhost:3000  (Ctrl+C to stop; reloads on save)
call npm run dev > logs\dev.log 2>&1
