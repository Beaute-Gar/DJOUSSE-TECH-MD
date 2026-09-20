# DJOUSSE-TECH-MD — Guide d'installation

## Pre-requis
- Node.js >= 20 (testé avec v24.16.0)
- npm >= 9

## Installation rapide
```bash
# Windows
install.bat

# Linux/Mac
npm install --legacy-peer-deps
```

## Dependances par groupe

### 1. Core Baileys
| Package | Role |
|---|---|
| @whiskeysockets/baileys@7.0.0-rc.2 | Coeur du bot, connexion WhatsApp |
| @hapi/boom | Gestion des erreurs Baileys |
| pino | Logs JSON performants |
| pino-pretty | Logs lisibles en dev |
| qrcode-terminal | QR code dans le terminal |

### 2. Boutons interactifs
| Package | Role |
|---|---|
| @qadeerxtech/qadeer-btns | Boutons WhatsApp (sendButtons, sendInteractiveMessage) |

### 3. Medias
| Package | Role |
|---|---|
| sharp | Redimensionnement images rapide |
| jimp | Manipulation images (fallback) |
| fluent-ffmpeg | Conversion audio/video |
| ffmpeg-static | Binaire ffmpeg auto-installe |
| file-type | Detection type fichier |
| mime-types | Conversion extension -> MIME |
| image-size | Dimensions images |

### 4. Stickers
| Package | Role |
|---|---|
| wa-sticker-formatter | Conversion en stickers WebP |
| node-webpmux | Metadonnees EXIF stickers |

### 5. Telechargement
| Package | Role |
|---|---|
| axios | Requetes HTTP |
| node-fetch | Fetch moderne |
| @distube/ytdl-core | Telechargement YouTube |
| play-dl | YouTube, Spotify, SoundCloud |
| yt-search | Recherche YouTube |
| cheerio | Scraping HTML |

### 6. Base de donnees
| Package | Role |
|---|---|
| better-sqlite3 | SQLite local rapide |
| @supabase/supabase-js | Base cloud |
| fs-extra | Operations fichiers avancees |

### 7. Utilitaires
| Package | Role |
|---|---|
| moment / dayjs | Formatage dates |
| chalk / colors | Couleurs console |
| dotenv | Variables d'environnement |
| uuid | Identifiants uniques |
| ms / humanize-duration | Conversion durees |
| cli-table3 | Tableaux console |

### 8. Serveur web
| Package | Role |
|---|---|
| express | Serveur web (pairing, webhooks) |
| cors | Autorisation cross-origin |
| helmet | Securite en-tetes HTTP |

### 9. Securite
| Package | Role |
|---|---|
| bcrypt | Hash mots de passe |
| jsonwebtoken | Tokens API |
| validator | Validation entrees |

### 10. Dev
| Package | Role |
|---|---|
| nodemon | Redemarrage auto en dev |

## Commandes de test
```bash
# Verifier les packages
npm list --depth=0

# Tester Baileys
node -e "const b = require('@whiskeysockets/baileys'); console.log('Baileys OK:', Object.keys(b).length, 'exports')"

# Tester boutons
node -e "const g = require('gifted-btns'); console.log('Boutons OK:', Object.keys(g))"

# Tester sharp
node -e "const s = require('sharp'); console.log('Sharp OK:', s.versions)"

# Tester better-sqlite3
node -e "const db = require('better-sqlite3')(':memory:'); db.exec('CREATE TABLE test(id INTEGER)'); console.log('SQLite OK')"

# Tester express
node -e "const e = require('express'); console.log('Express OK:', e().name)"
```

## Problemes connus

### sharp echoue sur Windows
```bash
npm install --platform=win32 --arch=x64 sharp
```

### better-sqlite3 echoue
Installer Visual Studio Build Tools ou utiliser sqlite3.

### Peer dependency warnings
```bash
npm install --legacy-peer-deps
```

## Fichiersimportants
- `package.json` — dependances
- `package.json.backup` — sauvegarde avant installation
- `install.bat` — reinstallation rapide Windows
