'use strict';

const style = require('../../config/style');

module.exports = {
    // @legacy-order {"sourceFile":"03-protection/group3.js","sourceOrder":104,"definitionIndex":0,"entryOrder":275}
    commands: ['getlid'],
    description: 'Extended group management commands',
    permission: 'admin',
    group: true,
    private: false,

    run: async (sock, message, args, ctx) => {
        const { jid, contextInfo, groupMetadata, mentionedJid } = ctx;
        const target = mentionedJid?.[0]
            || message.message?.extendedTextMessage?.contextInfo?.participant;
        const reply = (text, mentions = []) => sock.sendMessage(jid, {
            text: style.renderInfo(text.split('\n')),
            contextInfo,
            ...(mentions.length ? { mentions } : {}),
        }, { quoted: message });

        if (!target) return reply('❌ Reply to or mention a user.\n\n*Usage:* `.getlid @user`');

        const participants = groupMetadata?.participants || [];
        const participant = participants.find((entry) => entry.id === target || entry.lid === target);
        return reply(
            `🆔 *LID Info*\n\n👤 Phone: @${target.split('@')[0]}\n🔖 LID: ${participant?.lid || 'N/A'}`,
            [target],
        );
    },
};
