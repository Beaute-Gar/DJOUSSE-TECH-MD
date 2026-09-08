export const name = 'add';
export const aliases = ['ajouter', 'invite', 'inviter'];
export const description = 'Ajouter ou inviter une personne dans le groupe';
export const category = 'group';
export const level = 'user';
export const cooldown = 10;

export async function handler(sock, m, { args, text, prefix, reply, jid, isGroup }) {
  if (!isGroup) return reply('❌ Cette commande ne fonctionne qu\'en groupe');

  const num = (args[0] || '').replace(/[^0-9]/g, '');
  if (!num || num.length < 6) {
    return reply(
      `Usage: ${prefix}add <numéro>\n` +
      `Ex: ${prefix}add 691234567\n\n` +
      `Si je suis admin, j'ajoute directement.\n` +
      `Sinon, je génère un lien d'invitation.`
    );
  }

  const targetJid = num + '@s.whatsapp.net';

  try {
    const meta = await sock.groupMetadata(jid);
    const botJid = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
    const admins = meta.participants?.filter(p => p.admin).map(p => p.id) || [];
    const botIsAdmin = admins.includes(botJid);

    if (botIsAdmin) {
      await sock.groupParticipantsUpdate(jid, [targetJid], 'add');
      return reply(`✅ @${num} ajouté au groupe.`);
    }

    const code = await sock.groupInviteCode(jid);
    const link = `https://chat.whatsapp.com/${code}`;
    await sock.sendMessage(jid, {
      text: `🔗 Lien d'invitation pour @${num} :\n${link}\n\n_Je ne suis pas admin, partage ce lien à la personne._`,
      mentions: [targetJid],
    });
  } catch (err) {
    try {
      const code = await sock.groupInviteCode(jid);
      const link = `https://chat.whatsapp.com/${code}`;
      return reply(`🔗 Impossible d'ajouter directement. Lien d'invitation :\n${link}`);
    } catch (e2) {
      return reply(`❌ Erreur: ${err?.message || e2?.message || 'lien indisponible'}`);
    }
  }
}
