import { getMultiGroupStats, getRegisteredGroups } from '../modules/groups/multi-group-engine.js';

export const name = 'groups';
export const aliases = ['listgroups', 'mesgroupes'];
export const description = 'Liste les groupes animés par le bot';
export const category = 'admin';
export const level = 'sudo';

export async function handler(sock, m, { config }) {
  const stats = getMultiGroupStats();
  if (stats.length === 0) {
    return m.reply('Aucun groupe enregistré. Ajoutez le bot comme admin dans un groupe pour l\'activer automatiquement.');
  }
  let text = `╔══『 *GROUPES ACTIFS* 』══╗\n\n`;
  for (const [i, g] of stats.entries()) {
    text += `*${i + 1}. ${g.name}*\n   └ Type : ${g.type}\n   └ Silence : ${g.silenceLeft}\n   └ Activité : ${g.activityRate}\n   └ Scheduler : ${g.schedulerActive ? '✅' : '⏹️'}\n\n`;
  }
  text += `_Total : ${stats.length} groupe(s) — ${config.BOT_NAME}_`;
  await m.reply(text);
}
