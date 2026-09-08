#!/data/data/com.termux/files/usr/bin/bash
# ═══════════════════════════════════════════════════════════════
# DJOUSSE-TECH-MD — Build APK (Termux/Android)
# Usage: bash scripts/build-apk-termux.sh
# ═══════════════════════════════════════════════════════════════

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "═══════════════════════════════════════════════════"
echo "  DJOUSSE-TECH-MD — Build APK (Termux)"
echo "═══════════════════════════════════════════════════"
echo ""

# Vérifier les outils
for cmd in node npm java; do
    if ! command -v $cmd &> /dev/null; then
        echo "❌ $cmd non trouvé. Installation..."
        case $cmd in
            node) pkg install nodejs-lts ;;
            npm) pkg install nodejs-lts ;;
            java) pkg install openjdk-17 ;;
        esac
    fi
done

echo "✅ Node: $(node -v)"
echo "✅ Java: $(java -version 2>&1 | head -1)"
echo ""

# Étape 1: npm install
echo "[1/6] Installation des dependances..."
npm install 2>/dev/null || npm install --force

# Étape 2: Capacitor
echo "[2/6] Installation Capacitor..."
npm install --save-dev @capacitor/cli @capacitor/core @capacitor/android 2>/dev/null || true

# Étape 3: Init Capacitor
if [ ! -f "capacitor.config.json" ]; then
    echo "[3/6] Initialisation Capacitor..."
    npx cap init djousse-tech-md com.djoussetechnology.md --web-dir www
else
    echo "[3/6] Capacitor deja initialise"
fi

# Étape 4: Add Android
if [ ! -d "android/app" ]; then
    echo "[4/6] Ajout plateforme Android..."
    npx cap add android
else
    echo "[4/6] Plateforme Android deja presente"
fi

# Étape 5: Sync
echo "[5/6] Synchronisation..."
npx cap sync android

# Étape 6: Build Gradle
echo "[6/6] Build APK avec Gradle..."
cd android

chmod +x gradlew 2>/dev/null || true

# Termux a besoin de JAVA_HOME
if [ -z "$JAVA_HOME" ]; then
    export JAVA_HOME=$PREFIX/share/openjdk-17
fi

./gradlew assembleDebug --no-daemon --stacktrace 2>&1 | tee ../data/build-apk.log

cd ..

# Vérifier APK
APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK_PATH" ]; then
    SIZE=$(du -h "$APK_PATH" | cut -f1)
    echo ""
    echo "═══════════════════════════════════════════════════"
    echo "  ✅ APK BUILD REUSSI !"
    echo "═══════════════════════════════════════════════════"
    echo ""
    echo "  📱 APK: $APK_PATH"
    echo "  📏 Taille: $SIZE"
    echo ""
    echo "  Copier vers /sdcard/ pour l'installer:"
    echo "  cp $APK_PATH /sdcard/Download/"
    echo ""
    echo "  Ou utilisez .apk send dans WhatsApp"
    echo "═══════════════════════════════════════════════════"
else
    echo "❌ Build echoue — APK non trouve"
    echo "Voir data/build-apk.log pour les details"
    exit 1
fi
