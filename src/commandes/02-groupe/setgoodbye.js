// @legacy-order {"sourceFile":"02-groupe/welcome.js","sourceOrder":279,"definitionIndex":0,"entryOrder":766}
'use strict';

const style = require('../../config/style');

function getGroupSettings() {
  if (!(global.welcomeSettings instanceof Map)) {
    global.welcomeSettings = new Map();
  }
  return global.welcomeSettings;
}

getGroupSettings();

module.exports = {
  commands: ['setgoodbye'],
  description: 'Set the custom farewell message for this group',
  permission: 'admin',
  group: true,
  private: false,
  run: async (sock, message, args, ctx) => {
    if (!ctx.isAdmin) {
      return ctx.reply(style.renderError(['Only group admins can configure goodbye messages.']));
    }

    const text = args.join(' ').trim();
    if (!text) {
      return ctx.reply(style.renderError([
        'Provide a goodbye message.',
        'Use `{name}` as a placeholder for the member name.',
        '',
        'Example: `.setgoodbye Goodbye {name}, take care! 👋`',
      ]));
    }

    const settingsMap = getGroupSettings();
    const settings = settingsMap.get(ctx.jid) || {
      welcome: false,
      goodbye: false,
      customWelcome: '',
      customGoodbye: '',
    };
    settings.customGoodbye = text;
    settings.goodbye = true;
    settingsMap.set(ctx.jid, settings);

    return ctx.reply(style.renderSuccess([
      'Custom goodbye set and enabled:',
      '',
      text,
    ]));
  },
};
