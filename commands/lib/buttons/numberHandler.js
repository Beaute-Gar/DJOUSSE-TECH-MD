/**
 * Gestionnaire des saisies NUMÉRIQUES
 * Intercepte les messages qui contiennent juste un numéro
 * et exécute la commande correspondante du menu actif
 * DJOUSSE-TECH-MD
 */

const sessionManager = require('./sessionManager');
const { buildMainMenu, buildCategoryMenu, handleCommandClick } = require('./menuBuilder');

function extractText(message) {
  const msg = message.message;
  if (!msg) return null;
  if (msg.conversation) return msg.conversation;
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
  return null;
}

function isNumericChoice(text) {
  if (!text) return false;
  return /^\d+$/.test(text.trim());
}

async function handleNumberInput(sock, message) {
  const jid = message.key.remoteJid;
  const text = extractText(message);

  if (!text) return false;
  if (!isNumericChoice(text)) return false;

  const ctx = sessionManager.getMenuContext(jid);
  if (!ctx) return false;

  const num = parseInt(text.trim(), 10);
  const item = ctx.items.find(i => i.num === num);

  if (!item) {
    await sock.sendMessage(jid, {
      text: `⚠️ Numéro *${num}* invalide.\nChoisissez entre *${ctx.items[0]?.num}* et *${ctx.items[ctx.items.length - 1]?.num}*.`
    }, { quoted: message });
    return true;
  }

  console.log(`[NUMBER] Choix "${num}" → ${item.id} depuis ${jid}`);

  if (ctx.type === 'main') {
    return await buildCategoryMenu(sock, jid, item.id, 1, message);
  }

  if (ctx.type === 'category') {
    return await handleCommandClick(sock, jid, message, item.commandId || item.id);
  }

  return false;
}

module.exports = {
  handleNumberInput,
  isNumericChoice,
  extractText
};
