/**
 * Gestionnaire de saisies en attente
 * Intercepte les messages texte/fichier quand un utilisateur
 * est en état waiting_input ou waiting_file
 * DJOUSSE-TECH-MD
 */

const sessionManager = require('./sessionManager');
const { findCommandById } = require('./menuBuilder');
const { sendButtons, isPrivate, isGroup } = require('./buttonSender');

/**
 * Extrait le texte brut d'un message Baileys
 */
function extractText(message) {
  const msg = message.message;
  if (!msg) return null;

  if (msg.conversation) return msg.conversation;
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
  if (msg.buttonsResponseMessage?.selectedButtonId) return null; // C'est un bouton, pas du texte
  if (msg.interactiveResponseMessage) return null; // C'est un bouton
  if (msg.templateButtonReplyMessage) return null; // C'est un bouton

  return null;
}

/**
 * Vérifie si le message contient un média (image, vidéo, audio, document)
 */
function extractMedia(message) {
  const msg = message.message;
  if (!msg) return null;

  if (msg.imageMessage) return { type: 'image', msg: msg.imageMessage };
  if (msg.videoMessage) return { type: 'video', msg: msg.videoMessage };
  if (msg.audioMessage) return { type: 'audio', msg: msg.audioMessage };
  if (msg.documentMessage) return { type: 'document', msg: msg.documentMessage };

  // Sticker
  if (msg.stickerMessage) return { type: 'sticker', msg: msg.stickerMessage };

  return null;
}

/**
 * Gère les messages en attente (saisie texte ou fichier)
 * @returns {boolean} true si le message a été traité, false sinon
 */
async function handlePendingInput(sock, message) {
  const jid = message.key.remoteJid;
  const session = sessionManager.getWaiting(jid);

  // Pas de session en attente
  if (!session) return false;

  const text = extractText(message);

  // ── Cas : tapez "annuler" → annule l'attente ──
  if (text && text.toLowerCase() === 'annuler') {
    sessionManager.clear(jid);
    await sock.sendMessage(jid, { text: '❌ Action annulée.' }, { quoted: message });
    return true;
  }

  // ── TYPE B : attente de saisie texte ──
  if (session.state === 'waiting_input') {
    if (!text) {
      // L'utilisateur n'a pas envoyé de texte
      await sendButtons(sock, jid, {
        title: '⚠️ ATTENTE DE TEXTE',
        text: 'Envoyez un *texte* ou tapez *annuler*.',
        footer: '⏱️ 5 minutes restantes',
        buttons: [
          { id: 'cancel_wait', text: '❌ Annuler' },
          { id: 'back_menu', text: '🏠 Menu' }
        ],
        quoted: message
      });
      return true;
    }

    const cmd = findCommandById(session.commandId);
    if (!cmd) {
      sessionManager.clear(jid);
      await sock.sendMessage(jid, { text: 'Commande introuvable. Session annulée.' }, { quoted: message });
      return true;
    }

    const cmdName = session.commandId.replace('cmd_', '');

    // Cherche et exécute la commande
    try {
      const { commandMap } = require('../../command.cjs');
      const cmdObj = commandMap.get(cmdName);

      sessionManager.clear(jid);

      if (cmdObj && cmdObj.execute) {
        // Simule un message avec le texte comme argument
        const fakeMsg = {
          ...message,
          message: {
            extendedTextMessage: {
              text: text,
              contextInfo: message.message?.extendedTextMessage?.contextInfo || {}
            }
          }
        };
        const args = text.split(/\s+/);
        const ctx = {
          from: jid,
          sender: message.key.participant || jid,
          isGroup: isGroup(jid),
          isPrivate: isPrivate(jid),
          isOwner: false,
          isAdmin: false,
          isBotAdmin: false,
          conn: sock
        };
        return await cmdObj.execute(sock, fakeMsg, args, ctx);
      }

      // Fallback
      await sock.sendMessage(jid, {
        text: `Commande .${cmdName} non trouvée. Tapez .${cmdName} ${text}`
      }, { quoted: message });
      return true;
    } catch (e) {
      console.error(`[INPUT] Erreur exécution ${cmdName}:`, e.message);
      await sock.sendMessage(jid, {
        text: `Erreur: ${e.message}\nTapez .${cmdName} ${text}`
      }, { quoted: message });
      sessionManager.clear(jid);
      return true;
    }
  }

  // ── TYPE C : attente de fichier ──
  if (session.state === 'waiting_file') {
    const media = extractMedia(message);

    if (!media) {
      // Pas de média reçu
      await sendButtons(sock, jid, {
        title: '⚠️ ATTENTE DE FICHIER',
        text: 'Envoyez une *image*, *vidéo*, *audio* ou un *document*.\nOu tapez *annuler*.',
        footer: '⏱️ 5 minutes restantes',
        buttons: [
          { id: 'cancel_wait', text: '❌ Annuler' },
          { id: 'back_menu', text: '🏠 Menu' }
        ],
        quoted: message
      });
      return true;
    }

    const cmd = findCommandById(session.commandId);
    if (!cmd) {
      sessionManager.clear(jid);
      await sock.sendMessage(jid, { text: 'Commande introuvable. Session annulée.' }, { quoted: message });
      return true;
    }

    const cmdName = session.commandId.replace('cmd_', '');

    try {
      const { commandMap } = require('../../command.cjs');
      const cmdObj = commandMap.get(cmdName);

      sessionManager.clear(jid);

      if (cmdObj && cmdObj.execute) {
        const args = [];
        const ctx = {
          from: jid,
          sender: message.key.participant || jid,
          isGroup: isGroup(jid),
          isPrivate: isPrivate(jid),
          isOwner: false,
          isAdmin: false,
          isBotAdmin: false,
          conn: sock
        };
        return await cmdObj.execute(sock, message, args, ctx);
      }

      // Fallback
      await sock.sendMessage(jid, {
        text: `Commande .${cmdName} non trouvée.`
      }, { quoted: message });
      return true;
    } catch (e) {
      console.error(`[INPUT] Erreur exécution fichier ${cmdName}:`, e.message);
      await sock.sendMessage(jid, {
        text: `Erreur: ${e.message}`
      }, { quoted: message });
      sessionManager.clear(jid);
      return true;
    }
  }

  return false;
}

module.exports = {
  handlePendingInput,
  extractText,
  extractMedia
};
