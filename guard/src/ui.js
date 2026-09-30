'use strict';
/** Fine couche sur ../../style.js : tout message du guard passe par ici. */
const S = require('../../style');

/** Cadre titré : chaque ligne devient « │✦ ligne » (glyphes via style.js) */
const frame = (title, lines = []) => S.buildFrame(title, lines.map((l) => S.note(l)));
/** « ÉTIQUETTE: valeur » (étiquette en alphabet officiel) */
const kv = (label, value) => `${S.toUnicode(label)}: ${value}`;
const success = (lines) => S.renderSuccess([].concat(lines));
const info = (lines) => S.renderInfo([].concat(lines));
const error = (lines) => S.renderError([].concat(lines));

/** on/off/true/false… → true | false | null (invalide) */
function parseSwitch(arg) {
  const a = String(arg || '').toLowerCase();
  if (['on', 'true', '1', 'oui', 'yes', 'activer', 'activate'].includes(a)) return true;
  if (['off', 'false', '0', 'non', 'no', 'desactiver', 'désactiver', 'deactivate'].includes(a)) return false;
  return null;
}
const onoff = (b) => (b ? 'ON ✅' : 'OFF ❌');

const ICONS = {
  antilink: '🔗', antibad: '🤬', antitag: '📢', antispam: '🧨', antiflood: '🌊', antimedia: '📎',
  antisticker: '🎭', antivoice: '🎙️', antistatus: '📵', antiforward: '↪️', antivirtex: '💣',
  anticontact: '👤', antipoll: '📊',
};

module.exports = { S, frame, kv, success, info, error, parseSwitch, onoff, ICONS };
