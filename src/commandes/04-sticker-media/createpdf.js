'use strict';

const style = require('../../config/style');

module.exports = {
    commands: ['createpdf'],
    description: 'Show PDF creation guidance',
    permission: 'public',
    group: true,
    private: true,

    run: async (sock, message, args, ctx) => ctx.reply(style.renderOutgoingText(
        '📄 *Create PDF*\n\nSend text and this bot will format it as a PDF.\n\n_Use `.fetch <url>` to get webpage content first, then share as document._'
    )),
};
