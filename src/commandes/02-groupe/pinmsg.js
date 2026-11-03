'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['pinmsg', 'unpinmsg'],
  description: "Pin or unpin any message in a group (reply to the message)",
  usage: 'Reply to a message + .pin | .unpin',
  permission: 'admin',
  group: true,
  private: false,
  run: async (sock, message, args, ctx) => {
    const { jid, isAdmin, isBotAdmin, contextInfo } = ctx;
    const send = (text, error = false) => sock.sendMessage(
      jid,
      {
        text: (error ? style.renderError : style.renderInfo)([text]),
        contextInfo,
      },
      { quoted: message }
    );

    if (!isAdmin) return send('⛔ Only admins can pin/unpin messages.', true);
    if (!isBotAdmin) return send('⛔ I need to be an admin to pin messages.', true);

    const rawCommand = (
      message.message?.extendedTextMessage?.text
      || message.message?.conversation
      || ''
    ).trim().split(/\s+/)[0].replace(/^\./, '').toLowerCase();
    const isUnpin = rawCommand === 'unpinmsg';
    const quoted = message.message?.extendedTextMessage?.contextInfo;
    const stanzaId = quoted?.stanzaId;
    const participant = quoted?.participant;

    if (!stanzaId) {
      return send(
        `❌ *Reply to a message* to ${isUnpin ? 'unpin' : 'pin'} it.\n\n`
        + '• `.pin` — pin the replied message\n'
        + '• `.unpin` — unpin a pinned message\n\n'
        + '_Duration options:_\n'
        + '• `.pin 24h` — pin for 24 hours\n'
        + '• `.pin 7d` — pin for 7 days\n'
        + '• `.pin 30d` — pin for 30 days\n'
        + '• `.pin 0` — pin forever (default)',
        true
      );
    }

    const targetKey = {
      remoteJid: jid,
      fromMe: participant ? false : true,
      id: stanzaId,
      participant: participant || undefined,
    };

    const durationArg = (args[0] || '').toLowerCase();
    const duration = isUnpin ? 0
      : durationArg === '24h' ? 86400
        : durationArg === '7d' ? 604800
          : durationArg === '30d' ? 2592000
            : 0;

    try {
      await sock.sendMessage(jid, { pin: targetKey, type: isUnpin ? 0 : 1 });
      const durationText = duration === 86400 ? '24 hours'
        : duration === 604800 ? '7 days'
          : duration === 2592000 ? '30 days'
            : 'forever';
      return send(isUnpin ? '📌 Message *unpinned*.' : `📌 Message *pinned* (${durationText}).`);
    } catch (error) {
      return send(`❌ Failed to ${isUnpin ? 'unpin' : 'pin'}: ${error.message}`, true);
    }
  },
};
