// @legacy-order {"sourceFile":"05-outils/education.js","sourceOrder":81,"definitionIndex":4,"entryOrder":154}
'use strict';

const style = require('../../config/style');

const words = [
  { word: 'Ephemeral', definition: 'Lasting for a very short time', example: 'The beauty of cherry blossoms is ephemeral.' },
  { word: 'Serendipity', definition: 'The occurrence of events by chance in a happy way', example: 'Finding that book was pure serendipity.' },
  { word: 'Ubiquitous', definition: 'Present, appearing, or found everywhere', example: 'Mobile phones have become ubiquitous.' },
  { word: 'Eloquent', definition: 'Fluent or persuasive in speaking or writing', example: 'She gave an eloquent speech.' },
  { word: 'Resilient', definition: 'Able to recover quickly from difficulties', example: 'Children are remarkably resilient.' },
  { word: 'Pragmatic', definition: 'Dealing with things sensibly and realistically', example: 'We need a pragmatic approach.' },
  { word: 'Enigma', definition: 'A person or thing that is mysterious or puzzling', example: 'She remains an enigma to us all.' },
  { word: 'Paradigm', definition: 'A typical example or pattern of something', example: 'This discovery will shift the paradigm.' },
  { word: 'Catalyst', definition: 'A person or thing that causes change', example: 'Her speech was a catalyst for reform.' },
  { word: 'Ambiguous', definition: 'Open to more than one interpretation', example: 'The instructions were ambiguous.' },
  { word: 'Tenacious', definition: 'Persistent and determined', example: 'A tenacious negotiator.' },
  { word: 'Euphoria', definition: 'Intense feeling of happiness', example: 'The team was in euphoria after winning.' },
  { word: 'Benevolent', definition: 'Well-meaning and kindly', example: 'A benevolent smile.' },
  { word: 'Melancholy', definition: 'A deep sadness', example: 'A mood of melancholy descended on us.' },
  { word: 'Juxtapose', definition: 'Place close together for contrasting effect', example: 'The old and new buildings were juxtaposed.' },
];

module.exports = {
  commands: ['vocab', 'wotd'],
  description: 'Word of the day',
  permission: 'public',
  run: async (_sock, _message, _args, ctx) => {
    const word = words[Math.floor(Math.random() * words.length)];
    return ctx.reply(style.renderInfo([
      '📖 Word of the Day',
      word.word,
      `Meaning: ${word.definition}`,
      `Example: "${word.example}"`,
    ]));
  },
};
