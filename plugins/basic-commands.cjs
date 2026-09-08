const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');

/* .code — Affiche le code de pairing/parrainage en cours */
cmd({
    pattern: 'code',
    alias: ['pairing', 'codepair'],
    react: '📜',
    desc: 'Affiche le code de pairing',
    category: 'util',
    filename: __filename,
}, async (conn, m, commands, { reply }) => {
    const pairingCode = global.pairingCode || 'Non généré';
    const server = global.currentServer || '1';
    reply(box('📜 *CODE DE PAIRING*', [
        { label: 'Code', value: pairingCode },
        { label: 'Serveur', value: server },
        { blank: true },
        { raw: 'Copie ce code et envoie-le sur WhatsApp pour te connecter.' },
    ]));
});

/* .jid — Affiche ton JID WhatsApp */
cmd({
    pattern: 'jid',
    alias: ['id', 'monid'],
    react: '🆔',
    desc: 'Affiche ton JID WhatsApp',
    category: 'util',
    filename: __filename,
}, async (conn, m, commands, { reply }) => {
    const me = global.sock?.user || global.sock?.me || '';
    const jid = String(me).split('@')[0] || 'Non disponible';
    reply(box('🆔 *TON JID*', [
        { label: 'JID', value: jid },
        { blank: true },
        { raw: 'Utilise ce ID pour les commandes @mention.' },
    ]));
});

/* .owner — Affiche les informations du propriétaire */
cmd({
    pattern: 'owner',
    alias: ['ownerinfo', 'admin'],
    react: '👑',
    desc: 'Infos du propriétaire du bot',
    category: 'util',
    filename: __filename,
}, async (conn, m, commands, { reply }) => {
    const config = require('../config-djousse.cjs');
    const ownerNum = config.BOT_OWNER || config.OWNER_NUMBER || '237693978044';
    reply(box('👑 *PROPRIÉTAIRE*', [
        { label: 'Numéro', value: ownerNum },
        { blank: true },
        { raw: 'C\'est la personne qui a le contrôle total du bot.' },
    ]));
});
