'use strict';

const axios = require('axios');
const style = require('../../config/style');

function renderLines(renderer, lines) {
  return renderer(lines.flatMap(line => String(line).split(/\r?\n/)));
}

module.exports = {
  commands: ['summary', 'brief'],
  description: 'AI summarizes any long text, article, or quoted message',
  usage: '.summarize <text> OR reply to a long message',
  permission: 'public',
  group: true,
  private: true,
  run: async (sock, message, args, ctx) => {
    const jid = ctx.jid || ctx.sender || message.key.remoteJid;
    const { contextInfo, reply, safeSend } = ctx;
    const quoted = message.message?.extendedTextMessage?.contextInfo;
    const quotedText = quoted?.quotedMessage?.conversation
      || quoted?.quotedMessage?.extendedTextMessage?.text
      || '';
    const inputText = args.join(' ').trim() || quotedText;

    if (!inputText) {
      return reply(renderLines(style.renderError, [
        'Summarizer',
        '',
        'Reply to any long message with .summarize to get a quick summary.',
        '',
        'Or provide text directly:',
        '.summarize The quick brown fox jumps over...',
        '',
        'Aliases: .brief',
      ]));
    }

    if (inputText.length < 100) {
      return reply(style.renderError([
        `The text is too short to summarize (${inputText.length} chars).`,
        'Provide a longer piece of text.',
      ]));
    }

    await safeSend({ text: style.renderInfo(['📝 Summarizing...']), contextInfo }, { quoted: message });
    const prompt = 'Summarize the following text in clear, concise bullet points. '
      + `Be brief but cover all key points:\n\n${inputText.slice(0, 4000)}`;

    try {
      const { askAI } = require('../../lib/ai');
      const summary = (await askAI(prompt)).trim();
      if (summary) {
        return reply(renderLines(style.renderInfo, ['📝 Summary', '', summary]));
      }
    } catch {
      // Fall through to the anonymous provider and the built-in extractive summary.
    }

    try {
      const result = await axios.post(
        'https://ch.at/api/chat',
        { message: prompt },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'DJOUSSE-TECH-MD/1.0',
          },
          timeout: 15000,
        },
      );
      const summary = result.data?.answer
        || result.data?.reply
        || result.data?.message
        || result.data?.response
        || result.data?.result;
      if (summary && String(summary).trim().length > 10) {
        return reply(renderLines(style.renderInfo, ['📝 Summary', '', String(summary).trim()]));
      }
    } catch {
      // Fall through to a local extractive summary.
    }

    const sentences = inputText
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .filter(sentence => sentence.length > 20);
    const maxSentences = Math.min(5, Math.ceil(sentences.length * 0.3));
    const extracted = sentences.slice(0, maxSentences).join(' ');

    reply(renderLines(style.renderInfo, [
      '📝 Summary (extracted)',
      '',
      extracted,
      '',
      `Original: ${inputText.length} chars → Summary: ${extracted.length} chars`,
    ]));
  },
};
