// @legacy-order {"sourceFile":"02-groupe/welcomequiz.js","sourceOrder":280,"definitionIndex":0,"entryOrder":772}
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const style = require('../../config/style');
const { PLUGIN_DATA } = require('../../config/paths');

function readSettings(jid) {
  const liveSettings = global.welcomeQuizSettings?.[jid];
  if (liveSettings) return liveSettings;

  try {
    const settings = JSON.parse(fs.readFileSync(path.join(PLUGIN_DATA, 'welcomequiz.json'), 'utf8'));
    return settings[jid] || null;
  } catch {
    return null;
  }
}

module.exports = {
  commands: ['quizsettings'],
  description: 'Welcome quiz — new members must answer a question to stay',
  permission: 'admin',
  group: true,
  private: false,
  run: async (sock, message, args, ctx) => {
    if (!ctx.isAdmin) {
      return ctx.reply(style.renderError(['Only group admins can view welcome quiz settings.']));
    }

    const settings = readSettings(ctx.jid);
    if (!settings) {
      return ctx.reply(style.renderError([
        'No quiz configured.',
        '',
        'Set one with `.setquiz What is 2+2? | 4`',
      ]));
    }

    return ctx.reply(style.renderInfo([
      'Welcome quiz settings',
      '',
      `Status: ${settings.enabled ? 'ON' : 'OFF'}`,
      `Question: ${settings.question || ''}`,
      `Answer: ${settings.answer || ''}`,
      `Timeout: ${settings.timeout || 300}s`,
      '',
      'Commands:',
      '• `.setquiz Question | Answer`',
      '• `.welcomequiz on/off`',
      '• `.quizoff`',
    ]));
  },
};
