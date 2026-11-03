// @legacy-order {"sourceFile":"05-outils/info-lookup.js","sourceOrder":119,"definitionIndex":7,"entryOrder":337}
'use strict';

const style = require('../../config/style');

const phones = {
  apple: { name: 'Apple iPhone', country: 'USA', first: '2007', os: 'iOS', latest: 'iPhone 15 Pro Max' },
  samsung: { name: 'Samsung Galaxy', country: 'South Korea', first: '2009', os: 'Android', latest: 'Galaxy S24 Ultra' },
  google: { name: 'Google Pixel', country: 'USA', first: '2016', os: 'Android', latest: 'Pixel 8 Pro' },
  huawei: { name: 'Huawei', country: 'China', first: '2004', os: 'HarmonyOS/Android', latest: 'Mate 60 Pro' },
  xiaomi: { name: 'Xiaomi', country: 'China', first: '2011', os: 'Android (MIUI)', latest: '14 Ultra' },
  oneplus: { name: 'OnePlus', country: 'China', first: '2014', os: 'Android (OxygenOS)', latest: '12' },
};

module.exports = {
  commands: ['phone2', 'phoneinfo'],
  description: 'Phone brand info',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const query = (args[0] || '').toLowerCase();
    const phone = phones[query];
    if (!phone) {
      return ctx.reply(style.renderError([
        'Usage: .phone2 <brand>',
        `Brands: ${Object.keys(phones).join(', ')}`,
      ]));
    }

    return ctx.reply(style.renderInfo([
      `📱 ${phone.name}`,
      `Country: ${phone.country}`,
      `First Phone: ${phone.first}`,
      `OS: ${phone.os}`,
      `Latest: ${phone.latest}`,
    ]));
  },
};
