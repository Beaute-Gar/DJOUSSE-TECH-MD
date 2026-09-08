const thanksCommand = async (m, Matrix) => {
    const prefix = "."; // Change this if your bot uses a different prefix
    const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(" ")[0].toLowerCase() : '';

    const validCommands = ['thanks', 'thanksto', 'dev'];
    if (!validCommands.includes(cmd)) return;

    await m.React('ðŸ‘¤');

    const message = `
â•­â”€â *DEVELOPER:*
â”‚ðŸ‘¨â€ðŸ’» DEV : *Â©DJOUSSSE*
â”‚ðŸ‘¨â€ðŸ’» NUM : +237693978044
â”‚â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
â”‚ðŸ› ï¸ BOT: *DJOUSSE-TECH-MD*
â”‚â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
â”‚ðŸ™‹â€â™‚ï¸ HELLO @${m.sender.split("@")[0]}
â•°â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â
`;

    try {
        await Matrix.sendMessage(m.from, {
            image: { url: '../../media/djousse.jpg' },
            caption: message,
            contextInfo: {
                mentionedJid: [m.sender],
                forwardingScore: 1000,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363397722863547@newsletter', // optional
                    newsletterName: 'DJOUSSE-TECH-MD',
                    serverMessageId: 143
                }
            }
        }, { quoted: m });

        await m.React("âœ…");
    } catch (err) {
        console.error("Thanks Command Error:", err);
        await Matrix.sendMessage(m.from, { text: `Error: ${err.message}` }, { quoted: m });
        await m.React("âŒ");
    }
};

export default thanksCommand;


