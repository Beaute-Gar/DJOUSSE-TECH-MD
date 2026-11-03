// @legacy-order {"sourceFile":"03-protection/group3.js","sourceOrder":104,"definitionIndex":0,"entryOrder":274}
'use strict';

const style = require('../../config/style');

module.exports = {
    commands: ['getgcpp'],
    description: 'Show the group profile picture',
    permission: 'admin',
    group: true,
    private: false,

    run: async (sock, message, args, ctx) => {
        const { jid, contextInfo } = ctx;
        try {
            const pictureUrl = await sock.profilePictureUrl(jid, 'image');
            await sock.sendMessage(jid, {
                image: { url: pictureUrl },
                caption: style.renderInfo(['🖼️ Group Profile Picture']),
                contextInfo,
            }, { quoted: message });
        } catch {
            await sock.sendMessage(jid, {
                text: style.renderError(['Could not fetch group photo.']),
                contextInfo,
            }, { quoted: message });
        }
    },
};
