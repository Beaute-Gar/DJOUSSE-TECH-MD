@echo off
REM ═══════════════════════════════════════════════════════════════
REM DJOUSSE-TECH-MD — Build APK (Windows, sans Android Studio)
REM Usage: scripts\build-apk.bat
REM ═══════════════════════════════════════════════════════════════

cd /d "%~dp0.."

echo ════════════════════════════════════════════════════
echo   DJOUSSE-TECH-MD — Build APK
echo ════════════════════════════════════════════════════
echo.

REM Vérifier Node
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js non trouvé
    pause
    exit /b 1
)

REM Vérifier Java
where java >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Java non trouvé. Installez JDK 17+
    pause
    exit /b 1
)

REM Étape 1: npm install
echo [1/6] Installation des dependances...
call npm install 2>nul
if %errorlevel% neq 0 (
    echo ❌ Erreur npm install
    pause
    exit /b 1
)

REM Étape 2: Capacitor
echo [2/6] Installation Capacitor...
call npm install --save-dev @capacitor/cli @capacitor/core @capacitor/android 2>nul

REM Étape 3: Init Capacitor
if not exist "capacitor.config.json" (
    echo [3/6] Initialisation Capacitor...
    call npx cap init djousse-tech-md com.djoussetechnology.md --web-dir www
) else (
    echo [3/6] Capacitor deja initialise
)

REM Étape 4: Add Android
if not exist "android\app" (
    echo [4/6] Ajout plateforme Android...
    call npx cap add android
) else (
    echo [4/6] Plateforme Android deja presente
)

REM Étape 5: Sync
echo [5/6] Synchronisation...
call npx cap sync android
if %errorlevel% neq 0 (
    echo ❌ Erreur sync
    pause
    exit /b 1
)

REM Étape 6: Build Gradle
echo [6/6] Build APK avec Gradle...
cd android

if exist "gradlew.bat" (
    call gradlew.bat assembleDebug --no-daemon
) else if exist "gradlew" (
    call gradlew assembleDebug --no-daemon
) else (
    echo ❌ gradlew non trouvé
    pause
    exit /b 1
)

cd ..

REM Vérifier APK
set "APK_PATH=android\app\build\outputs\apk\debug\app-debug.apk"
if exist "%APK_PATH%" (
    echo.
    echo ════════════════════════════════════════════════════
    echo   ✅ APK BUILD REUSSI !
    echo ════════════════════════════════════════════════════
    echo.
    echo   📱 APK: %APK_PATH%
    echo.
    echo   Utilisez .apk dans WhatsApp pour l'envoyer
    echo ════════════════════════════════════════════════════
) else (
    echo ❌ Build echoue — APK non trouve
    pause
    exit /b 1
)

pause
