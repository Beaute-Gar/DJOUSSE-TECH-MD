export const name = 'poll';
export const aliases = ['sondage', 'vote'];
export const description = 'Créer un sondage dans le groupe';
export const category = 'group';
export const level = 'user';
export const cooldown = 10;

export async function handler(sock, m, { args, text, prefix, reply, jid, isGroup }) {
  if (!isGroup) return reply('❌ Les sondages ne fonctionnent qu\'en groupe');

  const parts = text.replace(/^\.(poll|sondage|vote)\s*/i, '').split('|').map(s => s.trim());
  if (parts.length < 2 || parts[0].length === 0) {
    return reply(
      `📊 *Créer un sondage*\n\n` +
      `Usage: ${prefix}poll Question | Option 1 | Option 2 | ...\n\n` +
      `Ex: ${prefix}poll Quel est ton langage préféré ? | JavaScript | Python | Java`
    );
  }

  const question = parts[0];
  const options = parts.slice(1).filter(o => o.length > 0);
  if (options.length < 2) return reply('❌ Minimum 2 options requises');
  if (options.length > 10) return reply('❌ Maximum 10 options');

  try {
    await sock.sendMessage(jid, {
      poll: { name: question, values: options, selectableCount: 1 },
    });
  } catch (err) {
    reply(`❌ Erreur: ${err.message}`);
  }
}
