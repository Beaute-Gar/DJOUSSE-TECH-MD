import config from '../config.cjs';

const yesno = async (m, sock) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
  const text = m.body.slice(prefix.length + cmd.length).trim();

  if (!['yesno', 'yn', 'question'].includes(cmd)) return;

  if (!text) {
    return m.reply(`Usage: ${prefix}yesno <question>\nExample: ${prefix}yesno Should I eat pizza?`);
  }

  const answers = [
    { text: '✅ Yes!', emoji: '✅' },
    { text: '❌ No!', emoji: '❌' },
    { text: '🤔 Maybe...', emoji: '🤔' },
    { text: '💯 Definitely!', emoji: '💯' },
    { text: '🚫 Absolutely not!', emoji: '🚫' },
    { text: '🤷 Who knows?', emoji: '🤷' },
    { text: '👍 Sure!', emoji: '👍' },
    { text: '👎 Nope!', emoji: '👎' }
  ];

  const random = answers[Math.floor(Math.random() * answers.length)];

  await sock.sendMessage(m.from, {
    text: `❓ *Question:* ${text}\n\n🎯 *Answer:* ${random.text}\n\n> Made by DJOUSSE-TECH-MD`
  }, { quoted: m });
};

export default yesno;
