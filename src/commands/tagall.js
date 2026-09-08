export const name = 'tagall';
export const aliases = ['all', 'mentionall', 'everyone', 'toutlemonde'];
export const description = 'Mentionner tous les membres du groupe';
export const category = 'group';
export const level = 'user';
export const cooldown = 30;

export async function handler(sock, m, { text, prefix, reply, jid, isGroup }) {
  if (!isGroup) return reply('❌ Cette commande ne fonctionne qu\'en groupe');

  try {
    const meta = await sock.groupMetadata(jid);
    const participants = meta.participants || [];
    const mentions = participants.map(p => p.id);
    const message = text.replace(/^\.(tagall|all|mentionall|everyone|toutlemonde)\s*/i, '').trim() || '🙏 Merci à tous !';

    await sock.sendMessage(jid, {
      text: `👥 *@${meta.subject || 'groupe'}*\n\n${message}\n\n┅┅┅┅┅┅┅┅┅┅┅┅┅┅\n_${participants.length} membres_`,
      mentions,
    });
  } catch (err) {
    reply(`❌ Erreur: ${err.message}`);
  }
}
