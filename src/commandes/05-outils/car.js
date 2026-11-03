// @legacy-order {"sourceFile":"05-outils/info-lookup.js","sourceOrder":119,"definitionIndex":6,"entryOrder":336}
'use strict';

const style = require('../../config/style');

const cars = {
  toyota: { name: 'Toyota', country: 'Japan', founded: 1937, slogan: "Let's Go Places", famous: 'Corolla, Camry, Land Cruiser' },
  mercedes: { name: 'Mercedes-Benz', country: 'Germany', founded: 1926, slogan: 'The Best or Nothing', famous: 'S-Class, G-Wagon, AMG GT' },
  bmw: { name: 'BMW', country: 'Germany', founded: 1916, slogan: 'The Ultimate Driving Machine', famous: '3 Series, X5, M3' },
  tesla: { name: 'Tesla', country: 'USA', founded: 2003, slogan: 'Accelerating Sustainable Energy', famous: 'Model 3, Model S, Cybertruck' },
  ford: { name: 'Ford', country: 'USA', founded: 1903, slogan: 'Go Further', famous: 'F-150, Mustang, Explorer' },
  honda: { name: 'Honda', country: 'Japan', founded: 1948, slogan: 'The Power of Dreams', famous: 'Civic, Accord, CR-V' },
  ferrari: { name: 'Ferrari', country: 'Italy', founded: 1947, slogan: 'We Are the Competition', famous: 'F40, LaFerrari, 488' },
  lamborghini: { name: 'Lamborghini', country: 'Italy', founded: 1963, slogan: 'Expect the Unexpected', famous: 'Aventador, Huracán, Urus' },
  audi: { name: 'Audi', country: 'Germany', founded: 1909, slogan: 'Vorsprung durch Technik', famous: 'A4, Q7, R8' },
  porsche: { name: 'Porsche', country: 'Germany', founded: 1931, slogan: 'There Is No Substitute', famous: '911, Cayenne, Taycan' },
};

module.exports = {
  commands: ['car', 'carinfo'],
  description: 'Car brand info',
  permission: 'public',
  run: async (_sock, _message, args, ctx) => {
    const query = (args[0] || '').toLowerCase();
    const car = cars[query];
    if (!car) {
      return ctx.reply(style.renderError([
        'Usage: .car <brand>',
        `Brands: ${Object.keys(cars).join(', ')}`,
      ]));
    }

    return ctx.reply(style.renderInfo([
      `🚗 ${car.name}`,
      `Country: ${car.country}`,
      `Founded: ${car.founded}`,
      `Slogan: "${car.slogan}"`,
      `Famous Models: ${car.famous}`,
    ]));
  },
};
