// @legacy-order {"sourceFile":"05-outils/info-lookup.js","sourceOrder":119,"definitionIndex":2,"entryOrder":332}
'use strict';

const style = require('../../config/style');

const heroes = {
  batman: { name: 'Batman', real: 'Bruce Wayne', publisher: 'DC Comics', powers: 'Martial arts, Detective skills, Technology', first: '1939' },
  superman: { name: 'Superman', real: 'Clark Kent / Kal-El', publisher: 'DC Comics', powers: 'Super strength, Flight, Heat vision, Invulnerability', first: '1938' },
  spiderman: { name: 'Spider-Man', real: 'Peter Parker', publisher: 'Marvel', powers: 'Wall-crawling, Spider-sense, Super strength, Web-shooting', first: '1962' },
  ironman: { name: 'Iron Man', real: 'Tony Stark', publisher: 'Marvel', powers: 'Genius intellect, Powered armor, Flight, Repulsor beams', first: '1963' },
  wonderwoman: { name: 'Wonder Woman', real: 'Diana Prince', publisher: 'DC Comics', powers: 'Super strength, Flight, Combat skill, Lasso of Truth', first: '1941' },
  thor: { name: 'Thor', real: 'Thor Odinson', publisher: 'Marvel', powers: 'God of Thunder, Mjolnir, Super strength, Lightning', first: '1962' },
  hulk: { name: 'Hulk', real: 'Bruce Banner', publisher: 'Marvel', powers: 'Incredible strength, Regeneration, Near-invulnerability', first: '1962' },
  flash: { name: 'The Flash', real: 'Barry Allen', publisher: 'DC Comics', powers: 'Super speed, Time travel, Speed Force', first: '1956' },
};

module.exports = {
  commands: ['superhero', 'hero'],
  description: 'Superhero info',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const query = args.join('').toLowerCase().replace(/[\s-]/g, '');
    const hero = heroes[query];
    if (!hero) {
      return ctx.reply(style.renderError([
        'Usage: .hero <name>',
        `Heroes: ${Object.keys(heroes).join(', ')}`,
      ]));
    }

    return ctx.reply(style.renderInfo([
      `🦸 ${hero.name}`,
      `Real Name: ${hero.real}`,
      `Publisher: ${hero.publisher}`,
      `Powers: ${hero.powers}`,
      `First Appearance: ${hero.first}`,
    ]));
  },
};
