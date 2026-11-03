// @legacy-order {"sourceFile":"05-outils/utility-tools.js","sourceOrder":265,"definitionIndex":1,"entryOrder":723}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['calendar', 'cal'],
  description: 'Show calendar',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const now = new Date();
    const month = Number.parseInt(args[0], 10) || now.getMonth() + 1;
    const year = Number.parseInt(args[1], 10) || now.getFullYear();
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthName = new Date(year, month - 1).toLocaleString('en', { month: 'long' });
    let calendar = `📅 ${monthName} ${year}\n\nSu Mo Tu We Th Fr Sa\n`;
    calendar += '   '.repeat(firstDay);

    for (let day = 1; day <= daysInMonth; day += 1) {
      calendar += `${String(day).padStart(2, ' ')} `;
      if ((firstDay + day) % 7 === 0) calendar += '\n';
    }

    return ctx.reply(style.renderInfo([calendar]));
  },
};
