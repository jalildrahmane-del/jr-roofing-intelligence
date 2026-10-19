@echo off
setlocal
cd /d "%~dp0"
title JR Roofing Intelligence - Back Up Review Data
"%~dp0runtime\node.exe" "%~dp0owner-preview\launch.mjs" --backup
echo.
pause
