'use strict';

const style = require('../../config/style');

module.exports = {
    // @legacy-order {"sourceFile":"03-protection/group3.js","sourceOrder":104,"definitionIndex":0,"entryOrder":288}
    commands: ['setgroupevents'],
    description: 'Extended group management commands',
    permission: 'admin',
    group: true,
    private: false,

    run: async (sock, message, args, ctx) => {
        const { jid, contextInfo } = ctx;
        const sub = (args[0] || 'on').toLowerCase();
        if (!global.groupEventsDisabled) global.groupEventsDisabled = new Set();
        const text = sub === 'off'
            ? (global.groupEventsDisabled.add(jid), '📢 *Group Events OFF* — Join/leave messages will be suppressed.')
            : (global.groupEventsDisabled.delete(jid), '📢 *Group Events ON* — Join/leave messages will be sent.');

        await sock.sendMessage(jid, {
            text: style.renderInfo(text.split('\n')),
            contextInfo,
        }, { quoted: message });
    },
};
