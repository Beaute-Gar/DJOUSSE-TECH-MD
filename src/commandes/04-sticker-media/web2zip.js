'use strict';

const style = require('../../config/style');

module.exports = {
    commands: ['web2zip'],
    description: 'Show website archiving guidance',
    permission: 'public',
    group: true,
    private: true,

    run: async (sock, message, args, ctx) => ctx.reply(style.renderOutgoingText(
        '🔧 *web2zip*\n\n_This feature requires desktop tools. Use your file manager or an online converter._'
    )),
};
