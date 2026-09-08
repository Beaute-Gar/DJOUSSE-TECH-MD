const { cmd } = require('../command.cjs');
const { getGroupAdmins } = require('../lib/functions.cjs');
const { box } = require('../lib/djousse-ui.cjs');

const normJid = (jid) => String(jid || '').split(':')[0];
const botJids = (sock) => {
    const list = new Set([normJid(sock.user?.id)]);
    const lid = sock.user?.lid || sock.lid;
    if (lid) list.add(String(lid).split(':')[0]);
    return list;
};

async function getMeta(conn, chat) {
    return await conn.groupMetadata(chat).catch(() => null);
}

function getTargetUser(m, quoted, args) {
    const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (mentions && mentions.length) return mentions[0];
    if (quoted?.sender) return quoted.sender;
    if (args[0]?.includes('@')) return args[0].replace('@', '') + '@s.whatsapp.net';
    return null;
}

// ───────────────────────── KICK ─────────────────────────
cmd({
    pattern: 'kick',
    react: '👢',
    desc: 'Kick user from group',
    category: 'group',
    filename: __filename,
}, async (conn, m) => {
    const chat = m.chat;
    if (!m.isGroup) return m.reply(box('👢 *KICK*', [
        { raw: '❌ *Commande réservée aux groupes.*' },
    ]));
    const meta = await getMeta(conn, chat);
    if (!meta) return m.reply('❌ Impossible de lire les infos du groupe.');
    const botIsAdmin = (meta.participants || []).some(p => botJids(conn).has(normJid(p.jid || p.id)) && p.admin);
    if (!botIsAdmin) return m.reply(box('👢 *KICK*', [
        { raw: '❌ *Le bot doit être admin pour expulser.*' },
    ]));
    const args = m.body.split(' ').slice(2);
    const target = getTargetUser(m, m.quoted, args);
    if (!target) return m.reply(box('👢 *KICK*', [
        { raw: 'Utilisation :' },
        { raw: '.kick @membre  |  .kick <numéro>' },
        { raw: 'Exemple :' },
        { raw: '.kick @237600000000' },
    ]));
    const admins = getGroupAdmins(meta.participants);
    if (admins.map(a => normJid(a)).includes(normJid(target))) return m.reply(box('👢 *KICK*', [
        { raw: '❌ *Impossible d\'expulser un admin.*' },
    ]));
    await conn.groupParticipantsUpdate(chat, [target], 'remove');
    await conn.sendMessage(chat, { text: box('👢 *KICK*', [
        { label: 'Expulsé', value: '@' + normJid(target).split('@')[0] },
    ]), contextInfo: { mentionedJid: [target] } }, { quoted: m });
});

// ───────────────────────── TAGALL ─────────────────────────
cmd({
    pattern: 'tagall',
    react: '📢',
    desc: 'Tag all group members',
    category: 'group',
    filename: __filename,
}, async (conn, m) => {
    if (!m.isGroup) return m.reply(box('📢 *TAGALL*', [
        { raw: '❌ *Commande réservée aux groupes.*' },
    ]));
    const meta = await getMeta(conn, m.chat);
    if (!meta || !meta.participants) return m.reply('❌ Impossible de lire le groupe.');
    const members = meta.participants.filter(p => {
        const num = String(p.jid || p.id || '').split(':')[0].split('@')[0];
        return /^\d{9,15}$/.test(num);
    });
    if (members.length === 0) return m.reply(box('📢 *TAGALL*', [
        { raw: '❌ *Aucun numéro valide à mentionner.*' },
    ]));
    const ids = members.map(p => String(p.jid || p.id).split(':')[0]);
    const text = '*Attention à tous :*\n' + ids.map(id => '@+' + id.split('@')[0]).join(' ');
    await conn.sendMessage(m.chat, { text: box('📢 *TAGALL*', [
        { raw: text },
    ]), contextInfo: { mentionedJid: ids } }, { quoted: m });
});

// ───────────────────────── TAGALL2 (mention cachée) ─────────────────────────
cmd({
    pattern: 'tagall2',
    react: '📢',
    desc: 'Tag all (mention cachée via relayMessage)',
    category: 'group',
    filename: __filename,
}, async (conn, m) => {
    if (!m.isGroup) return m.reply(box('📢 *TAGALL2*', [
        { raw: '❌ *Commande réservée aux groupes.*' },
    ]));
    try {
        await conn.relayMessage(m.chat, {
            extendedTextMessage: {
                text: '@all',
                contextInfo: { nonJidMentions: 1 }
            }
        }, {});
    } catch (e) {
        m.reply(box('📢 *TAGALL2*', [
            { raw: '❌ Erreur: ' + e.message },
        ]));
    }
});

// ───────────────────────── ADMINS ─────────────────────────
cmd({
    pattern: 'admins',
    react: '👑',
    desc: 'List all group admins',
    category: 'group',
    filename: __filename,
}, async (conn, m) => {
    if (!m.isGroup) return m.reply(box('👑 *ADMINS*', [
        { raw: '❌ *Commande réservée aux groupes.*' },
    ]));
    const meta = await getMeta(conn, m.chat);
    if (!meta || !meta.participants) return m.reply('❌ Impossible de lire le groupe.');
    const admins = meta.participants.filter(p => p.admin).map(p => '@' + String(p.jid || p.id).split(':')[0].split('@')[0]);
    await conn.sendMessage(m.chat, { text: box('👑 *ADMINS*', [
        { raw: '*🛡️ Admins :*\n' + (admins.length ? admins.join('\n') : '(aucun)') },
    ]), contextInfo: { mentionedJid: meta.participants.filter(p => p.admin).map(p => String(p.jid || p.id).split(':')[0]) } }, { quoted: m });
});

// ───────────────────────── PROMOTE ─────────────────────────
cmd({
    pattern: 'promote',
    react: '⬆️',
    desc: 'Promote user to admin',
    category: 'group',
    filename: __filename,
}, async (conn, m) => {
    const chat = m.chat;
    if (!m.isGroup) return m.reply(box('⬆️ *PROMOTE*', [
        { raw: '❌ *Commande réservée aux groupes.*' },
    ]));
    const meta = await getMeta(conn, chat);
    if (!meta) return m.reply('❌ Impossible de lire le groupe.');
    const botIsAdmin = (meta.participants || []).some(p => botJids(conn).has(normJid(p.jid || p.id)) && p.admin);
    if (!botIsAdmin) return m.reply(box('⬆️ *PROMOTE*', [
        { raw: '❌ *Le bot doit être admin.*' },
    ]));
    const args = m.body.split(' ').slice(2);
    const target = getTargetUser(m, m.quoted, args);
    if (!target) return m.reply(box('⬆️ *PROMOTE*', [
        { raw: 'Utilisation :' },
        { raw: '.promote @membre  |  .promote <numéro>' },
        { raw: 'Exemple :' },
        { raw: '.promote @237600000000' },
    ]));
    await conn.groupParticipantsUpdate(chat, [target], 'promote');
    await conn.sendMessage(chat, { text: box('⬆️ *PROMOTE*', [
        { label: 'Promu', value: '@' + normJid(target).split('@')[0] },
    ]), contextInfo: { mentionedJid: [target] } }, { quoted: m });
});

// ───────────────────────── DEMOTE ─────────────────────────
cmd({
    pattern: 'demote',
    react: '⬇️',
    desc: 'Demote admin to member',
    category: 'group',
    filename: __filename,
}, async (conn, m) => {
    const chat = m.chat;
    if (!m.isGroup) return m.reply(box('⬇️ *DEMOTE*', [
        { raw: '❌ *Commande réservée aux groupes.*' },
    ]));
    const meta = await getMeta(conn, chat);
    if (!meta) return m.reply('❌ Impossible de lire le groupe.');
    const botIsAdmin = (meta.participants || []).some(p => botJids(conn).has(normJid(p.jid || p.id)) && p.admin);
    if (!botIsAdmin) return m.reply(box('⬇️ *DEMOTE*', [
        { raw: '❌ *Le bot doit être admin.*' },
    ]));
    const args = m.body.split(' ').slice(2);
    const target = getTargetUser(m, m.quoted, args);
    if (!target) return m.reply(box('⬇️ *DEMOTE*', [
        { raw: 'Utilisation :' },
        { raw: '.demote @admin  |  .demote <numéro>' },
        { raw: 'Exemple :' },
        { raw: '.demote @237600000000' },
    ]));
    await conn.groupParticipantsUpdate(chat, [target], 'demote');
    await conn.sendMessage(chat, { text: box('⬇️ *DEMOTE*', [
        { label: 'Rétrogradé', value: '@' + normJid(target).split('@')[0] },
    ]), contextInfo: { mentionedJid: [target] } }, { quoted: m });
});

// ───────────────────────── OPEN ─────────────────────────
cmd({
    pattern: 'open',
    alias: ['unmute'],
    react: '⚠️',
    desc: 'Allow everyone to send messages in the group.',
    category: 'group',
    filename: __filename,
}, async (conn, m) => {
    try {
        if (!m.isGroup) return m.reply(box('⚠️ *OUVRIR*', [
            { raw: '⚠️ *Commande réservée aux groupes.*' },
        ]));
        await conn.groupSettingUpdate(m.chat, 'not_announcement');
        m.reply(box('⚠️ *OUVRIR*', [
            { label: 'Statut', value: '✅ Groupe déverrouillé' },
        ]));
    } catch (err) {
        console.error('Open Error:', err);
        m.reply(box('⚠️ *OUVRIR*', [
            { raw: '❌ *Échec du déverrouillage. ' + err.message + '*' },
        ]));
    }
});

// ───────────────────────── CLOSE ─────────────────────────
cmd({
    pattern: 'close',
    alias: ['mute', 'lock'],
    react: '⚠️',
    desc: 'Set group chat to admin-only messages.',
    category: 'group',
    filename: __filename,
}, async (conn, m) => {
    try {
        if (!m.isGroup) return m.reply(box('⚠️ *FERMER*', [
            { raw: '⚠️ *Commande réservée aux groupes.*' },
        ]));
        await conn.groupSettingUpdate(m.chat, 'announcement');
        m.reply(box('⚠️ *FERMER*', [
            { label: 'Statut', value: '✅ Groupe verrouillé' },
        ]));
    } catch (err) {
        console.error('Close Error:', err);
        m.reply(box('⚠️ *FERMER*', [
            { raw: '❌ *Échec du verrouillage. ' + err.message + '*' },
        ]));
    }
});

// ───────────────────────── REVOKE ─────────────────────────
cmd({
    pattern: 'revoke',
    react: '♻️',
    desc: 'Reset group invite link',
    category: 'group',
    filename: __filename,
}, async (conn, m) => {
    if (!m.isGroup) return m.reply(box('♻️ *REVOKE*', [
        { raw: '❌ *Commande réservée aux groupes.*' },
    ]));
    await conn.groupRevokeInvite(m.chat);
    m.reply(box('♻️ *REVOKE*', [
        { label: 'Statut', value: '✅ Lien réinitialisé' },
    ]));
});

// ───────────────────────── GROUPLINK ─────────────────────────
cmd({
    pattern: 'grouplink',
    alias: ['link'],
    react: '🔗',
    desc: 'Get current invite link',
    category: 'group',
    filename: __filename,
}, async (conn, m) => {
    if (!m.isGroup) return m.reply(box('🔗 *LIEN DU GROUPE*', [
        { raw: '❌ *Commande réservée aux groupes.*' },
    ]));
    const code = await conn.groupInviteCode(m.chat);
    m.reply(box('🔗 *LIEN DU GROUPE*', [
        { label: 'Lien', value: 'https://chat.whatsapp.com/' + code },
    ]));
});

// ───────────────────────── SETSUBJECT ─────────────────────────
cmd({
    pattern: 'setsubject',
    react: '✏️',
    desc: 'Change group name',
    category: 'group',
    filename: __filename,
}, async (conn, m) => {
    if (!m.isGroup) return m.reply(box('✏️ *NOM DU GROUPE*', [
        { raw: '❌ *Commande réservée aux groupes.*' },
    ]));
    const args = m.body.split(' ').slice(2);
    if (!args[0]) return m.reply(box('✏️ *NOM DU GROUPE*', [
        { raw: 'Utilisation :' },
        { raw: '.setsubject <nouveau nom>' },
        { raw: 'Exemple :' },
        { raw: '.setsubject DJOUSSE TECH' },
    ]));
    await conn.groupUpdateSubject(m.chat, args.join(' '));
    m.reply(box('✏️ *NOM DU GROUPE*', [
        { label: 'Nouveau nom', value: args.join(' ') },
        { label: 'Statut', value: '✅ Mis à jour' },
    ]));
});

// ───────────────────────── SETDESC ─────────────────────────
cmd({
    pattern: 'setdesc',
    react: '📝',
    desc: 'Change group description',
    category: 'group',
    filename: __filename,
}, async (conn, m) => {
    if (!m.isGroup) return m.reply(box('📝 *DESCRIPTION*', [
        { raw: '❌ *Commande réservée aux groupes.*' },
    ]));
    const args = m.body.split(' ').slice(2);
    if (!args[0]) return m.reply(box('📝 *DESCRIPTION*', [
        { raw: 'Utilisation :' },
        { raw: '.setdesc <nouvelle description>' },
        { raw: 'Exemple :' },
        { raw: '.setdesc Bienvenue dans le groupe' },
    ]));
    await conn.groupUpdateDescription(m.chat, args.join(' '));
    m.reply(box('📝 *DESCRIPTION*', [
        { label: 'Description', value: args.join(' ') },
        { label: 'Statut', value: '✅ Mis à jour' },
    ]));
});