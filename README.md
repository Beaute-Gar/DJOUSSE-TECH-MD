<div align="center">

# 🤖 DJOUSSE TECH MD

**Bot WhatsApp intelligent — DJOUSSE TECH EVOLUTION**

> **Des solutions fiables pour un avenir sans limites**

<img
  src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=20&duration=3000&pause=900&color=2ECC71&center=true&vCenter=true&width=680&lines=851+commandes+%C2%B7+12+cat%C3%A9gories;Moteur+DJOUSSE+GUARD+%C2%B7+14+protections;IA+Gemini+%C2%B7+Stickers+%C2%B7+T%C3%A9l%C3%A9chargements;Z%C3%A9ro+bouton+natif+%C2%B7+100%25+texte"
  alt="851 commandes · 12 catégories · Moteur DJOUSSE GUARD · IA Gemini"
/>

<br/>

<img src="https://img.shields.io/badge/version-4.0.0-2ECC71?style=flat-square" alt="Version 4.0.0" />
<img src="https://img.shields.io/badge/commandes-851-00b894?style=flat-square" alt="851 commandes" />
<img src="https://img.shields.io/badge/cat%C3%A9gories-12-111b26?style=flat-square" alt="12 catégories" />
<img src="https://img.shields.io/badge/Baileys-6.7.24-25D366?style=flat-square&logo=whatsapp&logoColor=white" alt="Baileys 6.7.24" />
<img src="https://img.shields.io/badge/Node.js-%E2%89%A518-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js 18+" />
<img src="https://img.shields.io/badge/licence-MIT-E67E22?style=flat-square" alt="Licence MIT" />
<img src="https://img.shields.io/badge/statut-stable-brightgreen?style=flat-square" alt="Statut stable" />

<br/><br/>

<a href="https://github.com/Beaute-Gar/DJOUSSE-TECH-MD">
  <img src="https://img.shields.io/github/stars/Beaute-Gar/DJOUSSE-TECH-MD?style=flat-square&logo=github" alt="Étoiles" />
</a>
<a href="https://github.com/Beaute-Gar/DJOUSSE-TECH-MD/issues">
  <img src="https://img.shields.io/github/issues/Beaute-Gar/DJOUSSE-TECH-MD?style=flat-square" alt="Issues" />
</a>
<a href="https://github.com/Beaute-Gar/DJOUSSE-TECH-MD/commits/main">
  <img src="https://img.shields.io/github/last-commit/Beaute-Gar/DJOUSSE-TECH-MD?style=flat-square" alt="Dernier commit" />
</a>
<a href="https://djousse-tech-md.vercel.app">
  <img src="https://img.shields.io/badge/site-en%20ligne-2ECC71?style=flat-square" alt="Site en ligne" />
</a>

<br/>

<a href="#-présentation">Présentation</a> •
<a href="#-les-12-catégories">Commandes</a> •
<a href="#-djousse-guard">Guard</a> •
<a href="#-installation">Installation</a> •
<a href="#-sécurité">Sécurité</a> •
<a href="#-politique-dutilisation">Politique</a> •
<a href="#-licence">Licence</a>

</div>

---

## 🎯 Présentation

DJOUSSE TECH MD est un assistant WhatsApp complet écrit en **JavaScript / Node.js** sur la bibliothèque [Baileys](https://github.com/WhiskeySockets/Baileys) (WhatsApp Web multi-appareils, **sans compte WhatsApp Business**).

> **WhatsApp transporte l'information. DJOUSSE TECH la comprend, l'organise et permet d'agir dessus.**

Il se distingue par trois piliers :

| Pilier | Ce que ça change |
|---|---|
| 🧠 **Un seul cerveau** | `handler.js` centralise **toutes** les commandes — `index.js` ne fait que la connexion. |
| 🛡️ **DJOUSSE GUARD** | Un moteur de protections de groupe **isolé dans `guard/`**, éprouvé et ordonné par priorité. |
| 🎨 **Zéro bouton natif** | 100 % messages texte et menu par chiffres — fonctionne partout, même sur les vieux clients. |

L'objectif n'est pas d'accumuler des commandes, mais de rendre l'assistant navigable : `.menu` ouvre un pavé numérique `1`–`11`, on tape un chiffre, on a la catégorie.

---

## ✨ Fonctionnalités

<table>
<tr>
<td>

**🎙️ Médias**
- Image / vidéo → sticker (`.s`, `.take`)
- Sticker → image, vidéo → MP3
- View-once : lecture, récupération, sauvegarde auto
- Albums, conversion, redimensionnement (`sharp`)

</td>
<td>

**🤖 IA (Gemini)**
- `.ai <question>` — conversation
- `.analyse` — **OCR** d'une image
- `.analyse` — **transcription** d'un vocal
- `.summarize` — résumé d'un document

</td>
</tr>
<tr>
<td>

**⬇️ Téléchargement**
- `.yt` — recherche YouTube
- `.play` — musique en MP3
- `.video` — vidéo MP4
- `yt-dlp` auto-téléchargé (`vendor/`)

</td>
<td>

**👥 Gestion de groupe**
- `kick` / `promote` / `demote`
- `tagall` / `hidetag` / `poll`
- `pin` / `unpin` / `disappear`
- Welcome & goodbye personnalisables

</td>
</tr>
<tr>
<td>

**🧰 Outils**
- `.translate`, `.calc`, `.qr`
- `.base64`, `.binary`
- `.weather`, `.wiki`, `.github`
- `.convert` — taux de change

</td>
<td>

**👑 Owner**
- `.self` / `.public` / `.broadcast`
- `.sudo` / `.authcode` / `.claim`
- `.accept` / `.unaccept` / `.accepted` — accès du bot
- `.unpause` / `.conflicts` — pause de chat (autre bot)
- `.schedule` — planification
- `.block`, `.mutechat`, `.archive`

</td>
</tr>
<tr>
<td>

**💾 Base locale (SQLite)**
- `data/bot.db` — état, historique, journal en **un seul fichier**
- `.journal [type] [n]` — sanctions, entrées/sorties, connexions
- `.chatlog [n] [@user] [ici]` — messages reçus, requêtes rapides
- `sessions/djsession/` ne contient **que** les credentials WhatsApp

</td>
<td>

**🩺 Diagnostics**
- `.diag` — état socket, version WA, conflits 440, mémoire
- `.menu qr` / `.menu pairing <num>` — bascule de connexion
- `.vv` — récupère une vue unique citée (photo, vidéo, **vocal**, document ou sticker), sauvegardée dans `downloads/`
- Photo de profil du bot — portrait anime local actualisé au démarrage après connexion
- `.sessions` — chemins actifs (session + base locale)

</td>
</tr>
</table>

---

## 🗂️ Les 12 catégories

| # | Catégorie | | Commandes |
|:-:|---|:-:|--:|
| 1 | 🌟 **GÉNÉRAL** | | 9 |
| 2 | 👥 **GROUPE** | | 92 |
| 3 | 🛡️ **PROTECTION** | | 58 |
| 4 | 🖼️ **STICKER & MEDIA** | | 446 |
| 5 | 🧰 **OUTILS** | | 58 |
| 6 | 🤖 **IA** | | 4 |
| 7 | 🎲 **FUN** | | 83 |
| 8 | 🔍 **RECHERCHE** | | 6 |
| 9 | 👑 **OWNER** | | 71 |
| 10 | 📦 **DIVERS** | | 13 |
| 11 | ⬇️ **TÉLÉCHARGEMENT** | | 3 |
| 12 | 🔐 **ARCHIVES** | | 1 |
| | | | **Total (visibles)** | **844** |

> **+ 8 commandes hors menus** (accès direct, ex. `.hacktools`) — total **851**.
> **+ 749 alias** (1600 entrées au registre) — par exemple `.s` → `sticker`, `.tr` → `translate`, `.bc` → `broadcast`.

---

## 🛡️ Canal officiel WhatsApp Agent Platform (zéro bannissement)

Alternative **officielle** à Baileys, activable quand tu veux. L'API est
fournie par WhatsApp lui-même (`api.whatsapp.com/agent/v1`) : aucun risque
de bannissement, aucun QR, aucune session à conserver.

**Activer (2 minutes)** — `.env` :

```env
AGENT_MODE=on
AGENT_API_TOKEN=ton-jeton
```

Jeton obtenu dans WhatsApp : **Paramètres → Agents → Créer un agent** →
ouvrir le chat de l'agent → **Chat info → Clé d'API**.

**Ce que ça change** — le bot reçoit tes messages en direct et répond avec
**toutes** ses commandes (`.menu`, jeux, outils, logos, football…).

**Limites officielles** (imposées par WhatsApp, pas par le bot) :

| Limite | Valeur |
|---|---|
| Destinataire | **Le créateur de l'agent uniquement** (pas de groupe, pas de tierce personne) |
| Réactions | Réception seule (l'envoi est refusé) |
| Envois | 12 messages/minute |
| Sondages | 15 requêtes/minute |
| Médias | 5 Mo image · 500 Ko sticker · 16 Mo vidéo/audio/document |
| Rétention | 30 jours |

> 🧠 Bon réflexe : garde **Baileys** pour ton bot public (groupes,
> modération, protections) et bascule sur **AGENT_MODE=on** pour ton
> usage perso sans aucun risque. Les deux modes se coupent dans `.env`.

**Mode HYBRIDE (le meilleur des deux)** — `.env` :

```env
AGENT_MODE=on
HYBRID_MODE=on
```

Un **seul process** lance alors **deux identités** :

| Identité | Numéro | Commands | Risque de ban |
|---|---|---|---|
| **Agent officiel** | ton numéro perso | limité par WhatsApp (créateur, pas de groupe) | **aucun** |
| **Baileys** | numéro du bot | **TOUTES** (groupes, tout le monde, réactions…) | normal |

Écris au **numéro du bot** pour les commandes complètes ; l'agent reste
ton canal personnel. ⚠️ On ne peut pas **étendre** l'agent (ses limites
sont côté serveurs WhatsApp) : Baileys tourne **à côté**, avec sa propre
identité. Aucune commande ne peut donc « sortir » de l'agent vers des
tiers ou des groupes.

Technique : `lib/wa-agent.js` (client complet : envoi, sondage long, accusés
de lecture, médias, erreurs typées, quota glissant, backoff exponentiel) et
`lib/wa-agent-bridge.js` (adapte les messages officiels au moteur DJOUSSE,
donc **toutes tes commandes existantes fonctionnent sans réécriture**).

---

## 🛡️ DJOUSSE GUARD

Le dossier `guard/` contient un moteur de protections **indépendant du reste du bot**.
L'ordre du tableau = **ordre de priorité d'évaluation**.

| # | Protection | Fichier | Effet |
|:-:|---|---|---|
| 1 | `antilink` | `antilink.js` | Liens interdits (whitelist de domaines) |
| 2 | `antibad` | `antibad.js` | Mots interdits |
| 3 | `antitag` | `antitag.js` | Mentions abusives |
| 4 | `antispam` | `antispam.js` | Rafale de messages |
| 5 | `antiflood` | `antiflood.js` | Flood configurable |
| 6 | `antimedia` | `antimedia.js` | Médias non sollicités |
| 7 | `antisticker` | `antisticker.js` | Stickers en masse |
| 8 | `antivoice` | `antivoice.js` | Vocaux non sollicités |
| 9 | `antistatus` | `antistatus.js` | Mention de statut |
| 10 | `antiforward` | `antiforward.js` | Transferts |
| 11 | `antivirtex` | `antivirtex.js` | Message géant / corruption |
| 12 | `anticontact` | `anticontact.js` | Envoi de contacts |
| 13 | `antipoll` | `antipoll.js` | Sondages intempestifs |

**Commandes associées** : `.security`, `.settings`, `.sanction`, `.warnlimit`, `.floodset`,
`.addbad` / `.delbad`, `.linkallow`, `.mute` / `.unmute`, `.antifake` / `.allowcodes`,
`.maxtext`, `.nightmode` / `.nightset`, `.groupstats`…

**Bonnes pratiques intégrées**
- Les protections passent **avant** toute autre logique (un sticker, un vocal ou un sondage sont contrôlés, même sans texte).
- Le mode `self` **ne coupe jamais** les protections.
- L'**antidelete ne re-poste pas** un lien déjà supprimé par l'antilink.
- Un seul **cache de permissions**, invalidé quand le bot est promu admin.
- Le owner est reconnu même quand WhatsApp renvoie un **LID**.

> **Sans admin, le bot peut prévenir mais pas faire taire.** WhatsApp interdit la suppression d'un
> message par un non-admin *côté serveur* : l'avis signale alors l'infraction et invite à promouvoir
> le bot. C'est une limite de la plateforme, pas du code.

---

## 🚀 Installation

### 1. Prérequis

- **Node.js ≥ 18**
- Un numéro WhatsApp **secondaire** fortement conseillé
- `ffmpeg` est fourni via `ffmpeg-static` — rien à installer à l'extérieur

```bash
git clone https://github.com/Beaute-Gar/DJOUSSE-TECH-MD.git
cd DJOUSSE-TECH-MD
npm install
```

### 2. Configuration

Crée un fichier `.env` à la racine en copiant `.env.example` puis en renseignant tes valeurs (il est **ignoré par git**, ne sera jamais commité) :

```env
# ── Identité ─────────────────────────────────────
BOT_NAME=DJOUSSE TECH
OWNER_NAME=Beaute Gar
OWNER_NUMBER=2376XXXXXXXXX
AUTO_OWNER=1

# ── Commandes ────────────────────────────────────
PREFIX=.

# ── Connexion ────────────────────────────────────
# Le pairing code est utilisé par défaut ; définir CONNECT_METHOD=qr pour le QR
SESSION_DIR=sessions/djsession
CONNECT_METHOD=pairing
PAIRING_PHONE=

# ── Photo du .menu ────────────────────────────────
# random = photo aléatoire tirée de Picsum, qui change régulièrement
# local  = image fixe (MENU_PICTURE_PATH)  ·  off = bannière générée
# Livrée : avatar hacker néon cyan « DJOUSSE TECH » (900×900, ephoto360)
MENU_PICTURE_MODE=local
# Utilisé si MENU_PICTURE_MODE=local (chemin relatif à la racine ou absolu)
MENU_PICTURE_PATH=assets/menu-hacker.jpg
# Régénérer (autre texte ou remise à zéro) :
#   node scripts/menu-image.js "DJOUSSE TECH" assets/menu-hacker.jpg

# ── IA (optionnel) ───────────────────────────────
# Sans clé, .ai renvoie un message explicite.
# Gemini est le provider principal ; en cas de panne, repli automatique
# sur OpenRouter — liste ordonnée de modèles, séparés par des virgules
# (les pools gratuits saturent : le suivant prend le relais).
GEMINI_KEY=
OPENROUTER_API_KEY=
# OPENROUTER_MODEL=nvidia/nemotron-3-super-120b-a12b:free, nvidia/nemotron-3.5-lightning:free, google/gemma-4-31b-it:free

# ── Protections par défaut ───────────────────────
ANTILINK=0
ANTI_DELETE=0
WELCOME=0
ANTI_LEFT=0

# WELCOME et ANTI_LEFT sont les valeurs par défaut des nouveaux groupes.
# Pour les groupes existants, les réglages propres au groupe sont conservés ;
# utilise .welcome on all ou .goodbye on all pour les activer partout.

# ── DJOUSSE GUARD ────────────────────────────────
GUARD_TZ=Africa/Douala
GUARD_LOG=0
GUARD_DB=guard.json

# ── Auto-Statuts (stories) ───────────────────────
AUTO_STATUS_SEEN=true      # vue auto de chaque statut reçu
AUTO_STATUS_REACT=true     # réaction auto (emoji tiré au sort)
AUTO_STATUS_REPLY=false    # réponse en DM à l'auteur du statut
AUTO_STATUS_MSG=Statut vu par DJOUSE TECH MD ✅
CUSTOM_REACT_EMOJIS=❤️,🔥,💯,😍,👏

# ── Modes ────────────────────────────────────────
# public = TOUT LE MONDE peut exécuter les commandes (celles réservées au
#          propriétaire — .accept, redémarrage… — restent protégées).
# self   = seul le propriétaire peut commander.
MODE=public
# PUBLIC_MODE=on force le mode public, même si MODE n'est pas défini.
# PUBLIC_MODE=on
REJECT_CALL=1
AUTO_READ=1
LINK_PREVIEW=1
MSG_CACHE_MAX=800

# ── API de jumelage (optionnelle, désactivée par défaut) ───
# off = le bot reste un worker sans port ouvert (comportement livré).
# on  = le bot écoute pour que le formulaire du site web envoie les
#       numéros ; /status répond { ok, connected, connection, sessions, active }
#       et /pair renvoie le code 8 caractères (409 si la session existe déjà).
PAIRING_API=off
# PAIRING_API_PORT=8089
# Jeton partagé : le site doit l'envoyer dans l'en-tête x-api-token.
# PAIRING_API_TOKEN=
# SERVE_SITE=on sert website/ sur le même port (une seule URL à exposer).
# SERVE_SITE=off
```

L’image [`assets/anime-profile.jpg`](./assets/anime-profile.jpg) provient de [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Anime_girl_portrait.jpg) et est publiée dans le domaine public.

### 3. Démarrer

```bash
npm start        # lance d'abord l'audit, puis le bot (au premier plan)
```

Au lancement, le terminal affiche l’état réel du processus, du stockage, des protections et de la connexion WhatsApp, ainsi que les commandes et plugins effectivement chargés. L’IA indique uniquement si une clé est configurée (aucun secret n’est affiché). Les services externes ne sont pas sondés au démarrage afin de ne pas ralentir ni bloquer la connexion. WhatsApp ne passe à `CONNECTE` qu’après l’événement de connexion confirmé par Baileys.

Le bot demande ton numéro international et affiche un **code de jumelage**.
Sur WhatsApp : Appareils connectés → Connecter un appareil → Associer avec un numéro de téléphone.
Les credentials sont écrits dans `sessions/djsession/` (ignoré par git).

> 💡 `npm run audit` s'exécute tout seul avant chaque démarrage (`prestart`).
> `npm run check` valide la syntaxe des 4 fichiers principaux.

#### Service détaché (le bot survit à la fermeture du terminal)

```powershell
node scripts/service.js start            # bot DÉTACHÉ  → logs/bot.log
node scripts/service.js status           # état + dernières lignes
node scripts/service.js stop             # arrêt (tue toute l'arborescence)
```

Le bot garde son couple `logs/bot.log` + `logs/bot.pid` (ignorés par git).
Le process est créé avec `detached` +
`unref` : pas besoin de pm2, il survit à la fermeture de la fenêtre.
L'heure des logs est **locale**, la même que dans `.journal` / `.chatlog`.

Suivi en direct :

```powershell
Get-Content logs\bot.log -Tail 20 -Wait
```

### 4. Hébergement (multiplateforme)

Le bot est un **worker sans port** (aucun serveur HTTP) : il tourne tel quel
sur VPS, Docker, Render, Fly.io, Railway, Heroku ou Replit. Fichiers livrés :

| Plateforme | Fichier | Lancer avec |
|---|---|---|
| VPS / serveur maison | `docker-compose.yml` | `docker compose up -d --build` |
| Docker générique | `Dockerfile` | `docker build -t djousse .` + `docker run --env-file .env -v ./sessions:/app/sessions -v ./data:/app/data -d djousse` |
| Render | `render.yaml` | New → Blueprint (service *worker*) |
| Fly.io | `fly.toml` | `fly launch --copy-config` + `fly volumes create djousse_state` |
| Heroku | `Procfile` + `app.json` | `heroku create` puis déploiement git |
| Replit | `.replit` | ▶ Run (Always On recommandé) |

**Règles d'or en cloud**

1. **Persistance** — monte `sessions/` et `data/` sur un disque/volume :
   sans lui, chaque redémarrage impose un réappairage. C'est le piège n°1
   des bots WhatsApp hébergés (Heroku et le plan gratuit de Render n'ont
   *aucun* disque persistant).
2. **Code d'appairage** — `CONNECT_METHOD=pairing` + `PAIRING_PHONE` dans
   les variables d'environnement ; le code 8 caractères s'affiche dans les
   **logs** de la plateforme (onglet Logs de Render, `fly logs`, Console
   Replit, `docker logs djousse-tech-md`).
3. **Jamais deux instances** — un seul déploiement actif par numéro : deux
   sessions concurrentes se détruisent mutuellement.
4. Le QR brut n'est jamais lisible depuis un log — préfère toujours le
   mode `pairing` en hébergement.

---

## 🏗️ Architecture

```
DJOUSSE-TECH-MD/
├── index.js          # Point d'entrée : connexion Baileys, QR/pairing, reconnexion
├── handler.js        # 🧠 Cerveau unique - 851 commandes, menu, moteur d'événements
├── config.js         # Toutes les constantes lues depuis .env (aucune logique métier)
├── style.js          # 🎨 Source unique du rendu (cadres ╭┄┄『 』┄❍, alphabet officiel)
│
├── guard/            # 🛡️ DJOUSSE GUARD — moteur de protections isolé
│   └── src/
│       ├── engine.js          # Orchestration + priorités
│       ├── protections/       # 13 fichiers, un par protection
│       ├── commands/          # Commandes de modération
│       ├── sanctions.js  · nightmode.js  · journal.js
│       └── utils/             # parseur, permissions, liens, temps
│
├── lib/              # Modules complémentaires
│   ├── extras.js     # Commandes avancées
│   ├── tools.js      # Outils (remove.bg, conversions…)
│   ├── missing.js    # Événements Baileys non couverts par handler.js
│   ├── store.js      # Persistance JSON (state, historique)
│   ├── dataDir.js    # 💾 Base locale data/ — séparée des credentials WhatsApp
│   ├── waStats.js    # 🔌 Stats de connexion partagées index.js ⇄ handler.js (.diag)
│   ├── scheduler.js  # .schedule / .schedules / .unschedule
│   ├── ai.js         # 🤖 IA unifiée : Gemini → secours OpenRouter multi-modèles
│   ├── auto-status.js # 📺 Auto-Status : vue + réaction + réponse sur les statuts
│   └── wa-send.js    # 🔑 Service d'envoi unique — tout envoi passe par send()
│
├── ludo/             # 🎲 Moteur de jeu Ludo (plateau, règles, rendu canvas)
├── plugins/          # Plugins extensibles
├── scripts/          # 🔍 audit.js · service.js · menu-image.js (image .menu ephoto360)
├── vendor/yt-dlp.exe # ⬇️ Auto-téléchargé au premier usage
├── Dockerfile · docker-compose.yml · Procfile · render.yaml · fly.toml · app.json · .replit
│                     # 🌍 hébergement multiplateforme (worker sans port)
├── data/             # 💾 Base locale SQLite — data/bot.db (état, historique, journal) — gitignoré
└── sessions/djsession/ # 🔒 Credentials WhatsApp uniquement — gitignoré
```

**Flux d'un message :**

```
index.js  ──messages.upsert──▶  handler.js
                                  ├─ 1. DJOUSSE GUARD   (protections, AVANT tout)
                                  ├─ 2. Parseur texte   (prefix + commande)
                                  ├─ 3. Permissions     (owner / admin / groupe)
                                  └─ 4. Exécution       → lib/wa-send.send()
```

**Base locale — `data/bot.db` (SQLite natif `node:sqlite`, zéro dépendance) :**

```
kv        état du bot (groupes, blacklist, stats) + mémoire contextuelle
events    journal : commandes, sanctions, entrées/sorties, cycles de connexion
messages  historique des messages — rétention 30 j / 50 000 lignes (DB_KEEP_DAYS, DB_MAX_ROWS)
guard_*   réglages de groupe, avertissements, mutes (DJOUSSE GUARD)
```

`GUARD_DB=guard.json` force l'ancien moteur JSON. Les fichiers JSON
présents à la migration sont **conservés** : un retour en arrière reste possible.

---

## ✅ Audit

```bash
npm run audit          # sécurité, cohérence des dépendances, structure
npm run audit:deps     # audit des dépendances uniquement
npm test               # tests automatisés des permissions et délais réseau
npm run check          # node --check sur index / handler / config / audit
```

L'audit est décrit dans [`DIAGNOSTIC.md`](./DIAGNOSTIC.md), les correctifs historiques dans [`CHANGELOG.md`](./CHANGELOG.md) et la feuille de route dans [`AMELIORATIONS.md`](./AMELIORATIONS.md).

---

## ⚠️ Limites honnêtes

- Le format « mention de statut » couvre **3 variantes**, à confirmer sur un vrai WhatsApp.
- Les protections partagent encore deux parseurs de texte (`textOf`/`ctxInfo` côté handler, `parse` côté guard) : rôles distincts, **non fusionnés par prudence**.
- Aucun bouton natif, liste ni carrousel — c'est un choix assumé, pas une omission.

---
---

# 🔐 SÉCURITÉ

## 🔑 Informations sensibles

Les éléments suivants doivent rester **privés** et **jamais** être commités dans Git :

```text
.env              sessions/          logs/
tokens            API keys           mots de passe
cookies           QR codes           codes d'appairage
credentials       journaux contenant des données sensibles
```

Déjà couvert par le `.gitignore` du dépôt :

```gitignore
.env
.env.*
session/
sessions/
session-*/
data/
creds.json
state.json
logs/
tmp/
*.log
vendor/yt-dlp.exe
```

> `sessions/djsession/` = credentials WhatsApp · `data/` = base locale du bot
> (`state.json`, `history.json`, `guard.json`, `scheduler.json`, `store/`).
> Effacer `sessions/djsession/` pour réappareiller ne détruit donc plus la config.

## 🤖 Politique d'accès & anti-conflits

```text
accès STRICT : OWNER + acceptés uniquement (numéros comparés EXACTEMENT)
  .accept @user [30m|24h|7d|permanent] · .unaccept · .accepted
  1er refus = explication, suivants = silencieux (anti-spam 60 s)
autre bot détecté sur un chat (boucle de réponses) → pause automatique
  avertissement unique puis plus aucune réponse (owner excepté)
  .conflicts — chats en pause · .unpause [all] — reprise
humanisation : délai aléatoire 300–1100 ms avant chaque message texte
  HUMAN_DELAY=0 coupe · HUMAN_DELAY_MIN / HUMAN_DELAY_MAX en ms
  réactions et médias : envoi immédiat (pas de délai)
```

Les protections de groupe (`guard/`) restent actives pendant une pause.

## 🚨 Risques liés aux sessions

Une session WhatsApp permet au programme de fonctionner avec le compte associé.
Si les fichiers d'authentification sont exposés, une personne non autorisée pourrait compromettre la session.

### ✅ À faire

```text
protéger le serveur · protéger le PC · protéger sessions/djsession/
limiter les accès · supprimer les sessions inutilisées
```

### ❌ À ne jamais faire

```text
envoyer sa session à quelqu'un
publier sessions/djsession/ sur GitHub
envoyer son QR dans un groupe public
publier son code d'appairage
écrire ses secrets directement dans index.js ou config.js
```

> ⚠️ `GUARD_LOG=true` envoie le rapport des expulsions en DM au owner : vérifie à qui parle le bot avant de l'activer.

---

# 🔒 CONFIDENTIALITÉ

La quantité exacte de données traitées dépend de la configuration et des fonctionnalités activées.

### 📩 Données pouvant être traitées

- identifiants techniques et numéro associé au compte
- identifiants et noms de groupes
- messages adressés au bot et médias transmis au bot
- informations nécessaires à l'exécution d'une commande
- données de session (`sessions/djsession/`), base locale du bot (`data/`) et journaux techniques (`logs/`)

Toutes les fonctionnalités ne traitent pas nécessairement toutes ces catégories.

### 🧠 Données envoyées aux services d'IA

Le module IA utilise **Google Gemini** (`GEMINI_KEY`), avec repli automatique sur **OpenRouter** (`OPENROUTER_API_KEY`). Les données nécessaires au traitement de la demande peuvent être transmises à ces fournisseurs.

Avant d'activer un fournisseur, vérifie ses conditions d'utilisation, sa politique de confidentialité, ses règles de conservation et ses limitations.

**🔴 Ne transmettez jamais volontairement à une IA :**

```text
mots de passe · clés privées · tokens · codes bancaires
informations d'authentification · documents confidentiels inutiles
```

### 🌐 Services externes

Le projet peut dépendre de services tiers (IA, recherche, téléchargement, météo, taux de change…).
Ces services ont leurs propres politiques de confidentialité et ne sont pas contrôlés par DJOUSSE TECH : serveurs, disponibilité, politiques, durée de conservation et évolutions techniques leur appartiennent.

### 🗃️ Conservation & 🧹 Suppression

Les données sont soit **temporaires** (exécution d'une opération), soit **techniques** (logs, diagnostic), soit de **configuration** (paramètres), soit de **session** (tant que la connexion est nécessaire).

Pour tout supprimer :

```bash
rm -rf sessions/djsession/ logs/ tmp/
```

⚠️ Supprimer `sessions/djsession/` impose une nouvelle authentification par code d'appairage (ou QR si `CONNECT_METHOD=qr`).

---

# ⚠️ POLITIQUE D'UTILISATION

DJOUSSE-TECH-MD doit être utilisé de manière responsable.
L'utilisateur doit respecter : les lois applicables, les droits des autres personnes, la vie privée, les conditions des services utilisés, les règles des groupes, les droits d'auteur et les règles de sécurité informatique.

## 🚫 Utilisations interdites

| | Interdit |
|:-:|---|
| 📢 | **Spam** — messages non sollicités en volume, publicités massives, invitations massives |
| 🧍 | **Harcèlement** — harceler, menacer, intimider, poursuivre une personne malgré un refus |
| 👁️ | **Surveillance abusive** — espionner, surveiller secrètement, suivre sans autorisation |
| 🎭 | **Usurpation** — se faire passer pour une personne, une entreprise, une administration |
| 💳 | **Fraude** — escroquer, phishing, vol d'identifiants, fausses offres |
| 🦠 | **Logiciels malveillants** — malware, ransomware, spyware, credential stealers |
| 💥 | **Attaques informatiques** — DDoS, compromission de comptes, vol de données |

## ⚠️ Risques d'une utilisation abusive

- **📱 Compte WhatsApp** — une activité jugée abusive peut entraîner restriction ou suspension du compte.
- **🔌 Déconnexion** — une session peut être invalidée : nouvelle authentification requise.
- **🔐 Fuite de données** — une mauvaise configuration expose messages, numéros, médias, tokens, clés et logs.
- **💾 Perte de données** — perte de session, corruption, suppression de fichiers.
- **⚖️ Risques juridiques** — l'utilisateur reste responsable de l'usage qu'il fait du logiciel.

---

# 📱 RELATION AVEC WHATSAPP

DJOUSSE-TECH-MD est un projet **indépendant**.

```text
❌ développé par WhatsApp        ❌ officiellement soutenu par WhatsApp
❌ détenu par WhatsApp           ❌ officiellement approuvé par WhatsApp
```

**WhatsApp** et les marques associées appartiennent à leurs propriétaires respectifs.
Le projet utilise [Baileys](https://github.com/WhiskeySockets/Baileys), une bibliothèque tierce permettant à une application de communiquer avec l'environnement WhatsApp — cela ne constitue **pas** une affiliation officielle.

---

# 🐛 Contribuer

### Signaler un bug

Fournir si possible :

```text
Version :        Node.js :        Système :
Fonction :       Étapes pour reproduire :
Erreur :         Logs :
```

> **⚠️ Avant de publier des logs**, supprime tokens, sessions, numéros privés, API keys, mots de passe et informations personnelles.

### Signaler une faille de sécurité

Ne publiez **pas** publiquement une faille exploitable immédiatement. Signalez-la de manière responsable au mainteneur du projet, via les [issues](https://github.com/Beaute-Gar/DJOUSSE-TECH-MD/issues) privées ou par un canal direct.

### Développement

```bash
git checkout -b feature/ma-fonctionnalite
git add . && git commit -m "feat: nouvelle fonctionnalité"
git push
```

Les contributions sont les bienvenues : 🧠 IA, 🛠️ outils, 🎨 interface, 🛡️ sécurité, ⚡ performances, 🐛 corrections, 📚 documentation.
Toute contribution doit respecter les principes de sécurité et d'utilisation responsable.

---

# 📜 Licence & crédits

Le projet est publié sous licence **MIT** (voir le fichier `LICENSE`).
Les dépendances externes restent soumises à leurs licences respectives — l'utilisation ou la redistribution d'un composant tiers doit respecter les conditions de sa licence.

### Crédits et licences tierces

Le dossier `plugins/core/` reprend du code de **« Silva MD Bot » (Silva Tech Nexus)**, publié sous licence MIT (<https://github.com/SilvaTechB/silva-md-bot>). Conformément à cette licence, l'avis de copyright d'origine est **conservé dans le fichier `NOTICE`** — ne pas le supprimer. Les anciens services liés à cette identité (`.getcode`, `.silvatech`, `.call`, la famille `.lend`…) ont été retirés du code source ; les équivalents `.repo`, `.support` et `.ia` sont désormais 100 % maison.

---

# ⚠️ AVERTISSEMENT FINAL

> **DJOUSSE-TECH-MD est fourni comme un outil logiciel.**
>
> L'utilisateur est responsable de la manière dont il configure et utilise son installation.
>
> Le projet ne doit pas être utilisé pour le spam, le harcèlement, la surveillance clandestine, la fraude, l'usurpation, le vol de données, les logiciels malveillants ou toute autre activité abusive ou illégale.
>
> L'utilisateur doit respecter les conditions applicables aux services utilisés, les droits des autres utilisateurs et les lois applicables dans sa juridiction.
>
> DJOUSSE TECH ne garantit pas l'absence de déconnexion, de restriction de compte, d'erreur technique ou d'indisponibilité d'un service tiers.
>
> **Utilisez l'automatisation de manière responsable.**

---

## 📚 Ressources

- 🌐 **Site** : [djousse-tech-md.vercel.app](https://djousse-tech-md.vercel.app)
- 🎨 **Portfolio** : [beaute-gar.github.io/Beaute-Gar](https://beaute-gar.github.io/Beaute-Gar/)
- 📦 **Baileys** : [github.com/WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys)
- ⬇️ **yt-dlp** : [github.com/yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp)

---

<div align="center">

<img
  src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=500&size=14&duration=4200&pause=1300&color=00b894&center=true&vCenter=true&width=560&lines=Tape+.menu+pour+commencer;Des+solutions+fiables+pour+un+avenir+sans+limites"
  alt="Tape .menu pour commencer"
/>

⭐ **Si le projet vous est utile, pensez à lui laisser une étoile.**

**MIT** © [Beaute-Gar](https://github.com/Beaute-Gar) · `Made with ❤️ by DJOUSSE TECH`

</div>

## Structure du projet

```text
DJOUSSE-TECH-MD/
├── index.js            point d'entrée
├── src/
│   ├── config/         config.js, style.js, paths.js (tous les chemins)
│   ├── handlers/       handler.js (messages & évènements)
│   ├── plugins/        commandes du bot (plugins/core)
│   ├── lib/            utilitaires et services
│   ├── guard/          protections de groupe
│   ├── ludo/           module Ludo
│   └── assets/         images du bot
├── web/                site (public/), API Vercel (api/), scripts (scripts/)
├── deployment/         Dockerfile, compose, Fly, Render, vercel.json
├── storage/            sessions, data, logs, downloads, bin (ignoré par git)
├── scripts/            audit.js, service.js (watchdog), outils
├── test/  docs/
└── .env  package.json  Procfile  app.json  .replit
```

Docker : `docker compose -f deployment/docker-compose.yml up -d --build`.
Fly : `fly deploy --config deployment/fly.toml --dockerfile deployment/Dockerfile`.
Voir `deployment/README.md`.
