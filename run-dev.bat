@echo off
cd /d "A:\MRA clone for anime"
echo Starting Vite dev server...
start /B npm run dev > nul 2>&1
timeout /t 3 /nobreak > nul
echo Starting Electron with remote debugging...
start /B npx electron . --remote-debugging-port=9222
echo.
echo Dev server: http://localhost:5173
echo Debugger: http://localhost:9222
echo.
echo Press any key to stop...
pause > nul