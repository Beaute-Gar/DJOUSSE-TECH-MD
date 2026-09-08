import config from '../config.cjs';

const fancyStyles = [
  ['ð•­ð–”ð–“ð–ð–”ð–šð–—', 'Style 1'],
  ['ð“‘ð“¸ð“·ð“³ð“¸ð“¾ð“»', 'Style 2'],
  ['ðµð‘œð“ƒð’¿ð‘œð“Šð“‡', 'Style 3'],
  ['ð“‘ð¨ð§ð£ð¨ð®ð«', 'Style 4'],
  ['ð•“ÏƒÎ·ÊÏƒÊŠÑ', 'Style 5'],
  ['ð”…ð”¬ð”«ð”§ð”¬ð”²ð”¯', 'Style 6'],
  ['ðŸ„±ðŸ„¾ðŸ„½ðŸ„¹ðŸ„¾ðŸ…„ðŸ…', 'Style 7'],
  ['ðŸ…±ðŸ…¾ðŸ…½ðŸ…¹ðŸ…¾ðŸ†„ðŸ†', 'Style 8'],
  ['ðŸ…‘ðŸ…žðŸ…ðŸ…™ðŸ…žðŸ…¤ðŸ…¡', 'Style 9'],
  ['Ê™á´É´á´Šá´á´œÊ€', 'Style 10'],
  ['áµ‡áµ’â¿Ê²áµ’áµ˜Ê³', 'Style 11'],
  ['ï¼¢ï¼¯ï¼®ï¼ªï¼¯ï¼µï¼²', 'Style 12'],
  ['ð™±ð™¾ð™½ð™¹ð™¾ðš„ðš', 'Style 13'],
  ['ð–‡ð–”ð–“ð–ð–”ð–šð–—', 'Style 14'],
  ['ð’ƒð’ð’ð’‹ð’ð’–ð’“', 'Style 15'],
  ['ð™±ðš˜ðš—ðš“ðš˜ðšžðš›', 'Style 16'],
  ['ð‘©ð’ð’ð’‹ð’ð’–ð’“', 'Style 17'],
  ['ðŸ…‘ï¸ŽðŸ…žï¸ŽðŸ…ï¸ŽðŸ…™ï¸ŽðŸ…žï¸ŽðŸ…¤ï¸ŽðŸ…¡ï¸Ž', 'Style 18'],
  ['ï¼¢ï½ï½Žï½Šï½ï½•ï½’', 'Style 19'],
  ['Ð²ÏƒÐ¸× ÏƒÏ…Ñ', 'Style 20'],
  ['ð™—ð™¤ð™£ð™Ÿð™¤ð™ªð™§', 'Style 21'],
  ['ÆÏƒÉ²ÊÏƒÊ‹É¾', 'Style 22'],
  ['ðŸ„±ð“¸ð“·ð“³ð“¸ð“¾ð“»', 'Style 23'],
  ['ð“‘ð“¸ð“·ð“³ð“¸ð“¾ð“» â˜ï¸', 'Style 24'],
  ['âœ¿ ð’·â„´ð“ƒð’¿â„´ð“Šð“‡ âœ¿', 'Style 25'],
  ['â˜…å½¡ð“‘ð“¸ð“·ð“³ð“¸ð“¾ð“»å½¡â˜…', 'Style 26'],
  ['ðŸ“ ð“‘ð“¸ð“·ð“³ð“¸ð“¾ð“» ðŸ“', 'Style 27'],
  ['ðŸ¦‹ ð“‘ð“¸ð“·ð“³ð“¸ð“¾ð“» ðŸ¦‹', 'Style 28'],
  ['ðŸ–¤ ð’·â„´ð“ƒð’¿â„´ð“Šð“‡ ðŸ–¤', 'Style 29'],
  ['ðŸ‘‘ ð”…ð”¬ð”«ð”§ð”¬ð”²ð”¯ ðŸ‘‘', 'Style 30'],
];

const baseWord = 'bonjour';

function stylizeText(text, style) {
  const styleLetters = [...style];
  const baseLetters = [...baseWord];
  return [...text].map(char => {
    const lower = char.toLowerCase();
    const pos = baseLetters.indexOf(lower);
    if (pos !== -1) return styleLetters[pos] || char;
    return char;
  }).join('');
}

const fancy = async (m, sock) => {
  const prefix = config.PREFIX || '.';
  const body = m.body.trim();
  if (!body.startsWith(prefix)) return;

  const args = body.slice(prefix.length).split(/\s+/);
  const cmd = args.shift().toLowerCase();

  if (!['fancy', 'style'].includes(cmd)) return;

  let index = null;
  let text = '';

  if (args.length === 0 && m.quoted?.text) {
    // Pas d'arguments mais reply Ã  un message
    text = m.quoted.text;
  } else if (args.length === 0) {
    text = 'DJOUSSE-TECH-MD';
  } else if (!isNaN(args[0])) {
    index = parseInt(args[0]) - 1;
    text = args.slice(1).join(' ') || (m.quoted?.text || 'DJOUSSE-TECH-MD');
  } else {
    text = args.join(' ');
  }

  if (index !== null) {
    if (index < 0 || index >= fancyStyles.length) {
      return sock.sendMessage(m.from, {
        text: `âŒ Style number *${index + 1}* is not available. Choose between 1 and ${fancyStyles.length}.`,
      }, { quoted: m });
    }
    const [style, name] = fancyStyles[index];
    const styledText = stylizeText(text, style);

    return sock.sendMessage(m.from, {
      text: `ðŸŽ¨ *${name}*\n\n${styledText}\n\nðŸ‘‘ *MADE BY DJOUSSSE*`,
    }, { quoted: m });
  }

  // Si pas d'index, affiche tous les styles
  const allStyles = fancyStyles
    .map(([style, name], i) => `*${i + 1}.* ${stylizeText(text, style)}`)
    .join('\n\n');

  await sock.sendMessage(m.from, {
    text: `âœ¨ *Fancy Styles for:* _${text}_\n\n${allStyles}\n\nðŸ‘‘ *MADE BY DJOUSSSE*`,
  }, { quoted: m });
};

export default fancy;

