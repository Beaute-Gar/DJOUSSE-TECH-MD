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
