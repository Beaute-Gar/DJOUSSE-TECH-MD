const blocked = new Map();

export async function checkBlock(sock, jid) {
  try {
    const test = await sock.sendMessage(jid, { text: '\u200B', disappearingMessagesInChat: 1 });
    if (test) try { await sock.sendMessage(jid, { delete: test.key }); } catch {}
  } catch (e) {
    if (e.message?.includes('blocked')) return { blocked: true, reason: 'Bloqué' };
    if (e.message?.includes('not allowed')) return { blocked: true, reason: 'Non autorisé' };
  }
  try { await sock.profilePictureUrl(jid, 'image'); } catch { return { blocked: 'maybe', reason: 'PP inaccessible' }; }
  return { blocked: false };
}

export async function scanAll(sock) {
  const contacts = sock.contacts || {};
  const results = [];
  for (const jid of Object.keys(contacts)) {
    const r = await checkBlock(sock, jid);
    if (r.blocked) {
      const name = contacts[jid]?.name || contacts[jid]?.notify || jid.split('@')[0];
      blocked.set(jid, { name, reason: r.reason });
      results.push({ jid, name, reason: r.reason });
    }
  }
  return results;
}

export function getBlocked() { return [...blocked.entries()].map(([j, v]) => ({ jid: j, ...v })); }
