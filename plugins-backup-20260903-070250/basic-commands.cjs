const { cmd } = require('../command.cjs');

/* .code — Affiche le code de pairing/parrainage en cours */
cmd({
    pattern: '.code',
    alias: ['pairing', 'codepair'],
    category: 'util',
    execute: async (m, match) => {
        const pairingCode = global.pairingCode || 'Non généré';
        const server = global.currentServer || '1';
        await m.reply(`📜 *Code de parrainage* : \`${pairingCode}\`
🖥 Serveur : *${server}*
⏰ Généré : récemment\n\n*
Copie ce code et envoie-le sur WhatsApp pour te connecter.*`);
    }
}, '/code');

/* .jid — Affiche ton JID WhatsApp */
cmd({
    pattern: '.jid',
    alias: ['id', 'monid'],
    category: 'util',
    execute: async (m, match) => {
        const me = global.sock?.user || global.sock?.me || '';
        const jid = String(me).split('@')[0] || 'Non disponible';
        await m.reply(`🆔 *Ton JID WhatsApp* : \`${jid}\`

*Utilise ce ID pour les commandes @mention ou'administration.*`);
    }
}, '/jid');

/* .owner — Affiche les informations du propriétaire */
cmd({
    pattern: '.owner',
    alias: ['ownerinfo', 'admin'],
    category: 'util',
    execute: async (m, match) => {
        const ownerNum = config.BOT_OWNER || '237693978044';
        await m.reply(`👑 *Propriétaire du bot* : \`${ownerNum}\`

*C'est la personne qui a le contrôle total du bot.*
*Commandes owner : .menu, .stats, .restart, etc.*`);
    }
}, '/owner');