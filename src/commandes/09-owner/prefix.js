'use strict';
// @legacy-order {"sourceFile":"09-owner/setprefix.js","sourceOrder":205,"definitionIndex":0,"entryOrder":600}

const fs = require('fs');
const path = require('path');
const config = require('../_partage/config');
const { renderError, renderInfo } = require('../../config/style');
const ENV_FILE = path.resolve(__dirname, '../../plugins/config.env');

function persistPrefix(value) {
  try {
    let content = '';
    if (fs.existsSync(ENV_FILE)) {
      content = fs.readFileSync(ENV_FILE, 'utf8')
        .split('\n')
        .filter(line => !line.trim().startsWith('PREFIX='))
        .join('\n')
        .trim();
    }
    content = content ? `${content}\nPREFIX=${value}` : `PREFIX=${value}`;
    fs.writeFileSync(ENV_FILE, `${content}\n`);
  } catch (error) {
    console.warn('[setprefix] Could not persist to config.env:', error.message);
  }
}

module.exports = ({ cmd }) => {
  cmd('prefix', ['changeprefix'], {
    cat: 9,
    desc: 'View or change the bot command prefix at runtime',
    usage: '.prefix <value>',
    owner: true,
    group: false,
    private: true,
  }, async (ctx) => {
    const current = config.PREFIX || '.';
    if (!ctx.args.length) {
      const display = current === '' || current.toLowerCase() === 'none'
        ? '_none (no prefix)_'
        : current.toLowerCase() === 'any'
          ? '_any symbol_'
          : `\`${current}\``;

      return ctx.reply(renderInfo([
        `CURRENT PREFIX: ${display}`,
        '',
        'HOW TO CHANGE:',
        '• .prefix . — single prefix',
        '• .prefix .,!,/ — multiple (any of them works)',
        '• .prefix any — any symbol, emoji or punctuation',
        '• .prefix none — no prefix (bare commands)',
        '• .prefix 🤖 — emoji prefix',
      ]));
    }

    const newPrefix = ctx.args.join(' ').trim();
    if (!newPrefix) {
      return ctx.reply(renderError(['PREFIX CANNOT BE EMPTY. USE "NONE" TO DISABLE THE PREFIX.']));
    }
    if (newPrefix.length > 50) {
      return ctx.reply(renderError(['PREFIX TOO LONG (MAX 50 CHARACTERS).']));
    }

    config.PREFIX = newPrefix;
    persistPrefix(newPrefix);

    const isNone = newPrefix.toLowerCase() === 'none' || newPrefix === '';
    const isAny = newPrefix.toLowerCase() === 'any';
    const list = !isNone && !isAny
      ? newPrefix.split(',').map(prefix => prefix.trim()).filter(Boolean)
      : [];
    let summary;
    if (isNone) summary = 'PREFIX DISABLED. COMMANDS NOW WORK WITHOUT ANY PREFIX.';
    else if (isAny) summary = 'ANY-PREFIX MODE. ANY SYMBOL, EMOJI OR PUNCTUATION TRIGGERS COMMANDS.';
    else if (list.length > 1) summary = `MULTI-PREFIX SET: ${list.map(prefix => `\`${prefix}\``).join('  ')}`;
    else summary = `PREFIX SET TO: \`${newPrefix}\``;

    return ctx.reply(renderInfo([
      summary,
      '',
      'CHANGE TAKES EFFECT IMMEDIATELY. RESTART IS NOT REQUIRED.',
    ]));
  });
};
module.exports.maison = true;
