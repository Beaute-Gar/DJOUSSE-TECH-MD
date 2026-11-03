// @legacy-order {"sourceFile":"05-outils/education.js","sourceOrder":81,"definitionIndex":2,"entryOrder":152}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['planet', 'planetinfo'],
  description: 'Planet information',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const planets = {
      mercury: { name: 'Mercury', dist: '57.9M km', diameter: '4,879 km', day: '58.6 Earth days', year: '88 Earth days', moons: 0, temp: '167°C avg' },
      venus: { name: 'Venus', dist: '108.2M km', diameter: '12,104 km', day: '243 Earth days', year: '225 Earth days', moons: 0, temp: '464°C avg' },
      earth: { name: 'Earth', dist: '149.6M km', diameter: '12,756 km', day: '24 hours', year: '365.25 days', moons: 1, temp: '15°C avg' },
      mars: { name: 'Mars', dist: '227.9M km', diameter: '6,792 km', day: '24.6 hours', year: '687 Earth days', moons: 2, temp: '-65°C avg' },
      jupiter: { name: 'Jupiter', dist: '778.6M km', diameter: '142,984 km', day: '9.9 hours', year: '11.9 Earth years', moons: 95, temp: '-110°C avg' },
      saturn: { name: 'Saturn', dist: '1.4B km', diameter: '120,536 km', day: '10.7 hours', year: '29.5 Earth years', moons: 146, temp: '-140°C avg' },
      uranus: { name: 'Uranus', dist: '2.9B km', diameter: '51,118 km', day: '17.2 hours', year: '84 Earth years', moons: 28, temp: '-195°C avg' },
      neptune: { name: 'Neptune', dist: '4.5B km', diameter: '49,528 km', day: '16.1 hours', year: '165 Earth years', moons: 16, temp: '-200°C avg' },
    };
    const query = (args[0] || '').toLowerCase();
    const planet = planets[query];
    if (!planet) {
      return ctx.reply(style.renderError([
        'Usage: .planet <name>',
        'Planets: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune',
      ]));
    }

    return ctx.reply(style.renderInfo([
      `🪐 *${planet.name}*\n\nDistance from Sun: ${planet.dist}\nDiameter: ${planet.diameter}\nDay Length: ${planet.day}\nYear Length: ${planet.year}\nMoons: ${planet.moons}\nTemp: ${planet.temp}`,
    ]));
  },
};
