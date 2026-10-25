'use strict';

/** Retourne { m, edited } : le contenu réel + un drapeau « c'est une édition ». */
function unwrapInfo(message, followEdits = true) {
  let m = message || {};
  let edited = false;
  for (let i = 0; i < 6; i++) {
    // Édition : protocolMessage.editedMessage (type 14) — sinon un membre envoie « salut »
    // puis ÉDITE son message pour y mettre un lien et échappe à l'anti-lien.
    if (followEdits && m.protocolMessage && m.protocolMessage.editedMessage) { m = m.protocolMessage.editedMessage; edited = true; continue; }
    const inner =
      (m.ephemeralMessage && m.ephemeralMessage.message) ||
      (m.viewOnceMessage && m.viewOnceMessage.message) ||
      (m.viewOnceMessageV2 && m.viewOnceMessageV2.message) ||
      (m.viewOnceMessageV2Extension && m.viewOnceMessageV2Extension.message) ||
      (m.documentWithCaptionMessage && m.documentWithCaptionMessage.message) ||
      (followEdits && m.editedMessage && m.editedMessage.message && m.editedMessage.message.protocolMessage && m.editedMessage.message.protocolMessage.editedMessage);
    if (!inner) break;
    if (m.editedMessage) edited = true;
    m = inner;
  }
  return { m, edited };
}
/** unwrap « simple » (sans édition) : utilisé par handler.js pour le routage des commandes. */
const unwrap = (message) => unwrapInfo(message, false).m;

/* ── UNIQUE extracteur de texte du projet (G4 « parseurs ») ─────────────
   handler.js, index.js et parse() passent tous par ici : toute nouvelle
   variante de message (enveloppe ou type) ne se rajoute qu'UNE fois. */
function textOf(content) {
  if (!content) return '';
  /* Déballage si l'appelant n'a pas tout aplati (éphémère, vue unique…) */
  let c = content;
  for (let i = 0; i < 4; i++) {
    const inner =
      c.ephemeralMessage?.message ||
      c.viewOnceMessage?.message ||
      c.viewOnceMessageV2?.message ||
      c.viewOnceMessageV2Extension?.message ||
      c.documentWithCaptionMessage?.message ||
      null;
    if (!inner) break;
    c = inner;
  }
  return (
    c.conversation ||
    c.extendedTextMessage?.text ||
    c.imageMessage?.caption ||
    c.videoMessage?.caption ||
    c.documentMessage?.caption ||
    ''
  );
}

/** UNIQUE extracteur de contextInfo (mentions, citation, participant). */
function ctxInfo(content) {
  if (!content) return null;
  return (
    content.extendedTextMessage?.contextInfo ||
    content.imageMessage?.contextInfo ||
    content.videoMessage?.contextInfo ||
    content.documentMessage?.contextInfo ||
    content.stickerMessage?.contextInfo ||
    content.audioMessage?.contextInfo ||
    null
  );
}

const STATUS_KEYS = ['groupStatusMentionMessage', 'groupMentionedMessage'];
/** Détecte l'identification d'un groupe dans un statut (variantes selon versions de WhatsApp/Baileys). */
function hasStatusMention(o, depth = 0) {
  if (!o || typeof o !== 'object' || depth > 5) return false;
  for (const k of Object.keys(o)) {
    if (STATUS_KEYS.includes(k)) return true;
    if (k === 'protocolMessage' && o[k] && (o[k].type === 25 || o[k].type === 'STATUS_MENTION_MESSAGE')) return true;
    if (k === 'messageContextInfo') continue;
    if (hasStatusMention(o[k], depth + 1)) return true;
  }
  return false;
}

/** Extrait type, texte (incl. légendes), mentions et citation d'un message Baileys. */
function parse(msg) {
  const { m, edited } = unwrapInfo(msg.message);
  const type = Object.keys(m).find((k) => k !== 'messageContextInfo' && k !== 'senderKeyDistributionMessage') || '';
  const node = m[type] || {};
  let text = textOf(m);
  if (m.extendedTextMessage && m.extendedTextMessage.matchedText) text += ' ' + m.extendedTextMessage.matchedText;
  const ctx = ctxInfo(m) || node.contextInfo || {};
  return {
    type,
    text: typeof text === 'string' ? text : '',
    mentions: ctx.mentionedJid || [],
    quotedParticipant: ctx.participant || null,
    isSticker: type === 'stickerMessage',
    isVoice: type === 'audioMessage' && !!node.ptt,
    isEdit: edited,
    isStatusMention: hasStatusMention(msg.message),
    isForwarded: !!(ctx.isForwarded || (ctx.forwardingScore || 0) > 0),
    isContact: type === 'contactMessage' || type === 'contactsArrayMessage',
    isPoll: /^pollCreationMessage/.test(type),
    isMedia: ['imageMessage', 'videoMessage', 'documentMessage', 'audioMessage'].includes(type),
  };
}

module.exports = { parse, unwrap, unwrapInfo, textOf, ctxInfo, hasStatusMention };
