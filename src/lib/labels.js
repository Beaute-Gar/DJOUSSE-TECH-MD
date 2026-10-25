'use strict';
/**
 * Cache des étiquettes (labels) WhatsApp — Baileys n'expose AUCUNE API
 * de lecture : les définitions arrivent par labels.edit et les
 * associations chat↔étiquette par labels.association (listeners
 * index.js), consommées par `.label list` (lib/missing.js).
 * Le cache se remplit au fil des événements : il peut être vide au
 * démarrage tant qu'aucune étiquette n'a changé.
 */
const defs = new Map();   // labelId -> { name, color }
const chats = new Map();  // chatJid -> Set(labelId)

/** labels.edit : définition (création / renommage / suppression) */
function onEdit(label) {
  try {
    if (!label?.id) return false;
    if (label.deleted) {
      defs.delete(label.id);
      for (const set of chats.values()) set.delete(label.id);
    } else {
      defs.set(label.id, { name: label.name || label.id, color: label.color });
    }
    return true;
  } catch (_) {
    return false;
  }
}

/** labels.association : association chat↔étiquette (add / remove) */
function onAssociation(evt) {
  try {
    const assoc = evt?.association;
    if (!assoc || assoc.type !== 'label_jid' || !assoc.chatId || !assoc.labelId) return false;
    if (evt.type === 'remove') {
      const set = chats.get(assoc.chatId);
      if (set) set.delete(assoc.labelId);
      return true;
    }
    let set = chats.get(assoc.chatId);
    if (!set) {
      set = new Set();
      chats.set(assoc.chatId, set);
    }
    set.add(assoc.labelId);
    return true;
  } catch (_) {
    return false;
  }
}

/** Étiquettes d'un chat : [{ id, name }] (nom via labels.edit si connu) */
function listFor(chatJid) {
  const set = chats.get(chatJid);
  if (!set) return [];
  return [...set].map((id) => ({ id, name: defs.get(id)?.name || `#${id}` }));
}

module.exports = { onEdit, onAssociation, listFor, _defs: defs, _chats: chats };
