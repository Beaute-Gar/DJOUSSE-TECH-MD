'use strict';
/**
 * lib/auto-status.js — AUTO-STATUTS : vue · réaction · réponse
 * ─────────────────────────────────────────────────────────────
 * Implémentation unique des 3 clés du cahier des charges :
 *   AUTO_STATUS_SEEN=true     vue automatique de chaque statut reçu
 *   AUTO_STATUS_REACT=true    réaction (emoji aléatoire) automatique
 *   AUTO_STATUS_REPLY=false   réponse en DM à l'auteur du statut
 *
 * Les pièges réels contournés (constatés sur des bots en production) :
 *   1. RÉACTION : WhatsApp AVALE silencieusement la réaction si l'option
 *      `statusJidList` manque ou contient un JID @lid — il faut passer les
 *      JID téléphone (@s.whatsapp.net) de l'auteur et du bot ;
 *   2. VUE : `sendReceipt('status@broadcast', auteur, [id], 'read')` est
 *      l'API fiable ; readMessages reste en repli ;
 *   3. L'auteur d'un statut est parfois un @lid : on résout son JID
 *      téléphone (key.participantAlt / senderPn) pour réaction et réponse ;
 *   4. RETRANSMISSIONS : le dédup par ID est déjà fait en amont dans
 *      index.js (processedMessages) — pas de second filtre ici (zéro doublon).
 *
 * Tous les envois passent par send() de lib/wa-send.js (garantie G2).
 * Réglages runtime : .autoview / .autolike / .autostatus (voir handler.js)
 * qui surchargent la config via state.settings.autoStatus.
 */

const config = require('../config');
const { send } = require('./wa-send');
/* Un seul unwrap dans le projet (guard) — utilisé pour citer le statut */
const { unwrap } = require('../guard/src/utils/message');

/** Dernier recours si la liste d'emojis est vide/cassée. */
const FALLBACK_EMOJI = '👍';

/**
 * Résolution effective des 3 drapeaux : override runtime (état persisté)
 * l'emporte sur la valeur .env. `undefined` = pas d'override.
 */
function effective(overrides = {}) {
  const flag = (value, fallback) => (value !== undefined ? !!value : fallback);
  return {
    seen: flag(overrides.seen, config.autoStatusSeen),
    react: flag(overrides.react, config.autoStatusReact),
    reply: flag(overrides.reply, config.autoStatusReply),
  };
}

/**
 * JID TÉLÉPHONE (@s.whatsapp.net) de l'auteur d'un statut.
 * Préfère participantPn (champ officiel Baileys 6.7.x : numéro réel quand
 * participant est un @lid ; participantAlt reste en repli pour les forks) —
 * WhatsApp rejette silencieusement les réactions portées par un @lid.
 * @returns {string|null}
 */
function phoneJidOf(key = {}) {
  for (const jid of [key.participantPn, key.participantAlt, key.participant, key.senderPn]) {
    if (jid && jid.includes('@s.whatsapp.net')) return jid;
  }
  return null;
}

/** JID téléphone du bot lui-même (« 237…:12@s.whatsapp.net » → sans l'appareil). */
function botPhoneJid(sock) {
  const raw = (sock && sock.user && sock.user.id) || '';
  return raw.replace(/:\d+@/, '@');
}

/** Emoji aléatoire dans la liste configurée (CUSTOM_REACT_EMOJIS). */
function pickEmoji() {
  const list = (config.statusEmojis || [])
    .map((e) => String(e).trim())
    .filter((e) => e && e.length <= 8);
  if (!list.length) return FALLBACK_EMOJI;
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Moteur auto-statuts — appelé par handleMessage() pour chaque
 * message dont le chat est status@broadcast (avant tous les filtres).
 *
 * @param {object} sock       socket Baileys
 * @param {object} msg        message brut (clé + contenu)
 * @param {object} [overrides] overrides runtime { seen, react, reply }
 * @returns {Promise<{seen: boolean, react: boolean, reply: boolean}>}
 *          ce qui a réellement été tenté (utile pour les tests/journal)
 */
async function handleStatus(sock, msg, overrides = {}) {
  const done = { seen: false, react: false, reply: false };
  try {
    if (!sock || !msg?.key || msg.key.fromMe) return done;
    const participant = msg.key.participant;           // auteur (peut être @lid)
    if (!participant) return done;                     // écho de notre propre statut
    const flags = effective(overrides);
    if (!flags.seen && !flags.react && !flags.reply) return done;

    const phoneJid = phoneJidOf(msg.key);
    const botJid = botPhoneJid(sock);

    /* ── 1. VUE : receipt « read » sur le broadcast (API fiable) ── */
    if (flags.seen) {
      try {
        if (typeof sock.sendReceipt === 'function') {
          await sock.sendReceipt('status@broadcast', participant, [msg.key.id], 'read');
          done.seen = true;
        } else if (typeof sock.readMessages === 'function') {
          await sock.readMessages([msg.key]);
          done.seen = true;
        }
      } catch (e) {
        console.error('[STATUS] vue impossible:', e.message);
      }
    }

    /* ── 2. RÉACTION : statusJidList OBLIGATOIRE (sinon avalée) ── */
    if (flags.react) {
      const emoji = pickEmoji();
      const statusJidList = [phoneJid, botJid].filter(Boolean);
      try {
        await send(sock, 'status@broadcast', {
          react: { text: emoji, key: msg.key },
        }, { statusJidList });
        done.react = true;
      } catch (e) {
        console.error('[STATUS] réaction impossible:', e.message);
      }
    }

    /* ── 3. RÉPONSE DM à l'auteur, citant le statut ── */
    const replyJid = phoneJid || participant;
    if (flags.reply && config.autoStatusMsg && replyJid) {
      try {
        const inner = unwrap(msg.message || {});
        await send(sock, replyJid, {
          text: config.autoStatusMsg,
          contextInfo: {
            stanzaId: msg.key.id,
            participant: replyJid,
            quotedMessage: inner,
          },
        });
        done.reply = true;
      } catch (e) {
        console.error('[STATUS] réponse impossible:', e.message);
      }
    }
  } catch (e) {
    console.error('[STATUS] moteur:', e.message);
  }
  return done;
}

module.exports = { handleStatus, effective, phoneJidOf, botPhoneJid, pickEmoji };
