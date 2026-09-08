import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('REPORT');

export async function collectStats(sock) {
  const groups = await sock.groupFetchAllParticipating();
  const stats = [];
  for (const [jid, g] of Object.entries(groups)) {
    const msgs = sock.store?.messages?.[jid]?.array || [];
    const today = Date.now() - 86400000;
    const recent = msgs.filter(m => (m.messageTimestamp || 0) * 1000 > today);
    stats.push({ name: g.subject || 'Sans nom', members: g.participants.length, msgs: recent.length, jid });
  }
  stats.sort((a, b) => b.msgs - a.msgs);
  const total = stats.reduce((s, g) => s + g.msgs, 0);
  const active = stats.filter(g => g.msgs > 0).length;
  const inactive = stats.filter(g => g.msgs === 0);
  return { stats, total, active, inactive, date: new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), totalGroups: stats.length };
}
