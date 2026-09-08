import config from '../config.cjs';

const acceptAll = async (m, gss) => {
  try {
    const botNumber = await gss.decodeJid(gss.user.id);
    const prefix = config.PREFIX;
    const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
    const validCommands = ['acceptall', 'acpt', 'accepter'];

    if (!validCommands.includes(cmd)) return;

    if (!m.isGroup) return m.reply("É¢Ê€á´á´œá´˜ á´„á´á´á´á´€É´á´… á´É´ÊŸÊ");

    const groupMetadata = await gss.groupMetadata(m.from);
    const groupName = groupMetadata.subject;
    const participants = groupMetadata.participants;
    const botAdmin = participants.find(p => p.id === botNumber)?.admin;

    if (!botAdmin) return m.reply("âš ï¸ Éª á´€á´ É´á´á´› á´€É´ á´€á´…á´ÉªÉ´ ÉªÉ´ á´›ÊœÉªs É¢Ê€á´á´œá´˜");

    const sender = m.sender;
    const isOwner = sender === config.OWNER_NUMBER + '@s.whatsapp.net';
    const isSudo = config.SUDO?.includes(sender);
    const isGroupAdmin = participants.find(p => p.id === sender)?.admin;

    if (!isOwner && !isSudo && !isGroupAdmin) {
      return m.reply("Êá´á´œ á´€Ê€á´‡ É´á´á´› á´€É´ á´€á´…á´ÉªÉ´");
    }

    if (!groupMetadata.pendingParticipants || groupMetadata.pendingParticipants.length === 0) {
      return m.reply("âœ… É´á´ á´˜á´‡É´á´…ÉªÉ´É¢ ÉªÉ´á´ Éªá´›á´‡ Ê€á´‡Qá´œá´‡sá´›s Ò“á´á´œÉ´á´…");
    }

    const acceptedNames = [];

    for (const pending of groupMetadata.pendingParticipants) {
      await gss.groupParticipantsUpdate(m.from, [pending.id], 'add')
        .then(() => {
          acceptedNames.push(pending.id.split('@')[0]);
        })
        .catch((e) => {
          console.log(`Failed to accept ${pending.id}:`, e);
        });
    }

    if (acceptedNames.length > 0) {
      m.reply(`âœ… *${acceptedNames.length} Member(s) Accepted to Group:*\n\nðŸ‘¥ Group: *${groupName}*\nðŸ‘¤ Members:\n${acceptedNames.map(n => `- @${n}`).join('\n')}`, {
        mentions: acceptedNames.map(n => n + '@s.whatsapp.net')
      });
    } else {
      m.reply("âš ï¸ É´á´ á´á´‡á´Ê™á´‡Ê€ á´„á´á´œÊŸá´… Ê™á´‡ á´€á´„á´„á´‡á´˜á´›á´‡á´…");
    }

  } catch (err) {
    console.error('AcceptAll Error:', err);
    m.reply("âŒ An error occurred while accepting pending invites.");
  }
};

export default acceptAll;

