@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\start-local-music.ps1"
if errorlevel 1 (
  echo.
  echo 启动失败，请把上面的错误信息发给我。
  pause
)
