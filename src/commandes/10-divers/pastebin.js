// @legacy-order {"sourceFile":"10-divers/pastebin.js","sourceOrder":161,"definitionIndex":0,"entryOrder":522}
'use strict';

const axios = require('axios');
const style = require('../../config/style');

module.exports = {
  commands: ['pastebin', 'hastebin'],
  description: 'Paste text online and get a shareable link',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedText = quotedMessage?.conversation
      || quotedMessage?.extendedTextMessage?.text
      || '';
    const text = args.join(' ').trim() || quotedText;
    if (!text) {
      return ctx.reply(style.renderError([
        'Please provide text to paste.',
        'Example: .pastebin Hello World',
        'Or reply to a message with .pastebin',
      ]));
    }

    await ctx.reply(style.renderInfo(['Uploading paste...']));

    try {
      const response = await axios.post('https://paste.rs/', text, {
        headers: { 'Content-Type': 'text/plain' },
        timeout: 12000,
      });
      const link = String(response.data).trim();
      if (link.startsWith('https://')) {
        return ctx.reply(style.renderInfo(['Paste Uploaded!', '', link, '', 'paste.rs • No expiry']));
      }
    } catch {}

    try {
      const form = new URLSearchParams({
        content: text,
        syntax: 'text',
        title: 'DJOUSSE TECH Paste',
        expiry_days: '30',
      });
      const response = await axios.post('https://dpaste.org/api/', form.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 12000,
      });
      const link = String(response.data).trim().replace(/["']/g, '');
      if (link.startsWith('http')) {
        return ctx.reply(style.renderInfo(['Paste Uploaded!', '', link, '', 'dpaste.org • Expires in 30 days']));
      }
    } catch {}

    try {
      const FormData = require('form-data');
      const form = new FormData();
      form.append('reqtype', 'fileupload');
      form.append('fileToUpload', Buffer.from(text, 'utf8'), {
        filename: `paste_${Date.now()}.txt`,
        contentType: 'text/plain',
      });
      const response = await axios.post('https://catbox.moe/user/api.php', form, {
        headers: form.getHeaders(),
        timeout: 20000,
      });
      const link = String(response.data).trim();
      if (link.startsWith('https://')) {
        return ctx.reply(style.renderInfo(['Paste Uploaded!', '', link, '', 'catbox.moe • No expiry']));
      }
    } catch {}

    return ctx.reply(style.renderError([
      'Paste upload failed.',
      '',
      'You can paste text manually at:',
      'https://paste.rs',
      'https://dpaste.org',
    ]));
  },
};
