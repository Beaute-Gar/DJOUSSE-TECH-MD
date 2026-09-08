import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('MSTATS');

const statsCache = new Map();

function bar(v, max, w = 10) { return '█'.repeat(Math.round((v/Math.max(1,max))*w)) + '░'.repeat(w - Math.round((v/Math.max(1,max))*w)); }

export async function analyzeGroup(sock, groupJid) {
  const cacheKey = groupJid;
  const cached = statsCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 3600000) return cached;

  const meta = await sock.groupMetadata(groupJid);
  const msgs = sock.store?.messages?.[groupJid]?.array || [];
  const memberMap = new Map();
  let totalMsgs = 0, mediaCount = 0;
  const hours = {};

  for (const msg of msgs) {
    if (msg.key?.fromMe) continue;
    const s = msg.key?.participant || msg.key?.remoteJid;
    if (!s) continue;
    if (!memberMap.has(s)) memberMap.set(s, { count: 0, media: 0, text: 0, last: 0 });
    const st = memberMap.get(s);
    st.count++; totalMsgs++;
    if (msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.audioMessage) { st.media++; mediaCount++; }
    else { st.text++; }
    const h = new Date((msg.messageTimestamp || 0) * 1000).getHours();
    hours[h] = (hours[h] || 0) + 1;
    if (msg.messageTimestamp > st.last) st.last = msg.messageTimestamp;
  }

  const top = [...memberMap.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 10).map(([jid, s]) => ({
    jid, name: sock.contacts?.[jid]?.name || sock.contacts?.[jid]?.notify || jid.split('@')[0], ...s,
  }));

  const activeJids = new Set(memberMap.keys());
  const inactive = meta.participants.filter(p => !activeJids.has(p.id)).map(p => ({
    jid: p.id, name: sock.contacts?.[p.id]?.name || sock.contacts?.[p.id]?.notify || p.id.split('@')[0], isAdmin: !!p.admin,
  }));

  const peak = Object.entries(hours).sort((a, b) => b[1] - a[1])[0];
  const result = { groupName: meta.subject, total: meta.participants.length, admins: meta.participants.filter(p => p.admin).length, totalMsgs, mediaCount, top, inactive: inactive.length, peakHour: peak ? parseInt(peak[0]) : null, peakCount: peak ? peak[1] : 0, ts: Date.now() };
  statsCache.set(cacheKey, result);
  return result;
}

export { bar };
