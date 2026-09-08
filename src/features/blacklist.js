import { createLogger } from '../../packages/infrastructure/logger.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { adjustTrust } from './block.js';

const log = createLogger('BLACKLIST');
const DB = './database/blacklist.json';

function load() {
  try {
    if (!existsSync(DB)) writeFileSync(DB, '[]');
    return JSON.parse(readFileSync(DB, 'utf8'));
  } catch { return []; }
}

function save(list) {
  writeFileSync(DB, JSON.stringify(list, null, 2));
}

const scamPatterns = [
  /gagne\s*\d+/, /free\s*iphone/, /clique\s*ici/, /lien.*bizarre/,
  /urgent.*argent/, /compte.*bloqué/, /mot.*passe/, /code.*confirmation/,
  /gagner.*facile/, /investis/, /rend.*10000/i, /money.*double/i
];

export function enableBlacklist(sock) {
  const strikes = new Map();

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const jid = msg.key.participant || msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !jid) continue;

      const isScam = scamPatterns.some(p => p.test(text.toLowerCase()));
      if (!isScam) continue;

      const current = (strikes.get(jid) ?? 0) + 1;
      strikes.set(jid, current);
      adjustTrust(jid, -25);
      log.info(`Pattern scam détecté ${jid} → strike ${current}/3`);

      if (current >= 3) {
        const list = load();
        if (!list.includes(jid)) {
          list.push(jid);
          save(list);
          adjustTrust(jid, -50);
          log.warn(`Blacklisté automatiquement: ${jid} (3 strikes scam)`);
          try {
            await sock.updateBlockStatus(jid, 'block');
          } catch (_) {}
          try {
            await sock.sendMessage(jid, {
              text: '🚫 Vous avez été blacklisté pour activités suspectes.\nContact: ' + (global.__sessionOwnerNumber || '') + ''
            });
          } catch (_) {}
        }
      }
    }
  });

  log.info('Module blacklist actif (3 strikes = blacklist auto)');
}

export function isBlacklisted(jid) {
  const list = load();
  return list.includes(jid);
}
