const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');;

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
    reply(boxWithFooter('📜 *CODE DE PAIRING*', [
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
    const me = conn?.user || '';
    const jid = String(me).split('@')[0] || 'Non disponible';
    reply(boxWithFooter('🆔 *TON JID*', [
        { label: 'JID', value: jid },
        { blank: true },
        { raw: 'Utilise ce ID pour les commandes @mention.' },
    ]));
});

/* .owner — DÉSACTIVÉ, conflit avec owner-v2.cjs */
