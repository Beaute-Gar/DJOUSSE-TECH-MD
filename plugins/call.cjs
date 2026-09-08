const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');
const settings = require('../lib/settings.cjs');

cmd({
    pattern: 'call',
    react: '📞',
    desc: 'Bloquer/débloquer les appels entrants',
    category: 'admin',
    filename: __filename,
    fromMe: true,
}, async (conn, m, commands, { q, reply }) => {
    const sub = (q || '').split(' ')[0].toLowerCase();

    if (sub === 'on') {
        settings.set('anticall', true);
        process.env.ANTI_CALL = 'true';
        return reply('✅ Blocage des appels *ACTIVÉ*.\nLes appels entrants seront automatiquement rejetés.');
    }

    if (sub === 'off') {
        settings.set('anticall', false);
        process.env.ANTI_CALL = 'false';
        return reply('✅ Blocage des appels *DÉSACTIVÉ*.');
    }

    const current = settings.get('anticall') || false;
    reply(box('📞 *ANTI-CALL*', [
        { label: 'Statut', value: current ? '✅ Activé' : '❌ Désactivé' },
        { blank: true },
        { raw: '.call on — Bloquer les appels' },
        { raw: '.call off — Autoriser les appels' },
    ]));
});

// Restaurer au démarrage
try {
    if (require('../lib/settings.cjs').get('anticall')) {
        process.env.ANTI_CALL = 'true';
    }
    if (require('../lib/settings.cjs').get('anticallvideo')) {
        process.env.ANTI_VIDEOCALL = 'true';
    }
} catch {}
