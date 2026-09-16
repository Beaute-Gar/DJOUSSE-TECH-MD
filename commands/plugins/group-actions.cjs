const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const { box } = require('../lib/djousse-ui.cjs');
const fs = require('fs');
const path = require('path');

function getBotJid(conn) {
    return conn.user.id.split(':')[0] + '@s.whatsapp.net';
}

async function isBotGroupAdmin(conn, from) {
    try {
        const metadata = await conn.groupMetadata(from);
        const botJid = getBotJid(conn);
        const botParticipant = metadata.participants.find(p => p.id === botJid);
        return !!(botParticipant && botParticipant.admin);
    } catch { return false; }
}

cmd({
    pattern: 'kicknum',
    desc: 'Remove a member by phone number',
    category: 'group',
    react: '🔢',
    use: '.kicknum <number>',
    filename: __filename
}, async (conn, m, commands, { from, args, isGroup, isAdmins, isOwner, reply }) => {
    try {
        if (!isGroup) return reply(box('KICKNUM', ['❌ Groups only.']));
        if (!isAdmins && !isOwner) return reply(box('KICKNUM', ['❌ Admin only.']));
        if (!(await isBotGroupAdmin(conn, from))) return reply(box('KICKNUM', ['❌ Bot must be admin.']));

        const rawNumber = args[0];
        if (!rawNumber) return reply(box('KICKNUM', ['❌ Usage: .kicknum <number>']));

        const cleanNumber = rawNumber.replace(/[^0-9]/g, '');
        if (cleanNumber.length < 8) return reply(box('KICKNUM', ['❌ Invalid number.']));

        const targetJid = `${cleanNumber}@s.whatsapp.net`;
        await conn.groupParticipantsUpdate(from, [targetJid], 'remove');
        return reply(box('KICKNUM', [`✅ ${cleanNumber} removed.`]));
    } catch (error) {
        console.error('KICKNUM ERROR:', error);
        reply('❌ Error.');
    }
});

cmd({
    pattern: 'acceptall',
    desc: 'Accept all pending group join requests',
    category: 'group',
    react: '✅',
    filename: __filename
}, async (conn, m, commands, { from, isGroup, isAdmins, isOwner, reply }) => {
    try {
        if (!isGroup) return reply(box('ACCEPTALL', ['❌ Groups only.']));
        if (!isAdmins && !isOwner) return reply(box('ACCEPTALL', ['❌ Admin only.']));
        if (!(await isBotGroupAdmin(conn, from))) return reply(box('ACCEPTALL', ['❌ Bot must be admin.']));

        const requests = await conn.groupRequestParticipantsList(from);
        if (!requests.length) return reply(box('ACCEPTALL', ['No pending requests.']));

        const jids = requests.map(r => r.jid);
        await conn.groupRequestParticipantsUpdate(from, jids, 'approve');
        return reply(box('ACCEPTALL', [`✅ ${jids.length} request(s) accepted.`]));
    } catch (error) {
        console.error('ACCEPTALL ERROR:', error);
        reply('❌ Error.');
    }
});

cmd({
    pattern: 'rejectall',
    desc: 'Reject all pending group join requests',
    category: 'group',
    react: '❌',
    filename: __filename
}, async (conn, m, commands, { from, isGroup, isAdmins, isOwner, reply }) => {
    try {
        if (!isGroup) return reply(box('REJECTALL', ['❌ Groups only.']));
        if (!isAdmins && !isOwner) return reply(box('REJECTALL', ['❌ Admin only.']));
        if (!(await isBotGroupAdmin(conn, from))) return reply(box('REJECTALL', ['❌ Bot must be admin.']));

        const requests = await conn.groupRequestParticipantsList(from);
        if (!requests.length) return reply(box('REJECTALL', ['No pending requests.']));

        const jids = requests.map(r => r.jid);
        await conn.groupRequestParticipantsUpdate(from, jids, 'reject');
        return reply(box('REJECTALL', [`✅ ${jids.length} request(s) rejected.`]));
    } catch (error) {
        console.error('REJECTALL ERROR:', error);
        reply('❌ Error.');
    }
});

cmd({
    pattern: 'kickadmin',
    desc: 'Demote then remove an admin (owner only)',
    category: 'group',
    react: '⚠️',
    filename: __filename
}, async (conn, m, commands, { from, isGroup, isOwner, reply }) => {
    try {
        if (!isGroup) return reply(box('KICKADMIN', ['❌ Groups only.']));
        if (!isOwner) return reply(box('KICKADMIN', ['❌ Owner only.']));
        if (!(await isBotGroupAdmin(conn, from))) return reply(box('KICKADMIN', ['❌ Bot must be admin.']));

        const quotedParticipant = m.message?.extendedTextMessage?.contextInfo?.participant;
        const mentionedJid = m.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        const target = (mentionedJid && mentionedJid[0]) || quotedParticipant;

        if (!target) return reply(box('KICKADMIN', ['❌ Reply to or mention the admin.']));

        await conn.groupParticipantsUpdate(from, [target], 'demote');
        await conn.groupParticipantsUpdate(from, [target], 'remove');
        return reply(box('KICKADMIN', [`✅ @${target.split('@')[0]} removed.`]));
    } catch (error) {
        console.error('KICKADMIN ERROR:', error);
        reply('❌ Error.');
    }
});

cmd({
    pattern: 'unlock',
    desc: 'Unlock group (everyone can send messages)',
    category: 'group',
    react: '🔓',
    filename: __filename
}, async (conn, m, commands, { from, isGroup, isAdmins, isOwner, reply }) => {
    try {
        if (!isGroup) return reply(box('UNLOCK', ['❌ Groups only.']));
        if (!isAdmins && !isOwner) return reply(box('UNLOCK', ['❌ Admin only.']));
        if (!(await isBotGroupAdmin(conn, from))) return reply(box('UNLOCK', ['❌ Bot must be admin.']));

        await conn.groupSettingUpdate(from, 'not_announcement');
        return reply(box('UNLOCK', ['🔓 Group unlocked.']));
    } catch (error) {
        console.error('UNLOCK ERROR:', error);
        reply('❌ Error.');
    }
});

cmd({
    pattern: 'block',
    desc: 'Block a user',
    category: 'owner',
    react: '🚫',
    use: '.block <number> or reply',
    filename: __filename
}, async (conn, m, commands, { from, args, isOwner, reply }) => {
    try {
        if (!isOwner) return reply(box('BLOCK', ['❌ Owner only.']));

        const quotedParticipant = m.message?.extendedTextMessage?.contextInfo?.participant;
        const mentionedJid = m.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        const target = (mentionedJid && mentionedJid[0]) || quotedParticipant ||
            (args[0] ? `${args[0].replace(/[^0-9]/g, '')}@s.whatsapp.net` : null);

        if (!target) return reply(box('BLOCK', ['❌ Usage: .block <number>']));

        await conn.updateBlockStatus(target, 'block');
        return reply(box('BLOCK', [`🚫 @${target.split('@')[0]} blocked.`]));
    } catch (error) {
        console.error('BLOCK ERROR:', error);
        reply('❌ Error.');
    }
});

cmd({
    pattern: 'unblock',
    desc: 'Unblock a user',
    category: 'owner',
    react: '✅',
    use: '.unblock <number>',
    filename: __filename
}, async (conn, m, commands, { from, args, isOwner, reply }) => {
    try {
        if (!isOwner) return reply(box('UNBLOCK', ['❌ Owner only.']));

        const target = (args[0] ? `${args[0].replace(/[^0-9]/g, '')}@s.whatsapp.net` : null);
        if (!target) return reply(box('UNBLOCK', ['❌ Usage: .unblock <number>']));

        await conn.updateBlockStatus(target, 'unblock');
        return reply(box('UNBLOCK', [`✅ @${target.split('@')[0]} unblocked.`]));
    } catch (error) {
        console.error('UNBLOCK ERROR:', error);
        reply('❌ Error.');
    }
});

cmd({
    pattern: 'left',
    alias: ['leave', 'leavegroup'],
    desc: 'Make the bot leave the group',
    category: 'group',
    react: '🚪',
    filename: __filename
}, async (conn, m, commands, { from, isGroup, isOwner, reply }) => {
    try {
        if (!isGroup) return reply(box('LEFT', ['❌ Groups only.']));
        if (!isOwner) return reply(box('LEFT', ['❌ Owner only.']));

        await reply(box('LEFT', ['👋 Bot is leaving the group...']));
        await conn.groupLeave(from);
    } catch (error) {
        console.error('LEFT ERROR:', error);
        reply('❌ Error.');
    }
});

cmd({
    pattern: 'vcf',
    alias: ['exportcontacts'],
    desc: 'Export all group members as .vcf contact file',
    category: 'group',
    react: '📇',
    filename: __filename
}, async (conn, m, commands, { from, isGroup, isAdmins, isOwner, reply }) => {
    try {
        if (!isGroup) return reply(box('VCF', ['❌ Groups only.']));
        if (!isAdmins && !isOwner) return reply(box('VCF', ['❌ Admin only.']));

        const metadata = await conn.groupMetadata(from);
        const participants = metadata.participants;

        let vcfContent = '';
        participants.forEach((p, i) => {
            const number = p.id.split('@')[0];
            vcfContent += `BEGIN:VCARD\nVERSION:3.0\nFN:Member ${i + 1}\nTEL;type=CELL;waid=${number}:${number}\nEND:VCARD\n`;
        });

        const buffer = Buffer.from(vcfContent, 'utf-8');

        await conn.sendMessage(from, {
            document: buffer,
            mimetype: 'text/x-vcard',
            fileName: `${metadata.subject || 'group'}-contacts.vcf`,
            caption: `📇 ${participants.length} contact(s) exported.`
        }, { quoted: m });
    } catch (error) {
        console.error('VCF ERROR:', error);
        reply('❌ Error.');
    }
});

cmd({
    pattern: 'demoteall',
    desc: 'Demote all group admins (owner only)',
    category: 'group',
    filename: __filename
}, async (conn, m, commands, { from, isGroup, isOwner, sender, reply }) => {
    try {
        if (!isGroup) return reply('❌ Groups only.');
        if (!isOwner) return reply('❌ Owner only.');

        const groupData = await conn.groupMetadata(from);
        const botId = conn.user.id.split(':')[0] + '@s.whatsapp.net';

        const admins = groupData.participants
            .filter(p => p.admin !== null)
            .map(p => p.id)
            .filter(id => id !== botId && id !== sender);

        if (admins.length === 0) return reply('❌ No admins to demote.');

        await conn.groupParticipantsUpdate(from, admins, 'demote');
        return reply('✅ All admins demoted.');
    } catch (error) {
        console.error('DEMOTEALL ERROR:', error);
        return reply('❌ Error: ' + error.message);
    }
});

cmd({
    pattern: 'requestlist',
    desc: 'Show pending group join requests',
    category: 'group',
    react: '📋',
    filename: __filename
}, async (conn, m, commands, { from, isGroup, isAdmins, isBotAdmins, reply }) => {
    try {
        if (!isGroup) return reply('❌ Groups only.');
        if (!isAdmins) return reply('❌ Admin only.');
        if (!isBotAdmins) return reply('❌ Bot must be admin.');

        const requests = await conn.groupRequestParticipantsList(from);
        if (requests.length === 0) return reply(box('PENDING REQUESTS', ['No pending join requests.']))

        let lines = requests.map((user, i) => `${i + 1}. @${user.jid.split('@')[0]}`);
        let text = box(`PENDING REQUESTS (${requests.length})`, lines);
        return reply(text, { mentions: requests.map(u => u.jid) });
    } catch (error) {
        console.error('REQUESTLIST ERROR:', error);
        return reply('❌ Error.');
    }
});

// ═══════════════════════════════════════════════════════
// GINFO — Group Information
// ═══════════════════════════════════════════════════════
cmd({
    pattern: "ginfo",
    desc: "Display group information",
    category: "group",
    react: "ℹ️",
    filename: __filename,
}, async (conn, m, commands, { from, isGroup, isAdmins, isOwner, isBotAdmins, reply }) => {
    try {
        if (!isGroup) return reply('❌ Groups only.');
        if (!isAdmins && !isOwner) return reply('❌ Admin/Owner only.');

        const groupMetadata = await conn.groupMetadata(from);
        const groupName = groupMetadata.subject;
        const memberCount = groupMetadata.participants.length;
        let creator = groupMetadata.owner ? `@${groupMetadata.owner.split('@')[0]}` : 'UNKNOWN';

        const groupAdmins = groupMetadata.participants
            .filter(member => member.admin)
            .map((admin, index) => `${index + 1}. @${admin.id.split('@')[0]}`)
            .join("\n") || "NO ADMIN FOUND";

        const creationDate = groupMetadata.creation
            ? new Date(groupMetadata.creation * 1000).toLocaleString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            })
            : 'UNKNOWN';

        const message = box('GROUP INFO', [
            `NAME: ${groupName}`,
            `ID: ${from}`,
            `TOTAL MEMBERS: ${memberCount}`,
            `CREATOR: ${creator}`,
            `CREATED: ${creationDate}`,
            `ADMINS:\n${groupAdmins}`
        ]);

        await conn.sendMessage(from, {
            text: message,
            mentions: groupMetadata.participants.filter(p => p.admin).map(a => a.id)
        }, { quoted: m });
    } catch (error) {
        console.error("GINFO ERROR:", error);
        reply('❌ Error retrieving group info.');
    }
});

// ═══════════════════════════════════════════════════════
// KICKALL — Remove all non-admins continuously
// ═══════════════════════════════════════════════════════
const stopFlags = new Map();

cmd({
    pattern: "kickall",
    desc: "Continuously remove all non-admins until stopped",
    react: "🧨",
    category: "group",
    filename: __filename,
}, async (conn, m, commands, { from, isGroup, isOwner, isAdmins, isBotAdmins, reply }) => {
    try {
        if (!isGroup) return reply('❌ Groups only.');
        if (!isAdmins && !isOwner) return reply('❌ Admin/Owner only.');
        if (!isBotAdmins) return reply('❌ Bot must be admin.');

        stopFlags.set(from, false);
        reply(box('KICKALL', ['Bot will continuously remove non-admins. Use .stop to stop.']))

        while (true) {
            const metadata = await conn.groupMetadata(from);
            const botJid = conn.user.id.split(':')[0] + '@s.whatsapp.net';
            const participants = metadata.participants;
            const groupAdmins = participants.filter(p => p.admin).map(p => p.id);
            const nonAdmins = participants.filter(mem => !groupAdmins.includes(mem.id) && mem.id !== botJid);

            if (nonAdmins.length === 0) {
                reply(box('KICKALL', ['No more non-admins to remove.']));
                break;
            }

            for (const participant of nonAdmins) {
                if (stopFlags.get(from)) {
                    reply(box('KICKALL', ['Operation stopped by user.']));
                    stopFlags.delete(from);
                    return;
                }
                await conn.groupParticipantsUpdate(from, [participant.id], "remove").catch(() => {});
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        stopFlags.delete(from);
    } catch (e) {
        console.error('KICKALL ERROR:', e);
        reply('❌ Error during kickall.');
    }
});

cmd({
    pattern: "stop",
    desc: "Stop the ongoing kickall",
    react: "⏹️",
    category: "group",
    filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
    stopFlags.set(from, true);
    reply(box('STOP', ['Operation stopped.']));
});

// ═══════════════════════════════════════════════════════
// KICKALL2 — Remove all non-admins (one-shot)
// ═══════════════════════════════════════════════════════
cmd({
    pattern: "kickall2",
    desc: "Remove all non-admin members at once",
    react: "⚠️",
    category: "group",
    filename: __filename
}, async (conn, m, commands, { from, isGroup, isAdmins, isBotAdmins, reply }) => {
    try {
        if (!isGroup) return reply('❌ Groups only.');
        if (!isAdmins) return reply('❌ Admin only.');
        if (!isBotAdmins) return reply('❌ Bot must be admin.');

        const metadata = await conn.groupMetadata(from);
        const participants = metadata.participants;
        const admins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id);
        const botJid = conn.user.id.includes(':') ? conn.user.id.split(':')[0] + "@s.whatsapp.net" : conn.user.id;
        const toKick = participants.map(p => p.id).filter(id => !admins.includes(id) && id !== botJid);

        await reply(box('KICKALL2', [`Removing ${toKick.length} members...`]));

        for (let user of toKick) {
            await conn.groupParticipantsUpdate(from, [user], "remove").catch(() => {});
        }

        await reply(box('KICKALL2', ['Removal completed!']));
    } catch (err) {
        console.error("KICKALL2 ERROR:", err);
        reply('❌ Failed to remove members.');
    }
});

// ═══════════════════════════════════════════════════════
// TAGALL2 — Tag all members
// ═══════════════════════════════════════════════════════
cmd({
    pattern: "tagall2",
    desc: "Tag all members",
    react: "🔊",
    category: "group",
    filename: __filename
}, async (conn, m, commands, { from, participants, reply, isGroup, body, command }) => {
    try {
        if (!isGroup) return reply('❌ Groups only.');

        let message = body.slice(body.indexOf(command) + command.length).trim();
        if (!message) message = "ATTENTION EVERYONE!";

        let lines = participants.map((member, i) => `> *│${i + 1}. @${member.id.split('@')[0]}*`);
        let text = box('TAG ALL', [`MESSAGE: ${message}`, ...lines, `> *TOTAL: ${participants.length} MEMBERS*`]);

        await conn.sendMessage(from, {
            text: text,
            mentions: participants.map(p => p.id)
        }, { quoted: m });
    } catch (err) {
        console.error("TAGALL2 ERROR:", err);
        reply('❌ Error tagging members.');
    }
});

// ═══════════════════════════════════════════════════════
// ADMINCHECK — Check admin status
// ═══════════════════════════════════════════════════════
cmd({
    pattern: "admincheck",
    desc: "Check admin status",
    react: "🔍",
    category: "group",
    filename: __filename
}, async (conn, m, commands, { from, isGroup, reply, sender, isOwner }) => {
    try {
        if (!isGroup) return reply('❌ Groups only.');

        let lines = [
            `YOU: @${sender.split('@')[0]}`,
            `BOT OWNER: ${isOwner ? '✅ YES' : '❌ NO'}`
        ];

        try {
            const groupMetadata = await conn.groupMetadata(from);
            const botNumber = conn.user.id.split(':')[0].split('@')[0];
            const botParticipant = groupMetadata.participants.find(p => p.id.split('@')[0] === botNumber);
            const isBotAdmin = botParticipant ? botParticipant.admin : false;

            lines.push(`BOT ADMIN: ${isBotAdmin ? '✅ YES' : '❌ NO'}`);
            lines.push(`TOTAL MEMBERS: ${groupMetadata.participants.length}`);
        } catch (e) {
            lines.push('UNABLE TO RETRIEVE GROUP INFO.');
        }

        await conn.sendMessage(from, {
            text: box('ADMIN CHECK', lines),
            mentions: [sender]
        }, { quoted: m });
    } catch (err) {
        console.error("ADMINCHECK ERROR:", err);
        reply('❌ Error checking admin status.');
    }
});

// ═══════════════════════════════════════════════════════
// END — Remove all members except specified numbers
// ═══════════════════════════════════════════════════════
cmd({
    pattern: "end",
    desc: "Remove all members from the group except owner/bot",
    react: "⚠️",
    category: "group",
    filename: __filename
}, async (conn, m, commands, { from, isGroup, isBotAdmins, reply, isOwner }) => {
    if (!isGroup) return reply('❌ Groups only.');
    if (!isOwner) return reply('❌ Owner only.');
    if (!isBotAdmins) return reply('❌ Bot must be admin.');

    try {
        const botJid = conn.user.id.split(':')[0] + '@s.whatsapp.net';
        const metadata = await conn.groupMetadata(from);
        const participants = metadata.participants || [];
        const targets = participants.filter(p => p.id !== botJid && p.id !== m.sender);
        const jids = targets.map(p => p.id);

        if (jids.length === 0) return reply(box('END', ['No members to remove.']));

        await conn.groupParticipantsUpdate(from, jids, "remove");
        reply(box('END', [`${jids.length} members removed.`]));
    } catch (error) {
        console.error("END ERROR:", error);
        reply('❌ Error removing members.');
    }
});
