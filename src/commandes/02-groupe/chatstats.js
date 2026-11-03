// @legacy-order {"sourceFile":"02-groupe/advanced-features.js","sourceOrder":4,"definitionIndex":22,"entryOrder":21}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['chatstats', 'whotalks'],
  description: 'Show who talks most in this group',
  permission: 'public',
  group: true,
  private: false,
  run: async (sock, message, args, ctx) => {
    const groupMessages = global.groupMsgMap?.get(ctx.jid);
    if (!groupMessages?.size) {
      return ctx.reply(style.renderInfo([
        'Not enough data yet. Chat a bit more and try again!',
      ]));
    }

    const sorted = [...groupMessages.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    const total = [...groupMessages.values()].reduce((sum, count) => sum + count, 0);
    const lines = sorted.map(([phone, count], index) => {
      const percent = total ? Math.round(count / total * 100) : 0;
      const filled = Math.round(percent / 10);
      const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
      return `${index + 1}. +${phone}\n   ${bar} ${count} msgs (${percent}%)`;
    });

    return ctx.reply(style.renderInfo([
      'Top Talkers',
      '',
      ...lines.flatMap((line, index) => index < lines.length - 1 ? [line, ''] : [line]),
      '',
      `Total messages tracked: ${total}`,
    ]));
  },
};
