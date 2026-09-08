/* Action Executor — point unique d'exécution des actions WhatsApp, utilisé par
   les commandes (ctx.execute) ET par SCG/features. Pipeline : Policy → Adapter.
   Logging structuré [ACTION]/[RESULT] avec fallback en cas d'échec. */

const { getWhatsAppAdapter } = require('../whatsapp/whatsapp-adapter.cjs');

const policies = [];
const onAudit = [];

function addPolicy(fn) {
  if (typeof fn === 'function') policies.push(fn);
  return () => {
    const i = policies.indexOf(fn);
    if (i >= 0) policies.splice(i, 1);
  };
}

function onAction(cb) {
  if (typeof cb === 'function') onAudit.push(cb);
  return () => {
    const i = onAudit.indexOf(cb);
    if (i >= 0) onAudit.splice(i, 1);
  };
}

const time = () => new Date().toLocaleTimeString('fr-FR', { hour12: false });
const log = (tag, msg) => console.log(`[${time()}] [${tag}] ${msg}`);

async function executeAction(action, env = {}) {
  const { conn, m, wa } = env;
  const a = typeof action === 'string' ? { type: action } : (action || {});
  if (!a.type) throw new Error('[EXECUTOR] Action sans type');
  const adapter = wa || getWhatsAppAdapter(conn);
  const jid = a.chatId || a.jid || (m && m.chat) || null;

  log('ACTION', a.type);

  for (const p of policies) {
    let r = null;
    try { r = await Promise.resolve(p(a, env)); } catch (e) { r = { allow: false, reason: e.message }; }
    if (r && r.allow === false) {
      log('RESULT', `blocked (${r.reason || 'governance'})`);
      throw new Error(`Governance: ${r.reason || 'action refusée'}`);
    }
  }

  const keyOf = (k) => (typeof k === 'object' ? k : { id: String(k || ''), remoteJid: jid });

  let result = null;
  switch (String(a.type).toUpperCase()) {
    case 'SEND_TEXT':
    case 'SEND_MESSAGE':
      result = await adapter.sendText(jid, a.text, a.options);
      break;
    case 'REPLY':
      result = await adapter.reply(jid, a.text, a.quoted, a.options);
      break;
    case 'EDIT':
    case 'EDIT_MESSAGE':
      result = await adapter.edit(jid, keyOf(a.key), a.text);
      break;
    case 'DELETE':
    case 'DELETE_MESSAGE':
      result = await adapter.delete(jid, keyOf(a.key), a.forEveryone !== false);
      break;
    case 'REACT':
    case 'REACTION':
      result = await adapter.react(jid, a.emoji || a.text, a.key);
      break;
    case 'SEND_IMAGE':
      result = await adapter.sendImage(jid, a.buffer || a.media, a.options);
      break;
    case 'SEND_VIDEO':
      result = await adapter.sendVideo(jid, a.buffer || a.media, a.options);
      break;
    case 'SEND_AUDIO':
      result = await adapter.sendAudio(jid, a.buffer || a.media, a.options);
      break;
    case 'SEND_STICKER':
      result = await adapter.sendSticker(jid, a.buffer || a.media, a.options);
      break;
    case 'SEND_DOCUMENT':
      result = await adapter.sendDocument(jid, a.buffer || a.media, a.options);
      break;
    case 'SEND_POLL':
    case 'POLL':
      result = await adapter.sendPoll(jid, a.question, a.options_list || a.options || [], a.options2 || {});
      break;
    case 'SEND_STATUS':
      result = await adapter.sendStatus(a.text);
      break;
    case 'GROUP_CREATE':
      result = await adapter.groupCreate(a.subject, a.participants || []);
      break;
    case 'GROUP_ADD':
      result = await adapter.groupAdd(jid, a.participantIds || a.participants || []);
      break;
    case 'GROUP_KICK':
      result = await adapter.groupKick(jid, a.participantIds || a.participants || []);
      break;
    case 'GROUP_PROMOTE':
      result = await adapter.groupPromote(jid, a.participantIds || a.participants || []);
      break;
    case 'GROUP_DEMOTE':
      result = await adapter.groupDemote(jid, a.participantIds || a.participants || []);
      break;
    case 'GROUP_SUBJECT':
      result = await adapter.groupSubject(jid, a.subject);
      break;
    default:
      log('RESULT', `unknown -> ${a.type}`);
      throw new Error(`[EXECUTOR] Type d'action inconnu: ${a.type}`);
  }

  try {
    for (const cb of onAudit) { try { await Promise.resolve(cb(a, result, env)); } catch (e) {} }
  } catch (e) {}

  log('RESULT', 'success');
  return result;
}

module.exports = {
  executeAction,
  addPolicy,
  onAction,
  log,
};