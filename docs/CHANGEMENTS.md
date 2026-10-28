# Changements de la restructuration

## Phases et commits

| Phase | Commit(s) | Résultat |
|---|---|---|
| 0 — référence | `ee830c6` | Branche `restructuration`, snapshot de référence dans `scripts/baseline.json`. |
| 1 — doublons morts | `3cff1a1` | Suppression de 25 plugins qui n’enregistraient aucune commande et n’étaient référencés par aucun `require`; registre inchangé. |
| 2 — noms et alias | `bf4b631` | Règles centralisées dans `src/commandes/_regles.js`; familles de fonctions indépendantes séparées; au plus un alias joignable par commande. |
| 3 — catégories | `3a6a1d8` | Plugins déplacés sous `src/commandes/`, découverte récursive, chemins vérifiés. |
| 4 — commandes maison | `1aa906b` | 101 modules maison par commande et chargeur `src/commandes/_maison.js`; les enregistrements restent à leur position historique. |
| 5 — classement validé | `55d2df5`, `f2c5ee4`, `a9429b5` | Corrections de catégories validées, collisions de fichiers résolues, calculatrice consolidée. |
| 6 — smoke et documentation | commit de cette phase | Harnais isolé, corrections de bugs déterministes, inventaire et rapports générés. |

## Chiffres vérifiés

| Mesure | Référence | État final |
|---|---:|---:|
| Commandes distinctes | 851 | 1 153 |
| Clés du registre (noms + alias joignables) | 1 600 | 1 589 |
| Alias par commande | non limité | 0 ou 1 |
| Alias joignables | 749 | 436 |
| Lignes physiques de `src/handlers/handler.js` | 4 341 | 2 709 |

La baisse de 313 alias joignables comprend **11 clés supprimées explicitement** et **302 noms conservés devenus des commandes principales** lorsque les anciennes familles ont été séparées. Elle ne représente donc pas 313 fonctionnalités supprimées.

Répartition finale des 1 153 commandes : catégorie 1 **14**, 2 **155**, 3 **90**, 4 **112**, 5 **255**, 6 **23**, 7 **223**, 8 **16**, 9 **145**, 10 **87**, 11 **24**, 12 **1**, catégorie 99 « hors menus » **8**.

## Fichiers supprimés

### Plugins morts supprimés en phase 1

Ces modules ne pouvaient pas ajouter de commande au registre et aucun autre fichier ne les référençait :

- `src/plugins/core/antibot.js`
- `src/plugins/core/antifake.js`
- `src/plugins/core/antilink.js`
- `src/plugins/core/antispam.js`
- `src/plugins/core/autostatus.js`
- `src/plugins/core/broadcast.js`
- `src/plugins/core/grouplink.js`
- `src/plugins/core/hangman.js`
- `src/plugins/core/ip.js`
- `src/plugins/core/kick.js`
- `src/plugins/core/listadmins.js`
- `src/plugins/core/lock.js`
- `src/plugins/core/ping.js`
- `src/plugins/core/poll.js`
- `src/plugins/core/react.js`
- `src/plugins/core/remind.js`
- `src/plugins/core/rhyme.js`
- `src/plugins/core/riddle.js`
- `src/plugins/core/roast.js`
- `src/plugins/core/settings.js`
- `src/plugins/core/sticker.js`
- `src/plugins/core/sudo.js`
- `src/plugins/core/tictactoe.js`
- `src/plugins/core/translate.js`
- `src/plugins/core/trivia.js`

Le snapshot par clé était identique avant et après cette suppression.

### Fichiers remplacés ou fusionnés ensuite

- `src/commandes/05-outils/menu.js`
- `src/commandes/06-ia/owner.js`
- `src/commandes/06-ia/setbio.js`
- `src/commandes/06-ia/uptime.js`
- `src/commandes/09-owner/calc.js`

Les quatre premiers étaient des fichiers en collision avec des commandes maison ou placés dans la mauvaise catégorie; les commandes maison concernées sont conservées sous des noms `*-maison.js`. L’ancienne calculatrice `calc` a été fusionnée avec celle de `05-outils/calc.js`.

## Noms retirés du registre

Les 11 clés retirées, affichées explicitement :

`ask`, `assistant`, `commands`, `do`, `math`, `pollstats`, `silva`, `textart`, `tovn`, `votes`, `ytv`.

Les suppressions de phase 2 sont des synonymes redondants ou l’ancien nom de marque. `math` a été retiré lors de la fusion calculatrice : `calc` reste le nom principal et `calculate` son alias; les expressions `Math.*` et `**` sont prises en charge. Aucun nom retiré n’est caché dans le chargeur.

## Familles examinées et séparées

Les 46 entrées historiques multi-noms passées par la normalisation des familles sont : `acceptall`, `analytics`, `expense`, `addnote`, `ebinary`, `groupstatus`, `advancedglow`, `djousse`, `topanime`, `anime`, `antiscam`, `google`, `figlet`, `tomp3`, `awaymsg`, `backupgroup`, `hug`, `ban`, `setbgm`, `save`, `recording`, `forward`, `dailychallenge`, `newsletter`, `rremind`, `help`, `vcfgen`, `encode`, `setgreet`, `tempinbox`, `rules`, `games`, `pair`, `floodoff`, `livescore`, `imgbb`, `setwelcome`, `waifu`, `subbot`, `rank`, `play`, `pollresult`, `welcomequiz`, `toptt`, `theme`, `yt`.

Les fonctions distinctes de ces familles sont maintenant des entrées séparées. Les seuls couples de synonymes retenus comme nom + alias par la table `ALIAS_FAMILLES` sont : `anime`/`animesearch`, `scamcheck`/`checkscam`, `awaymsg`/`setaway`, `djousse`/`agent`, `figlet`/`art`, `help`/`cmds`, `pollresult`/`pollresults`, `theme`/`themes`, `tomp3`/`audio`, `ytmp4`/`ytvideo`. Le catalogue généré donne le nom principal et l’alias actuellement joignable de chaque entrée.

## Commandes maison extraites de `handler.js`

Les 101 modules extraits sont répartis ainsi :

- `01-general` : `claim`, `diag`, `info`, `list`, `menu-maison`, `owner-maison`, `ping`, `source`, `uptime-maison`
- `02-groupe` : `close`, `demote`, `disappear`, `groupinfo-maison`, `hidetag-maison`, `kick`, `link`, `open`, `pin`, `poll`, `promote-maison`, `revoke`, `setdesc`, `setname`, `tagall-maison`, `unpin`
- `03-protection` : `blacklist`, `unblacklist`, `unwarn`, `warn`, `warnings`
- `04-sticker-media` : `autonce`, `sticker`, `take`, `toaudio-maison`, `toimg`, `viewonce-maison`, `vv`
- `05-outils` : `base64`, `binary`, `calc`, `del`, `edit`, `location`, `qr`, `react`, `translate`, `weather`
- `06-ia` : `ai-maison`, `analyse`, `ia`, `summarize-maison`
- `07-fun` : `8ball-maison`, `choose`, `coin`, `joke-maison`, `rate`, `roll`, `ship-maison`
- `08-recherche` : `convert`, `github`, `wiki`
- `09-owner` : `accept`, `accepted`, `archive`, `authcode`, `autolike`, `autostatus`, `autoview`, `block`, `broadcast`, `chatlog`, `conflicts`, `derniers`, `join`, `journal`, `leave`, `mutechat`, `public`, `read`, `self`, `setbio-maison`, `setbotname`, `setpp`, `statut`, `sudo`, `unaccept`, `unblock`, `unmutechat`, `unpause`
- `10-divers` : `afk`, `event`, `level`, `repo`, `report`, `stats`, `support`, `vcard`
- `11-telechargement` : `play`, `video`, `yt-maison`
- `12-archives` : `archives`

`handler.js` conserve le moteur : état et cache, contexte et permissions, fonctions partagées, dispatch et menus. `setmenuimg` reste enregistré dans le handler car son cache est réaffecté localement. Les commandes issues de boucles et de registres — notamment les tables de bascules et les commandes `guard` — restent générées à leur emplacement d’origine afin de préserver l’ordre « dernier enregistrement gagnant ».

Les plugins hérités qui déclarent plusieurs commandes dans un même fichier ont conservé leur fichier source, conformément à l’étape de déplacement qui imposait de garder les noms indexés par le chargeur. Les 101 extractions ci-dessus concernent les commandes maison du handler; la séparation physique de tous les modules plugins multi-commandes n’a pas été faite.

## Corrections de bugs effectuées

- `broadcast` ne dépend plus de la variable inexistante `msgCache`; il obtient les conversations récentes depuis le cache de messages partagé.
- `device` affiche le nom du pays renvoyé par `getCountry()` au lieu de sérialiser son objet en `[object Object]`.
- Les réglages Anti-Flood normalisent les deux formes de configuration historiques (`limit/window` et `maxMsg/timeWindow`), évitant une réponse contenant `undefined`.
- `news` et `tts` importent leur configuration. `news` répond maintenant clairement lorsque les services réseau ne sont pas disponibles, au lieu de terminer silencieusement.
- `newsletter` et `botsettings` utilisent les propriétés réellement définies et n’affichent plus `undefined`.
- Les commandes BGM utilisent une API cohérente et annoncent explicitement que l’autodiffusion audio reste désactivée pour protéger le compte; aucune automatisation d’envoi audio n’a été réactivée.
- Le cache des messages expose la liste des chats présents pour la commande `broadcast`; un test unitaire couvre cette liste.
- Le store JSON a un arrêt explicite pour que le smoke test puisse fermer proprement son stockage temporaire.

## Smoke test et limites

`scripts/smoke.js` teste **1 139** commandes non exclues : **1 138 OK**, **1 PLANTE** (la commande `yt`, dont le réseau est volontairement bloqué), **0 SILENCIEUSE**, **0 UNDEFINED**, **0 TIMEOUT**. Les 14 commandes exclues (internes, redémarrage, shell, exécution de code, reset, logout et diffusion de masse) sont listées dans `docs/SMOKE.md`.

Le script bloque le réseau, redirige les écritures vers un dossier temporaire et fournit un faux `sock`. **Aucune commande n’a été essayée sur un vrai compte, un vrai groupe ou un vrai réseau WhatsApp.** Les commandes qui nécessitent les API WhatsApp, le réseau ou des médias réels restent signalées comme non vérifiables dans `reports/smoke.json` et `docs/SMOKE.md`.
