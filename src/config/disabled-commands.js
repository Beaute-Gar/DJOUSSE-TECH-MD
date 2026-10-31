'use strict';
/**
 * config/disabled-commands.js — commandes RETIRÉES du bot
 * ────────────────────────────────────────────────────────────────────
 * Chaque nom listé ici est ignoré par le chargeur de plugins
 * (src/lib/plugin-loader.js) : la commande n'existe plus, elle ne
 * répond plus et n'est plus enregistrée dans le registre.
 *
 * Critère : le service externe est MORT (voir api-report.txt du
 * 2026-10-29) et la commande ne peut plus rien renvoyer d'utile.
 * Retirer un nom de cette liste suffit à réactiver la commande.
 *
 * Désactiver ce filtre sans toucher au code :
 *   ENABLE_DEAD_COMMANDS=1
 */

const DEAD = {
  /* jikan.moe — timeout 15 s (12 commandes) */
  anime:        'jikan.moe timeout',
  manga:        'jikan.moe timeout',
  topanime:     'jikan.moe timeout',
  topmanga:     'jikan.moe timeout',
  character:    'jikan.moe timeout',
  animeinfo:    'jikan.moe timeout',
  mangainfo:    'jikan.moe timeout',
  airing:       'jikan.moe timeout',
  seasonal:     'jikan.moe timeout',
  studio:       'jikan.moe timeout',
  upcoming:     'jikan.moe timeout',
  animegenre:   'jikan.moe timeout',

  /* animechan.io — HTTP 404 */
  animequote:   'animechan.io 404',

  /* waifu.im — ENOTFOUND (images et personnages).
     Les RÉACTIONS (hug, kiss, pat, slap…) ne sont plus ici : elles sont
     reprises par otakugifs.xyz dans 07-fun/_legacy-anime-reactions.js. */
  waifu:        'waifu.pics + waifu.im morts',
  neko:         'waifu.pics + waifu.im morts',
  maid:         'waifu.im ENOTFOUND',
  husbando:     'waifu.im ENOTFOUND',
  kamisato:     'waifu.im ENOTFOUND',
  megumin:      'waifu.im ENOTFOUND',
  rias:         'waifu.im ENOTFOUND',
  shinobu:      'waifu.im ENOTFOUND',
  raiden:       'waifu.im ENOTFOUND',
  selfies:      'waifu.im ENOTFOUND',
  uniform:      'waifu.im ENOTFOUND',

  /* api.quotable.io — CERT_HAS_EXPIRED (quote/citation/inspire/motivation) */
  quote:        'quotable.io CERT_HAS_EXPIRED',
  citation:     'quotable.io CERT_HAS_EXPIRED',
  inspire:      'quotable.io CERT_HAS_EXPIRED',
  motivation:   'quotable.io CERT_HAS_EXPIRED',

  /* gpt legacy — les deux endpoints sont morts (404 / ENOTFOUND) ; .ai le remplace */
  gpt:          'endpoints IA legacy morts',
  chatgpt:      'endpoints IA legacy morts',

  /* quotly.ryzl.xyz — timeout */
  quotly:       'quotly.ryzl.xyz timeout',
  q2s:          'quotly.ryzl.xyz timeout',
  quote2img:    'quotly.ryzl.xyz timeout',
  quotesticker: 'quotly.ryzl.xyz timeout',

  /* Divers services morts */
  cleanuri:     'cleanuri.com timeout',
  pixhost:      'api.pixhost.to HTTP 400',
  tempmail:     'api.mail.gw timeout',
  unsplash:     'unsplash API 401 (clé requise)',
  happymod:     'happymod.com DNS mort',

  /* api.mail.gw — timeout vérifié le 2026-10-31 (toute la famille tempmail) */
  delmail:      'api.mail.gw timeout',
  readmail:     'api.mail.gw timeout',
  tempinbox:    'api.mail.gw timeout',
  tempmailhelp: 'api.mail.gw timeout',

  /* saurav.tech — fetch failed ; ESPN ne couvre pas les « news » */
  sportnews:    'saurav.tech NewsAPI injoignable (2026-10-31)',

  /* api.sampleapis.com — HTTP 404 vérifié le 2026-10-31 */
  saying:       'sampleapis.com/proverbs 404',
  adage:        'sampleapis.com/proverbs 404',

  /* Threads : doc_id GraphQL périmé + saveinsta.app DNS mort */
  threads:      'threads.net doc_id périmé ; v3.saveinsta.app DNS mort',
  threadsdl:    'threads.net doc_id périmé ; v3.saveinsta.app DNS mort',

  /* ══ NETTOYAGE RENDER / DOUBLONS (liste appliquée le 2026-10-31) ══
     Retraits demandés explicitement : doublons d'une commande déjà
     présente, ou commandes inutilisables sur un hébergement cloud
     (système de fichiers éphémère, pas de shell, pas de binaire
     système, redémarrage géré par la plateforme). */

  /* Doublons — une seule commande conservée par fonction */
  list:          'doublon de .menu',
  ascii2:        'doublon de .ascii',
  ascii3:        'doublon de .ascii',
  bio2:          'doublon de .bio',
  color2:        'doublon de .color',
  countdown2:    'doublon de .countdown',
  countdown3:    'doublon de .countdown',
  emoji2:        'doublon de .emoji',
  matrixtext:    'doublon de .matrix',
  myip:          'doublon de .ip',
  neonlight:     'doublon de .neon',
  phone2:        'doublon de .fakephone',
  poll2:         'doublon de .poll',
  quote2:        'doublon de .quote',
  save2:         'doublon de .save',
  status2:       'doublon de .statut',
  warning:       'doublon de .warn',
  facts:         'doublon de .fact',
  flipcoin:      'doublon de .flip/.coin',
  fortune2:      'doublon de .fortune',
  hangman:       'doublon de .hang',
  horoscope2:    'doublon de .horo',
  joke2:         'doublon de .joke',
  jokeen:        'doublon de .joke',
  jokes:         'doublon de .joke',
  magic8:        'doublon de .8ball',
  magicball:     'doublon de .8ball',
  rateme:        'doublon de .rate',
  rolldice:      'doublon de .roll',
  shipping:      'doublon de .ship',
  ttt:           'doublon de .tictactoe',
  wouldyourather: 'doublon de .wouldyou',
  biblie:        'doublon de .bible',
  wikipedia:     'doublon de .wiki',
  calculate:     'alias de .calc',
  prefix2:       'doublon de .prefix',
  sessionlist:   'doublon de .sessions',
  password2:     'doublon de .password',
  qrcode:        'doublon de .qr',
  remind2:       'doublon de .remind',
  reminder:      'doublon de .remind',
  shorturl:      'doublon de .shorten',
  antibadwords:  'doublon de .antibadword',
  antidelete:    'alias de .antidel',
  antilink2:     'variante de .antilink',
  delbad:        'doublon de .antibadword',
  addbad:        'doublon de .antibadword',
  antibad:       'doublon de .antibadword',
  floodset:      'doublon de .antiflood',
  togstatus:     'alias de .togglestatus',
  joinv4:        'doublon de .join',
  revokev4:      'doublon de .revoke',
  listadmins:    'doublon de .admins',
  gpt4:          'doublon de .gpt',
  gpt4o:         'doublon de .gpt',
  'gpt4o-mini':  'doublon de .gpt',
  mode2:         'doublon de .mode',
  summary:       'doublon de .summarize',
  ping2:         'doublon de .ping',
  b64:           'doublon de .base64',

  /* Inutilisables sur Render (FS éphémère, pas de shell ni de binaire) */
  sh:            'shell impossible sur Render',
  eval:          'exécution de code arbitraire, bloquée sur Render',
  clearcache:    'sans objet : système de fichiers éphémère',
  speedtest:     'binaire système absent sur Render',
  netspeed:      'binaire système absent sur Render',
  restart2:      'redémarrage géré par la plateforme',
  antiban:       'redondant avec .antibot',
  backupgroup:   'sauvegarde locale perdue (FS éphémère)',
  groupbackup:   'sauvegarde locale perdue (FS éphémère)',
  archives:      'catalogue local sans objet sur Render',
  chmod:         'droits POSIX sans objet sur Render',
  testhandler:   'commande de développement',
  conflicts:     'commande de développement',
  __advanced_onmessage__: 'hook interne, pas une commande utilisateur',
  alwaysonline:  'géré par la plateforme (keep-alive externe)',
  autodlstatus:  'état local éphémère',
  didong:        'aucun service associé',
};

/* Clé Tenor/Giphy absente → la recherche de stickers GIF ne peut rien
   renvoyer. Elle se réactive d'elle-même dès que la clé est dans .env. */
if (!process.env.TENOR_API_KEY && !process.env.GIPHY_API_KEY) {
  DEAD.findsticker = 'clé TENOR_API_KEY absente';
  DEAD.giphy = 'clé TENOR_API_KEY absente';
}

const isOn = (value) => ['1', 'on', 'true', 'yes'].includes(String(value || '').trim().toLowerCase());

module.exports = {
  DEAD,
  DISABLED_COMMANDS: isOn(process.env.ENABLE_DEAD_COMMANDS) ? new Set() : new Set(Object.keys(DEAD)),
  isDisabled: (name) => !isOn(process.env.ENABLE_DEAD_COMMANDS) && Object.hasOwn(DEAD, String(name || '').toLowerCase()),
};
