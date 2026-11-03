// @legacy-order {"sourceFile":"02-groupe/welcome.js","sourceOrder":279,"definitionIndex":0,"entryOrder":765}
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
  commands: ['setwelcome'],
  description: 'Set the custom welcome message for this group',
  permission: 'admin',
  group: true,
  private: false,
  run: async (sock, message, args, ctx) => {
    if (!ctx.isAdmin) {
      return ctx.reply(style.renderError(['Only group admins can configure welcome messages.']));
    }

    const text = args.join(' ').trim();
    if (!text) {
      return ctx.reply(style.renderError([
        'Provide a welcome message.',
        'Use `{name}` as a placeholder for the member name.',
        '',
        'Example: `.setwelcome Welcome to the group, {name}! 🎉`',
      ]));
    }

    const settingsMap = getGroupSettings();
    const settings = settingsMap.get(ctx.jid) || {
      welcome: false,
      goodbye: false,
      customWelcome: '',
      customGoodbye: '',
    };
    settings.customWelcome = text;
    settings.welcome = true;
    settingsMap.set(ctx.jid, settings);

    return ctx.reply(style.renderSuccess([
      'Custom welcome set and enabled:',
      '',
      text,
    ]));
  },
};
