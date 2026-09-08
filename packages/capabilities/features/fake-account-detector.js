import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('FAKEDETECT');

export async function analyzeAccount(sock, jid) {
  const flags = [];
  let score = 0;
  try { await sock.profilePictureUrl(jid, 'image'); } catch { flags.push('Photo cachée'); score += 25; }
  try {
    const c = sock.contacts?.[jid];
    const name = c?.name || c?.notify || jid.split('@')[0];
    if (/^[0-9]{6,}$/.test(name)) { flags.push('Nom numérique'); score += 15; }
    if (name.length < 2) { flags.push('Nom trop court'); score += 10; }
  } catch {}
  const num = jid.split('@')[0];
  if (/^[0-9]{20,}$/.test(num)) { flags.push('Numéro anormal'); score += 30; }
  const level = score >= 60 ? 'élevé' : score >= 35 ? 'moyen' : 'faible';
  return { jid, num, score, level, flags, isFake: score >= 50 };
}

export async function scanGroup(sock, groupJid) {
  const meta = await sock.groupMetadata(groupJid);
  const results = [];
  for (const p of meta.participants) {
    const a = await analyzeAccount(sock, p.id);
    if (a.isFake) results.push(a);
  }
  return { groupName: meta.subject, total: meta.participants.length, suspicious: results.length, accounts: results };
}
