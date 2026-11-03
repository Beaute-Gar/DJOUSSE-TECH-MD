// @legacy-order {"sourceFile":"07-fun/fact.js","sourceOrder":90,"definitionIndex":0,"entryOrder":205}
'use strict';

const style = require('../../config/style');

const FACTS = [
  'Honey can remain edible for thousands of years when stored properly.',
  'A group of flamingos is called a flamboyance.',
  'Octopuses have three hearts and blue blood.',
  'The Eiffel Tower can grow taller in hot weather as its metal expands.',
  'Bananas are berries, but strawberries are not botanical berries.',
  'A day on Venus is longer than its year.',
  'Wombats produce cube-shaped droppings.',
  'The fingerprints of a koala are remarkably similar to human fingerprints.',
  'Sharks have existed for hundreds of millions of years.',
  'The shortest war in recorded history lasted less than an hour.',
];

module.exports = {
  commands: ['facts', 'funfact'],
  description: 'Get a random interesting fact',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
    await ctx.reply(style.renderInfo(['Random Fact', '', `💡 ${fact}`]));
  },
};
