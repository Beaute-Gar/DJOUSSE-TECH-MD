import config from '../config.cjs';

const images = {
  default: 'https://files.catbox.moe/e1k73u.jpg'
};

const messages = {
  love: (name) => `
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”“
â”ƒ â¤ï¸  *A Little Love*  â¤ï¸ 
â”ƒ                       
â”ƒ Hey *${name}*,           
â”ƒ Here's some warmth ðŸ’•  
â”ƒ to brighten your day!   
â”ƒ                       
â”ƒ Stay amazing! âœ¨         
â”—â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”›
`.trim(),

  goodmorning: (name) => `
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”“
â”ƒ â˜€ï¸  *Good Morning!*  â˜€ï¸ 
â”ƒ                        
â”ƒ Rise and shine, *${name}*!
â”ƒ May your day be filled   
â”ƒ with joy and good vibes! 
â”ƒ                        
â”ƒ Have a wonderful day!    
â”—â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”›
`.trim(),

  goodnight: (name) => `
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”“
â”ƒ ðŸŒ™  *Good Night*  ðŸŒ™ 
â”ƒ                       
â”ƒ Sweet dreams, *${name}*! 
â”ƒ May your sleep be calm  
â”ƒ and your rest peaceful. 
â”ƒ                       
â”ƒ See you tomorrow! âœ¨    
â”—â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”›
`.trim(),
};

const personality = async (m, sock) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix)
    ? m.body.slice(prefix.length).split(' ')[0].toLowerCase()
    : '';
  const senderName = m.pushName || 'User';

  if (!['love', 'goodmorning', 'goodnight'].includes(cmd)) return;

  const caption = messages[cmd](senderName);

  await sock.sendMessage(m.from, {
    image: { url: images.default },
    caption,
    contextInfo: {
      forwardingScore: 5,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterName: 'DJOUSSE-TECH-MD',
        newsletterJid: '120363397722863547@newsletter',
      },
    },
  }, { quoted: m });
};

export default personality;

