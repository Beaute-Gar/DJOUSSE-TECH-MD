// @legacy-order {"sourceFile":"05-outils/utility-tools.js","sourceOrder":265,"definitionIndex":6,"entryOrder":728}
'use strict';

const style = require('../../config/style');

module.exports = {
  commands: ['makeqr'],
  description: 'Generate QR code text',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const text = args.join(' ');
    if (!text) {
      return ctx.reply(style.renderError(['Usage: .qr <text or URL>']));
    }

    try {
      const qrcode = require('qrcode');
      const image = await qrcode.toBuffer(text, { width: 300 });
      return sock.sendMessage(ctx.jid, {
        image,
        caption: style.renderInfo([`📱 QR Code for: ${text}`]),
      }, { quoted: message });
    } catch {
      return ctx.reply(style.renderError(['Failed to generate QR code']));
    }
  },
};
