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

  /* waifu.pics DNS mort · waifu.im certificat invalide */
  waifu:        'waifu.pics + waifu.im morts',
  neko:         'waifu.pics + waifu.im morts',
  hug:          'waifu.pics DNS mort',
  pat:          'waifu.pics DNS mort',
  kiss:         'waifu.pics DNS mort',
  cuddle:       'waifu.pics DNS mort',
  slap:         'waifu.pics DNS mort',
  bonk:         'waifu.pics DNS mort',
  bite:         'waifu.pics DNS mort',
  blush:        'waifu.pics DNS mort',
  cry:          'waifu.pics DNS mort',
  dance:        'waifu.pics DNS mort',
  happy:        'waifu.pics DNS mort',
  laugh:        'waifu.pics DNS mort',
  nod:          'waifu.pics DNS mort',
  poke:         'waifu.pics DNS mort',
  shoot:        'waifu.pics DNS mort',
  smile:        'waifu.pics DNS mort',
  wave:         'waifu.pics DNS mort',
  wink:         'waifu.pics DNS mort',
  baka:         'waifu.pics DNS mort',
  maid:         'waifu.im certificat invalide',
  husbando:     'waifu.im certificat invalide',
  kamisato:     'waifu.im certificat invalide',
  megumin:      'waifu.im certificat invalide',
  rias:         'waifu.im certificat invalide',
  shinobu:      'waifu.im certificat invalide',

  /* api.quotable.io — certificat expiré */
  quote:        'quotable.io CERT_HAS_EXPIRED',

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
};

const isOn = (value) => ['1', 'on', 'true', 'yes'].includes(String(value || '').trim().toLowerCase());

module.exports = {
  DEAD,
  DISABLED_COMMANDS: isOn(process.env.ENABLE_DEAD_COMMANDS) ? new Set() : new Set(Object.keys(DEAD)),
  isDisabled: (name) => !isOn(process.env.ENABLE_DEAD_COMMANDS) && Object.hasOwn(DEAD, String(name || '').toLowerCase()),
};
