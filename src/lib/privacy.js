'use strict';
/**
 * Réglages de confidentialité WhatsApp — table des setters Baileys.
 * Valeurs conformes aux types WAPrivacy* de baileys/lib/Types/Chat.d.ts
 * (WAPrivacyValue, OnlineValue, GroupAddValue, ReadReceiptsValue,
 * CallValue, MessagesValue). Source unique pour `.privacy set`
 * (lib/missing.js) et les tests unitaires.
 */

const SETTERS = {
  lastseen: { fn: 'updateLastSeenPrivacy', values: ['all', 'contacts', 'contact_blacklist', 'none'] },
  online: { fn: 'updateOnlinePrivacy', values: ['all', 'match_last_seen'] },
  profilepic: { fn: 'updateProfilePicturePrivacy', values: ['all', 'contacts', 'contact_blacklist', 'none'] },
  status: { fn: 'updateStatusPrivacy', values: ['all', 'contacts', 'contact_blacklist', 'none'] },
  readreceipts: { fn: 'updateReadReceiptsPrivacy', values: ['all', 'none'] },
  groupadd: { fn: 'updateGroupsAddPrivacy', values: ['all', 'contacts', 'contact_blacklist'] },
  calls: { fn: 'updateCallPrivacy', values: ['all', 'known'] },
  messages: { fn: 'updateMessagesPrivacy', values: ['all', 'contacts'] },
  linkpreviews: { fn: 'updateDisableLinkPreviewsPrivacy', values: ['on', 'off'], bool: true },
};

/**
 * Contrôle les arguments de `.privacy set <clé> <valeur>`.
 * @returns {{ok:true,key:string,raw:string,arg:*,entry:object}
 *          |{ok:false,error:'MISSING'}
 *          |{ok:false,error:'KEY',allowed:string[]}
 *          |{ok:false,error:'VALUE',key:string,raw:string,allowed:string[]}}
 */
function parseSet(args) {
  const key = String(args?.[0] || '').toLowerCase();
  const raw = String(args?.[1] || '').toLowerCase();
  if (!key || !raw) return { ok: false, error: 'MISSING' };
  const entry = SETTERS[key];
  if (!entry) return { ok: false, error: 'KEY', key, allowed: Object.keys(SETTERS) };
  if (!entry.values.includes(raw)) return { ok: false, error: 'VALUE', key, raw, allowed: entry.values };
  // linkpreviews : 'off' signifie aperçus désactivés → true (isPreviewsDisabled)
  return { ok: true, key, raw, arg: entry.bool ? raw === 'off' : raw, entry };
}

module.exports = { SETTERS, parseSet };
