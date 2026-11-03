// @legacy-order {"sourceFile":"05-outils/education.js","sourceOrder":81,"definitionIndex":0,"entryOrder":151}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['element', 'chem'],
  description: 'Periodic table lookup',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const elements = {
      H: { name: 'Hydrogen', num: 1, mass: 1.008 },
      He: { name: 'Helium', num: 2, mass: 4.003 },
      Li: { name: 'Lithium', num: 3, mass: 6.941 },
      Be: { name: 'Beryllium', num: 4, mass: 9.012 },
      B: { name: 'Boron', num: 5, mass: 10.81 },
      C: { name: 'Carbon', num: 6, mass: 12.01 },
      N: { name: 'Nitrogen', num: 7, mass: 14.01 },
      O: { name: 'Oxygen', num: 8, mass: 16.00 },
      F: { name: 'Fluorine', num: 9, mass: 19.00 },
      Ne: { name: 'Neon', num: 10, mass: 20.18 },
      Na: { name: 'Sodium', num: 11, mass: 22.99 },
      Mg: { name: 'Magnesium', num: 12, mass: 24.31 },
      Al: { name: 'Aluminium', num: 13, mass: 26.98 },
      Si: { name: 'Silicon', num: 14, mass: 28.09 },
      P: { name: 'Phosphorus', num: 15, mass: 30.97 },
      S: { name: 'Sulfur', num: 16, mass: 32.07 },
      Cl: { name: 'Chlorine', num: 17, mass: 35.45 },
      Ar: { name: 'Argon', num: 18, mass: 39.95 },
      K: { name: 'Potassium', num: 19, mass: 39.10 },
      Ca: { name: 'Calcium', num: 20, mass: 40.08 },
      Fe: { name: 'Iron', num: 26, mass: 55.85 },
      Cu: { name: 'Copper', num: 29, mass: 63.55 },
      Zn: { name: 'Zinc', num: 30, mass: 65.38 },
      Ag: { name: 'Silver', num: 47, mass: 107.87 },
      Au: { name: 'Gold', num: 79, mass: 196.97 },
      Pt: { name: 'Platinum', num: 78, mass: 195.08 },
    };
    const query = args[0] || '';
    const symbol = query.charAt(0).toUpperCase() + query.slice(1).toLowerCase();
    const element = elements[symbol]
      || Object.values(elements).find(item => item.name.toLowerCase() === query.toLowerCase());
    if (!element) {
      return ctx.reply(style.renderError([
        'Usage: .element <symbol or name>',
        'Examples: .element Au, .element Gold',
      ]));
    }

    return ctx.reply(style.renderInfo([
      `⚗️ *${element.name}*\n\nSymbol: ${symbol}\nAtomic Number: ${element.num}\nAtomic Mass: ${element.mass}`,
    ]));
  },
};
