// @legacy-order {"sourceFile":"05-outils/logo2.js","sourceOrder":136,"definitionIndex":0,"entryOrder":377}
'use strict';

const style = require('../../config/style');
const effects = require('./_text-effects');

const COMMAND = 'makingneon';

module.exports = {
  commands: [COMMAND],
  description: 'Logo maker and text effect generator',
  permission: 'public',
  group: true,
  run: async (_sock, _message, args, ctx) => {
    const text = args.join(' ').trim();
    if (!text) {
      return ctx.reply(style.renderError([
        `Usage: .${COMMAND} <your text>`,
        `Example: .${COMMAND} DJOUSSE TECH`,
        'Use .logolist to see all styles',
      ]));
    }

    const { info, icon, text: styled } = effects.effect(COMMAND, text);
    return ctx.reply(style.renderInfo([
      `${icon} ${COMMAND.toUpperCase()} Style`,
      '',
      styled,
      '',
      `Text: ${text}`,
      `Color: ${info.color}  BG: ${info.bg}`,
    ]));
  },
};
