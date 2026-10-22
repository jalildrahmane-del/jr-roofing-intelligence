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
if not exist ".data\jr.sqlite" (
  echo First launch: set up your private manager login.
  powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\owner-preview-setup.ps1"
  if errorlevel 1 goto fail
)
echo Sign in with your own account. New preview accounts use username: owner.
echo No default password is provided.
echo.
echo Waiting for the local server before opening your browser...
start "JR Roofing browser readiness" /min powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\open-owner-preview.ps1"
echo Press Ctrl+C to stop the local server.
call npm start
exit /b %errorlevel%
:fail
echo.
echo Setup failed. See the error above; no data was reset.
pause
exit /b 1
