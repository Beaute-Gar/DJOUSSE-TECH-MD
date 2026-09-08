const { cmd } = require('../command.cjs');
cmd({ pattern: 'call', desc: 'Configurer le blocage des appels', category: 'communication', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
const args = m.body.split(' ').slice(1);
const sub = args[0]?.toLowerCase();
if (sub === 'on') {
process.env.ANTI_CALL = 'true';
return m.reply('✅ Blocage des appels ACTIVÉ.\nLes appels entrants seront automatiquement rejetés.');
} else if (sub === 'off') {
process.env.ANTI_CALL = 'false';
return m.reply('✅ Blocage des appels DÉSACTIVÉ.');
}
m.reply('📞 Gestion des appels\n\n.call on - Bloquer les appels\n.call off - Autoriser les appels\n\nActuellement: ' + (process.env.ANTI_CALL !== 'false' ? 'Bloqués' : 'Autorisés'));
});