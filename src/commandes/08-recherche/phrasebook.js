'use strict';

const style = require('../../config/style');

const PHRASES = [
  ['Hello', 'Habari / Jambo'],
  ['How are you?', 'Habari yako?'],
  ['I am fine', 'Mimi ni mzuri'],
  ['Thank you', 'Asante / Asante sana'],
  ['Please', 'Tafadhali'],
  ['Yes', 'Ndiyo'],
  ['No', 'Hapana'],
  ['Good morning', 'Habari ya asubuhi'],
  ['Good evening', 'Habari ya jioni'],
  ['Goodbye', 'Kwaheri'],
  ['I love you', 'Nakupenda'],
  ['Welcome', 'Karibu'],
  ['Sorry', 'Pole / Samahani'],
  ['How much?', 'Bei gani?'],
  ['Water', 'Maji'],
  ['Food', 'Chakula'],
  ['Friend', 'Rafiki'],
  ['Beautiful', 'Nzuri'],
  ['God', 'Mungu'],
  ['Peace', 'Amani'],
];

module.exports = {
  commands: ['phrasebook', 'swahili'],
  description: 'Common Swahili phrases',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const phrases = PHRASES.map(([english, swahili]) => `*${english}* → ${swahili}`).join('\n');
    return ctx.reply(style.renderInfo(['Swahili Phrasebook', '', ...phrases.split('\n')]));
  },
};
