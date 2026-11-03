'use strict';

const config = require('../_partage/config');
const style = require('../../config/style');

if (typeof global.antivvEnabled === 'undefined') {
    global.antivvEnabled = config.ANTIVV !== false;
}

module.exports = {
    // @legacy-order {"sourceFile":"03-protection/antivv.js","sourceOrder":23,"definitionIndex":0,"entryOrder":81}
    commands: ['antivv', 'avv'],
    description: 'Toggle automatic view-once reveal on/off',
    permission: 'owner',
    group: true,
    private: true,

    run: async (sock, message, args, ctx) => {
        const { contextInfo } = ctx;
        const jid = message.key.remoteJid;
        const sub = (args[0] || '').toLowerCase();

        if (sub === 'on') {
            global.antivvEnabled = true;
        } else if (sub === 'off') {
            global.antivvEnabled = false;
        } else {
            global.antivvEnabled = !global.antivvEnabled;
        }

        const state = global.antivvEnabled;
        const icon = state ? '✅' : '❌';
        const label = state ? 'ENABLED' : 'DISABLED';
        const lines = [
            `${icon} *Anti-ViewOnce ${label}*`,
            '',
            state
                ? '👁️ All view-once messages will be automatically revealed and forwarded to the owner.'
                : '🙈 Automatic view-once reveal is now off.',
        ];

        await sock.sendMessage(jid, { react: { text: state ? '👁️' : '🙈', key: message.key } });
        await sock.sendMessage(jid, {
            text: style.renderInfo(lines),
            contextInfo,
        }, { quoted: message });
    },
};
