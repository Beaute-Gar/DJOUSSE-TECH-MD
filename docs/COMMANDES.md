# Catalogue des commandes

Inventaire généré automatiquement : **1112 commandes**, **438 alias**, **1550 clés de registre**.

Chaque ligne décrit une commande principale et, au plus, un alias joignable.

## 01 — GÉNÉRAL (14)

| Commande | Alias | Description |
|---|---|---|
| `alive` | `bot` | Show bot status with full theme styling |
| `claim` | `claimsudo` | Activer un accès sudo avec un code |
| `creator` | — | Show bot owner contact information |
| `diag` | `diagnostic` | Diagnostic connexion Baileys |
| `hello` | — | Simple hello test command |
| `help` | `cmds` | Show all commands in a categorized menu — use .menu <number> for a category deep-dive |
| `info` | — | Informations du bot |
| `list` | — | Toutes les commandes |
| `menu` | — | Menu interactif par chiffres |
| `owner` | — | Contacter le propriétaire |
| `ping` | — | Latence du bot |
| `runtime` | — | Show bot uptime and system stats |
| `source` | — | Code source du bot |
| `uptime` | — | Temps de fonctionnement |

## 02 — GROUPE (115)

| Commande | Alias | Description |
|---|---|---|
| `activity` | — | View group chat analytics — top members, peak hours, activity stats |
| `addfilter` | `blockword` | Auto-delete messages containing a word. Usage: .addfilter <word> |
| `addmode` | — | Qui peut ajouter des membres |
| `admin` | `unadmin` | Promote or demote a group member (reply or mention) |
| `admins` | `@admins` | Mention all group admins |
| `analytics` | — | View group chat analytics — top members, peak hours, activity stats |
| `anon` | `anonmsg` | Send an anonymous message to this group. Only bot knows who sent it. |
| `auditlog` | `audit` | View admin action audit log — tracks kicks, promotes, demotes, settings changes |
| `automute` | — | Ferme le groupe automatiquement à une heure |
| `autounmute` | — | Ouvre le groupe automatiquement à une heure |
| `backupgroup` | — | Backup and restore group settings and configurations |
| `ban` | — | Permanently ban / unban users from using bot commands (persisted across restarts) |
| `banlist` | — | Permanently ban / unban users from using bot commands (persisted across restarts) |
| `blocknum` | `unblocknum` | Block or unblock a WhatsApp number at the account level |
| `blockuser` | — | Block a number |
| `broadcast2` | `bcastmembers` | DM a message to all members of the current group (owner only) |
| `bye2` | — | Goodbye in many languages |
| `challenge` | — | Auto-post daily trivia, puzzles, or word games in groups |
| `challengenow` | — | Auto-post daily trivia, puzzles, or word games in groups |
| `challengeoff` | — | Auto-post daily trivia, puzzles, or word games in groups |
| `channelinfo` | — | Newsletter/channel follow management |
| `chatstats` | `whotalks` | Show who talks most in this group |
| `clearfilters` | `resetfilters` | Remove all word filters from this group |
| `close` | — | Fermer le groupe (admins) |
| `commapprove` | — | Approuver une demande d’adhésion |
| `comminfo` | — | Métadonnées communauté / groupe |
| `comminvite` | — | Code / lien d’invitation |
| `commreject` | — | Refuser une demande d’adhésion |
| `commrequests` | — | Demandes d’adhésion en attente |
| `commrevoke` | — | Révoquer le lien d’invitation |
| `community` | `communaute` | Communautés WhatsApp (API native) |
| `dailychallenge` | — | Auto-post daily trivia, puzzles, or word games in groups |
| `delrules` | — | Set/show/delete group rules |
| `demote` | `removeadmin` | Retirer le statut admin |
| `disappear` | `ephemeral` | Messages éphémères du chat |
| `divorce` | — | Pair/marry two users in a group |
| `dmmembers` | `msgall` | Send a DM to every member of the current group (owner only) |
| `expense` | `expenses` | Group expense tracker and bill splitter (like Splitwise) |
| `followchannel` | — | Newsletter/channel follow management |
| `getjid` | `whois` | Advanced JID & account intelligence — user, group, business, LID, country, bio and more |
| `ginvite` | `invite` | Envoyer l'invitation du groupe en message natif |
| `glog` | — | Annoncer les changements du groupe |
| `goodbyeoff` | — | Auto-welcome new members and farewell members who leave |
| `groupbackup` | — | Sauvegarde des infos du groupe |
| `groupcron` | — | Voir les fermetures/ouvertures auto du groupe |
| `groupinfo` | `ginfo` | Infos groupe; admins, stats, activité, historique, âge et export via sous-commandes |
| `grouprules` | — | Règles du groupe |
| `hidetag` | — | Mention invisible |
| `htag` | `stag` | Silently mention all group members — they get notified but are not visibly tagged |
| `inviteinfo` | — | Infos d'un lien d'invitation |
| `invitelink` | `groupinvite` | Get the group invite link (bot must be admin) |
| `joingroup` | — | Join a group by link |
| `joinmode` | — | Entrée des membres sur approbation |
| `joinv4` | — | Accepter une invitation V4 (répondre à la carte) |
| `kick` | `remove` | Expulser un membre |
| `leaderboard` | `lb` | XP leveling system — earn XP by chatting, unlock titles |
| `leavegroup` | `quit` | Leave a group |
| `link` | `grouplink` | Lien d’invitation |
| `listadmins` | — | Liste des admins du groupe |
| `listbackups` | — | Backup and restore group settings and configurations |
| `listblock` | — | Show the bot's blocked numbers list — owner only |
| `listfilters` | `filterlist` | List active word filters in this group |
| `listmembers` | `members` | Liste des membres (rôles + compteurs) |
| `lock` | — | Verrouiller le groupe (admins) |
| `marry` | — | Pair/marry two users in a group |
| `massbc` | — | Broadcast to all groups |
| `mentionall` | `pingall` | Mention all members in the group |
| `mutechannel` | — | Newsletter/channel follow management |
| `mutelist` | — | Mute/unmute specific members (bot removes their messages automatically) |
| `muteuser` | — | Mute a user in group |
| `mygroups` | — | Tous les groupes où est le bot |
| `newsletter` | — | Newsletter/channel follow management |
| `note` | `notes` | Notes personnelles et de groupe : add, list, get, update, delete, clear |
| `open` | — | Ouvrir le groupe |
| `pair` | — | Pair/marry two users in a group |
| `peakhours` | — | View group chat analytics — top members, peak hours, activity stats |
| `pin` | — | Épingler un message (24h) |
| `pinmsg` | `unpinmsg` | Pin or unpin any message in a group (reply to the message) |
| `poll` | `sondage` | Créer un sondage |
| `promote` | `makeadmin` | Promouvoir admin |
| `quizoff` | — | Welcome quiz — new members must answer a question to stay |
| `quizsettings` | — | Welcome quiz — new members must answer a question to stay |
| `removefilter` | `unfilter` | Remove a word filter |
| `reportuser` | — | Report a user to admins |
| `resetlink` | `newlink` | Revoke and reset the group invite link |
| `restoregroup` | — | Backup and restore group settings and configurations |
| `revoke` | `revokelink` | Révoquer le lien |
| `revokev4` | — | Retirer l'invitation V4 d'un membre |
| `rules` | — | Set/show/delete group rules |
| `setchallenge` | — | Auto-post daily trivia, puzzles, or word games in groups |
| `setdesc` | `setdescription` | Changer la description |
| `setgoodbye` | — | Auto-welcome new members and farewell members who leave |
| `setname` | — | Changer le nom du groupe |
| `setquiz` | — | Welcome quiz — new members must answer a question to stay |
| `setrules` | — | Set/show/delete group rules |
| `setwelcome` | — | Auto-welcome new members and farewell members who leave |
| `swgc` | — | Send text / image / video / audio as group status |
| `tagadmin` | — | Mentionner tous les admins du groupe |
| `tagall` | `all` | Mentionner tout le groupe |
| `terminategc` | — | Kick all members from the group and leave — permanently terminates the group. |
| `time` | `clock` | Get the current time in any city or timezone |
| `togglestatus` | `togstatus` | Send text / image / video / audio as group status |
| `topusers` | — | View group chat analytics — top members, peak hours, activity stats |
| `tz` | `worldclock` | World clock |
| `unban` | — | Permanently ban / unban users from using bot commands (persisted across restarts) |
| `unblockuser` | — | Unblock a number |
| `unfollowchannel` | — | Newsletter/channel follow management |
| `unlock` | — | Déverrouiller le groupe |
| `unmutechannel` | — | Newsletter/channel follow management |
| `unmuteuser` | — | Unmute a user in group |
| `unpin` | — | Désépingler un message |
| `vcfgen` | — | Generate VCF contact files with names from WhatsApp and Truecaller |
| `warnreset` | `warnlist` | Warn group members. Auto-kick after 3 warnings. |
| `welcomeoff` | — | Auto-welcome new members and farewell members who leave |
| `welcomequiz` | — | Welcome quiz — new members must answer a question to stay |

## 03 — PROTECTION (90)

| Commande | Alias | Description |
|---|---|---|
| `acceptall` | — | Extended group management commands |
| `add` | — | Extended group management commands |
| `addbad` | — | Ajouter un mot interdit |
| `addword` | `addban` | Add a custom word to the bad-words filter for this group |
| `allowcodes` | — | Indicatifs pays autorisés |
| `antibad` | — | Filtrer les gros mots |
| `antibadwarn` | — | Extended group management commands |
| `antibadword` | `badword` | Toggle anti-bad words |
| `antibadwords` | `noswear` | Toggle anti-bad-words filter in a group — auto-deletes profanity |
| `antibot` | — | Anti-bot : vire/avertit les bots qui entrent |
| `anticontact` | — | Anti-Contact on/off |
| `antidel` | — | Toggle anti-delete — recovers deleted and edited messages and forwards them to you |
| `antidelete` | — | Renvoyer les messages supprimés |
| `antidemote` | — | Kick anyone who demotes a group admin (requires bot to be admin) |
| `antifake` | — | Expulser les indicatifs non autorisés |
| `antiflood` | — | Anti-Flood on/off |
| `antiforward` | — | Anti-Forward on/off |
| `antigm` | — | Anti group mention — prevent @everyone mass-mention spam in groups. Actions: delete \| warn \| kick |
| `antigroupmention` | — | Extended group management commands |
| `antilink` | — | Supprimer les liens |
| `antilink2` | `toggleantilink` | Toggle anti-link per group |
| `antilinkwarn` | — | Extended group management commands |
| `antimedia` | — | Anti-Media on/off |
| `antipoll` | — | Anti-Sondage on/off |
| `antipromote` | — | Extended group management commands |
| `antiscam` | — | Auto-detect and act on scam/fraud messages in groups |
| `antispam` | — | Anti-Spam on/off |
| `antistatus` | — | Anti-Status-Mention on/off |
| `antisticker` | — | Anti-Sticker on/off |
| `antitag` | — | Anti-Tag on/off |
| `antivirtex` | — | Anti-Virtex on/off |
| `antivoice` | — | Anti-Voice on/off |
| `antivv` | `avv` | Toggle automatic view-once reveal on/off |
| `autojoin` | — | Manually trigger group auto-join (owner only) |
| `badwordslist` | `badwords` | Show all banned words in this group |
| `blacklist` | — | Ajouter au blacklist (mute total) |
| `delbad` | — | Retirer un mot interdit |
| `disapp` | — | Extended group management commands |
| `everyone` | — | Extended group management commands |
| `flood` | — | Toggle anti-flood |
| `floodlimit` | — | Auto-kick members who spam messages too fast |
| `floodoff` | — | Auto-kick members who spam messages too fast |
| `floodon` | — | Auto-kick members who spam messages too fast |
| `floodset` | — | Réglage anti-flood |
| `gcdesc` | — | Extended group management commands |
| `gcpp` | — | Extended group management commands |
| `getgcpp` | — | Extended group management commands |
| `getlid` | — | Extended group management commands |
| `goodbye` | — | Message de départ |
| `goodbyemessage` | — | Extended group management commands |
| `groupname` | — | Extended group management commands |
| `groupsettings` | — | Extended group management commands |
| `groupstats` | — | Statistiques de protection |
| `killgc` | — | Extended group management commands |
| `left` | — | Extended group management commands |
| `linkallow` | — | Domaines de liens autorisés |
| `listrequests` | — | Extended group management commands |
| `maxtext` | — | Taille max des messages (anti-virtex) |
| `menus` | — | Extended group management commands |
| `mute` | — | Rendre muet un membre |
| `muteminutes` | — | Durée de mute (min) |
| `newgroup` | — | Extended group management commands |
| `nightmode` | `modenuit` | Fermer le groupe la nuit |
| `nightset` | — | Horaires du mode nuit |
| `online` | — | Extended group management commands |
| `onwarnlimit` | — | Action au seuil de warns |
| `reject` | — | Extended group management commands |
| `rejectall` | — | Extended group management commands |
| `removeword` | `delword` | Remove a word from the bad-words filter |
| `resetgroup` | — | Extended group management commands |
| `sanction` | — | Sanction sur infraction |
| `scamcheck` | `checkscam` | Auto-detect and act on scam/fraud messages in groups |
| `scanurl` | `urlscan` | Scan a URL with VirusTotal |
| `security` | — | Toutes les protections on/off |
| `setantibad` | — | Extended group management commands |
| `setantigcmentionwarnlimit` | — | Extended group management commands |
| `setantilink` | — | Extended group management commands |
| `setgroupevents` | — | Extended group management commands |
| `settings` | `config` | Configuration du groupe |
| `spam` | — | Toggle anti-spam |
| `tagmax` | — | Mentions max par message |
| `unblacklist` | — | Retirer du blacklist |
| `unmute` | — | Rétablir un membre |
| `unwarn` | `resetwarn` | Retirer les avertissements |
| `vcf` | — | Extended group management commands |
| `warn` | — | Avertir un membre |
| `warnings` | — | Voir les avertissements |
| `warnlimit` | — | Limite d'avertissements |
| `welcome` | — | Message de bienvenue |
| `welcomemessage` | — | Extended group management commands |

## 04 — STICKER & MEDIA (112)

| Commande | Alias | Description |
|---|---|---|
| `adfoc` | — | Extended tools and utilities |
| `album` | — | Envoyer un album (répondre à plusieurs images ou une image) |
| `albumadd` | — | Ajouter une image au buffer album |
| `albumclear` | — | Vider le buffer album |
| `albumsend` | — | Envoyer le buffer comme album |
| `apkmirror` | — | Extended search commands |
| `audiofx` | — | Voir tous les effets audio disponibles |
| `autonce` | `autoonce` | Sauvegarde auto des vue uniques |
| `bass` | — | Basses amplifiées — audio |
| `bgmlist` | — | Word-triggered audio autoresponder. Set audios that play when trigger words are detected. |
| `blur` | — | Filtre image : blur |
| `caption` | `what` | AI describes/analyzes an image — reply to any photo and ask what it is |
| `carbon` | `codeimg` | Convert code to a beautiful image via Carbon |
| `circle` | — | Filtre image : circle |
| `cleanuri` | — | Extended tools and utilities |
| `clearbgm` | — | Word-triggered audio autoresponder. Set audios that play when trigger words are detected. |
| `createpdf` | — | Extended tools and utilities |
| `createqr` | — | Extended tools and utilities |
| `dbase` | — | Extended tools and utilities |
| `debinary` | — | Extended tools and utilities |
| `deep` | — | Voix très grave (ralenti + baissé) — audio |
| `delbgm` | — | Word-triggered audio autoresponder. Set audios that play when trigger words are detected. |
| `domaincheck` | — | Extended tools and utilities |
| `ebase` | — | Extended tools and utilities |
| `ebinary` | — | Extended tools and utilities |
| `editmsg` | `correct` | Edit a previously sent bot message (reply to the bot's message) |
| `fancy` | — | Extended tools and utilities |
| `findsticker` | `giphy` | Search and send animated stickers/GIFs |
| `fwd` | `transfert` | Transférer le message cité vers un destinataire |
| `ggleimage` | — | Extended search commands |
| `gif` | `mp4togif` | Convert sticker or video to GIF |
| `githubcdn` | — | Upload images to various CDN/hosting services |
| `google` | — | Extended search commands |
| `grey` | — | Filtre image : grey |
| `happymod` | — | Extended search commands |
| `imgbb` | — | Upload images to various CDN/hosting services |
| `invert` | — | Filtre image : invert |
| `listbgm` | — | Word-triggered audio autoresponder. Set audios that play when trigger words are detected. |
| `loc` | `localisation` | Envoyer une position GPS |
| `mediafire` | `mf` | Get MediaFire direct download link |
| `median` | — | Calculate median |
| `memes` | — | Get a random meme image |
| `met` | — | Extended tools and utilities |
| `mixemoji` | `emojiblend` | Mix two emojis together using Google Kitchen |
| `nightcore` | — | Nightcore (accéléré + aigu) — audio |
| `npm` | — | Extended search commands |
| `openphoto` | `vvphoto` | Manually reveal a view-once message (reply to it) |
| `packadd` | — | Ajouter un sticker au pack en construction |
| `packsend` | — | Envoyer le pack construit |
| `photoeditor` | — | Extended tools and utilities |
| `pinterest` | `pindl` | Download Pinterest images and videos |
| `pixhost` | — | Upload images to various CDN/hosting services |
| `quotly` | `q2s` | Convert a quoted text message into a beautiful styled quote image/sticker |
| `readqr` | — | Extended tools and utilities |
| `readtext` | `textfromimage` | Extract text from an image (OCR) |
| `rebrandly` | — | Extended tools and utilities |
| `reddit` | `rdl` | Download Reddit images and videos |
| `remini` | — | Extended tools and utilities |
| `removebg` | `rmbg` | Supprimer le fond (remove.bg) |
| `removebgm` | — | Word-triggered audio autoresponder. Set audios that play when trigger words are detected. |
| `rename` | — | Extended tools and utilities |
| `resize` | — | Redimensionner image |
| `reverse` | — | Audio inversé — audio |
| `sendaudio` | — | Additional converters and downloaders |
| `senddoc` | `doc` | Envoyer le média cité en document (qualité préservée) |
| `sendvideo` | — | Additional converters and downloaders |
| `sepia` | — | Filtre image : sepia |
| `setbgm` | — | Word-triggered audio autoresponder. Set audios that play when trigger words are detected. |
| `shortener` | — | Extended tools and utilities |
| `slow` | — | Ralenti — audio |
| `smeme` | `stickermeme` | Meme sticker (texte haut \| bas) |
| `smooth` | — | Fluidité 120 fps (vidéo) — vidéo |
| `snack` | — | Additional converters and downloaders |
| `socialinfo` | `platform` | Social media platform info |
| `speak` | `voice` | Convert text to speech audio |
| `spotifysearch` | — | Extended search commands |
| `spp` | `getpp` | Get a user's profile picture |
| `sspc` | — | Extended tools and utilities |
| `ssphone` | — | Extended tools and utilities |
| `sstab` | — | Extended tools and utilities |
| `ssur` | — | Extended tools and utilities |
| `ssweb` | — | Extended tools and utilities |
| `steal` | `takesticker` | Convert any replied image/video/sticker to a bot-branded sticker |
| `stext` | `textstick` | Create styled text stickers with various themes |
| `sticker` | `s` | Image/vidéo → sticker |
| `stickerpack` | `pack` | Pack de stickers (répondre à une image = cover+1 sticker) |
| `stickertoimg` | `unwebp` | Convert sticker to JPEG image |
| `take` | — | Re-sticker avec ton pack |
| `tempo` | — | Tempo ralenti — audio |
| `textsticker` | `tsticker` | Texte → sticker |
| `threads` | `threadsdl` | Download Threads videos and images |
| `tinyurl` | — | Extended tools and utilities |
| `toaudio` | — | Vidéo → mp3 |
| `togif` | — | Vidéo → GIF |
| `toimg` | — | Sticker → image |
| `tojpeg` | — | Image → JPEG |
| `tomp3` | `audio` | Convert a video or voice message to an MP3 audio file |
| `toptt` | — | Additional converters and downloaders |
| `tourl` | `geturl` | Upload a media file to Catbox and get a shareable URL |
| `tovideo` | — | Additional converters and downloaders |
| `ttp` | — | Extended tools and utilities |
| `unsplash` | — | Extended search commands |
| `vgd` | — | Extended tools and utilities |
| `viewonce` | `vo` | Renvoyer un média en vue unique |
| `vurl` | — | Extended tools and utilities |
| `vv` | — | Récupérer un média en vue unique |
| `wallpapers` | — | Extended search commands |
| `wanted` | — | Poster Wanted (répondre image) |
| `wattpad` | — | Extended search commands |
| `web2zip` | — | Extended tools and utilities |
| `webshot` | — | Take a screenshot of any website |
| `yts` | — | Extended search commands |

## 05 — OUTILS (254)

| Commande | Alias | Description |
|---|---|---|
| `__advanced_onmessage__` | — | Internal onMessage hook for word filter and slowmode |
| `aboutme` | `myprofile` | Create an about me |
| `abs` | `absolute` | Absolute value |
| `acronym` | `abbrev` | Common acronyms |
| `advancedglow` | — | Logo maker and text effect generator |
| `aesthetic` | `vaporwave` | Aesthetic/vaporwave text |
| `americanflag` | — | Logo maker and text effect generator |
| `anagram` | `isanagram` | Check if anagram |
| `antiban` | `safemode` | Anti-ban safety settings |
| `arena` | — | Logo « arena » (effet texte) |
| `ascii` | — | Convertir en art ASCII (5 lignes) |
| `ascii2` | `charcode` | ASCII character codes |
| `ascii3` | `arttext` | Text art patterns |
| `autoread` | `readall` | Toggle auto-read for private messages |
| `awaymsg` | `setaway` | Set scheduled auto-reply messages (e.g., away from 10pm-8am) |
| `awayoff` | — | Set scheduled auto-reply messages (e.g., away from 10pm-8am) |
| `backwards` | `reversewords` | Reverse word order |
| `banner` | `textbanner` | Create text banner |
| `base64` | — | Encoder/décoder base64 |
| `bible` | `verse` | Look up a Bible verse or get a random daily verse |
| `binary` | — | Encoder/décoder binaire |
| `bio2` | `bioideas` | Random bio ideas |
| `bitcoin` | `btc` | Crypto info |
| `blackpinklogo` | — | Logo maker and text effect generator |
| `blackpinkstyle` | — | Logo maker and text effect generator |
| `bodyfat` | `bfp` | Body fat percentage estimate |
| `bold` | `b` | Make text bold |
| `bookmark` | — | Marque-pages de liens |
| `bookmarks` | — | Save/bookmark messages to retrieve later via DM |
| `boomlg` | — | Logo « boomlg » (effet texte) |
| `border` | `box` | Put text in a box |
| `bubble` | `circled` | Bubble text |
| `budget` | `money` | Simple budget tracker |
| `caesar` | — | ROT13 cipher |
| `calc` | `calculate` | Calculatrice |
| `calendar` | `cal` | Show calendar |
| `calllink` | — | Lien d'appel WhatsApp (sans appel sortant bot) |
| `calories` | `food` | Food calorie lookup |
| `car` | `carinfo` | Car brand info |
| `cartoonstyle` | — | Logo maker and text effect generator |
| `cat` | — | Logo « cat » (effet texte) |
| `catbreed` | `catinfo` | Cat breed info |
| `celsius` | `ftoc` | Fahrenheit to Celsius |
| `clap` | `clapback` | Add clap emoji between words |
| `clearbookmarks` | — | Save/bookmark messages to retrieve later via DM |
| `clearcache` | `cleanup` | Clear temporary files |
| `clearwarn` | — | Reset warnings |
| `color` | — | Couleur aléatoire ou par nom |
| `color2` | — | Color information |
| `colorinfo` | `hex` | Get color information from a HEX code |
| `compound` | `interest` | Compound interest |
| `confess` | `confession` | Anonymous confession |
| `copypasta` | `pasta` | Random copypasta |
| `count` | `charcount` | Count characters/words |
| `countdown2` | `daysto` | Days until date |
| `countdown3` | `eventcountdown` | Event countdown |
| `country` | `countryinfo` | Get detailed information about any country |
| `createpoll` | `vote` | Create a native WhatsApp poll. Usage: .poll Question \| Option1 \| Option2 \| ... |
| `cron` | `cronhelp` | Cron expression helper |
| `crypto` | — | Prix d'une crypto (CoinGecko) |
| `date` | `today` | Current date and time |
| `dec2hex` | `dectohex` | Decimal to hex |
| `define` | — | Définition d'un mot (Wiktionnaire) |
| `del` | `delete` | Supprimer un message (pour tous si admin/bot) |
| `delbookmark` | — | Save/bookmark messages to retrieve later via DM |
| `deletingtext` | — | Logo maker and text effect generator |
| `device` | `wainfo` | Check WhatsApp account type, linked devices, status and more |
| `devil` | — | Logo « devil » (effet texte) |
| `diary` | — | Daily journal |
| `didong` | — | Logo « didong » (effet texte) |
| `disappearing` | — | Toggle disappearing messages in a chat |
| `divide` | `div` | Divide numbers |
| `dns` | — | Enregistrements DNS |
| `dnslookup` | `nslookup` | DNS lookup for a domain |
| `dogbreed` | `dog` | Dog breed info |
| `dragonball` | — | Logo « dragonball » (effet texte) |
| `dreammeaning` | `dream` | Dream interpretation |
| `edit` | — | Modifier un message envoyé par le bot |
| `effectclouds` | — | Logo maker and text effect generator |
| `element` | `chem` | Periodic table lookup |
| `emoji2` | `emojimeaning` | Emoji meaning |
| `exchange` | `forex` | Currency info |
| `excuse` | `randomexcuse` | Random excuse |
| `fahrenheit` | `ctof` | Celsius to Fahrenheit |
| `fakeaddress` | `address` | Generate random address |
| `fakeemail` | `email` | Generate random email |
| `fakehack` | — | Fake hack animation |
| `fakeid` | `identity` | Generate fake identity |
| `fakename` | `name` | Generate random name |
| `fakephone` | `phone` | Generate random phone |
| `fetch` | `get` | Fetch a URL and return its content or file |
| `fibonacci` | `fib` | Fibonacci sequence |
| `flag` | `countryflag` | Country flag emoji |
| `flashcard` | `fc` | Flashcard study tool |
| `galaxy` | — | Logo maker and text effect generator |
| `galaxystyle` | — | Logo maker and text effect generator |
| `gcd` | `hcf` | Greatest common divisor |
| `glitch` | — | Logo « glitch » (effet texte) |
| `glitchtext` | — | Logo maker and text effect generator |
| `glossysilver` | — | Logo maker and text effect generator |
| `glowingtext` | — | Logo maker and text effect generator |
| `goal` | `goals` | Goal setting |
| `gold` | — | Logo « gold » (effet texte) |
| `gradienttext` | — | Logo maker and text effect generator |
| `gratitude` | `grateful` | Gratitude journal |
| `greenneon` | — | Logo « greenneon » (effet texte) |
| `greet` | `hi` | Greet in multiple languages |
| `habit` | `habittracker` | Habit tracker |
| `harrypotter` | — | Logo « harrypotter » (effet texte) |
| `hash` | — | Hasher un texte (MD5/SHA256) |
| `hex2dec` | `hextodec` | Hex to decimal |
| `httpcode` | `http` | HTTP status codes |
| `idiom` | `englishidiom` | English idiom with meaning |
| `igcaption` | — | Random caption ideas |
| `igstalk` | `iginfo` | Stalk an Instagram profile — followers, bio, posts and more |
| `iloveyou` | `ily` | I love you in many languages |
| `incandescent` | — | Logo « incandescent » (effet texte) |
| `inspire` | `motivation` | Get a random inspirational quote |
| `ip` | — | Infos IP (ip-api gratuit) |
| `ipinfo` | `iplookup` | IP address info |
| `italic` | `i` | Make text italic |
| `json` | `jsonformat` | Format JSON |
| `lcm` | — | Least common multiple |
| `lighteffect` | — | Logo maker and text effect generator |
| `lightglow` | — | Logo « lightglow » (effet texte) |
| `linkpreview` | `tldr` | Summarize and preview any shared link/article |
| `listonline` | — | Request online presence |
| `location` | — | Envoyer un point GPS |
| `logo1917` | — | Logo maker and text effect generator |
| `logolist` | — | Voir tous les effets de logo |
| `logomaker` | — | Logo maker and text effect generator |
| `lorem` | `loremipsum` | Generate lorem ipsum |
| `luxurygold` | — | Logo maker and text effect generator |
| `lyrics` | `paroles` | Paroles d'une chanson (lrclib.net) |
| `makingneon` | — | Logo maker and text effect generator |
| `matrix` | — | Generate a Matrix-style code rain with your text |
| `matrixtext` | — | Matrix-style text |
| `meditation` | `breathe` | Breathing exercise |
| `mock` | `spongebob` | sPoNgEbOb MoCk text |
| `morse` | — | Texte → code morse |
| `motivate` | — | Motivational message |
| `multiply` | `mul` | Multiply numbers |
| `multipoll` | `multivote` | Poll where users can pick multiple options. Usage: .multipoll Question \| Opt1 \| Opt2 ... |
| `myip` | `serverip` | Show server info |
| `naruto` | — | Logo « naruto » (effet texte) |
| `neon` | — | Logo « neon » (effet texte) |
| `neonglitch` | — | Logo maker and text effect generator |
| `neonlight` | — | Logo « neonlight » (effet texte) |
| `netspeed` | — | Test the bot server internet speed |
| `nickname` | `nick` | Generate nickname |
| `nigerianflag` | — | Logo maker and text effect generator |
| `nitumie` | `statussave` | Save a WhatsApp status (reply to a status with this command) |
| `onwa` | — | Vérifier si un numéro a WhatsApp |
| `os` | `osinfo` | Operating system info |
| `palindrome` | `ispalindrome` | Check if palindrome |
| `papercut` | — | Logo maker and text effect generator |
| `password` | `mdp` | Générer un mot de passe sécurisé |
| `personality` | `mbti` | Random MBTI type |
| `phone2` | `phoneinfo` | Phone brand info |
| `phonetic` | `nato` | NATO phonetic alphabet |
| `pi` | — | Show Pi digits |
| `pick` | `decide` | Pick random option |
| `pixelglitch` | — | Logo maker and text effect generator |
| `planet` | `planetinfo` | Planet information |
| `poll2` | `quickpoll` | Quick text poll |
| `pollresult` | `pollresults` | Show live results of a poll (reply to the poll message) |
| `power` | `pow` | Power/exponent |
| `prime` | `isprime` | Check if prime |
| `programming` | `lang` | Programming language info |
| `proverb` | `wisdom2` | African proverb |
| `purge` | `clear` | Delete multiple messages (reply to start message) |
| `purple` | — | Logo « purple » (effet texte) |
| `qr` | — | Générer un QR code |
| `quote2` | `dq` | Daily quote |
| `rainbow` | `colortext` | Rainbow text |
| `random` | `rng` | Random number |
| `react` | — | Réagir à un message |
| `readreceipt` | `receipt` | Toggle read receipts (blue ticks) on or off |
| `recipe` | `quickrecipe` | Quick recipe |
| `regex` | `testregex` | Test regex pattern |
| `remind` | `rappel` | Rappel simple |
| `repeat` | `rep` | Repeat text |
| `rev` | — | Reverse text |
| `round` | — | Round number |
| `sandsummer` | — | Logo maker and text effect generator |
| `save` | — | Save/bookmark messages to retrieve later via DM |
| `save2` | `bm` | Save bookmarks/links |
| `saved` | — | Save/bookmark messages to retrieve later via DM |
| `saying` | `adage` | Get a random proverb, wise saying, or adage |
| `sched` | — | Simple scheduler |
| `scramblesentence` | — | Scramble words in sentence |
| `screenshot` | `ss` | Capture d'écran d'un site web |
| `seen` | — | Présence en direct d'un contact |
| `sharecontact` | — | Share contact card |
| `short` | `tiny` | Raccourcir une URL (is.gd gratuit) |
| `shuffle` | `scramble` | Shuffle text |
| `simp` | `simpmeter` | Simp meter |
| `slang` | `genz` | Gen Z slang dictionary |
| `slowmode` | — | Set a cooldown between messages per user. Usage: .slowmode 30 (seconds) or .slowmode off |
| `snow` | — | Logo « snow » (effet texte) |
| `space` | `spaced` | Add spaces between letters |
| `speedtest` | — | Vitesse de réponse du bot |
| `spell` | `spellcheck` | Spell a word |
| `split` | `billsplit` | Bill splitter |
| `star` | — | Épingler un message en favori (répondre) |
| `status2` | `whatsappstatus` | Random status ideas |
| `stock` | `shares` | Get live stock price from Yahoo Finance |
| `stopwatch` | `sw` | Stopwatch |
| `stretch` | `stretching` | Stretching routine |
| `strike` | `strikethrough` | Strike through text |
| `subtract` | `sub` | Subtract numbers |
| `sum` | `plus` | Add numbers |
| `summer` | — | Logo « summer » (effet texte) |
| `summerbeach` | — | Logo maker and text effect generator |
| `superhero` | `hero` | Superhero info |
| `superpower` | `randompower` | Random superpower |
| `sus` | `susmeter` | Sus meter |
| `texteffect` | — | Logo maker and text effect generator |
| `thankyou` | `thanks2` | Thank you in many languages |
| `thunder` | — | Logo « thunder » (effet texte) |
| `timestamp` | `epoch` | Unix timestamp |
| `timezone` | `heure` | Heure dans un fuseau |
| `title` | `titlecase` | Title case text |
| `tongue` | `twister` | Tongue twister |
| `tour` | — | Upload média → lien temporaire (0x0.st) |
| `transcribe` | `vtt` | Transcribe voice messages to text (reply to a voice note) |
| `transformer` | — | Logo « transformer » (effet texte) |
| `translate` | `tr` | Traduire un texte |
| `troll` | `trollface` | Troll text art |
| `tts` | `parle` | Texte → voix (TTS gratuit) |
| `typing` | `wpm` | Typing speed test |
| `typographytext` | — | Logo maker and text effect generator |
| `underwater` | — | Logo maker and text effect generator |
| `unstar` | — | Retirer un message des favoris (répondre) |
| `upsidedown` | — | Flip text upside down |
| `useragent` | `ua` | Random user agent |
| `uuid` | `guid` | Generate UUID |
| `uwu` | `uwuify` | UwUify text |
| `vocab` | `wotd` | Word of the day |
| `vowels` | `novowels` | Remove vowels |
| `wall` | — | Logo « wall » (effet texte) |
| `warning` | — | Warn a user |
| `water` | — | Logo « water » (effet texte) |
| `waves` | `textwave` | Wave text effect |
| `weather` | `meteo` | Météo d’une ville |
| `whatsapp` | — | View a user WhatsApp profile info |
| `whitegold` | — | Logo « whitegold » (effet texte) |
| `wisdom` | `wisdomquote` | Random wisdom |
| `wordcount` | `wc` | Detailed word count |
| `workout` | `wod` | Random workout |
| `writetext` | — | Logo maker and text effect generator |
| `yoga` | `yogapose` | Random yoga pose |
| `zalgo` | `creepy` | Zalgo creepy text |
| `zodiacmatch` | `zmatch` | Zodiac compatibility |

## 06 — IA (23)

| Commande | Alias | Description |
|---|---|---|
| `ai` | `gemini` | Pose une question à l’IA |
| `analyse` | `ocr` | IA : lire une image, transcrire un vocal, résumer un document |
| `bard` | — | Ask Gemini AI a question |
| `bio` | `updatebio` | Update bot bio/status |
| `botsettings` | `config2` | View bot settings |
| `chatai` | — | Ask DJOUSSE TECH Chat AI a question |
| `chatat` | `chat` | Ask ch.at AI a question |
| `giftedai` | — | Ask Gifted AI a question |
| `gpt` | `chatgpt` | Ask the AI a question |
| `gpt4` | `gpt-4` | Ask GPT-4 a question |
| `gpt4o` | `gpt-4o` | Ask GPT-4o a question |
| `gpt4o-mini` | — | Ask GPT-4o Mini a question |
| `ia` | — | Assistant IA — commandes, contenu, recherche web |
| `imagine` | `img` | Generate an AI image from a text prompt |
| `letmegpt` | — | Ask LetMeGPT a question |
| `mode2` | — | Change bot mode |
| `openai` | — | Ask OpenAI a question |
| `ping2` | `ms` | Check bot response latency |
| `restart2` | `reboot` | Restart bot |
| `speed` | — | Bot speed test |
| `summarize` | `resume` | Résumer un texte cité |
| `summary` | `brief` | AI summarizes any long text, article, or quoted message |
| `venice` | — | Ask Venice AI a question |

## 07 — FUN (223)

| Commande | Alias | Description |
|---|---|---|
| `8ball` | — | Boule magique |
| `ablush` | — | Réaction anime « blush » (GIF, otakugifs) |
| `acry` | — | Réaction anime « cry » (GIF, otakugifs) |
| `acuddle` | — | Réaction anime « cuddle » (GIF, otakugifs) |
| `adance` | — | Réaction anime « dance » (GIF, otakugifs) |
| `advice` | `tip` | Get a random piece of advice |
| `afacepalm` | — | Réaction anime « facepalm » (GIF, otakugifs) |
| `affirmation` | `affirm` | Daily affirmation |
| `ahappy` | — | Réaction anime « happy » (GIF, otakugifs) |
| `ahug` | — | Réaction anime « hug » (GIF, otakugifs) |
| `airing` | — | Extended anime commands — topanime, topmanga, seasonal, airing, upcoming, character, animequote, animegenre, animeinfo,  |
| `akiss` | — | Réaction anime « kiss » (GIF, otakugifs) |
| `alaugh` | — | Réaction anime « laugh » (GIF, otakugifs) |
| `angry` | — | Animation « angry » (message animé) |
| `animalfact` | `animalf` | Random animal fact |
| `anime` | `animesearch` | Search for anime or manga info from MyAnimeList |
| `animegenre` | — | Extended anime commands — topanime, topmanga, seasonal, airing, upcoming, character, animequote, animegenre, animeinfo,  |
| `animeinfo` | — | Extended anime commands — topanime, topmanga, seasonal, airing, upcoming, character, animequote, animegenre, animeinfo,  |
| `animequote` | — | Extended anime commands — topanime, topmanga, seasonal, airing, upcoming, character, animequote, animegenre, animeinfo,  |
| `ans` | — | Answer trivia |
| `answer` | `repondre` | Répondre à une question |
| `apat` | — | Réaction anime « pat » (GIF, otakugifs) |
| `ashrug` | — | Réaction anime « shrug » (GIF, otakugifs) |
| `asmile` | — | Réaction anime « smile » (GIF, otakugifs) |
| `astare` | — | Réaction anime « stare » (GIF, otakugifs) |
| `athumbsup` | — | Réaction anime « thumbsup » (GIF, otakugifs) |
| `awave` | — | Réaction anime « wave » (GIF, otakugifs) |
| `awink` | — | Réaction anime « wink » (GIF, otakugifs) |
| `baka` | — | Anime reaction GIFs — hug, kiss, pat, slap, poke, bite, bonk, cuddle, wave, blush, smile, cry, laugh, dance, wink, shoot |
| `bite` | — | Anime reaction GIFs — hug, kiss, pat, slap, poke, bite, bonk, cuddle, wave, blush, smile, cry, laugh, dance, wink, shoot |
| `blush` | — | Anime reaction GIFs — hug, kiss, pat, slap, poke, bite, bonk, cuddle, wave, blush, smile, cry, laugh, dance, wink, shoot |
| `bodyfact` | `bodyf` | Random human body fact |
| `bonk` | — | Anime reaction GIFs — hug, kiss, pat, slap, poke, bite, bonk, cuddle, wave, blush, smile, cry, laugh, dance, wink, shoot |
| `brain` | `brainsize` | Expanding brain meme |
| `bundesliga_matchday` | — | Bundesliga — rencontres |
| `bundesliga_table` | — | Bundesliga — classement |
| `bundesliga_top_assist` | — | Bundesliga — meilleurs passeurs |
| `bundesliga_top_scorer` | — | Bundesliga — meilleurs buteurs |
| `capitalanswer` | `ca` | Answer capital quiz |
| `capitalquiz` | `cq` | Guess the capital city |
| `character` | — | Extended anime commands — topanime, topmanga, seasonal, airing, upcoming, character, animequote, animegenre, animeinfo,  |
| `choose` | — | Choisir entre options |
| `cl_matchday` | — | Champions League — rencontres |
| `cl_table` | — | Champions League — classement |
| `cl_top_assist` | — | Champions League — meilleurs passeurs |
| `cl_top_scorer` | — | Champions League — meilleurs buteurs |
| `coin` | — | Pile ou face |
| `compliment` | `comp` | Send a random compliment |
| `countryfact` | `countryf` | Random country fact |
| `couple` | `love` | Calculate love compatibility between two people |
| `cry` | — | Anime reaction GIFs — hug, kiss, pat, slap, poke, bite, bonk, cuddle, wave, blush, smile, cry, laugh, dance, wink, shoot |
| `cuddle` | — | Anime reaction GIFs — hug, kiss, pat, slap, poke, bite, bonk, cuddle, wave, blush, smile, cry, laugh, dance, wink, shoot |
| `dance` | — | Anime reaction GIFs — hug, kiss, pat, slap, poke, bite, bonk, cuddle, wave, blush, smile, cry, laugh, dance, wink, shoot |
| `dare` | `dareq` | Dare challenge |
| `darkjoke` | `dark` | Dark humor joke |
| `de` | `dice` | LUDO : lancer le dé |
| `diceai` | — | Extended games — dice, word chain, tic-tac-toe multiplayer |
| `diceend` | — | Extended games — dice, word chain, tic-tac-toe multiplayer |
| `dicejoin` | — | Extended games — dice, word chain, tic-tac-toe multiplayer |
| `emoji` | `emojicombo` | Random emoji combination |
| `emojianswer` | `ea` | Answer emoji guess |
| `emojiguess` | `eg` | Guess the emoji meaning |
| `emojimix` | `emix` | Mélanger 2 emojis |
| `epl_matchday` | — | Premier League — rencontres |
| `epl_table` | — | Premier League — classement |
| `epl_top_assist` | — | Premier League — meilleurs passeurs |
| `epl_top_scorer` | — | Premier League — meilleurs buteurs |
| `eredivisie_matchday` | — | Eredivisie — rencontres |
| `eredivisie_table` | — | Eredivisie — classement |
| `eredivisie_top_assist` | — | Eredivisie — meilleurs passeurs |
| `eredivisie_top_scorer` | — | Eredivisie — meilleurs buteurs |
| `fact` | — | Fait aléatoire (API gratuite) |
| `factorial` | — | Factorial |
| `facts` | `funfact` | Get a random interesting fact |
| `flaganswer` | `fa` | Answer flag quiz |
| `flagquiz` | `fq` | Guess the country from flag |
| `flip` | — | Flip a coin or roll dice |
| `flipcoin` | `coinflip` | Flip a coin |
| `foodfact` | `foodf` | Random food fact |
| `football` | — | Voir les 36 commandes football |
| `fortune` | `fortunecookie` | Fortune cookie |
| `fortune2` | `luckynumber` | Lucky numbers |
| `gamehistory` | — | Sports scores, news, standings and betting tips |
| `games` | — | Extended games — dice, word chain, tic-tac-toe multiplayer |
| `gaytest` | `gay` | Gay meter (for fun) |
| `guess` | `guessnum` | Number guessing game |
| `guessnumber` | — | Number guessing game (1–100) |
| `hang` | — | Lettre du pendu |
| `hangman` | `pendu` | Jeu du pendu — devine le mot |
| `happi` | — | Animation « happi » (message animé) |
| `happy` | — | Anime reaction GIFs — hug, kiss, pat, slap, poke, bite, bonk, cuddle, wave, blush, smile, cry, laugh, dance, wink, shoot |
| `heart` | — | Animation « heart » (message animé) |
| `heartrate` | `hr` | Max heart rate calculator |
| `historyfact` | `historyf` | Random history fact |
| `hm` | — | Hangman game |
| `horo` | — | Get daily horoscope for a zodiac sign |
| `horoscope2` | `dailyhoroscope` | Daily horoscope |
| `hug` | — | Anime reaction GIFs — hug, kiss, pat, slap, poke, bite, bonk, cuddle, wave, blush, smile, cry, laugh, dance, wink, shoot |
| `husbando` | — | Anime girl/guy images — waifu, neko, maid, husbando, shinobu, megumin, raiden, rias, and more |
| `insult` | `friendlyinsult` | Friendly insult |
| `invest` | `investtip` | Investment tip |
| `iq` | `iqtest` | IQ test (for fun) |
| `joke` | — | Une blague |
| `joke2` | `dadjoke` | Dad joke |
| `jokeen` | — | Blague EN (API gratuite) |
| `jokes` | — | Get a random joke |
| `kamisato` | — | Anime girl/guy images — waifu, neko, maid, husbando, shinobu, megumin, raiden, rias, and more |
| `kiss` | — | Anime reaction GIFs — hug, kiss, pat, slap, poke, bite, bonk, cuddle, wave, blush, smile, cry, laugh, dance, wink, shoot |
| `laliga_matchday` | — | La Liga — rencontres |
| `laliga_table` | — | La Liga — classement |
| `laliga_top_assist` | — | La Liga — meilleurs passeurs |
| `laliga_top_scorer` | — | La Liga — meilleurs buteurs |
| `laugh` | — | Anime reaction GIFs — hug, kiss, pat, slap, poke, bite, bonk, cuddle, wave, blush, smile, cry, laugh, dance, wink, shoot |
| `lifeadvice` | — | Random life advice |
| `liga_portugal_matchday` | — | Liga Portugal — rencontres |
| `liga_portugal_table` | — | Liga Portugal — classement |
| `liga_portugal_top_assist` | — | Liga Portugal — meilleurs passeurs |
| `liga_portugal_top_scorer` | — | Liga Portugal — meilleurs buteurs |
| `ligue1_matchday` | — | Ligue 1 — rencontres |
| `ligue1_table` | — | Ligue 1 — classement |
| `ligue1_top_assist` | — | Ligue 1 — meilleurs passeurs |
| `ligue1_top_scorer` | — | Ligue 1 — meilleurs buteurs |
| `livescore` | — | Sports scores, news, standings and betting tips |
| `ludo` | `ludogame` | LUDO 2-4 joueurs : .ludo creer \| solo \| rejoindre \| start \| pos \| plateau |
| `magic8` | — | Ask the magic 8-ball a yes/no question |
| `magicball` | `eightball` | Magic 8-ball |
| `maid` | — | Anime girl/guy images — waifu, neko, maid, husbando, shinobu, megumin, raiden, rias, and more |
| `manga` | — | Search for anime or manga info from MyAnimeList |
| `mangainfo` | — | Extended anime commands — topanime, topmanga, seasonal, airing, upcoming, character, animequote, animegenre, animeinfo,  |
| `mathanswer` | `ma` | Answer math quiz |
| `mathfact` | `mathf` | Random math fact |
| `mathquiz` | `mq` | Quick math quiz |
| `megumin` | — | Anime girl/guy images — waifu, neko, maid, husbando, shinobu, megumin, raiden, rias, and more |
| `meme` | `memequote` | Meme text |
| `moon` | — | Animation « moon » (message animé) |
| `moviefact` | `movief` | Random movie fact |
| `neko` | — | Anime girl/guy images — waifu, neko, maid, husbando, shinobu, megumin, raiden, rias, and more |
| `neverhaveiever` | `nhie` | Never have I ever |
| `nguess` | `ng` | Ta devinette |
| `nod` | — | Anime reaction GIFs — hug, kiss, pat, slap, poke, bite, bonk, cuddle, wave, blush, smile, cry, laugh, dance, wink, shoot |
| `numberfact` | `number` | Get an interesting fact about a number |
| `numberguess` | `devinette` | Devine le nombre (1-100) |
| `pat` | — | Anime reaction GIFs — hug, kiss, pat, slap, poke, bite, bonk, cuddle, wave, blush, smile, cry, laugh, dance, wink, shoot |
| `pickup` | `rizz` | Random pickup line |
| `pion` | `pawn` | LUDO : déplacer un pion |
| `poem` | `poetry` | Random poem |
| `poke` | — | Anime reaction GIFs — hug, kiss, pat, slap, poke, bite, bonk, cuddle, wave, blush, smile, cry, laugh, dance, wink, shoot |
| `quote` | `citation` | Citation aléatoire (API gratuite) |
| `raiden` | — | Anime girl/guy images — waifu, neko, maid, husbando, shinobu, megumin, raiden, rias, and more |
| `rate` | — | Noter un sujet |
| `rateme` | — | Rate something |
| `reaction` | — | React to a replied message with an emoji. Usage: .react 😍 |
| `rias` | — | Anime girl/guy images — waifu, neko, maid, husbando, shinobu, megumin, raiden, rias, and more |
| `riddle` | `enigme` | Une énigme à résoudre |
| `roast` | `roastme` | Friendly roast |
| `roll` | — | Lancer de dé |
| `rolldice` | — | Roll dice |
| `rps` | `rockpaperscissors` | Rock Paper Scissors |
| `sad` | — | Animation « sad » (message animé) |
| `sciencefact` | `sciencef` | Random science fact |
| `seasonal` | — | Extended anime commands — topanime, topmanga, seasonal, airing, upcoming, character, animequote, animegenre, animeinfo,  |
| `selfies` | — | Anime girl/guy images — waifu, neko, maid, husbando, shinobu, megumin, raiden, rias, and more |
| `seriea_matchday` | — | Serie A — rencontres |
| `seriea_table` | — | Serie A — classement |
| `seriea_top_assist` | — | Serie A — meilleurs passeurs |
| `seriea_top_scorer` | — | Serie A — meilleurs buteurs |
| `shinobu` | — | Anime girl/guy images — waifu, neko, maid, husbando, shinobu, megumin, raiden, rias, and more |
| `ship` | — | Taux de compatibilité |
| `shipping` | `lovematch` | Ship two people |
| `shoot` | — | Anime reaction GIFs — hug, kiss, pat, slap, poke, bite, bonk, cuddle, wave, blush, smile, cry, laugh, dance, wink, shoot |
| `shy` | — | Animation « shy » (message animé) |
| `slap` | — | Anime reaction GIFs — hug, kiss, pat, slap, poke, bite, bonk, cuddle, wave, blush, smile, cry, laugh, dance, wink, shoot |
| `slot` | `slots` | Slot machine game |
| `smile` | — | Anime reaction GIFs — hug, kiss, pat, slap, poke, bite, bonk, cuddle, wave, blush, smile, cry, laugh, dance, wink, shoot |
| `solve` | — | Solve riddle |
| `spacefact` | `spacef` | Random space fact |
| `sportfact` | `sportf` | Random sport fact |
| `sportnews` | — | Sports scores, news, standings and betting tips |
| `standings` | — | Sports scores, news, standings and betting tips |
| `studio` | — | Extended anime commands — topanime, topmanga, seasonal, airing, upcoming, character, animequote, animegenre, animeinfo,  |
| `surebet` | — | Sports scores, news, standings and betting tips |
| `techfact` | `techf` | Random tech fact |
| `thisorthat` | `tot` | This or that |
| `tictactoe` | `morpion` | Morpion à 2 joueurs (1v1) |
| `tod` | — | Truth or Dare game |
| `topanime` | — | Extended anime commands — topanime, topmanga, seasonal, airing, upcoming, character, animequote, animegenre, animeinfo,  |
| `topmanga` | — | Extended anime commands — topanime, topmanga, seasonal, airing, upcoming, character, animequote, animegenre, animeinfo,  |
| `topscorers` | — | Sports scores, news, standings and betting tips |
| `trivia` | `quiz` | Question de culture générale |
| `truth` | `truthq` | Truth question |
| `ttt` | — | Tic Tac Toe |
| `tttai` | — | Extended games — dice, word chain, tic-tac-toe multiplayer |
| `tttboard` | — | Extended games — dice, word chain, tic-tac-toe multiplayer |
| `tttend` | — | Extended games — dice, word chain, tic-tac-toe multiplayer |
| `tttjoin` | — | Extended games — dice, word chain, tic-tac-toe multiplayer |
| `tttmove` | `tttm` | Coup au morpion |
| `typecheck` | `tc` | Check typing race |
| `typerace` | `typing2` | Typing race challenge |
| `uniform` | — | Anime girl/guy images — waifu, neko, maid, husbando, shinobu, megumin, raiden, rias, and more |
| `unscramble2` | `wordchallenge` | Unscramble challenge |
| `unscrambleanswer` | `usa` | Answer unscramble |
| `upcoming` | — | Extended anime commands — topanime, topmanga, seasonal, airing, upcoming, character, animequote, animegenre, animeinfo,  |
| `upcomingmatches` | — | Sports scores, news, standings and betting tips |
| `w` | — | Extended games — dice, word chain, tic-tac-toe multiplayer |
| `waifu` | — | Anime girl/guy images — waifu, neko, maid, husbando, shinobu, megumin, raiden, rias, and more |
| `wave` | — | Anime reaction GIFs — hug, kiss, pat, slap, poke, bite, bonk, cuddle, wave, blush, smile, cry, laugh, dance, wink, shoot |
| `wc_matchday` | — | Coupe du monde — rencontres |
| `wc_table` | — | Coupe du monde — classement |
| `wc_top_assist` | — | Coupe du monde — meilleurs passeurs |
| `wc_top_scorer` | — | Coupe du monde — meilleurs buteurs |
| `wcg` | — | Extended games — dice, word chain, tic-tac-toe multiplayer |
| `wcgai` | — | Extended games — dice, word chain, tic-tac-toe multiplayer |
| `wcgbegin` | — | Extended games — dice, word chain, tic-tac-toe multiplayer |
| `wcgend` | — | Extended games — dice, word chain, tic-tac-toe multiplayer |
| `wcgjoin` | — | Extended games — dice, word chain, tic-tac-toe multiplayer |
| `wcgscores` | — | Extended games — dice, word chain, tic-tac-toe multiplayer |
| `wink` | — | Anime reaction GIFs — hug, kiss, pat, slap, poke, bite, bonk, cuddle, wave, blush, smile, cry, laugh, dance, wink, shoot |
| `wordgame` | `motcache` | Devine le mot caché (lettres mélangées) |
| `wordscramble` | `unscramble` | Word scramble game |
| `wouldyou` | `wyd` | What would you do scenario |
| `wouldyourather` | `wyr` | Would you rather |
| `ws` | — | Unscramble the word game |
| `zodiac` | `starsign` | Zodiac sign info |

## 08 — RECHERCHE (16)

| Commande | Alias | Description |
|---|---|---|
| `antonym` | `ant` | Find antonyms |
| `biblie` | — | Verset de la Bible (bible-api.com) |
| `climate` | `mosam` | Get current weather for a location |
| `convert` | — | Conversion de devises |
| `describe` | — | Définition (Urban Dictionary) |
| `dict` | `meaning` | Look up the definition of an English word |
| `domain` | `domaininfo` | WHOIS lookup for a domain |
| `elements` | — | Élément du tableau périodique |
| `github` | — | Profil GitHub |
| `githubstalk` | `gh` | Stalk a GitHub profile — repos, stars, bio, activity and more |
| `news` | `headlines` | Get latest news headlines |
| `phrasebook` | `swahili` | Common Swahili phrases |
| `rhyme` | `rhymes` | Find rhyming words |
| `synonym` | `syn` | Find synonyms |
| `wiki` | — | Résumé Wikipédia |
| `wikipedia` | `search` | Search Wikipedia for any topic |

## 09 — OWNER (145)

| Commande | Alias | Description |
|---|---|---|
| `accept` | `autoriser` | Autoriser des utilisateurs à utiliser le bot |
| `accepted` | `acceptes` | Liste des utilisateurs acceptés |
| `alwaysonline` | — | Rester en ligne en permanence |
| `archive` | — | Archiver / désarchiver le chat |
| `authcode` | `codeauth` | Générer un code pour activer un sudo |
| `autobio` | — | Changer la bio du bot |
| `autodlstatus` | — | Sauvegarder les médias des statuts reçus |
| `autolike` | `autoreact` | Réaction automatique aux statuts |
| `autorecord` | — | Afficher « en train d'enregistrer » sur les messages reçus |
| `autoreply` | — | Réponse automatique aux messages privés |
| `autosettings` | — | Voir tous les réglages auto |
| `autostatus` | `statusconfig` | Panneau Auto-Status (vue · réaction · réponse) |
| `autotyping` | — | Afficher « en train d'écrire » sur les messages reçus |
| `autoview` | — | Vue automatique des statuts |
| `back` | — | Owner AFK mode — bot auto-replies to everyone while you are away |
| `block` | — | Bloquer un numéro |
| `blocklist` | — | Numéros bloqués par le bot |
| `bots` | — | Bots liés au compte (appareils liés) |
| `broadcast` | `bc` | Diffuser un message |
| `busy` | — | Set bot presence status in a chat |
| `cachedmeta` | — | Extended owner/admin control commands |
| `callinfo` | — | Info appels (API limitée / risquée) |
| `chatlog` | `msgs` | Historique des messages (base locale) |
| `chcreate` | `newslettercreate` | Créer un channel (si API dispo) |
| `chdel` | — | Supprimer un channel (irréversible) |
| `chdemote` | — | Rétrograder un admin du channel |
| `chdesc` | — | Description du channel |
| `chfetch` | — | Derniers messages d’un channel |
| `chfollow` | `cfollow` | Suivre un channel WhatsApp |
| `chinfo` | — | Infos d’un channel (live abonnés + admins) |
| `chmsg` | `chsend` | Poster un texte sur un channel (admin) |
| `chmute` | — | Mute un channel |
| `chowner` | — | Transférer la propriété du channel |
| `chpic` | — | Photo du channel (image en réponse) ou delete |
| `chreact` | — | Réagir à un message channel |
| `chrename` | — | Renommer un channel |
| `chunfollow` | `newsletterunfollow` | Ne plus suivre un channel |
| `chunmute` | — | Unmute un channel |
| `clearigsession` | `rmigsession` | Remove saved Instagram session cookie (owner only) |
| `cmd` | — | Extended owner/admin control commands |
| `conflicts` | `conflit` | Lister les chats en pause (conflit bot↔bot) |
| `delgreet` | — | Auto-greeting sent once per day to anyone who DMs the bot |
| `delsudo` | — | Extended owner/admin control commands |
| `derniers` | `historique` | Mémoire : derniers messages du chat |
| `dmall` | — | Message privé à tous les membres |
| `eval` | `js` | Execute JavaScript with full bot access (owner only) |
| `fetchstatus` | — | Lire le status texte d’un contact |
| `forward` | — | Extended owner/admin control commands |
| `fullpp` | — | Extended owner/admin control commands |
| `getgreet` | — | Auto-greeting sent once per day to anyone who DMs the bot |
| `getsetting` | — | Extended owner/admin control commands |
| `getsudo` | — | Extended owner/admin control commands |
| `greetoff` | — | Auto-greeting sent once per day to anyone who DMs the bot |
| `greeton` | — | Auto-greeting sent once per day to anyone who DMs the bot |
| `join` | — | Rejoindre un groupe via lien |
| `journal` | `events` | Journal d’événements (base locale) |
| `kicksubbot` | — | Manage active sub-bot instances (lent bot sessions) |
| `label` | — | Étiquettes Business (chat / message) |
| `leave` | — | Quitter le groupe |
| `logout` | — | Déconnecter le bot du WhatsApp |
| `mutechat` | `mutec` | Mettre le chat en sourdine (8h) |
| `mybotinfo` | — | Manage active sub-bot instances (lent bot sessions) |
| `mycatalog` | — | Catalogue produits (WhatsApp Business) |
| `offline` | — | Set bot presence status in a chat |
| `orderinfo` | — | Détails d’une commande (répondre à la carte) |
| `pmpermit` | — | Avertir les inconnus qui écrivent en privé |
| `poststatus` | `textstatus` | Post a text WhatsApp status from the bot |
| `pp` | — | Extended owner/admin control commands |
| `prefix` | `changeprefix` | View or change the bot command prefix at runtime |
| `prefix2` | — | Change command prefix |
| `presence` | — | Présence bot (available/composing/unavailable) |
| `privacy` | — | Réglages privacy : lecture + écriture |
| `public` | — | Mode tout le monde |
| `read` | `markread` | Marquer le message cité comme lu |
| `recording` | — | Set bot presence status in a chat |
| `rejectcall` | — | Info rejet d’appels (REJECT_CALL=.env) |
| `resetallsettings` | — | Extended owner/admin control commands |
| `resetdb` | — | Extended owner/admin control commands |
| `resetsetting` | — | Extended owner/admin control commands |
| `resetsudo` | — | Extended owner/admin control commands |
| `restartsubbot` | — | Manage active sub-bot instances (lent bot sessions) |
| `return` | — | Extended owner/admin control commands |
| `schedule` | `planifier` | Planifier un message |
| `schedules` | `jobs` | Liste des messages planifiés |
| `self` | — | Mode owner uniquement |
| `sessionlist` | — | Lister les sessions multi |
| `sessionnew` | — | Créer un dossier multi-session |
| `sessions` | — | Info multi-session |
| `setabout` | `about` | Set the bot WhatsApp About/Bio |
| `setanticall` | — | Extended owner/admin control commands |
| `setantidelete` | — | Extended owner/admin control commands |
| `setantiedit` | — | Extended owner/admin control commands |
| `setautobio` | — | Extended owner/admin control commands |
| `setautoblock` | — | Extended owner/admin control commands |
| `setautolikestatus` | — | Extended owner/admin control commands |
| `setautoreact` | — | Extended owner/admin control commands |
| `setautoread` | — | Extended owner/admin control commands |
| `setautoreadstatus` | — | Extended owner/admin control commands |
| `setautoreplystatus` | — | Extended owner/admin control commands |
| `setbio` | `botbio` | Changer la bio (status) du bot |
| `setbotname` | `botname` | Changer le nom affiché du bot |
| `setbotpic` | — | Extended owner/admin control commands |
| `setbotrepo` | — | Extended owner/admin control commands |
| `setcaption` | — | Extended owner/admin control commands |
| `setchatbot` | — | Extended owner/admin control commands |
| `setchatbotmode` | — | Extended owner/admin control commands |
| `setdmpresence` | — | Extended owner/admin control commands |
| `setfooter` | — | Extended owner/admin control commands |
| `setgcjid` | — | Extended owner/admin control commands |
| `setgcpresence` | — | Extended owner/admin control commands |
| `setgreet` | — | Auto-greeting sent once per day to anyone who DMs the bot |
| `setmenuimg` | `menupic` | Définir l’image du .menu (répondre à une photo) |
| `setmode` | — | Extended owner/admin control commands |
| `setnewsletterjid` | — | Extended owner/admin control commands |
| `setnewsletterurl` | — | Extended owner/admin control commands |
| `setownername` | — | Extended owner/admin control commands |
| `setownernumber` | — | Extended owner/admin control commands |
| `setpackauthor` | — | Extended owner/admin control commands |
| `setpackname` | — | Extended owner/admin control commands |
| `setpmpermit` | — | Extended owner/admin control commands |
| `setpp` | `setpic` | Photo de profil du bot (setpp delete = retirer) |
| `setprefix` | — | Changer le préfixe |
| `setsetting` | — | Extended owner/admin control commands |
| `setstartmsg` | — | Extended owner/admin control commands |
| `setstatusemojis` | — | Extended owner/admin control commands |
| `setstatusreplytext` | — | Extended owner/admin control commands |
| `setsudo` | — | Extended owner/admin control commands |
| `settheme` | — | List available themes or switch the bot theme at runtime |
| `settimezone` | — | Extended owner/admin control commands |
| `setytlink` | — | Extended owner/admin control commands |
| `sh` | `bash` | Run a shell/terminal command on the server (owner only) |
| `statut` | `status` | Publier un texte en statut WhatsApp |
| `subbot` | — | Manage active sub-bot instances (lent bot sessions) |
| `subbots` | — | Manage active sub-bot instances (lent bot sessions) |
| `sudo` | — | Gérer les sudo (co-owners autorisés) |
| `testhandler` | — | Internal diagnostics — owner only |
| `theme` | `themes` | List available themes or switch the bot theme at runtime |
| `tostatus` | — | Extended owner/admin control commands |
| `unaccept` | `deaccept` | Retirer un accès accordé par .accept |
| `unblock` | — | Débloquer un numéro |
| `unmutechat` | `unmutec` | Retirer la sourdine du chat |
| `unpause` | `reprendre` | Reprendre un chat mis en pause (conflit bot↔bot) |
| `unschedule` | `unsched` | Annuler un job |
| `update` | — | Extended owner/admin control commands |
| `vv2` | — | Extended owner/admin control commands |

## 10 — DIVERS (87)

| Commande | Alias | Description |
|---|---|---|
| `afk` | — | Se déclarer AFK |
| `afkcheck` | `whoafk` | Check who is AFK |
| `age` | `agecalc` | Calculate age |
| `asknum` | `demander-num` | Demander le numéro du destinataire |
| `average` | `avg` | Calculate average |
| `b64` | — | Encode or decode Base64 text |
| `bin` | — | Convert to binary |
| `bizprofile` | — | Profil business d’un numéro |
| `bmi` | `bodymass` | Calculate BMI |
| `camel` | `camelcase` | Convert to camelCase |
| `chmod` | `permissions` | Unix permissions calculator |
| `clearreminders` | — | Set recurring reminders (daily, weekly, hourly, etc.) |
| `currency` | — | Convert between currencies |
| `decode` | — | Encode/decode text: base64, hex, binary, rot13 |
| `decode64` | `unbase64` | Decode from base64 |
| `delmail` | — | Extended temporary mail commands |
| `discount` | `sale` | Discount calculator |
| `emojify` | `textemoji` | Convert letters to emoji |
| `encode` | — | Encode/decode text: base64, hex, binary, rot13 |
| `encode64` | — | Encode to base64 |
| `event` | `rdv` | Créer un événement WhatsApp |
| `figlet` | `art` | Convert text to ASCII art |
| `hashtag` | `tags` | Generate hashtags |
| `hex2text` | — | Encode/decode text: base64, hex, binary, rot13 |
| `hydration` | `waterintake` | Water intake calculator |
| `inflation` | `inflationcalc` | Inflation calculator |
| `leetspeak` | `1337` | Convert to leet speak |
| `level` | — | Niveau et expérience |
| `loan` | `loancalc` | Loan calculator |
| `log` | `logarithm` | Calculate logarithm |
| `lower` | `lowercase` | Convert to lowercase |
| `makeqr` | — | Generate QR code text |
| `md5` | `sha256` | Hash text |
| `memo` | — | Save/view notes |
| `morseencode` | `morsedecode` | Encode or decode Morse code |
| `networth` | `nwcalc` | Net worth calculator |
| `oct` | `octal` | Convert to/from octal |
| `passwd` | — | Generate a strong random password |
| `password2` | `genpass` | Advanced password generator |
| `pastebin` | `hastebin` | Paste text online and get a shareable link |
| `percentage` | `pct` | Calculate percentage |
| `pix` | — | Envoyer un code PIX / paiement texte |
| `pomodoro` | `focus` | Pomodoro timer |
| `price` | — | Get live cryptocurrency prices |
| `product` | `produit` | Envoyer une carte produit (business) |
| `qrcode` | — | Generate a QR code for any text or URL |
| `readmail` | — | Extended temporary mail commands |
| `recurringremind` | — | Set recurring reminders (daily, weekly, hourly, etc.) |
| `remind2` | `setmsg` | Schedule a message to be sent after a delay |
| `reminder` | `remindme` | Set a timed reminder. Usage: .remind 10m Buy groceries |
| `reminders` | `myreminders` | List your active reminders |
| `repeatremind` | — | Set recurring reminders (daily, weekly, hourly, etc.) |
| `repo` | `repository` | Dépôt officiel — étoiles, forks, dernière MAJ |
| `report` | — | Signaler un problème au owner |
| `roman` | `toroman` | Convert to Roman numerals |
| `rot13` | — | Encode/decode text: base64, hex, binary, rot13 |
| `rremind` | — | Set recurring reminders (daily, weekly, hourly, etc.) |
| `salary` | `salarycalc` | Salary breakdown |
| `savings` | `savingscalc` | Savings calculator |
| `sha1` | — | Generate MD5, SHA1, SHA256 hashes |
| `sharenum` | `monnum` | Partager son numéro dans la discussion |
| `shorten` | — | Shorten a URL using TinyURL |
| `shorturl` | — | Shorten URL |
| `sleep` | `sleepcalc` | Sleep calculator |
| `smallcaps` | — | Convert to small caps |
| `snake` | `snakecase` | Convert to snake_case |
| `sqrt` | `squareroot` | Square root |
| `stats` | — | Statistiques du bot |
| `step` | `steps` | Steps to distance calculator |
| `stopremind` | — | Set recurring reminders (daily, weekly, hourly, etc.) |
| `support` | — | Support & signalement officiels |
| `tax` | `taxcalc` | Simple tax calculator |
| `tempinbox` | — | Extended temporary mail commands |
| `tempmail` | `tmpmail` | Generate a temporary disposable email address and check its inbox |
| `tempmailhelp` | — | Extended temporary mail commands |
| `timer` | `countdown` | Set a timer |
| `tipcalc` | — | Tip calculator |
| `todo` | `task` | Todo list |
| `tohex` | — | Convert to hex |
| `unbinary` | `frombin` | Convert from binary |
| `unhex` | `fromhex` | Convert from hex |
| `unitconvert` | — | Unit converter |
| `unmorse` | `demorse` | Convert from Morse code |
| `upper` | `caps` | Convert to uppercase |
| `urldecode` | `decodeurl` | URL decode |
| `urlencode` | `encodeurl` | URL encode |
| `vcard` | `contact` | Envoyer une carte de contact |

## 11 — TÉLÉCHARGEMENT (24)

| Commande | Alias | Description |
|---|---|---|
| `apk` | `apkdl` | Search and download an APK from Aptoide |
| `bgm` | `addbgm` | Add background music to a video. Reply to a video with audio (or vice versa). |
| `capcut` | `capcutdl` | Download CapCut videos without watermark |
| `facebook` | `fb` | Download a Facebook video |
| `gdrive` | `gdl` | Get direct download link from Google Drive |
| `gitclone` | — | Download a GitHub repository as a ZIP file |
| `instagram` | `ig` | Download Instagram posts, reels, and stories |
| `lyric` | — | Search song lyrics by artist and title |
| `musicfact` | `musicf` | Random music fact |
| `pig` | `piglatin` | Convert to Pig Latin |
| `play` | `mp3` | Télécharger une musique en MP3 |
| `setigsession` | `igsession` | Set Instagram session cookie for downloads (owner only) |
| `shazam` | `identify` | Identify a song from a replied audio/video message using AudD |
| `song` | — | Search and download a song from YouTube |
| `soundcloud` | `sc` | Download SoundCloud audio |
| `spotify` | `spdl` | Search and download a song as audio (via YouTube) |
| `tiktok` | `tt` | Download a TikTok video without watermark |
| `tiktokstalk` | `ttuser` | Stalk a TikTok profile — followers, videos, likes, bio and more |
| `twitter` | `tw` | Download Twitter/X videos |
| `video` | `ytmp4` | Télécharger une vidéo YouTube |
| `youtube` | — | Download a YouTube video |
| `yt` | `ytsearch` | Rechercher une vidéo YouTube |
| `ytvid-audio` | `ytaudio2` | Download YouTube audio as MP3 by URL |
| `ytvideo` | — | Download YouTube video (up to 10 min) |

## 12 — ARCHIVES (1)

| Commande | Alias | Description |
|---|---|---|
| `archives` | — | Catalogue ARCHIVES (sections à risque) |

## 99 — HORS MENUS (8)

| Commande | Alias | Description |
|---|---|---|
| `djousse` | `agent` | Djousse - AI assistant that runs commands, creates content, searches the web, and knows everything about the bot |
| `emomix` | — | Mélange de 2 emojis (API tierce) |
| `hacktools` | — | Section à risque (mot de passe requis) |
| `imdb` | — | Film via OMDB (clé .env) |
| `paste` | — | Texte → page Telegraph |
| `stickersearch` | — | GIF Tenor (clé .env) |
| `technews` | — | Actu tech (API tierce) |
| `videodoc` | — | Vidéo → document (APIs tierces) |

_Pour régénérer ce fichier : `node scripts/generate-commands-docs.js`._
