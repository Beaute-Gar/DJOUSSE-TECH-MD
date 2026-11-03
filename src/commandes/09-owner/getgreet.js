'use strict';
// @legacy-order {"sourceFile":"09-owner/greet.js","sourceOrder":102,"definitionIndex":0,"entryOrder":258}

const fs = require('fs');
const path = require('path');
const { renderError, renderInfo } = require('../../config/style');
const GREET_FILE = path.join(require('../../config/paths').PLUGIN_DATA, 'greet.json');

function loadGreetingData() {
  try {
    return JSON.parse(fs.readFileSync(GREET_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function getGreeting(data) {
  const ownerNumber = (process.env.OWNER_NUMBER || global.botNum || '').replace(/\D/g, '');
  const ownerJid = ownerNumber ? `${ownerNumber}@s.whatsapp.net` : null;
  return data.__text__
    || (ownerJid && data[ownerJid])
    || Object.values(data).find(value => typeof value === 'string')
    || null;
}

module.exports = ({ cmd }) => {
  cmd('getgreet', [], {
    cat: 9,
    desc: 'View the current auto-greeting',
    usage: '.getgreet',
    owner: true,
    group: false,
    private: true,
  }, async (ctx) => {
    const data = loadGreetingData();
    const greeting = getGreeting(data);
    if (!greeting) {
      return ctx.reply(renderError([
        'NO GREETING SET.',
        'USE .setgreet <message> TO SET ONE.',
      ]));
    }

    return ctx.reply(renderInfo([
      'CURRENT GREETING',
      `"${greeting}"`,
      '',
      `STATUS: ${data.__enabled__ !== false ? 'ON — SENT ONCE PER DAY' : 'OFF — PAUSED'}`,
      '.greeton / .greetoff — TOGGLE',
      '.setgreet <msg> — CHANGE MESSAGE',
      '.delgreet — DELETE',
    ]));
  });
};
module.exports.maison = true;
