'use strict';

const axios = require('axios');
const style = require('../../config/style');

module.exports = {
  commands: ['imagine', 'img'],
  description: 'Generate an AI image from a text prompt',
  usage: '.imagine <description>',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    const jid = ctx.jid || ctx.sender || message.key.remoteJid;
    const { contextInfo } = ctx;
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: style.renderError([
          'Usage: .imagine <description>',
          '',
          'Examples:',
          '• .imagine a lion wearing a gold crown',
          '• .imagine futuristic city at night, neon lights',
        ]),
        contextInfo,
      }, { quoted: message });
    }

    const prompt = args.join(' ');
    await sock.sendMessage(jid, {
      text: style.renderInfo([`🎨 Generating: "${prompt}"`, '', '⏳ Please wait...']),
      contextInfo,
    }, { quoted: message });

    try {
      const seed = Math.floor(Math.random() * 999999);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`
        + `?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;
      const result = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 60000 });
      await sock.sendMessage(jid, {
        image: Buffer.from(result.data),
        caption: style.renderInfo(['🎨 AI Generated Image', '', `📝 Prompt: ${prompt}`]),
        contextInfo,
      }, { quoted: message });
    } catch (error) {
      await sock.sendMessage(jid, {
        text: style.renderError([`Image generation failed: ${error.message}`]),
        contextInfo,
      }, { quoted: message });
    }
  },
};
