import config from '../config.cjs';

const relationshipDares = [
  "ðŸ’Œ Tell me one secret you've never told anyone.",
  "ðŸ˜˜ Send a cute selfie with a kiss face.",
  "ðŸ’ Propose to me like it's real.",
  "ðŸŽµ Dedicate a romantic song to me now.",
  "ðŸ’¬ Type 'I love you' in 3 different styles.",
  "ðŸ“± Share the last photo in your gallery.",
  "ðŸ«‚ Describe how you'd cuddle me in detail.",
  "ðŸ›ï¸ Describe your dream date night with me.",
  "ðŸ‘€ Send me an 'I miss you' voice note.",
  "ðŸŽ­ Act like you're mad at me for 30 seconds.",
  "ðŸ‘„ Send a kiss emoji combo of your choice.",
  "â¤ï¸ Tell me what you like most about me.",
  "ðŸ“ Write a 3-line romantic poem about us.",
  "ðŸ¥º Say something sweet and emotional to make me blush.",
  "ðŸ‘« Use an emoji to represent our relationship.",
  "â° Set my name as your status for 1 hour.",
  "ðŸ“¸ Recreate one of my selfies and send it.",
  "ðŸ“ž Call me by a cute nickname right now.",
  "ðŸŒ¹ Send a virtual rose with a flirty message.",
  "ðŸŽ² Describe your wildest romantic fantasy with me."
];

const dareCommand = async (m, sock) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix)
    ? m.body.slice(prefix.length).split(" ")[0].toLowerCase()
    : '';
  if (cmd !== 'dare') return;

  const dare = relationshipDares[Math.floor(Math.random() * relationshipDares.length)];

  const formatted = `
â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
â•‘  *R E L A T I O N S H I P   D A R E* ðŸ’–
â• â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
â•‘                            
â•‘ ðŸ’Œ Dare:                   
â•‘ âž¥ ${dare}                 
â•‘                            
â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
â³ *Do it now or you're scared ðŸ˜*
`.trim();

  await sock.sendMessage(m.from, {
    text: formatted,
    contextInfo: {
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterName: "DJOUSSE-TECH-MD",
        newsletterJid: "120363397722863547@newsletter",
      },
    },
  });
};

export default dareCommand;

