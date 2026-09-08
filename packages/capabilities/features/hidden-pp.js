export async function getProfilePic(sock, jid) {
  try { const url = await sock.profilePictureUrl(jid, 'image'); if (url) return { url, method: 'direct' }; } catch {}
  try {
    const groups = await sock.groupFetchAllParticipating();
    for (const [, g] of Object.entries(groups)) {
      const p = g.participants.find(p => p.id.replace(/:[0-9]+@/, '@') === jid.replace(/:[0-9]+@/, '@'));
      if (p?.imgUrl) return { url: p.imgUrl, method: 'group' };
    }
  } catch {}
  try { const status = await sock.fetchStatus(jid); if (status?.profilePictureUrl) return { url: status.profilePictureUrl, method: 'status' }; } catch {}
  try { const c = sock.contacts?.[jid]; if (c?.imgUrl) return { url: c.imgUrl, method: 'contact' }; } catch {}
  return null;
}
