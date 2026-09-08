import config from '../config.cjs';

const frilt = async (m, sock) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';

  if (!['flirt', 'frilt', 'pickup'].includes(cmd)) return;

  const flirts = [
    "Are you a magician? Because whenever I look at you, everyone else disappears.",
    "Do you have a map? Because I just got lost in your eyes.",
    "Are you a parking ticket? Because you've got FINE written all over you.",
    "Do you believe in love at first sight, or should I walk by again?",
    "Is your name Google? Because you have everything I've been searching for.",
    "Are you a camera? Because every time I look at you, I smile.",
    "Do you have a Band-Aid? Because I just scraped my knee falling for you.",
    "Are you a time traveler? Because I see you in my future.",
    "Is your name Wi-Fi? Because I'm feeling a connection.",
    "Are you a parking ticket? Because you've got fine written all over you.",
    "Do you have a sunburn, or are you always this hot?",
    "Are you a snowflake? Because I've fallen for you.",
    "Is there a rainbow today? I just found the treasure I've been searching for.",
    "If you were a vegetable, you'd be a cute-cumber.",
    "Are you a campfire? Because you're hot and I want s'more."
  ];

  const random = flirts[Math.floor(Math.random() * flirts.length)];
  await sock.sendMessage(m.from, {
    text: `💘 *Flirt of the Day:*\n\n_${random}_\n\n> Made by DJOUSSE-TECH-MD`
  }, { quoted: m });
};

export default frilt;
