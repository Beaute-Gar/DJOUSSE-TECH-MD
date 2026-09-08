#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# DJOUSSE-TECH-MD — Build APK (sans Android Studio)
# Usage: bash scripts/build-apk.sh
# ═══════════════════════════════════════════════════════════════

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "═══════════════════════════════════════════════════"
echo "  DJOUSSE-TECH-MD — Build APK"
echo "═══════════════════════════════════════════════════"
echo ""

# Vérifier node
if ! command -v node &> /dev/null; then
    echo "❌ Node.js non trouvé"
    exit 1
fi

# Vérifier java
if ! command -v java &> /dev/null; then
    echo "❌ Java non trouvé. Installez JDK 17+"
    exit 1
fi

# Étape 1: npm install
echo "[1/6] Installation des dépendances..."
npm install --production=false 2>/dev/null || npm install

# Étape 2: Capacitor CLI
echo "[2/6] Installation Capacitor..."
npm install --save-dev @capacitor/cli @capacitor/core @capacitor/android 2>/dev/null || true

# Étape 3: Init Capacitor
if [ ! -f "capacitor.config.json" ]; then
    echo "[3/6] Initialisation Capacitor..."
    npx cap init djousse-tech-md com.djoussetechnology.md --web-dir www
else
    echo "[3/6] Capacitor déjà initialisé"
fi

# Étape 4: Add Android
if [ ! -d "android/app" ]; then
    echo "[4/6] Ajout plateforme Android..."
    npx cap add android
else
    echo "[4/6] Plateforme Android déjà présente"
fi

# Étape 5: Sync
echo "[5/6] Synchronisation..."
npx cap sync android

# Étape 6: Build Gradle
echo "[6/6] Build APK avec Gradle..."
cd android

# Rendre gradlew exécutable
chmod +x gradlew 2>/dev/null || true

# Build debug APK
./gradlew assembleDebug --no-daemon

# Vérifier si le build a réussi
APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK_PATH" ]; then
    echo ""
    echo "═══════════════════════════════════════════════════"
    echo "  ✅ APK BUILD RÉUSSI !"
    echo "═══════════════════════════════════════════════════"
    echo ""
    echo "  📱 APK: android/$APK_PATH"
    echo "  📏 Taille: $(du -h "$APK_PATH" | cut -f1)"
    echo ""
    echo "  Utilisez .apk dans WhatsApp pour l'envoyer"
    echo "═══════════════════════════════════════════════════"
else
    echo "❌ Build échoué — APK non trouvé"
    exit 1
fi
