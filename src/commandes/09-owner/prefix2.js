'use strict';
// @legacy-order {"sourceFile":"02-groupe/security-tools.js","sourceOrder":195,"definitionIndex":2,"entryOrder":581}

const { renderError, renderInfo } = require('../../config/style');

module.exports = ({ cmd }) => {
  cmd('prefix2', [], {
    cat: 9,
    desc: 'Change command prefix',
    usage: '.prefix2 <new_prefix>',
    owner: true,
    group: true,
    private: true,
  }, async (ctx) => {
    const newPrefix = ctx.args[0];
    if (!newPrefix) {
      return ctx.reply(renderError(['USAGE: .prefix2 <new_prefix>']));
    }

    process.env.PREFIX = newPrefix;
    return ctx.reply(renderInfo([
      `PREFIX CHANGED TO: ${newPrefix}`,
      '',
      'THIS CHANGE IS TEMPORARY UNTIL RESTART.',
    ]));
  });
};
module.exports.maison = true;
