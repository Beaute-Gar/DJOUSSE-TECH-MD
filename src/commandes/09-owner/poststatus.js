// @legacy-order {"sourceFile":"09-owner/setstatus.js","sourceOrder":206,"definitionIndex":0,"entryOrder":601}
'use strict';

const { renderError, renderInfo } = require('../../config/style');

module.exports = function register({ cmd, config }) {
  cmd('poststatus', ['textstatus'], {
    cat: 9,
    desc: 'Post a text WhatsApp status from the bot',
    usage: 'poststatus <text>',
    owner: true,
    group: false,
    private: true,
  }, async (ctx) => {
    const text = ctx.args.join(' ');
    if (!text) {
      return ctx.reply(renderError([
        `USAGE: ${config.prefix}poststatus <text>`,
        `EXAMPLE: ${config.prefix}poststatus DJOUSSE TECH is online! 🔥`,
      ]));
    }

    try {
      await ctx.sock.sendMessage('status@broadcast', {
        text,
        backgroundColor: '#075e54',
        font: 0,
      }, { statusJidList: [ctx.sender] });
      return ctx.reply(renderInfo(['STATUS POSTED', `📢 "${text}"`]));
    } catch (error) {
      return ctx.reply(renderError([`STATUS POST FAILED: ${error.message}`]));
    }
  });
};
