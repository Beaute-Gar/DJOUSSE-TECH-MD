import { getLoaderStats } from '../core/loader.js';
import { runtime } from '../lib/utils.js';

export const name = 'alive';
export const aliases = ['ping', 'status', 'bot'];
export const description = 'Vérifie que le bot est en ligne';
export const category = 'info';
export const level = 'user';

export async function handler(sock, m, { config }) {
  const stats   = getLoaderStats();
  const uptime  = runtime(process.uptime() * 1000);
  const memory  = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
  const latency = Date.now() - Number(m.timestamp);
  const now     = new Date().toLocaleString('fr-FR', {
    timeZone: 'Africa/Douala', dateStyle: 'short', timeStyle: 'medium',
  });

  await m.reply(
`╔══『 *${config.BOT_NAME}* 』══╗
║ 🟢 *Status* : En ligne ✅
║ ⏱️ *Uptime* : ${uptime}
║ ⚡ *Latence* : ${latency}ms
║ 🔌 *Plugins* : ${stats.total} chargés
║ 💾 *RAM* : ${memory} MB
║ 📅 *Date* : ${now}
║ 🏢 *${config.COMPANY_NAME}*
╚══════════════════════╝`
  );
}
