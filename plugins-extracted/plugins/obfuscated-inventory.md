# INVENTAIRE DES PLUGINS OBFUSQUÉS

> Généré le 31/07/2026 — 52 plugins obfusqués (obfuscator.io, 2-3 lignes, illisibles).
> Ces plugins sont chargés par `index.cjs` (`require()` de chaque `.cjs` dans `plugins/`)
> mais leur code ne peut pas être audité. Risque de patterns en collision, d'API externes
> non maintenues et de comportement inconnu.

## ⚠️ DÉCOUVERTE CRITIQUE (test de chargement réel, 31/07/2026)

**Les 52 plugins obfusqués ne se chargent PAS en production.** Ils utilisent `require('../command')`
sans extension `.cjs` — or Node.js ne résout pas automatiquement l'extension `.cjs` dans `require()`.
Résultat : chaque `require()` échoue (`Cannot find module '../command'`), l'erreur est avalée par le
try/catch de `index.cjs`, et **les commandes de ces plugins sont absentes du bot en prod**.

- 63 plugins chargés correctement (utilisent `require('../command.cjs')`).
- 52 plugins échouent : 51 obfusqués + `movie.cjs` (pourtant lisible, 196 lignes).
- Erreurs : 49× `Cannot find module '../command'`, 1× `../lib/functions` (`download.cjs`),
  1× `../config` (`restart_bot.cjs`), 1× `../command` (`movie.cjs`).

**Conséquences pratiques** : `.tiktok`, `.song`, `.summarize`, `.movie`, `.system`, `.allmenu`,
`.calculator`, etc. ne répondent actuellement PAS — ils ne sont jamais enregistrés dans `command.cjs`.

**Options de correction** :
1. Réparer (re-export shims) : créer `command.js`, `lib/functions.js`, `config.js` qui re-exportent
   les `.cjs` → réactiverait 52 plugins dont le code est illisible (risque sécurité).
2. Laisser en l'état (statut quo) : ces commandes restent absentes, aucune désactivation nécessaire.
3. Réécrire les plugins importants proprement (recommandé) puis supprimer les obfusqués.

## Liste des 52 plugins obfusqués

| # | Fichier | Taille | Risque | Action recommandée |
|---|---------|--------|--------|--------------------|
| 1 | `ai-chat.cjs` | 8 356 o | 🟠 Moyen | Réécrire proprement |
| 2 | `aimusic.cjs` | 9 553 o | 🟠 Moyen | Réécrire proprement |
| 3 | `allmenu.cjs` | 6 965 o | 🟠 Moyen | Réécrire / fusionner dans menu |
| 4 | `anime.cjs` | 17 278 o | 🟢 Bas | Réécrire proprement |
| 5 | `anime_effect_image_edit.cjs` | 4 809 o | 🟢 Bas | Réécrire proprement |
| 6 | `antidelete.cjs` | 10 101 o | 🟠 Moyen | Réécrire (déjà couvert par ANTI_DELETE) |
| 7 | `apk.cjs` | 6 941 o | 🟠 Moyen | Réécrire proprement |
| 8 | `ask.cjs` | 4 433 o | 🟠 Moyen | Réécrire proprement |
| 9 | `base64.cjs` | 3 098 o | 🟢 Bas | Réécrire (simple) |
| 10 | `calculator.cjs` | 3 991 o | 🟢 Bas | Réécrire (simple) |
| 11 | `convert.cjs` | 12 956 o | 🟠 Moyen | Réécrire proprement |
| 12 | `currency_.cjs` | 7 143 o | 🟠 Moyen | Réécrire (API exchange rate) |
| 13 | `dare.cjs` | 4 249 o | 🟢 Bas | Réécrire (liste statique) |
| 14 | `developer.cjs` | 5 125 o | 🟢 Bas | Réécrire proprement |
| 15 | `dictionary.cjs` | 3 992 o | 🟠 Moyen | Réécrire (API dictionnaire) |
| 16 | `direct.cjs` | 10 354 o | 🟠 Moyen | Réécrire proprement |
| 17 | `download.cjs` | 13 622 o | 🟠 Moyen | Réécrire proprement |
| 18 | `fact.cjs` | 2 620 o | 🟢 Bas | Réécrire (liste statique) |
| 19 | `fb.cjs` | 8 557 o | 🟠 Moyen | Réécrire (API Facebook) |
| 20 | `fun_menu.cjs` | 9 578 o | 🟢 Bas | Réécrire proprement |
| 21 | `games_menu.cjs` | 24 016 o | 🟠 Moyen | Réécrire proprement |
| 22 | `group.cjs` | 27 245 o | 🟠 Moyen | Réécrire proprement |
| 23 | `image.cjs` | 7 092 o | 🟠 Moyen | Réécrire (IA image) |
| 24 | `image_college_maker.cjs` | 6 852 o | 🟢 Bas | Réécrire proprement |
| 25 | `imageurl.cjs` | 4 499 o | 🟢 Bas | Réécrire proprement |
| 26 | `img2sticker.cjs` | 4 018 o | 🟢 Bas | Réécrire proprement |
| 27 | `instagram.cjs` | 8 311 o | 🟠 Moyen | Réécrire (API Instagram) |
| 28 | `jid.cjs` | 3 536 o | 🟢 Bas | Réécrire (simple) |
| 29 | `joke_.cjs` | 2 538 o | 🟢 Bas | Réécrire (liste statique) |
| 30 | `logo.cjs` | 30 240 o | 🟠 Moyen | Réécrire proprement |
| 31 | `memes.cjs` | 3 076 o | 🟢 Bas | Réécrire proprement |
| 32 | `nova.cjs` | 2 989 o | 🟠 Moyen | Réécrire proprement |
| 33 | `nsfwai.cjs` | 4 217 o | 🔴 Critique | **Désactiver** (contenu NSFW) |
| 34 | `pinterest_download.cjs` | 5 519 o | 🟠 Moyen | Réécrire (API Pinterest) |
| 35 | `quotes.cjs` | 2 592 o | 🟢 Bas | Réécrire (liste statique) |
| 36 | `restart_bot.cjs` | 3 473 o | 🔴 Élevé | Réécrire (contrôle process) |
| 37 | `setting.cjs` | 4 590 o | 🟠 Moyen | Réécrire proprement |
| 38 | `song.cjs` | 9 482 o | 🟠 Moyen | Réécrire (API musique) |
| 39 | `spotify.cjs` | 4 544 o | 🟠 Moyen | Réécrire (API Spotify) |
| 40 | `summarize.cjs` | 3 785 o | 🟠 Moyen | Réécrire (IA résumé) |
| 41 | `system.cjs` | 7 132 o | 🟠 Moyen | Réécrire (infos système) |
| 42 | `text_to_speech_.cjs` | 4 577 o | 🟢 Bas | Réécrire (TTS) |
| 43 | `tiktok.cjs` | 8 036 o | 🟠 Moyen | Réécrire (API TikTok) |
| 44 | `tofigure.cjs` | 5 251 o | 🟠 Moyen | Réécrire proprement |
| 45 | `tool.cjs` | 32 987 o | 🟠 Moyen | Réécrire proprement |
| 46 | `Tourl.cjs` | 3 088 o | 🟢 Bas | Réécrire (shortlink) |
| 47 | `truth_game.cjs` | 4 247 o | 🟢 Bas | Réécrire (liste statique) |
| 48 | `video.cjs` | 9 010 o | 🟠 Moyen | Réécrire (téléchargement vidéo) |
| 49 | `vv.cjs` | 4 348 o | 🟢 Bas | Réécrire (view-once) |
| 50 | `waifu_.cjs` | 3 178 o | 🟢 Bas | Réécrire (API waifu) |
| 51 | `website_screenshot.cjs` | 5 514 o | 🟠 Moyen | Réécrire (screenshot) |
| 52 | `yts.cjs` | 6 075 o | 🟠 Moyen | Réécrire (API YouTube) |

## Plan d'action

### Phase 1 — URGENT (sécurité)
- Désactiver `nsfwai.cjs` (contenu inapproprié, violation conditions WhatsApp).
- Désactiver `restart_bot.cjs` (contrôle process illisible, risque sécurité).

### Phase 2 — IMPORTANT (fiabilité)
- Désactiver par défaut les 50 autres et réécrire au besoin, groupe par groupe.
- Commencer par les critiques pour le bot : `allmenu`, `antidelete`, `system`, `setting`.

### Phase 3 — OPTIONNEL
- Réécrire les utilitaires simples (`base64`, `calculator`, `joke_`, `fact`, `quotes`, `dare`, `truth_game`, `jid`, `Tourl`, `vv`) — faciles à remplacer par du code propre.

## Comment désactiver (script)

```bash
node scripts/disable-obfuscated-plugins.cjs
# Déplace les plugins obfusqués vers plugins/disabled/ (ignorés par index.cjs)
```

> Note : `index.cjs` scanne `plugins/*.cjs` en non-récursif → les fichiers dans
> `plugins/disabled/` ne sont pas chargés. Renommer en `_fichier.cjs` ne suffit PAS.
