<div align="center">

## DJOUSSE TECH MD

[![Made with Baileys](https://img.shields.io/badge/Made%20with-Baileys-00bcd4?style=for-the-badge)](https://github.com/WhiskeySockets/Baileys)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

</div>

DJOUSSE TECH MD est un bot WhatsApp multi-compte construit sur la librairie **Baileys**.
Conçu pour être rapide, léger et facile à personnaliser sans toucher au code source.
Projet **100% open source** — tu peux le modifier, le rebrander et en faire **ton propre bot** gratuitement.

---

## Fonctionnalités

- **Open Source** — tout le code est éditable, hébergeable partout (Heroku, VPS, panel, etc.)
- **Customisation facile** — change le nom, le préfixe, l'image du bot, le newsletter via des commandes
- **Système de commandes modulaire** — tout est rangé dans le dossier `commands/`
- **Optimisé** — gestion mémoire optimisée, sessions via `SESSION_ID`, temp files auto-nettoyés
- **Outils propriétaire** — restart, update, broadcast, et plus

---

## Installation rapide

### 1. Cloner le repo

```bash
git clone https://github.com/Beaute-Gar/DJOUSSE-TECH-MD.git
cd DJOUSSE-TECH-MD
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer

Crée un fichier `.env` à la racine :

```env
SESSION_ID=DJOUSSE!...
OWNER_NUMBER=237693978044
OWNER_NAME=Beaute Gar
BOT_NAME=DJOUSSE TECH
PREFIX=.
GROQ_API_KEY=ta_cle_groq
```

Ou édite `config.js` directement.

### 4. Lancer

```bash
node index.js
```

- Si `SESSION_ID` est vide, un **QR code** apparaît — scanne-le avec WhatsApp (Appareils liés)
- Si `SESSION_ID` est défini, le bot se connecte automatiquement

---

## Déploiement

### Heroku

[![Deploy on Heroku](https://img.shields.io/badge/Deploy-Heroku-430098?style=for-the-badge&logo=heroku&logoColor=white)](https://heroku.com/deploy)

### Panel (Katabump, etc.)

Configure les variables d'environnement dans ton panel avec les mêmes clés que le fichier `.env`.

---

## Commandes

Le bot contient **90+ commandes** organisées par catégorie :

| Catégorie | Exemples |
|-----------|----------|
| **Admin** | antilink, welcome, warn, kick, mute, promote |
| **IA** | ai, gptimage, magicstudio |
| **Anime** | neko, waifu, hneko |
| **Fun** | bomb, dare, truth, joke, meme, ship, tictactoe |
| **Général** | menu, ping, sticker, tts, translate, uptime |
| **Média** | facebook, instagram, tiktok, song, lyrics |
| **Owner** | restart, broadcast, mode, sudo, block |
| **Textmaker** | neon, glitch, fire,冰, metallic |
| **Utility** | calc, weather, translate |

Tape `.menu` dans le bot pour voir la liste complète.

---

## Communauté

- **GitHub** : [Beaute-Gar/DJOUSSE-TECH-MD](https://github.com/Beaute-Gar/DJOUSSE-TECH-MD)
- **Créateur** : Beaute Gar (Cameroun)

---

## Crédits

- **Beaute Gar** — Développeur principal
- **Mr Unique Hacker** — Base KnightBot-Mini
- **Baileys** — Librairie WhatsApp Web API
- Autres bibliothèques open source listées dans `package.json`

---

## Avertissement

- Ce bot est créé **à des fins éducatives uniquement**
- Ce n'est **PAS** un bot WhatsApp officiel
- L'utilisation de bots tiers peut **violer les CGU de WhatsApp** et mener à un **ban**

> Tu utilises ce bot **à tes propres risques**.
> Les développeurs ne sont **pas responsables** de tout ban ou problème résultant de son utilisation.

---

## Licence (MIT)

Ce projet est sous licence **MIT**.

Tu dois :
- Utiliser ce logiciel en conformité avec les lois applicables
- Garder les mentions de licence et copyright originales
- Créditer les auteurs originaux
- Ne pas utiliser ce logiciel pour du spam, de l'abus ou des activités malveillantes

---

## Copyright

Copyright (c) **2026 Beaute Gar**. Tous droits réservés.

Ce projet contient du code de divers projets open source, notamment :
- **Baileys** — Licence MIT
- **KnightBot-Mini** — Licence MIT
- Autres bibliothèques listées dans `package.json`
