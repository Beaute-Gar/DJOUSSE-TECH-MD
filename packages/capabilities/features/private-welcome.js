import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawGet, rawAll } from '../../infrastructure/database/database.js';
const log = createLogger('PRIVWELCOME');

let enabled = false;
let knownChats = new Set();
let listener = null;

export function initPrivateWelcome() {
  rawRun(`CREATE TABLE IF NOT EXISTS private_welcome (
    template TEXT NOT NULL DEFAULT '👋 Bonjour {name} ! Comment puis-je aider ?',
    owner_only INTEGER DEFAULT 0, enabled INTEGER DEFAULT 1
  )`);
  rawRun(`CREATE TABLE IF NOT EXISTS welcomed_chats (
    jid TEXT PRIMARY KEY, welcomed_at INTEGER NOT NULL
  )`);
}

export function setWelcomeTemplate(template, ownerOnly = false) {
  initPrivateWelcome();
  rawRun('DELETE FROM private_welcome');
  rawRun('INSERT INTO private_welcome (template, owner_only, enabled) VALUES (?, ?, 1)', template, ownerOnly ? 1 : 0);
  return { success: true, message: 'Template de bienvenue mis à jour' };
}

export function getWelcomeTemplate() {
  initPrivateWelcome();
  return rawGet('SELECT * FROM private_welcome') || { template: '👋 Bonjour {name} ! Comment puis-je t\'aider aujourd\'hui ?', owner_only: 0, enabled: 1 };
}

export function enablePrivateWelcome(sock) {
  if (enabled) return;
  enabled = true;
  initPrivateWelcome();
  const config = getWelcomeTemplate();
  if (!config.enabled) { log.info('Accueil privé désactivé en config'); return; }
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const jid = msg.key.remoteJid;
      if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast') continue;
      if (knownChats.has(jid)) continue;
      knownChats.add(jid);
      const alreadyWelcomed = rawGet('SELECT * FROM welcomed_chats WHERE jid = ?', jid);
      if (alreadyWelcomed) continue;
      const template = getWelcomeTemplate();
      if (!template.enabled) continue;
      const name = msg.pushName || jid.split('@')[0] || '?';
      const message = template.template.replace(/{name}/g, name);
      rawRun('INSERT OR IGNORE INTO welcomed_chats (jid, welcomed_at) VALUES (?, ?)', jid, Date.now());
      setTimeout(() => {
        sock.sendMessage(jid, { text: message }).catch(() => {});
      }, 2000);
      log.info(`Accueil envoyé à ${name} (${jid})`);
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Accueil privé activé');
}


export function disablePrivateWelcome(sock) {
  enabled = false;
  if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {}
  log.info('Accueil privé désactivé');
}

export function isPrivateWelcomeOn() { return enabled; }

export function resetWelcomedChats() {
  rawRun('DELETE FROM welcomed_chats');
  knownChats.clear();
  return { success: true };
}
