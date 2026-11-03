// @legacy-order {"sourceFile":"02-groupe/groupbackup.js","sourceOrder":105,"definitionIndex":0,"entryOrder":298}
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const style = require('../../config/style');
const { PLUGIN_DATA } = require('../../config/paths');

const backupDir = path.join(PLUGIN_DATA, 'backups');

module.exports = {
  commands: ['listbackups'],
  description: 'Backup and restore group settings and configurations',
  permission: 'admin',
  group: true,
  private: false,
  run: async (sock, message, args, ctx) => {
    if (!ctx.isAdmin) {
      return ctx.reply(style.renderError(['Only group admins can manage group backups.']));
    }

    const safeJid = String(ctx.jid).replace(/[^a-zA-Z0-9]/g, '_');
    let backups = [];
    try {
      fs.mkdirSync(backupDir, { recursive: true });
      backups = fs.readdirSync(backupDir)
        .filter(file => file.startsWith(`${safeJid}_`) && file.endsWith('.json'))
        .map(file => {
          const stat = fs.statSync(path.join(backupDir, file));
          return {
            name: file.slice(safeJid.length + 1, -'.json'.length),
            date: stat.mtime,
          };
        })
        .sort((a, b) => b.date - a.date);
    } catch {
      return ctx.reply(style.renderInfo(['No backups found.']));
    }

    if (backups.length === 0) {
      return ctx.reply(style.renderInfo([
        'No backups found.',
        '',
        'Create one with `.backupgroup <name>`',
      ]));
    }

    return ctx.reply(style.renderInfo([
      'Group backups',
      '',
      ...backups.flatMap((backup, index) => [
        `${index + 1}. ${backup.name}`,
        `   ${backup.date.toLocaleDateString()} ${backup.date.toLocaleTimeString()}`,
      ]),
      '',
      'Restore with `.restoregroup <name>`',
    ]));
  },
};
