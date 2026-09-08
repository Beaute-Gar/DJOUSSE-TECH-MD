import { createLogger } from '../../packages/infrastructure/logger.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const log = createLogger('SECURITY');
const DB = './database/security.json';

function load() {
  try {
    if (!existsSync(DB)) {
      writeFileSync(DB, JSON.stringify({ antiLink: false, antiSpam: true, spamThreshold: 5, antiBadWord: false, antiCall: true, antiVirus: true, autoWarn: true, strictMode: false }, null, 2));
    }
    return JSON.parse(readFileSync(DB, 'utf8'));
  } catch { return {}; }
}

function save(d) { writeFileSync(DB, JSON.stringify(d, null, 2)); }

const securityTriggers = [
  /sécurité/i, /securite/i, /security/i,
  /audit.*sécurité/i, /sécurité.*groupe/i
];

export function enableSecurity(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat) continue;
      const sender = msg.key.participant || chat;
      if (!securityTriggers.some(p => p.test(text))) continue;

      const isOwner = sender?.split('@')[0] === (global.__sessionOwnerNumber || process.env.BOT_OWNER || process.env.OWNER_NUMBER || '') || msg.key.fromMe;
      const cfg = load();

      if (isOwner && (text.includes('anti') || text.includes('activ') || text.includes('désactiv'))) {
        if (text.includes('antilink') || text.includes('anti link')) {
          cfg.antiLink = !text.includes('désactiv');
          save(cfg);
          try { await sock.sendMessage(chat, { text: `✅ Anti-lien: ${cfg.antiLink ? 'Activé' : 'Désactivé'}` }); } catch (_) {}
        } else if (text.includes('antispam') || text.includes('anti spam')) {
          cfg.antiSpam = !text.includes('désactiv');
          save(cfg);
          try { await sock.sendMessage(chat, { text: `✅ Anti-spam: ${cfg.antiSpam ? 'Activé' : 'Désactivé'}` }); } catch (_) {}
        }
        return;
      }

      if (chat.endsWith('@g.us')) {
        try {
          const meta = await sock.groupMetadata(chat);
          const members = meta.participants?.length || 0;
          const admins = meta.participants?.filter(p => p.admin)?.length || 0;
          let response = `🔒 *Audit Sécurité — ${meta.subject}*\n\n`;
          response += `👥 Membres: ${members}\n`;
          response += `👑 Admins: ${admins}\n`;
          response += `🔐 Sécurité: ${cfg.strictMode ? '🟢 Haute' : '🟡 Normale'}\n`;
          response += `🚫 Anti-link: ${cfg.antiLink ? '✅' : '❌'}\n`;
          response += `🛡️ Anti-spam: ${cfg.antiSpam ? '✅' : '❌'}\n`;
          response += `📞 Anti-call: ${cfg.antiCall ? '✅' : '❌'}\n`;
          response += `⚠️ Auto-warn: ${cfg.autoWarn ? '✅' : '❌'}\n`;
          response += `\n💡 Recommandé: activer anti-link et strictMode pour grands groupes.`;
          await sock.sendMessage(chat, { text: response });
          log.info(`Audit sécurité: ${chat} — ${members} membres`);
        } catch (_) {}
      }
    }
  });

  log.info('Module security actif');
}

export function getSecurityConfig() { return load(); }
