@echo off
setlocal
cd /d "%~dp0"
title JR Roofing Intelligence - Local Owner Review
if not exist "%~dp0runtime\node.exe" (
  echo Please right-click the downloaded ZIP and select Extract All first.
  echo Then open the extracted folder and double-click START JR Roofing.cmd.
  pause
  exit /b 1
)
"%~dp0runtime\node.exe" "%~dp0owner-preview\launch.mjs" %*
if errorlevel 1 (
  echo.
  echo The app could not start. Your review data has not been reset.
  echo Please share the error message above for help.
  pause
  exit /b 1
)
