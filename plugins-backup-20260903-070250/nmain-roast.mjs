import config from '../config.cjs';

const roast = async (m, sock) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';

  if (!['roast', 'insult', 'dis'].includes(cmd)) return;

  const roasts = [
    "You're the reason God created the middle finger.",
    "If you were any more inbred, you'd be a sandwich.",
    "You're so ugly, when you cry for attention, nobody comes.",
    "You're the human equivalent of a participation trophy.",
    "I'd agree with you, but then we'd both be wrong.",
    "You're proof that evolution can go in reverse.",
    "You're so generic, you could be a store brand.",
    "If stupid was a sport, you'd be an Olympic champion.",
    "You're the human version of a screen door on a submarine.",
    "You have the right to remain silent, and I strongly suggest you exercise it.",
    "You're so dense, light bends around you.",
    "You're the type of person to microwaves water just to watch it explode.",
    "You're proof that evolution isn't always an improvement.",
    "You're so ugly, your reflection looks away.",
    "If you were any simpler, you'd need instructions to breathe."
  ];

  const random = roasts[Math.floor(Math.random() * roasts.length)];
  await sock.sendMessage(m.from, {
    text: `🔥 *Roast:*\n\n_${random}_\n\n> Made by DJOUSSE-TECH-MD`
  }, { quoted: m });
};

export default roast;
