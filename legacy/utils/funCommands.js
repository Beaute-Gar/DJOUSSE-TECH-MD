const api = require('./api');

const tag = (mentions) => {
  if (!mentions || !mentions.length) return '';
  return mentions.map(m => `@${m.split('@')[0]}`).join(' ');
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const percentFromId = (id) => {
  const hash = id.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
  return Math.abs(hash % 101);
};

const getTargetUser = (msg, args, sender) => {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  if (ctx?.mentionedJid?.length) return ctx.mentionedJid[0];
  if (ctx?.participant) return ctx.participant;
  if (args?.length && /\d{5,}/.test(args[0])) return args[0].replace(/\D/g, '') + '@s.whatsapp.net';
  return sender;
};

module.exports = { tag, pick, percentFromId, getTargetUser };