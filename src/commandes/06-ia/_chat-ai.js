'use strict';

const axios = require('axios');
const style = require('../../config/style');

async function callChAt(prompt, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await axios.post(
        'https://ch.at/api/chat',
        { message: prompt },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'DJOUSSE-TECH-MD/1.0',
          },
          timeout: 12000,
        },
      );
      const answer = response.data?.answer
        || response.data?.reply
        || response.data?.message
        || response.data?.response
        || response.data?.result;
      if (answer && String(answer).trim().length > 2) return String(answer).trim();
    } catch {
      // Try the next attempt, then Pollinations below.
    }
    if (attempt < retries) await new Promise(resolve => setTimeout(resolve, 500 * attempt));
  }
  return null;
}

async function callPollinations(prompt) {
  try {
    const response = await axios.get(
      `https://text.pollinations.ai/${encodeURIComponent(prompt.slice(0, 500))}`
        + `?model=openai&seed=${Date.now() % 9999}`,
      { timeout: 18000 },
    );
    return typeof response.data === 'string' ? response.data.trim() : null;
  } catch {
    return null;
  }
}

async function askAI(prompt) {
  const pollinationsFallback = new Promise(resolve => {
    setTimeout(() => {
      callPollinations(prompt).then(resolve).catch(() => resolve(null));
    }, 200);
  });

  const answer = await Promise.race([
    callChAt(prompt),
    pollinationsFallback,
    new Promise(resolve => setTimeout(() => resolve(null), 22000)),
  ]);
  return answer || '⚠️ AI servers are busy right now. Please try again in a moment.';
}

function createChatCommand(commands, label, systemHint) {
  return {
    commands,
    description: `Ask ${label} a question`,
    usage: `.${commands[0]} <question>`,
    permission: 'public',
    group: true,
    private: true,
    run: async (sock, message, args, ctx) => {
      const jid = ctx.jid || ctx.sender || message.key.remoteJid;
      const contextInfo = ctx.contextInfo;
      const query = args.join(' ').trim();
      if (!query) {
        return sock.sendMessage(jid, {
          text: style.renderError([
            `Usage: .${commands[0]} <question>`,
            '',
            `Example: .${commands[0]} What is quantum computing?`,
          ]),
          contextInfo,
        }, { quoted: message });
      }

      await sock.sendPresenceUpdate('composing', jid);
      const prompt = systemHint ? `[${systemHint}] ${query}` : query;
      const answer = await askAI(prompt);
      const lines = [
        `🤖 ${label}`,
        '',
        `❓ Q: ${query}`,
        '',
        `💬 A: ${answer}`,
      ].flatMap(line => line.split(/\r?\n/));
      await sock.sendMessage(jid, {
        text: style.renderInfo(lines),
        contextInfo,
      }, { quoted: message });
    },
  };
}

module.exports = createChatCommand;
