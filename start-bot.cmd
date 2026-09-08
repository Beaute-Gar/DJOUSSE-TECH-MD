@echo off
chcp 65001 >nul
title DJOUSSE-TECH-MD Bot
color 0A
cd /d "%~dp0"

if not exist "node_modules" (
    echo [!] node_modules introuvable. Installation en cours...
    npm install
    echo.
)

:start
cls
echo.
echo   ================================================================
echo     DJOUSSE-TECH-MD  -  WhatsApp Bot
echo   ================================================================
echo     Date    : %date% %time%
echo     Dossier : %cd%
echo   ================================================================
echo.

node --max-old-space-size=2048 index.cjs

echo.
echo   ----------------------------------------------------------------
echo     Le bot s'est arrete. Redemarrage dans 5s... (Ctrl+C pour quitter)
echo   ----------------------------------------------------------------
timeout /t 5 /nobreak >nul
goto start
