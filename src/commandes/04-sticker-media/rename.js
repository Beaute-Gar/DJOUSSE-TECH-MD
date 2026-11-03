'use strict';

const style = require('../../config/style');

module.exports = {
    commands: ['rename'],
    description: 'Show file renaming guidance',
    permission: 'public',
    group: true,
    private: true,

    run: async (sock, message, args, ctx) => ctx.reply(style.renderOutgoingText(
        '🔧 *rename*\n\n_This feature requires desktop tools. Use your file manager or an online converter._'
    )),
};
