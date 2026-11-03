// @legacy-order {"sourceFile":"02-groupe/welcome.js","sourceOrder":279,"definitionIndex":0,"entryOrder":767}
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
  commands: ['welcomeoff'],
  description: 'Disable welcome messages for this group',
  permission: 'admin',
  group: true,
  private: false,
  run: async (sock, message, args, ctx) => {
    if (!ctx.isAdmin) {
      return ctx.reply(style.renderError(['Only group admins can configure welcome messages.']));
    }

    const settingsMap = getGroupSettings();
    const settings = settingsMap.get(ctx.jid) || {
      welcome: false,
      goodbye: false,
      customWelcome: '',
      customGoodbye: '',
    };
    settings.welcome = false;
    settingsMap.set(ctx.jid, settings);

    return ctx.reply(style.renderInfo(['Welcome messages OFF']));
  },
};
