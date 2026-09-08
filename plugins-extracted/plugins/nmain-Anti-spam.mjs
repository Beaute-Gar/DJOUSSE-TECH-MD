import config from '../config.cjs';

const spamData = {
  mode: 'off', // warn, kick, or off
  warns: {}, // { groupId: { userId: warnCount } }
  history: {}, // { groupId: { userId: [timestamps] } }
  limit: 5, // messages dans 5 secondes
};

const antispamCommand = async (m, Matrix) => {
  const prefix = config.PREFIX;
  const isOwner = [Matrix.decodeJid(Matrix.user.id), config.OWNER_NUMBER + '@s.whatsapp.net'].includes(m.sender);
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
  const args = m.body.trim().split(/\s+/).slice(1);
  const groupId = m.from;

  if (cmd !== 'antispam') return;

  // Seul le owner peut modifier
  if (args.length === 0) {
    const statusText = `ðŸ“Š *ANTI-SPAM STATUS*\n\n` +
      `ðŸ”˜ Mode: ${spamData.mode === 'off' ? 'ðŸ”´ OFF' : spamData.mode === 'warn' ? 'ðŸŸ¡ WARN' : 'ðŸ”º KICK'}\n` +
      `ðŸ§¨ Trigger: ${spamData.limit} messages / 5 sec\n` +
      `ðŸŽ¯ Action: ${spamData.mode === 'warn' ? '3 Warnings = Kick' : spamData.mode === 'kick' ? 'Direct Kick' : 'Disabled'}\n\n` +
      `> ðŸ‘‘ *MADE BY DJOUSSSE*`;

    return Matrix.sendMessage(groupId, { text: statusText }, { quoted: m });
  }

  if (!isOwner) return Matrix.sendMessage(groupId, { text: "ðŸš« *Owner only command!*" }, { quoted: m });

  const mode = args[0].toLowerCase();

  if (!['warn', 'kick', 'off'].includes(mode)) {
    return Matrix.sendMessage(groupId, {
      text:
        `âŒ *Invalid mode!*\n\n` +
        `ðŸ’¡ Usage:\n` +
        `â€¢ ${prefix}antispam warn â€” Warn + Kick at 3 warns\n` +
        `â€¢ ${prefix}antispam kick â€” Kick directly\n` +
        `â€¢ ${prefix}antispam off â€” Disable protection`
    }, { quoted: m });
  }

  spamData.mode = mode;
  spamData.warns[groupId] = {};
  spamData.history[groupId] = {};

  return Matrix.sendMessage(groupId, {
    text: `âœ… *Anti-Spam mode set to:* ${mode.toUpperCase()}`
  }, { quoted: m });
};

export default antispamCommand;

