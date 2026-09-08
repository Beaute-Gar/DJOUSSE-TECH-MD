# Plan d'implémentation : Bot WhatsApp Android Autonome (Version Native Node.js)

Ce plan vise à intégrer le runtime `nodejs-mobile` pour exécuter le bot WhatsApp localement sur le téléphone, en incluant tout le code source et les dépendances.

## User Review Required

> [!IMPORTANT]
> **Performance** : L'extraction de `node_modules` peut prendre du temps au premier démarrage (environ 1-2 minutes selon le nombre de fichiers).
> **Espace Disque** : L'application occupera environ 200-300 Mo après extraction complète des dépendances.
> **Batterie** : Le bot WhatsApp consomme de l'énergie en arrière-plan. L'utilisateur devra désactiver l'optimisation de batterie pour l'application.

## Proposed Changes

### 1. Intégration du Runtime Node.js

#### [MODIFY] [app/build.gradle](file:///C:/Users/djous/Documents/DJOUSSE-TECH-MD/android/app/build.gradle)
- Changement de la dépendance vers une version stable : `com.github.nodejs-mobile:nodejs-mobile-android:0.3.3`.
- Ajout d'une tâche `bundleNodeJsProject` qui crée un fichier ZIP de tout le projet (hors dossiers inutiles comme `.git`, `android`, `tmp`) et le place dans `src/main/assets`.

### 2. Gestion de l'Extraction et du Lancement (Java)

#### [MODIFY] [NodeRunner.java](file:///C:/Users/djous/Documents/DJOUSSE-TECH-MD/android/app/src/main/java/com/djoussetechnology/md/bot/NodeRunner.java)
- Remplacement du chargement JNI manuel par l'utilisation de la classe `NodeJS` fournie par l'AAR.
- Implémentation d'un extracteur de ZIP efficace pour décompresser le projet dans `context.getFilesDir()`.
- Gestion du "versioning" pour ne ré-extraire que si l'APK a été mise à jour.

### 3. Adaptation du Bot (Node.js)

#### [MODIFY] [index.cjs](file:///C:/Users/djous/Documents/DJOUSSE-TECH-MD/index.cjs)
- Configuration des chemins pour pointer vers le stockage interne Android (`/data/data/com.djoussetechnology.md/files/nodejs-project`).
- Initialisation du canal de communication `nodejs-mobile` pour envoyer les statuts à la barre de notification et à l'interface Android.

### 4. Interface Utilisateur (Java)

#### [MODIFY] [MainActivity.java](file:///C:/Users/djous/Documents/DJOUSSE-TECH-MD/android/app/src/main/java/com/djoussetechnology/md/MainActivity.java)
- Ajout d'une barre de progression pour l'extraction initiale.
- Affichage en temps réel des logs Node.js dans la zone de texte.

## Verification Plan

### Automated Tests
- Lancement de `./gradlew assembleDebug` pour vérifier la création du bundle et l'intégration de la bibliothèque.

### Manual Verification
- Premier lancement : observer la barre de progression d'extraction.
- Génération du code : vérifier que le code s'affiche bien dans l'interface.
- Interaction : envoyer `.ping` au bot depuis un autre téléphone et vérifier la réponse locale.
