const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');
const settings = require('../lib/settings.cjs');

cmd({
    pattern: 'videocall',
    react: '📹',
    desc: 'Bloquer/débloquer les appels vidéo',
    category: 'admin',
    filename: __filename,
    fromMe: true,
}, async (conn, m, commands, { q, reply }) => {
    const sub = (q || '').split(' ')[0].toLowerCase();

    if (sub === 'on') {
        settings.set('anticallvideo', true);
        process.env.ANTI_VIDEOCALL = 'true';
        return reply('✅ Blocage des appels vidéo *ACTIVÉ*.');
    }

    if (sub === 'off') {
        settings.set('anticallvideo', false);
        process.env.ANTI_VIDEOCALL = 'false';
        return reply('✅ Blocage des appels vidéo *DÉSACTIVÉ*.');
    }

    const current = settings.get('anticallvideo') || false;
    reply(box('📹 *ANTI-VIDEOCALL*', [
        { label: 'Statut', value: current ? '✅ Activé' : '❌ Désactivé' },
        { blank: true },
        { raw: '.videocall on — Bloquer les appels vidéo' },
        { raw: '.videocall off — Autoriser' },
    ]));
});
