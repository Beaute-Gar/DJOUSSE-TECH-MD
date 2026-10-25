# DJOUSSE TECH MD — Améliorations Baileys (sans boutons interactifs)

Projet mis à jour à partir de ton code d’origine. **Aucun bouton / liste interactive / carousel** n’a été ajouté.

## Fichiers modifiés

| Fichier | Changements |
|---------|-------------|
| `config.js` | `linkPreview`, `msgCacheMax`, `defaultEphemeral` |
| `index.js` | `getMessage` branché, `generateHighQualityLinkPreview`, event `messages.update` |
| `handler.js` | Cache messages élargi, `getMessageForBaileys`, nouvelles commandes, `handleMessagesUpdate` |
| `style.js` | Inchangé |

## Nouvelles commandes

| Commande | Cat. | Description |
|----------|------|-------------|
| `.edit <texte>` | Outils | Modifier un message du bot (répondre au message) |
| `.pin` | Groupe | Épingler 24h (répondre, admin + bot admin) |
| `.unpin` | Groupe | Désépingler |
| `.disappear off\|24h\|7d\|90d` | Groupe | Messages éphémères du chat |
| `.react 🔥` | Outils | Réagir au message cité |
| `.del` | Outils | Supprimer le message cité (pour tous si possible) |
| `.mutechat [heures]` | Owner | Sourdine du chat courant |
| `.unmutechat` | Owner | Retirer la sourdine |
| `.archive [on\|off]` | Owner | Archiver / désarchiver le chat |
| `.setpp` | Owner | Photo de profil du bot (répondre à une image) |
| `.setbotname <nom>` | Owner | Nom affiché du bot |
| `.setbio <texte>` | Owner | Bio / status WhatsApp du bot |
| `.read` | Owner | Marquer comme lu |

Déjà présents et conservés : `.block`, `.unblock`, protections Guard, menu chiffres, stickers, IA, téléchargements, etc.

## Fondations techniques

1. **`getMessage`** — Baileys peut maintenant retrouver les messages en cache (retry, votes de sondages, édition).
2. **Cache messages** — jusqu’à `MSG_CACHE_MAX` (défaut 800) entrées, partagé antidelete + getMessage.
3. **`messages.update`** — met à jour le cache sur édition ; log des votes de sondage.
4. **Link preview** — `generateHighQualityLinkPreview` (désactivable via `LINK_PREVIEW=false`).

## Variables `.env` optionnelles

```env
LINK_PREVIEW=true
MSG_CACHE_MAX=800
DEFAULT_EPHEMERAL=0
```

## Installation

Remplace les fichiers dans ton projet existant (garde `package.json`, `guard/`, `session/`, `.env`) :

```bash
cp config.js handler.js index.js style.js /chemin/vers/ton/bot/
# redémarre le bot
```

## Non inclus (comme demandé)

- Boutons interactifs, listes natives, carousels, native flow
- Communities / Newsletters (peuvent être ajoutés plus tard)
- Store SQLite complet (le cache RAM + state.json suffit pour la majorité des cas)
- Appels sortants (risqué)

## Prochaines étapes possibles

- Store SQLite pour historique long
- Support Communities / Channels
- Scheduler de messages
- Multi-session

## Modules avancés (ajoutés)

| Feature | Commandes | Notes |
|---------|-----------|--------|
| Store JSON + SQLite optionnel | automatique | `session/store/` — `npm i better-sqlite3` pour SQLite |
| Scheduler | `.schedule` `.schedules` `.unschedule` | Persisté dans `session/scheduler.json` |
| Albums | `.album` | Natif si Baileys le supporte, sinon image simple |
| Sticker pack | `.stickerpack` | Natif ou fallback sticker |
| Channels | `.chfollow` `.chunfollow` `.chmsg` `.chcreate` | Selon API du fork Baileys |
| Communities | `.community create\|link` | groupCreate / invite |
| Catalog / PIX | `.product` `.pix` | productMessage si dispo + texte |
| Multi-session | `.sessions` | Guide `SESSION_DIR=sessions/compte2` |
| Appels | `.callinfo` `.calllink` | **Pas d'appel sortant bot** (risque ban) — liens wa.me |

### Install optionnelle SQLite
```bash
npm i better-sqlite3
```
