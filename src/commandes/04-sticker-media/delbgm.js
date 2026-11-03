'use strict';

const style = require('../../config/style');
const { isEnabled, delTrigger } = require('../_partage/bgmTrigger');

module.exports = {
    commands: ['delbgm'],
    description: 'Remove a word-triggered audio autoresponder trigger',
    permission: 'owner',
    group: true,
    private: true,

    run: async (_sock, _message, args, { reply }) => {
        if (!isEnabled()) {
            return reply(style.renderInfo([
                'Les déclencheurs audio automatiques sont désactivés pour protéger le compte WhatsApp.',
            ]));
        }

        const word = args[0]?.toLowerCase().trim();
        if (!word) return reply(style.renderError(['Usage: `.delbgm <word>`']));

        const removed = delTrigger(word);
        return reply(removed
            ? style.renderSuccess([`Removed trigger: \`${word}\``])
            : style.renderInfo([`No trigger found for: \`${word}\``])
        );
    },
};
