'use strict';

const style = require('../../config/style');

module.exports = {
    // @legacy-order {"sourceFile":"03-protection/group3.js","sourceOrder":104,"definitionIndex":0,"entryOrder":289}
    commands: ['welcomemessage'],
    description: 'Extended group management commands',
    permission: 'admin',
    group: true,
    private: false,

    run: async (sock, message, args, ctx) => {
        const { jid, contextInfo } = ctx;
        const send = (text, renderer = style.renderInfo) => sock.sendMessage(jid, {
            text: renderer(text.split('\n')),
            contextInfo,
        }, { quoted: message });
        if (!global.welcomeSettings) return send('❌ Welcome plugin not loaded.', style.renderError);

        const settings = global.welcomeSettings.get(jid) || {};
        const status = settings.welcome ? '✅ ON' : '❌ OFF';
        const customMessage = settings.customWelcome || '(default)';
        return send(`👋 *Welcome Message*\n\nStatus: *${status}*\nMessage: ${customMessage}\n\nEdit with \`.setwelcome <message>\``);
    },
};
