@echo off
setlocal
cd /d "%~dp0"
title JR Roofing Intelligence - Private Review Logins
"%~dp0runtime\node.exe" "%~dp0owner-preview\launch.mjs" --show-accounts
echo.
echo Copy the username and password into the app login page.
echo Keep these details private. Press any key to close this window.
pause >nul
