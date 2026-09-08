const alive = async (m, sock) => {
  try {
    const prefix = '.'; // adapte si tu changes de prÃ©fixe
    const body = m.body || '';
    const cmd = body.startsWith(prefix) ? body.slice(prefix.length).split(' ')[0].toLowerCase() : body.trim().toLowerCase();

    // ExÃ©cuter seulement si le message est exactement "alive" ou "inconnu"
    if (cmd !== 'alive' && cmd !== 'inconnu') return;

    const aliveText = `
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
*DJOUSSE-TECH-MD IS ACTIVE* 
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

âœ… Bot: *ONLINE*
ðŸ“… Date: ${new Date().toLocaleDateString('en-GB')}
ðŸ•’ Time: ${new Date().toLocaleTimeString('en-GB')}
ðŸ‘¤ User: @${m.sender.split('@')[0]}
ðŸ’» Version: 2.0.0

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
    `;

    const profilePictureUrl = "../../media/djousse.jpg";

    await sock.sendMessage(m.from, {
      image: { url: profilePictureUrl },
      caption: aliveText.trim(),
      contextInfo: {
        forwardingScore: 5,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterName: "DJOUSSE-TECH-MD",
          newsletterJid: "120363397722863547@newsletter",
        },
        mentionedJid: [m.sender],
      },
    }, { quoted: m });

  } catch (err) {
    console.error("[ALIVE ERROR]:", err.message);
  }
};

export default alive;


