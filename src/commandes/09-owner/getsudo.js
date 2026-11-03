'use strict';
// @legacy-order {"sourceFile":"09-owner/owner3.js","sourceOrder":158,"definitionIndex":0,"entryOrder":474}

const fs = require('fs');
const path = require('path');
const { renderInfo } = require('../../config/style');
const SUDO_FILE = path.join(require('../../config/paths').PLUGIN_DATA, 'sudo.json');

function loadSudo() {
  try {
    const list = JSON.parse(fs.readFileSync(SUDO_FILE, 'utf8'));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

module.exports = ({ cmd }) => {
  cmd('getsudo', [], {
    cat: 9,
    desc: 'List configured sudo users',
    usage: '.getsudo',
    owner: true,
    group: true,
    private: true,
  }, async (ctx) => {
    const list = loadSudo();
    if (!list.length) {
      return ctx.reply(renderInfo(['SUDO USERS', '', 'NO SUDO USERS SET.']));
    }

    return ctx.reply(renderInfo([
      `SUDO USERS (${list.length})`,
      '',
      ...list.map((jid, index) => `${index + 1}. +${String(jid).split('@')[0]}`),
    ]));
  });
};
module.exports.maison = true;
