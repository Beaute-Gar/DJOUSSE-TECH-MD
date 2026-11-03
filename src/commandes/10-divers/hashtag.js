'use strict';
// @legacy-order {"sourceFile":"05-outils/utility-tools.js","sourceOrder":265,"definitionIndex":12,"entryOrder":734}

const style = require('../../config/style');

module.exports = {
  commands: ['hashtag', 'tags'],
  description: 'Generate hashtags',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const topic = args.join(' ');
    if (!topic) {
      return ctx.reply(style.renderError(['Usage: .hashtag <topic>']));
    }

    const words = topic.toLowerCase().split(/\s+/);
    const tags = words.map((word) => `#${word}`);
    const extras = words.flatMap((word) => [
      `#${word}life`, `#${word}vibes`, `#best${word}`, `#${word}lovers`, `#${word}daily`,
    ]);
    const all = [...new Set([...tags, ...extras])].slice(0, 30);
    return ctx.reply(style.renderInfo([
      '#️⃣ *Hashtag Generator*',
      '',
      `Topic: ${topic}`,
      '',
      all.join(' '),
    ]));
  },
};
