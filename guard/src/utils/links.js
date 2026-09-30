'use strict';
const TLDS = 'com|net|org|io|me|cm|fr|info|xyz|link|site|online|app|dev|co|ly|gg|tv|ru|biz|shop|club|top|vip|cc|ws|to|tk|ml|ga|cf|gq|store|tech|live|pro|africa';
const SRC =
  '(?:https?:\\/\\/|www\\.)[^\\s]+' +
  '|\\b(?:chat\\.whatsapp\\.com|wa\\.me|whatsapp\\.com\\/channel|t\\.me|telegram\\.me|discord\\.gg|bit\\.ly|tiktok\\.com|instagram\\.com|youtu\\.be|youtube\\.com|facebook\\.com|fb\\.me)(?:\\/[^\\s]*)?' +
  '|\\b[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.(?:' + TLDS + ')\\b(?:\\/[^\\s]*)?';

const normalize = (t) =>
  String(t || '')
    .replace(/[\u200B-\u200F\u2060\uFEFF]/g, '')
    .replace(/\[\.\]|\(\.\)|\{\.\}/g, '.')
    .replace(/h(?:xx|tt)ps?:\/\//gi, 'http://');

function host(link) {
  return link.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[\/?#]/)[0].toLowerCase();
}

/** Retourne la liste des liens détectés (hors domaines whitelistés). */
function findLinks(text, whitelist = []) {
  const re = new RegExp(SRC, 'gi'); // nouvelle instance => pas de bug lastIndex
  const found = normalize(text).match(re) || [];
  const wl = whitelist.map((w) => w.toLowerCase().replace(/^www\./, ''));
  return found.filter((l) => {
    const h = host(l);
    return !wl.some((w) => h === w || h.endsWith('.' + w));
  });
}

module.exports = { findLinks, host };
