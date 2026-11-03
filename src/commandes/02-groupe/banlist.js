// @legacy-order {"sourceFile":"02-groupe/ban.js","sourceOrder":37,"definitionIndex":0,"entryOrder":91}
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const style = require('../../config/style');
const { PLUGIN_DATA } = require('../../config/paths');

function readBans() {
  if (global.bannedUsers instanceof Set) return [...global.bannedUsers];

  try {
    const bans = JSON.parse(fs.readFileSync(path.join(PLUGIN_DATA, 'bans.json'), 'utf8'));
    return Array.isArray(bans) ? bans : [];
  } catch {
    return [];
  }
}

module.exports = {
  commands: ['banlist'],
  description: 'Permanently ban / unban users from using bot commands (persisted across restarts)',
  permission: 'admin',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    if (!ctx.isAdmin && !ctx.isOwner) {
      return ctx.reply(style.renderError(['Only group admins can view the ban list.']));
    }

    const bans = readBans();
    if (bans.length === 0) {
      return ctx.reply(style.renderInfo(['Ban list', '', 'No users are currently banned.']));
    }

    return ctx.reply(style.renderInfo([
      `Banned users (${bans.length})`,
      '',
      ...bans.map(jid => `• @${String(jid).split('@')[0]}`),
      '',
      'Bans are permanent and survive restarts.',
    ]), bans);
  },
};
