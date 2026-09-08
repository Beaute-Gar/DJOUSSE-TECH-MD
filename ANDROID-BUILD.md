# 📱 DJOUSSE-TECH-MD — Build Android APK

## Prérequis

### 1. Node.js (v18+)
```bash
# Télécharger depuis https://nodejs.org
# Vérifier:
node --version
npm --version
```

### 2. Java JDK 17+
```bash
# Télécharger depuis https://adoptium.net
# Vérifier:
java -version
```

### 3. Android Studio (optionnel, recommandé)
```bash
# Télécharger depuis https://developer.android.com/studio
# Nécessaire pour signer l'APK en release
```

## Build rapide (PowerShell)

```powershell
# Depuis la racine du projet:
.\build-android.ps1
```

## Build manuel

```bash
# 1. Installer les dépendances
npm install

# 2. Installer Capacitor
npm install -g @capacitor/cli

# 3. Initialiser Capacitor
npx cap init djousse-tech-md com.djoussetechnology.md --web-dir www

# 4. Ajouter Android
npx cap add android

# 5. Synchroniser
npx cap sync android

# 6. Ouvrir dans Android Studio
npx cap open android
```

## Build APK (sans Android Studio)

```bash
cd android
./gradlew assembleDebug
```

APK sera dans: `android/app/build/outputs/apk/debug/app-debug.apk`

## Build APK Release (signé)

```bash
cd android
./gradlew assembleRelease
```

**Note:** Nécessite un keystore de signature. Voir ci-dessous.

## Créer un keystore (pour release)

```bash
keytool -genkey -v -keystore djousse-tech.keystore -alias djousse-tech -keyalg RSA -keysize 2048 -validity 10000
```

## Structure Android

```
android/
├── app/
│   ├── build.gradle          # Config de build
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/djoussetechnology/md/
│       │   ├── MainActivity.java      # Activity principale
│       │   ├── BotService.java        # Service arrière-plan
│       │   └── BootReceiver.java      # Auto-start au boot
│       └── res/
│           ├── values/         # Strings, colors, styles
│           └── xml/           # Network security config
├── build.gradle              # Config globale
├── settings.gradle
├── gradle.properties
└── gradle/wrapper/
```

## Fonctionnalités Android

- ✅ **Interface Web** — Dashboard temps réel
- ✅ **Arrière-plan** — Service persistant avec notification
- ✅ **Auto-start** — Démarrage au boot
- ✅ **Network** — HTTP local autorisé
- ✅ **Thème** — Interface sombre cyberpunk
- ✅ **Capacitor** — Bridge natif Android

## Téléphone comme serveur local

L'APK Capacitor sert à demander le code officiel, mais elle n'exécute pas Node.js.
Pour que le téléphone charge réellement `index.cjs`, les plugins et les commandes,
installe Termux puis copie le projet dans `~/djousse-tech-md` et lance:

```bash
chmod +x scripts/run-on-termux.sh
./scripts/run-on-termux.sh
```

Le script utilise SQLite et `session/` localement. Il ne demande ni root ni extraction
des fichiers privés de WhatsApp. Après le démarrage, ouvre l'APK ou `http://127.0.0.1:3000`
et utilise le pairing officiel par numéro. Les commandes de base sont locales; les
commandes IA, météo, actualités et téléchargement nécessitent une connexion Internet.

Pour garder Termux actif, installe aussi Termux:WakeLock et désactive l'optimisation
batterie pour Termux. Android peut sinon suspendre le processus.

## Compatibilité sans Termux

L'APK Capacitor ne contient pas Node.js, Baileys ni le serveur de commandes. Elle ne
peut donc pas devenir serveur sur un appareil qui ne supporte pas Termux. Les modules
Node mobiles disponibles ciblent React Native et ne sont pas compatibles directement
avec cette application Capacitor.

Sur ces appareils, utilise Render comme serveur et configure l'URL Render dans l'APK.
Une APK serveur autonome demanderait une réécriture Android native et un runtime Node
embarqué pour chaque architecture CPU; elle ne doit pas extraire la session WhatsApp
par root ou contourner le pairing officiel.

## Installer l'APK sur Android

```bash
# Via ADB
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Ou copier le fichier APK sur le téléphone et installer
```

## Configuration

Le bot lit les variables d'environnement depuis `.env`:

```env
ENGINE_TYPE=baileys
OWNER_NUMBER=237693978044
DASHBOARD_ENABLED=true
DASHBOARD_SECRET=ton-secret
```

## Dépannage

### Erreur "SDK not found"
```bash
# Installer Android SDK via Android Studio
# Ou définir ANDROID_HOME:
export ANDROID_HOME=$HOME/Android/Sdk
```

### Erreur "Gradle not found"
```bash
cd android
./gradlew wrapper
```

### Erreur "Capacitor sync failed"
```bash
# Vérifier que www/index.html existe
ls www/
# Réessayer:
npx cap sync android
```
