'use strict';

const style = require('../../config/style');

module.exports = {
    // @legacy-order {"sourceFile":"03-protection/group3.js","sourceOrder":104,"definitionIndex":0,"entryOrder":290}
    commands: ['goodbyemessage'],
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
        const status = settings.goodbye ? '✅ ON' : '❌ OFF';
        const customMessage = settings.customGoodbye || '(default)';
        return send(`👋 *Goodbye Message*\n\nStatus: *${status}*\nMessage: ${customMessage}\n\nEdit with \`.setgoodbye <message>\``);
    },
};
