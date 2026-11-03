'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['terminategc'],
  description: "Kick all members from the group and leave — permanently terminates the group.",
  permission: 'owner',
  group: true,
  private: false,
  run: async (sock, message, args, ctx) => {
    const { jid, isBotAdmin, groupMetadata, contextInfo, theme, isOwner } = ctx;
    const send = (text, error = false) => sock.sendMessage(
      jid,
      {
        text: (error ? style.renderError : style.renderInfo)([text]),
        contextInfo,
      },
      { quoted: message }
    );

    if (!isOwner) return send('⛔ Only the bot owner can use this command.', true);
    if (!isBotAdmin) return send(theme?.botAdmin || '⛔ I need to be an admin to do this.', true);

    const meta = groupMetadata || await sock.groupMetadata(jid).catch(() => null);
    if (!meta) return send('⛔ Impossible de récupérer les informations de ce groupe.', true);

    const botJid = sock.user?.id?.replace(/:.*@/, '@') || '';
    const toKick = (meta.participants || [])
      .map((participant) => participant.id)
      .filter((id) => id !== botJid);

    if (toKick.length === 0) {
      await sock.groupLeave(jid);
      return;
    }

    await send(
      `⚠️ *Terminating group…*\n\nRemoving ${toKick.length} participant(s) and leaving.\n_This cannot be undone._`
    );

    const batchSize = 5;
    for (let index = 0; index < toKick.length; index += batchSize) {
      try {
        await sock.groupParticipantsUpdate(jid, toKick.slice(index, index + batchSize), 'remove');
      } catch {
        // Continue when one batch contains members the bot cannot remove.
      }
      if (index + batchSize < toKick.length) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    try {
      await sock.groupLeave(jid);
    } catch {
      // The bot may already have left or been removed.
    }
  },
};
