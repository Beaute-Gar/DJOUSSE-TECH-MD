'use strict';

const axios = require('axios');
const style = require('../../config/style');

const AI_APIS = [
  query => `https://lance-frank-asta.onrender.com/api/gpt?q=${encodeURIComponent(query)}`,
  query => `https://vapis.my.id/api/openai?q=${encodeURIComponent(query)}`,
];

module.exports = {
  commands: ['gpt', 'chatgpt'],
  description: 'Ask the AI a question',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    const jid = ctx.sender || ctx.jid || message.key.remoteJid;
    const { contextInfo } = ctx;
    const query = args.join(' ').trim();
    if (!query) {
      return sock.sendMessage(jid, {
        text: style.renderError([
          'Please provide a question!',
          'Example: .ai What is AI?',
        ]),
        contextInfo,
      }, { quoted: message });
    }

    let response = null;
    for (const buildUrl of AI_APIS) {
      try {
        const result = await axios.get(buildUrl(query), { timeout: 15000 });
        if (result.data?.message) {
          response = result.data.message;
          break;
        }
      } catch (error) {
        console.error('[AI] API failed:', error.message);
      }
    }

    if (!response) {
      response = 'Sorry, all AI servers are currently unavailable. Try again later.';
    }

    await sock.sendMessage(jid, {
      text: style.renderInfo(['🤖 AI Response:', '', String(response)]),
      contextInfo,
    }, { quoted: message });
  },
};
