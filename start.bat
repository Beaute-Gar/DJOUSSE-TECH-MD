@echo off
chcp 65001 >nul
title DJOUSSE-TECH-MD - Bot WhatsApp
color 0A
cd /d "%~dp0"
set NODE_ENV=production

if not exist "node_modules" (
    echo [!] node_modules introuvable. Installation en cours...
    call npm install
    echo.
)

echo.
echo   ================================================================
echo     DJOUSSE-TECH-MD - Demarrage du bot (npm start)
echo   ================================================================
echo.
call npm start

echo.
echo   [i] Bot arrete. Appuyez sur une touche pour fermer.
pause >nul
