const { cmd } = require('../command.cjs');
cmd({ pattern: 'videocall', desc: 'Configurer le blocage des appels vidéo', category: 'utility', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
const args = m.body.split(' ').slice(1);
const sub = args[0]?.toLowerCase();
if (sub === 'on') {
process.env.ANTI_VIDEOCALL = 'true';
return m.reply('✅ Blocage des appels vidéo ACTIVÉ.');
} else if (sub === 'off') {
process.env.ANTI_VIDEOCALL = 'false';
return m.reply('✅ Blocage des appels vidéo DÉSACTIVÉ.');
}
m.reply('📹 Gestion appels vidéo\n\n.videocall on - Bloquer\n.videocall off - Autoriser\n\nActuel: ' + (process.env.ANTI_VIDEOCALL !== 'false' ? 'Bloqués' : 'Autorisés'));
});