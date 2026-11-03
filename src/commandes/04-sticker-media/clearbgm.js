'use strict';

const style = require('../../config/style');
const { isEnabled, listTriggers, delTrigger } = require('../_partage/bgmTrigger');

module.exports = {
    commands: ['clearbgm'],
    description: 'Clear word-triggered audio autoresponder triggers',
    permission: 'owner',
    group: true,
    private: true,

    run: async (_sock, _message, _args, { reply }) => {
        if (!isEnabled()) {
            return reply(style.renderInfo([
                'Les déclencheurs audio automatiques sont désactivés pour protéger le compte WhatsApp.',
            ]));
        }

        const list = listTriggers();
        if (!list.length) return reply(style.renderInfo(['No triggers to clear.']));

        list.forEach(delTrigger);
        return reply(style.renderSuccess([`Cleared all ${list.length} BGM trigger(s).`]));
    },
};
