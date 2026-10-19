@echo off
setlocal
cd /d "%~dp0"
title JR Roofing Intelligence - OPEN APP
if not exist "%~dp0Application\runtime\node.exe" (
 echo PLEASE EXTRACT THE WHOLE ZIP FIRST.
 echo Close this window. Go to Downloads.
 echo Right-click JR-Roofing-Easy-Start.zip and choose Extract All.
 echo Open the NEW extracted folder and double-click OPEN-JR-ROOFING.
 pause
 exit /b 1
)
call "%~dp0Application\START JR Roofing.cmd" %*
