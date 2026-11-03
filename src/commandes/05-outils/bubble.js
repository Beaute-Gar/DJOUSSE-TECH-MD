// @legacy-order {"sourceFile":"05-outils/text-tools.js","sourceOrder":236,"definitionIndex":11,"entryOrder":654}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['bubble', 'circled'],
  description: 'Bubble text',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .bubble <text>']));
    }

    const regular = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const circled = [...'ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ⓪①②③④⑤⑥⑦⑧⑨'];
    const result = text.split('').map(character => {
      const index = regular.indexOf(character);
      return index >= 0 ? circled[index] : character;
    }).join('');
    return ctx.reply(style.renderInfo([result]));
  },
};
