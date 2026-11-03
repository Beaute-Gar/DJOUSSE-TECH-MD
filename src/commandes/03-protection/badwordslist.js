// @legacy-order {"sourceFile":"03-protection/antibadwords.js","sourceOrder":17,"definitionIndex":3,"entryOrder":72}
'use strict';

const style = require('../../config/style');
const legacyCommands = require('./_legacy-antibadwords');

module.exports = {
    commands: ['badwordslist', 'badwords'],
    description: 'Show all banned words in this group',
    permission: 'admin',
    group: true,
    private: false,

    run: async (sock, message, args, ctx) => {
        const custom = legacyCommands.getCustomWords(ctx.jid);
        const lines = [
            '🤬 Banned Words',
            '',
            '*Built-in words:* [hidden for privacy]',
            '',
            `Custom (${custom.length}):`,
            custom.length ? custom.map((word, index) => `${index + 1}. ${word}`).join('\n') : '_(none added)_',
        ];
        return ctx.reply(style.renderInfo(lines));
    },
};
