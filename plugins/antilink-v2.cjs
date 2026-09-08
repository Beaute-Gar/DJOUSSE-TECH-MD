const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');

const antilinkGroups = new Map();
const antilinkWarnings = new Map();

const linkPatterns = [
    /https?:\/\/(?:chat\.whatsapp\.com|wa\.me)\/\S+/gi,
    /https?:\/\/(www\.)?whatsapp\.com\/channel\/\S+/gi,
    /wa\.me\/\S+/gi,
    /https?:\/\/(?:t\.me|telegram\.me)\/\S+/gi,
    /https?:\/\/(?:www\.)?youtube\.com\/\S+/gi,
    /https?:\/\/youtu\.be\/\S+/gi,
    /https?:\/\/(?:www\.)?facebook\.com\/\S+/gi,
    /https?:\/\/fb\.me\/\S+/gi,
    /https?:\/\/(?:www\.)?instagram\.com\/\S+/gi,
    /https?:\/\/(?:www\.)?twitter\.com\/\S+/gi,
    /https?:\/\/(?:www\.)?x\.com\/\S+/gi,
    /https?:\/\/(?:www\.)?tiktok\.com\/\S+/gi,
    /https?:\/\/(?:www\.)?discord\.gg\/\S+/gi,
    /https?:\/\/(?:www\.)?discord\.com\/\S+/gi,
    /https?:\/\/bit\.ly\/\S+/gi,
    /https?:\/\/tinyurl\.com\/\S+/gi,
    /https?:\/\/t\.co\/\S+/gi,
];

cmd({
    pattern: 'antilink',
    desc: 'Enable/disable antilink (warn + delete, remove on 2nd offense)',
    category: 'group',
    react: '🔗',
    use: '.antilink on/off',
    filename: __filename
}, async (conn, m, commands, { from, args, isGroup, isOwner, isAdmins, isBotAdmins, reply }) => {
    try {
        if (!isGroup) return reply(box('ANTILINK', ['❌ Groups only.']));
        if (!isOwner && !isAdmins) return reply(box('ANTILINK', ['❌ Admin only.']));
        if (!isBotAdmins) return reply(box('ANTILINK', ['❌ Bot must be admin.']));

        const action = (args[0] || '').toLowerCase();
        if (!['on', 'off'].includes(action)) {
            return reply(box('ANTILINK', ['Usage: .antilink on/off']));
        }

        if (action === 'on') {
            antilinkGroups.set(from, true);
            reply(box('ANTILINK', ['🟢 Antilink activated.']));
        } else {
            antilinkGroups.set(from, false);
            for (const key of antilinkWarnings.keys()) {
                if (key.startsWith(from + ':')) antilinkWarnings.delete(key);
            }
            reply(box('ANTILINK', ['🔴 Antilink deactivated.']));
        }
    } catch (e) {
        console.error('Antilink cmd error:', e);
        reply('❌ Error.');
    }
});

cmd({
    on: 'body'
}, async (conn, m, commands, { from, body, sender, isGroup, isAdmins, isBotAdmins }) => {
    try {
        if (!isGroup || isAdmins || !isBotAdmins) return;
        if (m.key?.fromMe) return;
        if (!antilinkGroups.get(from)) return;

        const hasLink = linkPatterns.some(p => {
            p.lastIndex = 0;
            return p.test(body || '');
        });
        if (!hasLink) return;

        const warnKey = `${from}:${sender}`;
        const userWarnings = antilinkWarnings.get(warnKey) || 0;

        if (userWarnings === 0) {
            antilinkWarnings.set(warnKey, 1);
            try { await conn.sendMessage(from, { delete: m.key }); } catch {}
            await conn.sendMessage(from, {
                text: `⚠️ @${sender.split('@')[0]}, links are not allowed here! This is a warning.`,
                mentions: [sender]
            }, { quoted: m });
        } else {
            antilinkWarnings.delete(warnKey);
            try { await conn.sendMessage(from, { delete: m.key }); } catch {}
            await conn.sendMessage(from, {
                text: `🚫 @${sender.split('@')[0]} has been removed for posting links after warning.`,
                mentions: [sender]
            }, { quoted: m });
            await conn.groupParticipantsUpdate(from, [sender], 'remove');
        }
    } catch (e) {
        console.error('Antilink detect error:', e);
    }
});
