import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('STATS');

const triggers = [
  /statistiques/i, /stats/i,
  /performance/i, /combien.*message/i, /activité/i
];

let messageCount = 0;
let commandCount = 0;
const startTime = Date.now();
const dailyStats = new Map();

async function getDB() {
  try {
    const { getDB } = await import('../../packages/infrastructure/database/database.js');
    return getDB();
  } catch { return null; }
}

export function enableStats(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key) continue;
      messageCount++;
      if (msg.key.fromMe) commandCount++;

      const today = new Date().toISOString().split('T')[0];
      dailyStats.set(today, (dailyStats.get(today) || 0) + 1);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat) continue;
      if (!triggers.some(p => p.test(text))) continue;

      try {
        const db = await getDB();
        let dbStats = {};
        if (db) {
          const total = await db.get("SELECT COUNT(*) as c FROM messages").catch(() => ({ c: 0 }));
          const today = await db.get("SELECT COUNT(*) as c FROM messages WHERE date(dateEnvoi) = date('now')").catch(() => ({ c: 0 }));
          const contacts = await db.get("SELECT COUNT(*) as c FROM crm_contacts").catch(() => ({ c: 0 }));
          const groups = await db.get("SELECT COUNT(*) as c FROM `groups`").catch(() => ({ c: 0 }));
          dbStats = { total: total?.c || 0, today: today?.c || 0, contacts: contacts?.c || 0, groups: groups?.c || 0 };
        }

        const uptime = Math.floor((Date.now() - startTime) / 1000);
        const d = Math.floor(uptime / 86400);
        const h = Math.floor((uptime % 86400) / 3600);
        const m = Math.floor((uptime % 3600) / 60);
        const uptimeStr = `${d}j ${h}h ${m}m`;
        const todayDate = new Date().toISOString().split('T')[0];
        const todayMsgs = dailyStats.get(todayDate) || dbStats.today || 0;

        let response = `📊 *Statistiques DJOUSSE TECH*\n\n`;
        response += `⏱️ Uptime: ${uptimeStr}\n`;
        response += `💬 Messages traités: ${(dbStats.total || messageCount).toLocaleString()}\n`;
        response += `⚡ Commandes exécutées: ${commandCount.toLocaleString()}\n`;
        response += `📅 Aujourd'hui: ${todayMsgs} messages\n`;
        response += `📈 Moyenne: ${messageCount > 0 ? (messageCount / ((Date.now() - startTime) / 3600000)).toFixed(1) : 0} msg/h\n`;
        if (dbStats.contacts) response += `👥 Contacts CRM: ${dbStats.contacts}\n`;
        if (dbStats.groups) response += `👥 Groupes: ${dbStats.groups}\n`;
        response += `\n🧠 *Cognitive OS v2.0* | AINORIA`;

        try { await sock.sendMessage(chat, { text: response }); } catch (_) {}
        log.info('Stats affichées (données réelles)');
      } catch (e) {
        try { await sock.sendMessage(chat, { text: `❌ Erreur: ${e.message}` }); } catch (_) {}
      }
    }
  });

  log.info('Module stats actif (données réelles DB + WhatsApp)');
}

export function getStats() {
  return { messageCount, commandCount, uptime: Date.now() - startTime, daily: Object.fromEntries(dailyStats) };
}
