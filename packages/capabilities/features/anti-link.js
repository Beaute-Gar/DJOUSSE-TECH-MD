import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('ANTILINK');
const groupConfigs = new Map();
const TRUSTED_DOMAINS = [
  'google.com', 'youtube.com', 'github.com', 'wikipedia.org',
  'whatsapp.com', 'facebook.com', 'instagram.com', 'twitter.com',
  'roblox.com', 'minecraft.net', 'epicgames.com', 'giphy.com',
  'tenor.com', 'spotify.com', 'netflix.com', 'amazon.com',
];
function isTrusted(url) {
  try {
    const h = new URL(url).hostname.replace('www.', '');
    return TRUSTED_DOMAINS.some(d => h === d || h.endsWith('.' + d));
  } catch { return false; }
}
export function hasUntrustedLink(text) {
  const urls = text.match(/https?:\/\/[^\s]+/g);
  if (!urls) return false;
  return urls.some(u => !isTrusted(u));
}
export function enableAntiLink(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const m of messages) {
      const jid = m.key?.remoteJid;
      if (!jid?.endsWith('@g.us')) continue;
      const text = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
      if (!text) continue;
      if (!hasUntrustedLink(text)) continue;
      let config = groupConfigs.get(jid);
      if (config === undefined) {
        try {
          const db = (await import('../../infrastructure/database/database.js')).default;
          const row = db.prepare('SELECT value FROM group_settings WHERE jid=? AND key=?').get(jid, 'antilink');
          config = row ? (row.value === 'true' || row.value === true) : false;
        } catch { config = false; }
        groupConfigs.set(jid, config);
      }
      if (!config) continue;
      const sender = m.key?.participant || m.key?.remoteJid;
      if (sender === sock.user?.id?.replace(/:.*@/, '@')) continue;
      try {
        await sock.sendMessage(jid, { delete: m.key });
        const name = m.pushName || sender?.split('@')[0] || 'Inconnu';
        await sock.sendMessage(jid, { text: `🚫 @${sender?.split('@')[0]} les liens non autorisés sont supprimés.`, mentions: [sender] });
        log.info(`Anti-link: supprimé de ${sender?.split('@')[0]} dans ${jid}`);
      } catch {}
    }
  });
  log.info('Anti-link activé');
}
export function setAntiLink(jid, value) {
  groupConfigs.set(jid, value);
}
