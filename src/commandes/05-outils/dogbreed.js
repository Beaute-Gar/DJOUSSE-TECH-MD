// @legacy-order {"sourceFile":"05-outils/info-lookup.js","sourceOrder":119,"definitionIndex":0,"entryOrder":330}
'use strict';

const style = require('../../config/style');

const breeds = {
  labrador: { origin: 'Canada', size: 'Large', life: '10-12 years', temperament: 'Friendly, Active, Outgoing' },
  germanshepherd: { origin: 'Germany', size: 'Large', life: '9-13 years', temperament: 'Intelligent, Loyal, Confident' },
  goldenretriever: { origin: 'Scotland', size: 'Large', life: '10-12 years', temperament: 'Intelligent, Friendly, Reliable' },
  bulldog: { origin: 'England', size: 'Medium', life: '8-10 years', temperament: 'Docile, Willful, Friendly' },
  poodle: { origin: 'France/Germany', size: 'Varies', life: '12-15 years', temperament: 'Intelligent, Active, Alert' },
  beagle: { origin: 'England', size: 'Small-Medium', life: '12-15 years', temperament: 'Gentle, Friendly, Curious' },
  rottweiler: { origin: 'Germany', size: 'Large', life: '8-10 years', temperament: 'Good-natured, Devoted, Alert' },
  husky: { origin: 'Siberia', size: 'Medium-Large', life: '12-15 years', temperament: 'Outgoing, Gentle, Friendly' },
  chihuahua: { origin: 'Mexico', size: 'Small', life: '12-20 years', temperament: 'Devoted, Lively, Alert' },
  dalmatian: { origin: 'Croatia', size: 'Large', life: '10-13 years', temperament: 'Outgoing, Energetic, Playful' },
};

module.exports = {
  commands: ['dogbreed', 'dog'],
  description: 'Dog breed info',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const query = args.join('').toLowerCase().replace(/\s/g, '');
    const breed = breeds[query];
    if (!breed) {
      return ctx.reply(style.renderError([
        'Usage: .dog <breed>',
        `Breeds: ${Object.keys(breeds).join(', ')}`,
      ]));
    }

    const name = query.charAt(0).toUpperCase() + query.slice(1);
    return ctx.reply(style.renderInfo([
      `🐕 ${name}`,
      `Origin: ${breed.origin}`,
      `Size: ${breed.size}`,
      `Lifespan: ${breed.life}`,
      `Temperament: ${breed.temperament}`,
    ]));
  },
};
