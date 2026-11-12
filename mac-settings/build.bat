@echo off
chcp 65001 >nul
title Build System Settings
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [LOI] Chua cai Node.js. Tai tai https://nodejs.org roi chay lai.
  pause & exit /b 1
)

if not exist node_modules (
  echo [1/2] Dang cai dat thu vien...
  call npm install
  if errorlevel 1 ( echo [LOI] npm install that bai. & pause & exit /b 1 )
)

echo [2/2] Dang build ban cai dat .exe ...
call npm run build
if errorlevel 1 ( echo [LOI] Build that bai. & pause & exit /b 1 )

echo.
echo Xong! File cai dat nam trong thu muc "dist".
start "" "%~dp0dist"
pause
