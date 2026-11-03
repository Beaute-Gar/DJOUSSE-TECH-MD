'use strict';

const { renderError, renderInfo } = require('../../config/style');

const PRESENCE = {
  recording: { type: 'recording', label: '🎤 Recording...' },
  busy: { type: 'unavailable', label: '⚫ Offline' },
  offline: { type: 'unavailable', label: '⚫ Offline' },
};

module.exports = function createPresenceStatus(command) {
  const status = PRESENCE[command];
  if (!status) throw new Error(`Unknown presence command: ${command}`);

  const register = ({ cmd }) => {
    cmd(command, [], {
      cat: 9,
      desc: 'Set bot presence status in a chat',
      usage: `.${command}`,
      owner: true,
      group: true,
      private: true,
    }, async (ctx) => {
      try {
        await ctx.sock.sendPresenceUpdate(status.type, ctx.jid);
        return ctx.reply(renderInfo([`${status.label} PRESENCE SET!`]));
      } catch (error) {
        return ctx.reply(renderError([
          `FAILED TO SET PRESENCE: ${error.message}`,
        ]));
      }
    });
  };

  register.maison = true;
  return register;
};
