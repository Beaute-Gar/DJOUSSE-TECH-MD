import config from '../config.cjs';

const insultList = [
  "ðŸ§  Your brain ran away from embarrassment.",
  "ðŸ•³ï¸ You're proof the universe has bugs.",
  "ðŸ“Ÿ Your IQ score came back as a 404 error.",
  "ðŸ”Œ You're not dumb. You're just on airplane mode permanently.",
  "ðŸ’¾ You're outdated software in a corrupt drive.",
  "ðŸ¥´ If stupidity were a sport, youâ€™d have a gold medal.",
  "ðŸªž Your reflection probably hides in shame.",
  "ðŸŽ­ You wear your ego like it's a superhero cape... sadly, it's invisible.",
  "â˜¢ï¸ You're like a nuclear error: rare, dangerous, and entirely useless.",
  "ðŸŽ® Youâ€™re the lag in lifeâ€™s multiplayer game.",
  "ðŸ•·ï¸ Even spiders avoid your web of nonsense.",
  "ðŸ“‰ You're the reason the group chat went silent.",
  "ðŸŒªï¸ You're a tornado of bad decisions.",
  "ðŸ§© Youâ€™re like a puzzle piece from the wrong box.",
  "ðŸ”“ Your logic is so flawed it triggers CAPTCHA every time you speak.",
  "ðŸš½ Even the toilet flushed itself to avoid hearing from you.",
  "ðŸ“¼ Your thoughts play on VHS in a digital world.",
  "ðŸ”• You're proof that silence is golden."
];

const insultCommand = async (m, sock) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix) 
    ? m.body.slice(prefix.length).split(" ")[0].toLowerCase() 
    : '';
  if (cmd !== 'insult') return;

  const isReply = m.quoted && m.quoted.sender;
  const targetJid = isReply ? m.quoted.sender : m.sender;
  const targetTag = targetJid.split("@")[0];

  const insult = insultList[Math.floor(Math.random() * insultList.length)];

  const styledMessage = `
â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
â•‘ðŸ”¥  ð•´ð–“ð–˜ð–šð–‘ð–™ ð•»ð–—ð–”ð–ð–Šð–ˆð–™ ðŸ”¥â•‘
â• â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•£
â•‘ ðŸ‘¤ Target: @${targetTag.padEnd(15)} â•‘
â•‘                             â•‘
â•‘ ðŸ’¥ Roasted with:            â•‘
â•‘ "${insult}" â•‘
â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  `.trim();

  await sock.sendMessage(m.from, {
    text: styledMessage,
    mentions: [targetJid],
    contextInfo: {
      forwardingScore: 777,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterName: "DJOUSSE-TECH-MD",
        newsletterJid: "120363397722863547@newsletter",
      },
    },
  });
};

export default insultCommand;

