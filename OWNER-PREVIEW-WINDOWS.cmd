@echo off
setlocal
cd /d "%~dp0"
echo.
echo JR Roofing Intelligence - Private Owner Preview
echo No cloud deployment. Local computer only.
echo.
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 24 or newer is required. Install Node.js 24 LTS and try again.
  pause
  exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0])<24)process.exit(1)"
if errorlevel 1 (
  echo Node.js 24 or newer is required.
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  echo Installing local dependencies...
  call npm ci
  if errorlevel 1 goto fail
)
echo Building the latest owner preview...
call npm run build
if errorlevel 1 goto fail
echo.
echo If you have not created a manager account yet, follow README.md.
echo This preview requires a valid account. No default password is provided.
echo.
echo Open http://127.0.0.1:3000 in your browser.
start "" "http://127.0.0.1:3000"
echo Press Ctrl+C to stop the local server.
call npm start
exit /b %errorlevel%
:fail
echo.
echo Setup failed. See the error above; no data was reset.
pause
exit /b 1
