// @legacy-order {"sourceFile":"03-protection/group3.js","sourceOrder":104,"definitionIndex":0,"entryOrder":269}
'use strict';

const style = require('../../config/style');

module.exports = {
    commands: ['listrequests'],
    description: 'List pending group join requests',
    permission: 'admin',
    group: true,
    private: false,

    run: async (sock, message, args, ctx) => {
        const { jid, isAdmin, contextInfo } = ctx;
        const send = (text, renderer = style.renderInfo) => sock.sendMessage(jid, {
            text: renderer(text.split('\n')),
            contextInfo,
        }, { quoted: message });

        if (!isAdmin) {
            return send('⛔ Only admins can use this command.', style.renderError);
        }

        try {
            const requests = await sock.groupRequestParticipantsList(jid);
            if (!requests?.length) {
                return send('📋 *Join Requests*\n\nNo pending join requests.');
            }

            const list = requests.slice(0, 20)
                .map((request, index) => `*${index + 1}.* +${request.jid?.split('@')[0]}`)
                .join('\n');
            return send(
                `📋 *Join Requests (${requests.length})*\n\n${list}\n\nUse \`.accept all\` or \`.reject all\``
            );
        } catch {
            return send('❌ Failed to fetch join requests.', style.renderError);
        }
    },
};
