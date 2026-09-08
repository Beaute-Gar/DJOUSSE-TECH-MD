# Tâches : Bot WhatsApp Android Autonome

- `[x]` Configuration du projet Android (Gradle & Manifest)
    - `[x]` Mettre à jour `variables.gradle` (SDK versions)
    - `[x]` Configurer `app/build.gradle` (Node.js Mobile & UI deps)
    - `[x]` Mettre à jour `AndroidManifest.xml` (Permissions & Services)
- `[x]` Développement des composants natifs (Java)
    - `[x]` Créer `BotService.java` (Foreground Service)
    - `[x]` Créer `NodeRunner.java` (Node.js runtime bridge)
    - `[x]` Créer `NetworkReceiver.java` (Auto-reconnect)
    - `[x]` Refondre `MainActivity.java` (UI Bot)
- `[x]` Préparation du pont Node.js
    - `[x]` Créer `android-bridge.cjs`
    - `[x]` Adapter `index.cjs` pour le mode mobile
- `[/]` Build et Vérification
    - `[ ]` Lancer le build Gradle (`assembleDebug`)
    - `[ ]` Vérifier l'APK générée
