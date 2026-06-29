import { getAllCommandNames, getCommandsByCategory } from '../core/loader.js';

export const name = 'menu';
export const aliases = ['aide', 'help', 'cmds'];
export const description = 'Affiche le menu des commandes';
export const category = 'info';
export const level = 'user';

export async function handler(sock, m, { prefix, config, privilege }) {
  const now = new Date().toLocaleString('fr-FR', {
    timeZone: 'Africa/Douala', dateStyle: 'short', timeStyle: 'short',
  });

  const categories = {
    info   : { label: 'ℹ️ Information',    cmds: [] },
    groupe : { label: '👥 Groupe',          cmds: [] },
    media  : { label: '🎵 Médias',          cmds: [] },
    dl     : { label: '⬇️ Téléchargement', cmds: [] },
    ia     : { label: '🤖 Intelligence IA', cmds: [] },
    eco    : { label: '💰 Économie',        cmds: [] },
    admin  : { label: '⚙️ Administration',  cmds: [] },
    owner  : { label: '👑 Owner',           cmds: [] },
  };

  const all = getCommandsByCategory();
  for (const cmd of all) {
    const cat = cmd.category || 'info';
    if (categories[cat]) {
      if (cmd.level === 'owner' && privilege !== 'owner') continue;
      if (cmd.level === 'sudo'  && privilege === 'user')  continue;
      categories[cat].cmds.push(cmd.name);
    }
  }

  let text = `╔══『 *${config.BOT_NAME}* 』══╗\n`;
  text += `║ 📅 ${now}\n`;
  text += `║ 🔧 Préfixe : *${prefix}*\n`;
  text += `║ 🎖️ Niveau : *${privilege}*\n`;
  text += `╚══════════════════════╝\n\n`;

  for (const [, cat] of Object.entries(categories)) {
    if (cat.cmds.length === 0) continue;
    text += `*${cat.label}*\n`;
    text += cat.cmds.map(c => `  ${prefix}${c}`).join('\n');
    text += '\n\n';
  }

  text += `_${config.COMPANY_NAME}_`;
  await m.reply(text);
}
