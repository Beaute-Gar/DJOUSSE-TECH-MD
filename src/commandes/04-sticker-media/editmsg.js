'use strict';

const style = require('../../config/style');

if (!global.lastBotMsg) global.lastBotMsg = new Map();

module.exports = {
    commands: ['editmsg', 'correct'],
    description: 'Edit a previously sent bot message (reply to the bot\'s message)',
    usage: 'Reply to a bot message + .editmsg New text here',
    permission: 'admin',
    group: true,
    private: true,

    run: async (sock, message, args, ctx) => {
        const { jid, isAdmin, isOwner, reply } = ctx;
        if (!isAdmin && !isOwner) {
            return reply(style.renderError(['Only admins can edit bot messages.']));
        }

        const newText = args.join(' ').trim();
        if (!newText) {
            return reply(style.renderInfo([
                'Edit Bot Message',
                'Reply to any message the bot sent, then:',
                '`.editmsg The corrected text here`',
            ]));
        }

        const contextInfo = message.message?.extendedTextMessage?.contextInfo;
        const stanzaId = contextInfo?.stanzaId;
        const participant = contextInfo?.participant;
        const outgoingText = style.renderOutgoingText(newText);

        if (!stanzaId) {
            const lastKey = global.lastBotMsg?.get(jid);
            if (!lastKey) {
                return reply(style.renderError([
                    'Reply to a bot message to edit it, or send a message first.',
                ]));
            }

            try {
                await sock.sendMessage(jid, { text: outgoingText, edit: lastKey });
                return;
            } catch (err) {
                return reply(style.renderError([`Edit failed: ${err.message}`]));
            }
        }

        const editKey = {
            remoteJid: jid,
            fromMe: !participant,
            id: stanzaId,
            participant: participant || undefined,
        };

        try {
            await sock.sendMessage(jid, { text: outgoingText, edit: editKey });
        } catch (err) {
            return reply(style.renderError([
                'Could not edit — make sure you replied to a bot message.',
                err.message,
            ]));
        }
    },
};
