'use strict';

const style = require('../../config/style');
const { isEnabled, listTriggers } = require('../_partage/bgmTrigger');

module.exports = {
    commands: ['listbgm'],
    description: 'List word-triggered audio autoresponder triggers',
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
        if (!list.length) {
            return reply(style.renderInfo([
                'No BGM triggers set yet.',
                'Use `.setbgm <word>` while replying to an audio.',
            ]));
        }

        return reply(style.renderInfo([
            `BGM Trigger Words (${list.length})`,
            ...list.map((word, index) => `${index + 1}. \`${word}\``),
            'Anyone who says one of these words will get an auto audio reply.',
        ]));
    },
};
