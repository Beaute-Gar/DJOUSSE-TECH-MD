// @legacy-order {"sourceFile":"09-owner/setbio.js","sourceOrder":199,"definitionIndex":0,"entryOrder":599}
'use strict';

const { renderError, renderSaisie, renderSuccess } = require('../../config/style');

module.exports = function registerSetAbout({ cmd }) {
  cmd('setabout', ['about'], {
    cat: 9,
    desc: 'Set the bot WhatsApp About/Bio',
    usage: '.setabout <text>',
    owner: true,
    group: false,
    private: true,
  }, async (ctx) => {
    const bio = (ctx.q || '').trim();
    if (!bio) {
      return ctx.reply(renderSaisie('.setabout <text>'));
    }

    try {
      await ctx.sock.updateProfileStatus(bio);
      return ctx.reply(renderSuccess([`BOT BIO UPDATED: ${bio}`]));
    } catch (error) {
      return ctx.reply(renderError([`FAILED TO UPDATE BIO: ${error.message}`]));
    }
  });
};

module.exports.maison = true;
