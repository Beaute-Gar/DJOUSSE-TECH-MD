'use strict';

const fs = require('fs');
const path = require('path');
const style = require('../../config/style');

const rulesFile = path.join(require('../../config/paths').PLUGIN_DATA, 'grouprules.json');

function loadRules() {
  try {
    return JSON.parse(fs.readFileSync(rulesFile, 'utf8'));
  } catch {
    return {};
  }
}

function saveRules(rules) {
  fs.mkdirSync(path.dirname(rulesFile), { recursive: true });
  fs.writeFileSync(rulesFile, JSON.stringify(rules, null, 2));
}

module.exports = {
  commands: ['rules', 'setrules', 'delrules'],
  description: "Set/show/delete group rules",
  permission: 'admin',
  group: true,
  private: false,
  run: async (sock, message, args, ctx) => {
    const rawText = message.message?.extendedTextMessage?.text
      || message.message?.conversation
      || ctx.text
      || '';
    const commandToken = String(ctx.command || rawText).trim().split(/\s+/)[0];
    const prefix = ctx.prefix || '.';
    const command = (commandToken.startsWith(prefix)
      ? commandToken.slice(prefix.length)
      : commandToken).toLowerCase();
    const groupId = ctx.groupId || ctx.jid;
    const sender = ctx.sender || ctx.jid;
    const contextInfo = ctx.contextInfo || {};
    const rules = loadRules();
    const sendInfo = (jid, text) => sock.sendMessage(
      jid,
      { text: style.renderInfo([text]), contextInfo },
      { quoted: message }
    );
    const sendError = (jid, text) => sock.sendMessage(
      jid,
      { text: style.renderError([text]), contextInfo },
      { quoted: message }
    );

    if (command === 'rules') {
      const text = rules[groupId];
      if (!text) {
        return sendInfo(groupId, '📋 No rules set for this group yet.\nAdmin can use .setrules to add rules.');
      }
      return sendInfo(
        groupId,
        `📋 *Group Rules*\n\n${text}\n\n_Please follow the rules to avoid being removed._`
      );
    }

    if (!ctx.isAdmin) return sendError(sender, '❌ Only admins can set rules.');

    if (command === 'setrules') {
      const text = args.join(' ');
      if (!text) return sendError(sender, '📋 Usage: .setrules <rules text>');
      rules[groupId] = text;
      saveRules(rules);
      return sendInfo(groupId, `✅ Group rules updated!\n\n📋 ${text}`);
    }

    if (command === 'delrules') {
      delete rules[groupId];
      saveRules(rules);
      return sendInfo(groupId, '🗑️ Group rules deleted.');
    }
  },
};
