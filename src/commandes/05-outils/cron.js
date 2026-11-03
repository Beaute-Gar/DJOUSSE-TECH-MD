// @legacy-order {"sourceFile":"05-outils/dev-tools.js","sourceOrder":73,"definitionIndex":13,"entryOrder":145}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['cron', 'cronhelp'],
  description: 'Cron expression helper',
  permission: 'public',
  run: async (_sock, _message, _args, ctx) => ctx.reply(style.renderInfo([
    'Cron Expression Guide',
    '',
    '`* * * * *`',
    '│ │ │ │ │',
    '│ │ │ │ └─ Day of Week (0-7)',
    '│ │ │ └── Month (1-12)',
    '│ │ └─── Day of Month (1-31)',
    '│ └──── Hour (0-23)',
    '└───── Minute (0-59)',
    '',
    'Examples:',
    '`0 */2 * * *` = Every 2 hours',
    '`0 9 * * 1-5` = 9 AM weekdays',
    '`*/5 * * * *` = Every 5 minutes',
    '`0 0 * * 0` = Midnight Sunday',
  ])),
};
