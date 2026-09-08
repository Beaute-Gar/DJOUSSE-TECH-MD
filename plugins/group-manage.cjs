const { cmd } = require('../command.cjs');
const { getGroupAdmins } = require('../lib/functions.cjs');
const { box } = require('../lib/djousse-ui.cjs');
const settings = require('../lib/settings.cjs');
const fs = require('fs');

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
    if (args[0] && /^\d{7,15}$/.test(args[0])) return args[0] + '@s.whatsapp.net';
    return null;
}

// ───────────────────────── MUTE (standalone) ─────────────────────────
cmd({
    pattern: 'mute',
    react: '🔇',
    desc: 'Fermer le groupe (seuls les admins peuvent écrire)',
    category: 'group',
    filename: __filename,
}, async (conn, m) => {
    if (!m.isGroup) return m.reply(box('🔇 *MUTE*', [
        { raw: '❌ *Commande réservée aux groupes.*' },
    ]));
    const meta = await getMeta(conn, m.chat);
    if (!meta) return m.reply('❌ Impossible de lire les infos du groupe.');
    const botIsAdmin = (meta.participants || []).some(p => botJids(conn).has(normJid(p.jid || p.id)) && p.admin);
    if (!botIsAdmin) return m.reply(box('🔇 *MUTE*', [
        { raw: '❌ *Le bot doit être admin pour fermer le groupe.*' },
    ]));
    try {
        await conn.groupSettingUpdate(m.chat, 'announcement');
        m.reply(box('🔇 *MUTE*', [
            { label: 'Statut', value: '✅ Groupe fermé' },
            { raw: 'Seuls les admins peuvent écrire.' },
        ]));
    } catch (err) {
        m.reply('❌ Erreur: ' + err.message);
    }
});

// ───────────────────────── UNMUTE (standalone) ─────────────────────────
cmd({
    pattern: 'unmute',
    react: '🔊',
    desc: 'Ouvrir le groupe (tout le monde peut écrire)',
    category: 'group',
    filename: __filename,
}, async (conn, m) => {
    if (!m.isGroup) return m.reply(box('🔊 *UNMUTE*', [
        { raw: '❌ *Commande réservée aux groupes.*' },
    ]));
    const meta = await getMeta(conn, m.chat);
    if (!meta) return m.reply('❌ Impossible de lire les infos du groupe.');
    const botIsAdmin = (meta.participants || []).some(p => botJids(conn).has(normJid(p.jid || p.id)) && p.admin);
    if (!botIsAdmin) return m.reply(box('🔊 *UNMUTE*', [
        { raw: '❌ *Le bot doit être admin pour ouvrir le groupe.*' },
    ]));
    try {
        await conn.groupSettingUpdate(m.chat, 'not_announcement');
        m.reply(box('🔊 *UNMUTE*', [
            { label: 'Statut', value: '✅ Groupe ouvert' },
            { raw: 'Tout le monde peut écrire.' },
        ]));
    } catch (err) {
        m.reply('❌ Erreur: ' + err.message);
    }
});

// ───────────────────────── BAN (expulser + blacklister) ─────────────────────────
cmd({
    pattern: 'ban',
    react: '⛔',
    desc: 'Expulser et blacklister un membre',
    category: 'group',
    filename: __filename,
}, async (conn, m) => {
    if (!m.isGroup) return m.reply('❌ Commande de groupe uniquement.');
    const meta = await getMeta(conn, m.chat);
    if (!meta) return m.reply('❌ Impossible de lire les infos du groupe.');
    const botIsAdmin = (meta.participants || []).some(p => botJids(conn).has(normJid(p.jid || p.id)) && p.admin);
    if (!botIsAdmin) return m.reply('❌ Le bot doit être admin.');
    const senderJid = normJid(m.sender);
    const senderIsAdmin = meta.participants.some(p => normJid(p.jid || p.id) === senderJid && p.admin);
    if (!senderIsAdmin) return m.reply('❌ Tu dois être admin.');
    const args = m.body.split(' ').slice(2);
    const target = getTargetUser(m, m.quoted, args);
    if (!target) return m.reply('❌ Mentionne ou répond à l\'utilisateur.\nEx: .ban @237600000000');
    const targetIsAdmin = meta.participants.some(p => normJid(p.jid || p.id) === normJid(target) && p.admin);
    if (targetIsAdmin) return m.reply('❌ Impossible de bannir un admin.');
    try {
        await conn.groupParticipantsUpdate(m.chat, [target], 'remove');
        const BL_DB = './database/blacklist.json';
        let bl = {};
        try { bl = JSON.parse(fs.readFileSync(BL_DB)); } catch { }
        if (!bl[target]) bl[target] = [];
        bl[target].push({ date: new Date().toISOString(), by: m.sender, reason: args.slice(1).join(' ') || 'Ban par admin' });
        fs.writeFileSync(BL_DB, JSON.stringify(bl, null, 2));
        await conn.sendMessage(m.chat, {
            text: box('⛔ *BAN*', [
                { label: 'Banni', value: '@' + normJid(target).split('@')[0] },
                { raw: 'Expulsé et blacklisté.' },
            ]),
            contextInfo: { mentionedJid: [target] }
        }, { quoted: m });
    } catch (err) {
        m.reply('❌ Erreur: ' + err.message);
    }
});

// ───────────────────────── UNBAN (retirer de la blacklist) ─────────────────────────
cmd({
    pattern: 'unban',
    react: '✅',
    desc: 'Retirer un membre de la blacklist',
    category: 'group',
    filename: __filename,
}, async (conn, m) => {
    const BL_DB = './database/blacklist.json';
    const args = m.body.split(' ').slice(2);
    let target = null;
    if (m.quoted?.sender) target = m.quoted.sender;
    else if (m.mention && m.mention.length) target = m.mention[0];
    else if (args[0]) {
        const num = args[0].replace('@', '').replace(/[^0-9]/g, '');
        if (num) target = num + '@s.whatsapp.net';
    }
    if (!target) return m.reply('❌ Mentionne ou répond à l\'utilisateur.\nEx: .unban @237600000000');
    try {
        let bl = {};
        try { bl = JSON.parse(fs.readFileSync(BL_DB)); } catch { }
        if (!bl[target]) return m.reply('❌ @' + target.split('@')[0] + ' n\'est pas blacklisté.');
        delete bl[target];
        fs.writeFileSync(BL_DB, JSON.stringify(bl, null, 2));
        m.reply('✅ @' + target.split('@')[0] + ' retiré de la blacklist.');
    } catch (err) {
        m.reply('❌ Erreur: ' + err.message);
    }
});

// ───────────────────────── MUTEUSER (mute individuel — suppression auto) ─────────────────────────
const MUTED_DB = './database/muted.json';
const loadMuted = () => { try { return JSON.parse(fs.readFileSync(MUTED_DB)); } catch { return {}; }};
const saveMuted = (d) => fs.writeFileSync(MUTED_DB, JSON.stringify(d, null, 2));

cmd({
    pattern: 'muteuser',
    alias: ['mutemember', 'mu'],
    react: '🔇',
    desc: 'Mute un membre (ses messages seront supprimés automatiquement)',
    category: 'group',
    filename: __filename,
}, async (conn, m) => {
    if (!m.isGroup) return m.reply('❌ Commande de groupe uniquement.');
    const meta = await getMeta(conn, m.chat);
    if (!meta) return m.reply('❌ Impossible de lire les infos du groupe.');
    const botIsAdmin = (meta.participants || []).some(p => botJids(conn).has(normJid(p.jid || p.id)) && p.admin);
    if (!botIsAdmin) return m.reply('❌ Le bot doit être admin.');
    const senderJid = normJid(m.sender);
    const senderIsAdmin = meta.participants.some(p => normJid(p.jid || p.id) === senderJid && p.admin);
    if (!senderIsAdmin) return m.reply('❌ Tu dois être admin.');
    const args = m.body.split(' ').slice(2);
    const target = getTargetUser(m, m.quoted, args);
    if (!target) return m.reply('❌ Mentionne ou répond à l\'utilisateur.\nEx: .muteuser @237600000000');
    const targetIsAdmin = meta.participants.some(p => normJid(p.jid || p.id) === normJid(target) && p.admin);
    if (targetIsAdmin) return m.reply('❌ Impossible de mute un admin.');
    const muted = loadMuted();
    if (!muted[m.chat]) muted[m.chat] = {};
    if (muted[m.chat][normJid(target)]) return m.reply('❌ @' + normJid(target).split('@')[0] + ' est déjà mute.');
    muted[m.chat][normJid(target)] = {
        by: m.sender,
        date: new Date().toISOString(),
        reason: args.slice(1).join(' ') || 'Aucune raison'
    };
    saveMuted(muted);
    await conn.sendMessage(m.chat, {
        text: box('🔇 *MUTE USER*', [
            { label: 'Mute', value: '@' + normJid(target).split('@')[0] },
            { raw: 'Ses messages seront supprimés automatiquement.' },
            { raw: 'Pour unmute: .unmuteuser @' + normJid(target).split('@')[0] },
        ]),
        contextInfo: { mentionedJid: [target] }
    }, { quoted: m });
});

// ───────────────────────── UNMUTEUSER ─────────────────────────
cmd({
    pattern: 'unmuteuser',
    alias: ['unmutemember', 'umu'],
    react: '🔊',
    desc: 'Unmute un membre',
    category: 'group',
    filename: __filename,
}, async (conn, m) => {
    if (!m.isGroup) return m.reply('❌ Commande de groupe uniquement.');
    const meta = await getMeta(conn, m.chat);
    if (!meta) return m.reply('❌ Impossible de lire les infos du groupe.');
    const botIsAdmin = (meta.participants || []).some(p => botJids(conn).has(normJid(p.jid || p.id)) && p.admin);
    if (!botIsAdmin) return m.reply('❌ Le bot doit être admin.');
    const senderJid = normJid(m.sender);
    const senderIsAdmin = meta.participants.some(p => normJid(p.jid || p.id) === senderJid && p.admin);
    if (!senderIsAdmin) return m.reply('❌ Tu dois être admin.');
    const args = m.body.split(' ').slice(2);
    const target = getTargetUser(m, m.quoted, args);
    if (!target) return m.reply('❌ Mentionne ou répond à l\'utilisateur.\nEx: .unmuteuser @237600000000');
    const muted = loadMuted();
    if (!muted[m.chat] || !muted[m.chat][normJid(target)]) {
        return m.reply('❌ @' + normJid(target).split('@')[0] + ' n\'est pas mute.');
    }
    delete muted[m.chat][normJid(target)];
    saveMuted(muted);
    await conn.sendMessage(m.chat, {
        text: box('🔊 *UNMUTE USER*', [
            { label: 'Unmute', value: '@' + normJid(target).split('@')[0] },
            { raw: 'Ce membre peut à nouveau écrire librement.' },
        ]),
        contextInfo: { mentionedJid: [target] }
    }, { quoted: m });
});

// ───────────────────────── MUTELIST ─────────────────────────
cmd({
    pattern: 'mutelist',
    react: '📋',
    desc: 'Voir la liste des membres mutés',
    category: 'group',
    filename: __filename,
}, async (conn, m) => {
    if (!m.isGroup) return m.reply('❌ Commande de groupe uniquement.');
    const muted = loadMuted();
    const groupMuted = muted[m.chat] || {};
    const entries = Object.entries(groupMuted);
    if (!entries.length) return m.reply('✅ Aucun membre muté dans ce groupe.');
    let txt = '🔇 *MEMBRES MUTÉS*\n\n';
    entries.forEach(([jid, info]) => {
        txt += `👤 @${jid.split('@')[0]}\n`;
        txt += `   Par: @${(info.by || '').split('@')[0]}\n`;
        txt += `   Date: ${info.date?.slice(0, 16) || '?'}\n`;
        if (info.reason) txt += `   Raison: ${info.reason}\n`;
        txt += '\n';
    });
    const mentions = entries.map(([j]) => j).concat(entries.map(([, i]) => i.by).filter(Boolean));
    await conn.sendMessage(m.chat, { text: txt, mentions }, { quoted: m });
});

// ───────────────────────── ANTILINK (toggle dédié) ─────────────────────────
cmd({
    pattern: 'antilink',
    react: '🔗',
    desc: 'Activer/désactiver la détection de liens',
    category: 'group',
    filename: __filename,
}, async (conn, m) => {
    if (!m.isGroup) return m.reply('❌ Commande de groupe uniquement.');
    const args = m.body.split(' ').slice(1);
    const sub = args[0]?.toLowerCase();
    if (!sub || !['on', 'off', 'status'].includes(sub)) {
        const current = settings.get('antilink') || false;
        return m.reply(box('🔗 *ANTILINK*', [
            { label: 'Statut', value: current ? '✅ Activé' : '❌ Désactivé' },
            { blank: true },
            { raw: 'Usage:' },
            { raw: '.antilink on — Activer' },
            { raw: '.antilink off — Désactiver' },
            { raw: '.antilink status — Voir le statut' },
            { blank: true },
            { raw: 'Action configurée: ' + (settings.get('antilinkaction') || 'delete') },
        ]));
    }
    if (sub === 'status') {
        const current = settings.get('antilink') || false;
        return m.reply('🔗 Antilink: ' + (current ? '✅ ON' : '❌ OFF') + '\nAction: ' + (settings.get('antilinkaction') || 'delete'));
    }
    const state = sub === 'on';
    settings.set('antilink', state);
    m.reply('🔗 Antilink: ' + (state ? '✅ Activé' : '❌ Désactivé'));
});

// ───────────────────────── CHECKWARN ─────────────────────────
cmd({
    pattern: 'checkwarn',
    alias: ['warns'],
    react: '⚠️',
    desc: 'Voir les warns d\'un utilisateur',
    category: 'group',
    filename: __filename,
}, async (conn, m) => {
    const DB = './database/warns.json';
    let warns = {};
    try { warns = JSON.parse(fs.readFileSync(DB)); } catch { }
    const args = m.body.split(' ').slice(2);
    let target = null;
    if (m.quoted?.sender) target = m.quoted.sender;
    else if (m.mention && m.mention.length) target = m.mention[0];
    else if (args[0]) {
        const num = args[0].replace('@', '').replace(/[^0-9]/g, '');
        if (num) target = num + '@s.whatsapp.net';
    }
    if (!target) return m.reply('❌ Mentionne ou répond à l\'utilisateur.\nEx: .checkwarn @237600000000');
    const userWarns = warns[target] || [];
    if (userWarns.length === 0) {
        return m.reply(box('⚠️ *CHECKWARN*', [
            { label: 'Utilisateur', value: '@' + target.split('@')[0] },
            { label: 'Warns', value: '✅ Aucun warn' },
        ]));
    }
    let txt = box('⚠️ *CHECKWARN*', [
        { label: 'Utilisateur', value: '@' + target.split('@')[0] },
        { label: 'Warns', value: userWarns.length + '/3' },
        { blank: true },
    ]);
    userWarns.forEach((w, i) => {
        txt += `\n${i + 1}. ${w.reason} (${w.date?.slice(0, 10) || '?'})`;
    });
    if (userWarns.length >= 3) txt += '\n\n⛔ *3 warns → prochain = expulsion*';
    await conn.sendMessage(m.chat, { text: txt, mentions: [target] }, { quoted: m });
});

// ───────────────────────── KICKALL ─────────────────────────
cmd({
    pattern: 'kickall',
    react: '💀',
    desc: 'Expulser tous les non-admins (avec confirmation)',
    category: 'group',
    filename: __filename,
    fromMe: true,
}, async (conn, m) => {
    if (!m.isGroup) return m.reply('❌ Commande de groupe uniquement.');
    const meta = await getMeta(conn, m.chat);
    if (!meta) return m.reply('❌ Impossible de lire les infos du groupe.');
    const botJid = normJid(conn.user?.id);
    const adminIds = new Set(meta.participants.filter(p => p.admin).map(p => normJid(p.jid || p.id)));
    adminIds.add(botJid);
    const targets = meta.participants.map(p => normJid(p.jid || p.id)).filter(id => !adminIds.has(id) && /^\d{9,15}@/.test(id));
    if (!targets.length) return m.reply('⚠️ Aucun membre non-admin à expulser.');
    const confirmKey = 'kickall_' + m.chat;
    if (m.body.includes('--confirm')) {
        m.reply('⏳ Expulsion de *' + targets.length + '* membres...');
        await conn.groupParticipantsUpdate(m.chat, targets, 'remove');
        m.reply('✅ ' + targets.length + ' membres expulsés.');
    } else {
        m.reply(box('💀 *KICKALL*', [
            { label: 'Membres', value: String(targets.length) },
            { blank: true },
            { raw: '⚠️ Cette action est irréversible !' },
            { raw: 'Pour confirmer :' },
            { raw: '.kickall --confirm' },
        ]));
    }
});

// ───────────────────────── WARNS RESET ALL ─────────────────────────
cmd({
    pattern: 'resetallwarns',
    react: '♻️',
    desc: 'Réinitialiser TOUS les warns du groupe',
    category: 'group',
    filename: __filename,
    fromMe: true,
}, async (conn, m) => {
    if (!m.isGroup) return m.reply('❌ Commande de groupe uniquement.');
    const DB = './database/warns.json';
    try {
        const warns = JSON.parse(fs.readFileSync(DB));
        const meta = await getMeta(conn, m.chat);
        const memberIds = new Set((meta.participants || []).map(p => normJid(p.jid || p.id)));
        let count = 0;
        for (const [jid] of Object.entries(warns)) {
            if (memberIds.has(normJid(jid))) { delete warns[jid]; count++; }
        }
        fs.writeFileSync(DB, JSON.stringify(warns, null, 2));
        m.reply('♻️ ' + count + ' utilisateurs désavertis.');
    } catch (e) {
        m.reply('❌ Erreur: ' + e.message);
    }
});
