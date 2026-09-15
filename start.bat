@echo off
title DJOUSSE TECH - Command Center
color 0A
cd /d "%~dp0"

echo.
echo  +==========================================================+
echo  |            DJOUSSE TECH - COMMAND CENTER                  |
echo  |              AINORIA OPERATING CORE                       |
echo  +==========================================================+
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is not installed!
    echo  Download: https://nodejs.org
    pause
    exit /b 1
)

:: Check node_modules
if not exist "node_modules\" (
    echo  [INFO] Installing dependencies...
    echo.
    call npm install
    echo.
)

:: Check .env
if not exist ".env" (
    echo  [ERROR] .env file missing!
    echo  Copy .env.example to .env and configure it.
    pause
    exit /b 1
)

echo  Launching Command Center...
echo.
node index.js
echo.
echo  Bot stopped. Press any key to restart...
pause >nul
call "%~f0"
