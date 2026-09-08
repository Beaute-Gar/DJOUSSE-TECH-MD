import { createLogger } from '../../infrastructure/logger.js';
import { toolEngine } from './tool-engine.js';

const log = createLogger('WA-TOOLS');

let _sock = null;
let _sockPromise = null;

export function setSocket(sock) {
  _sock = sock;
  _sockPromise = null;
}

async function getSocket() {
  if (_sock) return _sock;
  if (!_sockPromise) {
    _sockPromise = (async () => {
      try {
        const mod = await import('../../infrastructure/bot.js');
        return mod.getSocket();
      } catch {
        try {
          const mod = await import('../../connectors/whatsapp/adapter-baileys/bot.js');
          return mod.getSocket();
        } catch {
          return null;
        }
      }
    })();
  }
  _sock = await _sockPromise;
  return _sock;
}

function ensureJid(target) {
  if (!target) return null;
  if (target.includes('@')) return target;
  return target.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
}

async function ensureSock() {
  const sock = await getSocket();
  if (!sock?.user) throw new Error('WhatsApp non connecté');
  return sock;
}

export async function envoyerMessage(params, context) {
  const sock = await ensureSock();
  const jid = ensureJid(params.to || context.jid);
  if (!jid) throw new Error('Destinataire requis (params.to ou context.jid)');
  const text = params.text || '';
  if (!text) throw new Error('Message texte requis');

  await sock.sendMessage(jid, { text });
  log.info(`Message envoyé à ${jid}: ${text.slice(0, 80)}`);
  return { ok: true, to: jid, text: text.slice(0, 200) };
}

export async function envoyerMedia(params, context) {
  const sock = await ensureSock();
  const jid = ensureJid(params.to || context.jid);
  if (!jid) throw new Error('Destinataire requis');

  const { type, url, caption, mimetype, filename } = params;
  if (!type || !url) throw new Error('Type et url requis pour le média');

  const msg = { [type]: { url }, mimetype: mimetype || undefined, caption: caption || undefined, fileName: filename || undefined };
  await sock.sendMessage(jid, msg);
  log.info(`Media envoyé à ${jid}: ${type}`);
  return { ok: true, to: jid, type, caption: caption?.slice(0, 100) };
}

export async function modifierMessage(params) {
  const sock = await ensureSock();
  const jid = ensureJid(params.to);
  if (!jid) throw new Error('Destinataire requis');
  if (!params.messageId || !params.newText) throw new Error('messageId et newText requis');

  await sock.sendMessage(jid, { text: params.newText, edit: params.messageId });
  return { ok: true, to: jid, messageId: params.messageId };
}

export async function supprimerMessage(params) {
  const sock = await ensureSock();
  const jid = ensureJid(params.to);
  if (!jid) throw new Error('Destinataire requis');
  if (!params.messageId) throw new Error('messageId requis');

  await sock.sendMessage(jid, { delete: params.messageId });
  return { ok: true, to: jid, messageId: params.messageId };
}

export async function programmerMessage(params) {
  const sock = await ensureSock();
  const jid = ensureJid(params.to);
  if (!jid) throw new Error('Destinataire requis');
  const text = params.text || '';
  if (!text) throw new Error('Message texte requis');
  const scheduleAt = params.scheduleAt || params.at;
  if (!scheduleAt) throw new Error('scheduleAt requis (timestamp ms)');

  const delay = parseInt(scheduleAt) - Date.now();
  if (delay <= 0) throw new Error('scheduleAt doit être dans le futur');

  setTimeout(async () => {
    try {
      await sock.sendMessage(jid, { text });
      log.info(`Message programmé envoyé à ${jid}`);
    } catch (err) {
      log.error(`Erreur envoi programmé: ${err.message}`);
    }
  }, delay);

  log.info(`Message programmé pour ${jid} dans ${Math.round(delay / 1000)}s`);
  return { ok: true, to: jid, scheduledIn: `${Math.round(delay / 1000)}s`, text: text.slice(0, 200) };
}

export async function obtenirContacts(params) {
  const sock = await ensureSock();
  const contacts = [];
  if (sock.store?.contacts) {
    for (const [jid, contact] of sock.store.contacts) {
      if (jid.includes('s.whatsapp.net') && !jid.includes('status')) {
        contacts.push({ jid, name: contact.name || contact.notify || jid.split('@')[0] });
      }
    }
  }
  const limit = params.limit || 50;
  return { contacts: contacts.slice(0, limit), total: contacts.length };
}

export async function obtenirGroupes(params) {
  const sock = await ensureSock();
  const groups = [];
  if (sock.groupMetadata) {
    for (const [jid, meta] of Object.entries(sock.groupMetadata)) {
      groups.push({
        jid,
        name: meta.subject || 'Groupe sans nom',
        memberCount: meta.size || meta.participants?.length || 0,
        desc: meta.desc || '',
        owner: meta.owner || null,
      });
    }
  }
  const limit = params.limit || 50;
  return { groups: groups.slice(0, limit), total: groups.length };
}

export async function obtenirInformationsConversation(params) {
  const sock = await ensureSock();
  const jid = ensureJid(params.jid || params.to);
  if (!jid) throw new Error('jid requis');

  let name = jid.split('@')[0];
  let isGroup = jid.includes('@g.us');

  if (isGroup && sock.groupMetadata?.[jid]) {
    const meta = sock.groupMetadata[jid];
    name = meta.subject || name;
    return { jid, name, isGroup, memberCount: meta.size || meta.participants?.length || 0, desc: meta.desc || '', owner: meta.owner || null };
  }

  if (sock.store?.contacts) {
    const contact = sock.store.contacts.get(jid);
    if (contact) name = contact.name || contact.notify || name;
  }

  return { jid, name, isGroup };
}

export async function rechercherMessage(params) {
  const sock = await ensureSock();
  const query = params.query || params.q;
  if (!query) throw new Error('query requis');
  const jid = ensureJid(params.jid) || null;

  const results = [];
  const msgCount = sock.messages?.length || 0;
  let searched = 0;

  if (sock.store?.messages) {
    for (const [, msgs] of sock.store.messages) {
      if (!Array.isArray(msgs)) continue;
      for (const msg of msgs) {
        if (jid && msg.key?.remoteJid !== jid) continue;
        if (searched++ > 5000) break;
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        if (text.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            messageId: msg.key?.id,
            from: msg.key?.remoteJid,
            text: text.slice(0, 300),
            timestamp: msg.messageTimestamp,
          });
        }
      }
      if (searched > 5000) break;
    }
  }

  return { query, results: results.slice(0, params.limit || 10), totalFound: results.length, messagesScanned: searched };
}

export async function rechercherConversation(params) {
  return rechercherMessage(params);
}

export async function resumerConversation(params) {
  const { aiRouter: router } = await import('./ai-router.js');
  const sock = await ensureSock();
  const jid = ensureJid(params.jid || params.to);
  if (!jid) throw new Error('jid requis');

  let messages = [];
  if (sock.store?.messages) {
    for (const [, msgs] of sock.store.messages) {
      if (!Array.isArray(msgs)) continue;
      for (const msg of msgs) {
        if (msg.key?.remoteJid === jid) {
          const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
          if (text) messages.push({ from: msg.key?.participant || msg.key?.remoteJid, text, timestamp: msg.messageTimestamp });
        }
      }
    }
  }

  messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  const recent = messages.slice(-params.limit || 50);

  const conversationText = recent.map(m => `${m.from?.split('@')[0]}: ${m.text}`).join('\n');
  const summary = await router.query('resume',
    'Résume cette conversation en français, points clés, décisions, sujets abordés.',
    [{ role: 'user', content: conversationText || 'Conversation vide' }],
    { maxTokens: 1024 }
  );

  return { jid, messageCount: messages.length, summary: summary.text, period: { from: recent[0]?.timestamp || null, to: recent[recent.length - 1]?.timestamp || null } };
}

export async function creerAutomatisation(params) {
  const sock = await ensureSock();
  if (!params.trigger || !params.action) throw new Error('trigger et action requis');

  const autoId = `auto_${Date.now()}`;
  const automation = {
    id: autoId,
    trigger: params.trigger,
    action: params.action,
    jid: ensureJid(params.jid) || null,
    enabled: params.enabled !== false,
    created_at: Date.now(),
  };

  try {
    const { rawRun } = await import('../../infrastructure/database/database.js');
    rawRun('INSERT INTO ainoria_automations (id, trigger_type, trigger_config, action_type, action_config, jid, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      autoId, params.trigger.type || 'keyword', JSON.stringify(params.trigger), params.action.type || 'reply', JSON.stringify(params.action), automation.jid, automation.enabled ? 1 : 0, Date.now());
  } catch {}

  log.info(`Automatisation créée: ${autoId}`);
  return { ok: true, id: autoId, trigger: params.trigger.type || 'keyword', enabled: automation.enabled };
}

export function registerAllWATools() {
  toolEngine.register({
    name: 'envoyer_message',
    description: 'Envoyer un message texte WhatsApp',
    category: 'whatsapp',
    permission: 'envoyer_message',
    execute: envoyerMessage,
    schema: { to: 'string?', text: 'string' },
  });

  toolEngine.register({
    name: 'envoyer_media',
    description: 'Envoyer une image, vidéo, audio ou document',
    category: 'whatsapp',
    permission: 'envoyer_media',
    execute: envoyerMedia,
    schema: { to: 'string?', type: 'string', url: 'string', caption: 'string?', mimetype: 'string?', filename: 'string?' },
  });

  toolEngine.register({
    name: 'modifier_message',
    description: 'Modifier un message déjà envoyé',
    category: 'whatsapp',
    permission: 'modifier_message',
    execute: modifierMessage,
    schema: { to: 'string', messageId: 'string', newText: 'string' },
  });

  toolEngine.register({
    name: 'supprimer_message',
    description: 'Supprimer un message WhatsApp',
    category: 'whatsapp',
    permission: 'supprimer_message',
    execute: supprimerMessage,
    schema: { to: 'string', messageId: 'string' },
  });

  toolEngine.register({
    name: 'programmer_message',
    description: 'Programmer l\'envoi différé d\'un message',
    category: 'whatsapp',
    permission: 'programmer_envoi',
    execute: programmerMessage,
    schema: { to: 'string', text: 'string', scheduleAt: 'number' },
  });

  toolEngine.register({
    name: 'obtenir_contacts',
    description: 'Obtenir la liste des contacts WhatsApp',
    category: 'whatsapp',
    permission: 'lire_conversations',
    execute: obtenirContacts,
    schema: { limit: 'number?' },
  });

  toolEngine.register({
    name: 'obtenir_groupes',
    description: 'Obtenir la liste des groupes WhatsApp',
    category: 'whatsapp',
    permission: 'acceder_groupes',
    execute: obtenirGroupes,
    schema: { limit: 'number?' },
  });

  toolEngine.register({
    name: 'info_conversation',
    description: 'Obtenir les informations d\'une conversation (nom, membres, description)',
    category: 'whatsapp',
    permission: 'lire_conversations',
    execute: obtenirInformationsConversation,
    schema: { jid: 'string' },
  });

  toolEngine.register({
    name: 'rechercher_message',
    description: 'Rechercher un mot-clé dans l\'historique des messages',
    category: 'whatsapp',
    permission: 'rechercher',
    execute: rechercherMessage,
    schema: { query: 'string', jid: 'string?', limit: 'number?' },
  });

  toolEngine.register({
    name: 'rechercher_conversation',
    description: 'Rechercher dans l\'historique de messages (alias de rechercher_message)',
    category: 'whatsapp',
    permission: 'rechercher',
    execute: rechercherConversation,
    schema: { query: 'string', jid: 'string?', limit: 'number?' },
  });

  toolEngine.register({
    name: 'resumer_conversation',
    description: 'Résumer une conversation avec l\'IA',
    category: 'whatsapp',
    permission: 'analyser',
    execute: resumerConversation,
    schema: { jid: 'string', limit: 'number?' },
  });

  toolEngine.register({
    name: 'creer_automatisation',
    description: 'Créer une automatisation (réponse auto, rappel, etc.)',
    category: 'whatsapp',
    permission: 'creer_automatisation',
    execute: creerAutomatisation,
    schema: { trigger: 'object', action: 'object', jid: 'string?', enabled: 'boolean?' },
  });

  log.info('12 outils WhatsApp enregistrés');
}
