/* eslint-disable */
/* Converti depuis N-main: nmain-autotyping.mjs */
/* Plugin converti automatiquement — 2026-09-05T23:33:26.960Z */

const { cmd } = require('../command.cjs');
const config = require('../config.cjs');



const autotypingCommand = async (m, Matrix) => {
  const botNumber = await Matrix.decodeJid(Matrix.user.id);
  const isCreator = [botNumber, config.OWNER_NUMBER + '@s.whatsapp.net'].includes(m.sender);
  const prefix = config.PREFIX;
const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
const text = m.body.slice(prefix.length + cmd.length).trim();

  if (cmd === 'autotyping') {
    if (!isCreator) return m.reply("*ðŸ“› THIS IS AN OWNER COMMAND*");
    let responseMessage;

    if (text === 'on') {
      config.AUTO_TYPING = true;
      responseMessage = "Auto-Typing has been enabled.";
    } else if (text === 'off') {
      config.AUTO_TYPING = false;
      responseMessage = "Auto-Typing has been disabled.";
    } else {
      responseMessage = "Usage:\n- `autotyping on`: Enable Auto-Typing\n- `autotyping off`: Disable Auto-Typing";
    }

    try {
      await Matrix.sendMessage(m.from, { text: responseMessage }, { quoted: m });
    } catch (error) {
      console.error("Error processing your request:", error);
      await Matrix.sendMessage(m.from, { text: 'Error processing your request.' }, { quoted: m });
    }
  }
};




cmd({
  pattern: 'autotypingcommand',
  desc: 'Plugin N-main converti: autotypingCommand',
  category: 'converted',
  filename: __filename,
}, async (conn, m) => {
  const sock = conn;
  await autotypingCommand(m, sock);
});