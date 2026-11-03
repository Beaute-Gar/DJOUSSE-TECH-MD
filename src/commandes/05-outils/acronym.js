// @legacy-order {"sourceFile":"05-outils/education.js","sourceOrder":81,"definitionIndex":6,"entryOrder":156}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['acronym', 'abbrev'],
  description: 'Common acronyms',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const acronyms = {
      lol: 'Laughing Out Loud',
      brb: 'Be Right Back',
      afk: 'Away From Keyboard',
      imo: 'In My Opinion',
      tbh: 'To Be Honest',
      fyi: 'For Your Information',
      asap: 'As Soon As Possible',
      diy: 'Do It Yourself',
      faq: 'Frequently Asked Questions',
      eta: 'Estimated Time of Arrival',
      rsvp: "Répondez S'il Vous Plaît",
      aka: 'Also Known As',
      tba: 'To Be Announced',
      irl: 'In Real Life',
      smh: 'Shaking My Head',
      gg: 'Good Game',
      dm: 'Direct Message',
      ama: 'Ask Me Anything',
      tldr: "Too Long; Didn't Read",
      goat: 'Greatest Of All Time',
      nft: 'Non-Fungible Token',
      ai: 'Artificial Intelligence',
      api: 'Application Programming Interface',
      cpu: 'Central Processing Unit',
      gpu: 'Graphics Processing Unit',
      url: 'Uniform Resource Locator',
      html: 'HyperText Markup Language',
      css: 'Cascading Style Sheets',
      sql: 'Structured Query Language',
      vpn: 'Virtual Private Network',
    };
    const query = (args[0] || '').toLowerCase();
    if (!query) {
      return ctx.reply(style.renderError([
        'Usage: .acronym <abbreviation>',
        'Example: .acronym lol',
      ]));
    }

    return ctx.reply(style.renderInfo([
      `📚 *${query.toUpperCase()}*\n\n${acronyms[query] || 'Unknown acronym'}`,
    ]));
  },
};
