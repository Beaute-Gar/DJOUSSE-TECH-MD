import config from '../config.cjs';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const ping = async (m, sock) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';

  if (cmd === "ping") {
    const start = Date.now();
    await m.React('ðŸ“');
    const end = Date.now();
    const pingTime = end - start;

    const result = `ðŸ“ Pong!\nâ±ï¸ ${pingTime}ms`;

    await sock.sendMessage(m.from, { text: result }, { quoted: m });
  }
};

export default ping;

