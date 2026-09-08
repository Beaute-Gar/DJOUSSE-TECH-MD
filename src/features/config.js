import { createLogger } from '../../packages/infrastructure/logger.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const log = createLogger('CONFIG');
const DB = './database/config.json';

function load() {
  try {
    if (!existsSync(DB)) {
      const def = { prefix: '.', mode: 'public', antiSpam: true, antiCall: true, antiLink: false, welcomeEnabled: true, goodbyeEnabled: true };
      writeFileSync(DB, JSON.stringify(def, null, 2));
      return def;
    }
    return JSON.parse(readFileSync(DB, 'utf8'));
  } catch { return { prefix: '.', mode: 'public' }; }
}

function save(data) {
  writeFileSync(DB, JSON.stringify(data, null, 2));
}

const configTriggers = [
  /changer le (préfixe|prefixe|prefix)/i,
  /passer en (public|private|privé|invisible)/i,
  /activer.*anti.*(spam|link|call)/i, /désactiver.*anti.*(spam|link|call)/i,
  /configurer (le bot|le système)/i, /paramètres/i
];

export function enableConfig(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat) continue;
      const sender = msg.key.participant || msg.key.remoteJid;
      const isOwner = sender?.split('@')[0] === (global.__sessionOwnerNumber || process.env.BOT_OWNER || process.env.OWNER_NUMBER || '') || msg.key.fromMe;

      if (!isOwner) continue;
      if (!configTriggers.some(p => p.test(text))) continue;

      const cfg = load();
      const matchPrefix = text.match(/préfixe[:\s]*([^\s,.!?]+)/i);
      if (matchPrefix) {
        cfg.prefix = matchPrefix[1];
        save(cfg);
        try { await sock.sendMessage(chat, { text: `✅ Préfixe changé: "${cfg.prefix}"` }); } catch (_) {}
        continue;
      }

      const matchMode = text.match(/passer en (public|private|privé|invisible)/i);
      if (matchMode) {
        const mode = matchMode[1] === 'privé' ? 'private' : matchMode[1];
        cfg.mode = mode;
        save(cfg);
        try { await sock.sendMessage(chat, { text: `✅ Mode changé: ${mode}` }); } catch (_) {}
        continue;
      }

      const matchAntiOn = text.match(/activer.*anti.*(spam|link|call)/i);
      if (matchAntiOn) {
        const key = `anti${matchAntiOn[1].charAt(0).toUpperCase() + matchAntiOn[1].slice(1)}`;
        if (key in cfg) { cfg[key] = true; save(cfg); }
        try { await sock.sendMessage(chat, { text: `✅ Anti-${matchAntiOn[1]} activé` }); } catch (_) {}
        continue;
      }

      const matchAntiOff = text.match(/désactiver.*anti.*(spam|link|call)/i);
      if (matchAntiOff) {
        const key = `anti${matchAntiOff[1].charAt(0).toUpperCase() + matchAntiOff[1].slice(1)}`;
        if (key in cfg) { cfg[key] = false; save(cfg); }
        try { await sock.sendMessage(chat, { text: `✅ Anti-${matchAntiOff[1]} désactivé` }); } catch (_) {}
        continue;
      }

      const summary = Object.entries(cfg).map(([k, v]) => `  ${k}: ${typeof v === 'boolean' ? (v ? '✅' : '❌') : v}`).join('\n');
      try { await sock.sendMessage(chat, { text: `⚙️ *Configuration actuelle*\n\n${summary}\n\n💡 Dis "changer le préfixe ." ou "passer en private"` }); } catch (_) {}
    }
  });

  log.info('Module config actif (dashboard + suggestions owner)');
}

export function getConfig() { return load(); }
