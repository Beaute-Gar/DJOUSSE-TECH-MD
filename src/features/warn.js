import { createLogger } from '../../packages/infrastructure/logger.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { adjustTrust } from './block.js';

const log = createLogger('WARN');
const DB = './database/warns.json';

function load() {
  try {
    if (!existsSync(DB)) writeFileSync(DB, '{}');
    return JSON.parse(readFileSync(DB, 'utf8'));
  } catch { return {}; }
}

function save(data) {
  writeFileSync(DB, JSON.stringify(data, null, 2));
}

const insultPatterns = [
  /fils de pute/i, /nique/i, /putain/i, /connard/i, /enculé/i,
  /bâtard/i, /salope/i, /ta gueule/i, /ferme/i, /gros con/i,
  /idiote?/i, /débile/i, /crétin/i, /va te faire/i
];

const linkPattern = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/i;

export function enableWarn(sock) {
  const warnConfig = new Map();
  const recentWarns = new Map();

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const jid = msg.key.participant || msg.key.remoteJid;
      const chat = msg.key.remoteJid;
      if (!jid || !chat) continue;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text) continue;

      let reason = null;
      if (insultPatterns.some(p => p.test(text))) reason = 'Insulte';
      if (!reason && linkPattern.test(text)) {
        const config = warnConfig.get(chat);
        if (config?.antiLink) reason = 'Lien interdit';
      }

      if (!reason) continue;

      const warns = load();
      if (!warns[jid]) warns[jid] = [];
      warns[jid].push({ reason, date: new Date().toISOString() });
      save(warns);
      adjustTrust(jid, -15);

      const count = warns[jid].length;
      log.info(`⚠️ ${jid} warn ${count}/3 — ${reason}`);

      try {
        await sock.sendMessage(chat, {
          text: `⚠️ *Avertissement* ${count}/3\n👤 @${jid.split('@')[0]}\n📋 Raison: ${reason}\nProchain warn = exclusion automatique.`,
          mentions: [jid]
        });
      } catch (_) {}

      if (count >= 3 && chat.endsWith('@g.us')) {
        try {
          await sock.groupParticipantsUpdate(chat, [jid], 'remove');
          adjustTrust(jid, -30);
          log.warn(`⛔ ${jid} expulsé (3 warns)`);
          warns[jid] = [];
          save(warns);
        } catch (_) {}
      }
    }
  });

  sock.ev.on('group-participants.update', ({ id, participants, action }) => {
    if (action === 'add') {
      const config = warnConfig.get(id);
      if (config?.welcomeWarn) {
        participants.forEach(jid => adjustTrust(jid, +10));
      }
    }
  });

  log.info('Module warn actif (insultes/liens → warn auto)');
}

export function setWarnConfig(groupJid, config) {
  warnConfig.set(groupJid, config);
}

export function getWarns(jid) {
  const warns = load();
  return warns[jid] || [];
}
