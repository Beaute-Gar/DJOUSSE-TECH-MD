<div align="center">

# 🤖 DJOUSSE TECH MD

**Bot WhatsApp intelligent — DJOUSSE TECH EVOLUTION**

<img
  src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=20&duration=3000&pause=900&color=2ECC71&center=true&vCenter=true&width=680&lines=187+commandes+%C2%B7+11+cat%C3%A9gories;Moteur+DJOUSSE+GUARD+%C2+B7+13+protections;IA+Gemini+%C2%B7+Stickers+%C2%B7+T%C3%A9l%C3%A9chargements;Z%C3%A9ro+bouton+natif+%C2%B7+100%25+texte"
  alt="187 commandes · 11 catégories · Moteur DJOUSSE GUARD · IA Gemini"
/>

<br/>

<img src="https://img.shields.io/badge/version-4.0.0-2ECC71?style=flat-square" alt="Version 4.0.0" />
<img src="https://img.shields.io/badge/commandes-187-00b894?style=flat-square" alt="187 commandes" />
<img src="https://img.shields.io/badge/cat%C3%A9gories-11-111b26?style=flat-square" alt="11 catégories" />
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

</div>

---

## 🎯 Pourquoi ce bot

DJOUSSE TECH MD est un assistant WhatsApp complet écrit en **JavaScript / Node.js** sur la bibliothèque [Baileys](https://github.com/WhiskeySockets/Baileys) (WhatsApp Web multi-appareils, **sans compte WhatsApp Business**).

Il se distingue par trois piliers :

| Pilier | Ce que ça change |
|---|---|
| 🧠 **Un seul cerveau** | `handler.js` centralise **toutes** les commandes — `index.js` ne fait que la connexion. |
| 🛡️ **DJOUSSE GUARD** | Un moteur de protections de groupe **isolé dans `guard/`**, testé et ordonné par priorité. |
| 🎨 **Zéro bouton natif** | 100 % messages texte et menu par chiffres — fonctionne partout, même sur les vieux clients. |

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
- `yt-dlp` embarqué (`vendor/`)

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
- `.schedule` — planification
- `.block`, `.mutechat`, `.archive`

</td>
</tr>
</table>

---

## 🗂️ Les 11 catégories

Le menu **`.menu`** s'ouvre sur un pavé numérique de `1` à `11` — on tape un chiffre, on a la catégorie.

| # | Catégorie | | Commandes |
|:-:|---|:-:|--:|
| 1 | 🌟 **GÉNÉRAL** | | 8 |
| 2 | 👥 **GROUPE** | | 25 |
| 3 | 🛡️ **PROTECTION** | | 40 |
| 4 | 🖼️ **STICKER & MEDIA** | | 26 |
| 5 | 🧰 **OUTILS** | | 16 |
| 6 | 🤖 **IA** | | 3 |
| 7 | 🎲 **FUN** | | 14 |
| 8 | 🔍 **RECHERCHE** | | 3 |
| 9 | 👑 **OWNER** | | 38 |
| 10 | 📦 **DIVERS** | | 11 |
| 11 | ⬇️ **TÉLÉCHARGEMENT** | | 3 |
| | | **Total** | **187** |

> **+ 93 alias** (280 entrées au registre) — par exemple `.s` → `sticker`, `.tr` → `translate`, `.bc` → `broadcast`.

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

---

## 🚀 Installation

### 1. Prérequis

- **Node.js ≥ 18** (testé sur 20)
- Un numéro WhatsApp **secondaire** fortement conseillé
- `ffmpeg` est fourni via `ffmpeg-static` — rien à installer à l'extérieur

```bash
git clone https://github.com/Beaute-Gar/DJOUSSE-TECH-MD.git
cd DJOUSSE-TECH-MD
npm install
```

### 2. Configuration

Crée un fichier `.env` à la racine (il est **ignoré par git**, ne sera jamais commité) :

```env
# ── Identité ─────────────────────────────────────
BOT_NAME=DJOUSSE TECH
OWNER_NAME=Beaute Gar
OWNER_NUMBER=237693978044
AUTO_OWNER=1

# ── Commandes ────────────────────────────────────
PREFIX=.

# ── Connexion ────────────────────────────────────
# QR : laisser vide   ·   Pairing : CONNECT_METHOD=pairing
CONNECT_METHOD=
PAIRING_PHONE=

# ── IA (optionnel) ───────────────────────────────
# Sans clé, .ai renvoie un message explicite.
GEMINI_KEY=

# ── Protections par défaut ───────────────────────
ANTILINK=0
ANTI_DELETE=0
WELCOME=0
ANTI_LEFT=0

# ── DJOUSSE GUARD ────────────────────────────────
GUARD_TZ=Africa/Douala
GUARD_LOG=0
GUARD_DB=guard.json

# ── Modes ────────────────────────────────────────
MODE=public
REJECT_CALL=1
AUTO_READ=1
LINK_PREVIEW=1
MSG_CACHE_MAX=800
```

### 3. Lancement

```bash
npm start        # lance d'abord l'audit, puis le bot
```

Un **QR code** s'affiche dans le terminal → WhatsApp › Appareils connectés › Connecter un appareil.
Les credentials sont écrits dans `session/` (ignoré par git).

> 💡 `npm run audit` s'exécute tout seul avant chaque démarrage (`prestart`).
> `npm run check` valide la syntaxe des 4 fichiers principaux.

---

## 🏗️ Architecture

```
DJOUSSE-TECH-MD/
├── index.js          # Point d'entrée : connexion Baileys, QR/pairing, reconnexion
├── handler.js        # 🧠 Cerveau unique — 187 commandes, menu, moteur d'événements
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
│   ├── scheduler.js  # .schedule / .schedules / .unschedule
│   └── wa-send.js    # 🔑 Service d'envoi unique — tout envoi passe par send()
│
├── ludo/             # 🎲 Moteur de jeu Ludo (plateau, règles, rendu canvas)
├── plugins/          # Plugins extensibles
├── scripts/audit.js  # 🔍 Audit de démarrage (sécurité, deps, structure)
├── tests/            # ✅ node --test
├── vendor/yt-dlp.exe # ⬇️ Auto-téléchargé au premier usage
└── session/          # 🔒 Credentials + état (gitignoré)
```

**Flux d'un message :**

```
index.js  ──messages.upsert──▶  handler.js
                                  ├─ 1. DJOUSSE GUARD   (protections, AVANT tout)
                                  ├─ 2. Parseur texte   (prefix + commande)
                                  ├─ 3. Permissions     (owner / admin / groupe)
                                  └─ 4. Exécution       → lib/wa-send.send()
```

---

## ✅ Audit & tests

```bash
npm run audit          # sécurité, cohérence des dépendances, structure
npm run audit:deps     # audit des dépendances uniquement
npm run check          # node --check sur index / handler / config / audit
node --test tests/*.test.js
```

L'audit est décrit dans [`DIAGNOSTIC.md`](./DIAGNOSTIC.md), les correctifs historiques dans [`CHANGELOG.md`](./CHANGELOG.md) et la feuille de route dans [`AMELIORATIONS.md`](./AMELIORATIONS.md).

---

## ⚠️ Limites honnêtes

Transparence sur l'état réel du projet :

- Les tests ont été exécutés avec de **faux modules** (`sharp`, `ffmpeg`…) et un faux socket — la connexion réelle n'est pas testée dans la CI.
- Le format « mention de statut » couvre **3 variantes**, à confirmer sur un vrai WhatsApp.
- Les protections partagent encore deux parseurs de texte (`textOf`/`ctxInfo` côté handler, `parse` côté guard) : rôles distincts, **non fusionnés par prudence**.
- Aucun bouton natif, liste ni carrousel — c'est un choix assumé, pas une omission.

---

## 📚 Ressources

- 🌐 **Site** : [djousse-tech-md.vercel.app](https://djousse-tech-md.vercel.app)
- 🎨 **Portfolio** : [gitskins.com/Beaute-Gar](https://www.gitskins.com/portfolio/Beaute-Gar/)
- 📦 **Baileys** : [github.com/WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys)
- ⬇️ **yt-dlp** : [github.com/yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp)

---

<div align="center">

<img
  src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=500&size=14&duration=4200&pause=1300&color=00b894&center=true&vCenter=true&width=560&lines=Tape+.menu+pour+commencer;Fait+avec+%E2%9D%A4%EF%B8%8F+%C3%A0+Douala"
  alt="Tape .menu pour commencer — Fait avec ❤️ à Douala"
/>

**MIT** © [Beaute-Gar](https://github.com/Beaute-Gar)

</div>
