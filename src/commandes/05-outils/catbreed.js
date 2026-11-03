// @legacy-order {"sourceFile":"05-outils/info-lookup.js","sourceOrder":119,"definitionIndex":1,"entryOrder":331}
'use strict';

const style = require('../../config/style');

const breeds = {
  persian: { origin: 'Iran', size: 'Medium-Large', life: '12-17 years', temperament: 'Quiet, Affectionate, Gentle' },
  siamese: { origin: 'Thailand', size: 'Medium', life: '15-20 years', temperament: 'Social, Intelligent, Playful' },
  mainecoon: { origin: 'USA', size: 'Large', life: '12-15 years', temperament: 'Gentle, Intelligent, Independent' },
  bengal: { origin: 'USA', size: 'Medium-Large', life: '12-16 years', temperament: 'Energetic, Playful, Intelligent' },
  ragdoll: { origin: 'USA', size: 'Large', life: '15-20 years', temperament: 'Calm, Gentle, Affectionate' },
  sphynx: { origin: 'Canada', size: 'Medium', life: '12-14 years', temperament: 'Energetic, Social, Mischievous' },
  british: { origin: 'UK', size: 'Medium-Large', life: '12-20 years', temperament: 'Calm, Patient, Intelligent' },
  scottish: { origin: 'Scotland', size: 'Medium', life: '11-14 years', temperament: 'Sweet, Charming, Gentle' },
};

module.exports = {
  commands: ['catbreed', 'catinfo'],
  description: 'Cat breed info',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const query = args.join('').toLowerCase().replace(/\s/g, '');
    const breed = breeds[query];
    if (!breed) {
      return ctx.reply(style.renderError([
        'Usage: .catinfo <breed>',
        `Breeds: ${Object.keys(breeds).join(', ')}`,
      ]));
    }

    const name = query.charAt(0).toUpperCase() + query.slice(1);
    return ctx.reply(style.renderInfo([
      `🐱 ${name}`,
      `Origin: ${breed.origin}`,
      `Size: ${breed.size}`,
      `Lifespan: ${breed.life}`,
      `Temperament: ${breed.temperament}`,
    ]));
  },
};
