// @legacy-order {"sourceFile":"05-outils/education.js","sourceOrder":81,"definitionIndex":10,"entryOrder":160}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['flag', 'countryflag'],
  description: 'Country flag emoji',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const flags = {
      kenya: '🇰🇪', usa: '🇺🇸', uk: '🇬🇧', china: '🇨🇳', japan: '🇯🇵',
      brazil: '🇧🇷', india: '🇮🇳', nigeria: '🇳🇬', southafrica: '🇿🇦',
      tanzania: '🇹🇿', uganda: '🇺🇬', ethiopia: '🇪🇹', egypt: '🇪🇬',
      germany: '🇩🇪', france: '🇫🇷', australia: '🇦🇺', canada: '🇨🇦',
      russia: '🇷🇺', mexico: '🇲🇽', spain: '🇪🇸', italy: '🇮🇹',
      turkey: '🇹🇷', korea: '🇰🇷', argentina: '🇦🇷', ghana: '🇬🇭',
      cameroon: '🇨🇲', morocco: '🇲🇦', rwanda: '🇷🇼', zambia: '🇿🇲',
      zimbabwe: '🇿🇼',
    };
    const country = args.join('').toLowerCase();
    return ctx.reply(style.renderInfo([
      flags[country] || '🏳️ Unknown country. Try: kenya, usa, uk, japan, etc.',
    ]));
  },
};
