export const name = 'profil';
export const aliases = ['profile', 'moi', 'monprofil'];
export const description = 'Voir ton profil utilisateur';
export const category = 'general';
export const level = 'user';
export const cooldown = 5;

function bareNum(jid) {
  return String(jid || '').split('@')[0].split(':')[0];
}

export async function handler(sock, m, { reply, sender, jid, isGroup, config }) {
  const cleanJid = sender?.split('@')[0] || 'inconnu';
  const own = String(config?.BOT_OWNER || process.env.BOT_OWNER || '').split('@')[0].split(':')[0];
  const bot = bareNum(sock?.user?.id);

  let roleLabel = '👤 Utilisateur';
  if (own && cleanJid === own) roleLabel = '👑 Propriétaire';
  else if (bot && cleanJid === bot) roleLabel = '🤖 Bot';

  if (roleLabel === '👤 Utilisateur' && isGroup && jid) {
    try {
      const meta = await sock.groupMetadata(jid);
      const part = (meta.participants || []).find(p => bareNum(p.id) === cleanJid);
      if (part?.admin === 'superadmin') roleLabel = '🌟 Créateur';
      else if (part?.admin === 'admin') roleLabel = '👑 Admin';
    } catch {}
  }

  const name = m?.pushName || 'Inconnu';

  return reply(
    `👤 *Profil*\n\n` +
    `📛 Nom: ${name}\n` +
    `🆔 ID: ${cleanJid}\n` +
    `🔰 Rôle: ${roleLabel}\n` +
    `📱 WhatsApp: wa.me/${cleanJid}`
  );
}