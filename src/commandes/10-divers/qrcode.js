// @legacy-order {"sourceFile":"10-divers/qrcode.js","sourceOrder":178,"definitionIndex":0,"entryOrder":543}
'use strict';

const axios = require('axios');
const style = require('../../config/style');

module.exports = {
  commands: ['qrcode'],
  description: 'Generate a QR code for any text or URL',
  usage: '.qr <text or URL>',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    if (!args.length) {
      return ctx.reply(style.renderError([
        'Usage: .qr <text or URL>',
        '',
        'Examples:',
        '.qr https://djousse-tech-md-web.vercel.app',
        '.qr Hello World',
        '.qr +237690000000',
      ]));
    }

    const content = args.join(' ');
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(content)}&color=000000&bgcolor=ffffff&margin=20`;
    try {
      const response = await axios.get(qrUrl, { responseType: 'arraybuffer', timeout: 15000 });
      return ctx.sock.sendMessage(ctx.jid, {
        image: Buffer.from(response.data),
        caption: style.renderInfo([
          'QR Code Generated',
          '',
          `Content: ${content.length > 80 ? `${content.slice(0, 77)}...` : content}`,
        ]),
      }, { quoted: message });
    } catch (error) {
      return ctx.reply(style.renderError([`Failed to generate QR code: ${error.message}`]));
    }
  },
};
