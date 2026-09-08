import config from '../config.cjs';

const acceptAll = async (m, gss) => {
  try {
    const botNumber = await gss.decodeJid(gss.user.id);
    const prefix = config.PREFIX;
    const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
    const validCommands = ['acceptall', 'acpt', 'accepter'];

    if (!validCommands.includes(cmd)) return;

    if (!m.isGroup) return m.reply("ɢʀᴏᴜᴘ ᴄᴏᴍᴍᴀɴᴅ ᴏɴʟʏ");

    const groupMetadata = await gss.groupMetadata(m.from);
    const groupName = groupMetadata.subject;
    const participants = groupMetadata.participants;
    const botAdmin = participants.find(p => p.id === botNumber)?.admin;

    if (!botAdmin) return m.reply("⚠️ ɪ ᴀᴍ ɴᴏᴛ ᴀɴ ᴀᴅᴍɪɴ ɪɴ ᴛʜɪs ɢʀᴏᴜᴘ");

    const sender = m.sender;
    const isOwner = sender === config.OWNER_NUMBER + '@s.whatsapp.net';
    const isSudo = config.SUDO?.includes(sender);
    const isGroupAdmin = participants.find(p => p.id === sender)?.admin;

    if (!isOwner && !isSudo && !isGroupAdmin) {
      return m.reply("ʏᴏᴜ ᴀʀᴇ ɴᴏᴛ ᴀɴ ᴀᴅᴍɪɴ");
    }

    if (!groupMetadata.pendingParticipants || groupMetadata.pendingParticipants.length === 0) {
      return m.reply("✅ ɴᴏ ᴘᴇɴᴅɪɴɢ ɪɴᴠɪᴛᴇ ʀᴇQᴜᴇsᴛs ғᴏᴜɴᴅ");
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
      m.reply(`✅ *${acceptedNames.length} Member(s) Accepted to Group:*\n\n👥 Group: *${groupName}*\n👤 Members:\n${acceptedNames.map(n => `- @${n}`).join('\n')}`, {
        mentions: acceptedNames.map(n => n + '@s.whatsapp.net')
      });
    } else {
      m.reply("⚠️ ɴᴏ ᴍᴇᴍʙᴇʀ ᴄᴏᴜʟᴅ ʙᴇ ᴀᴄᴄᴇᴘᴛᴇᴅ");
    }

  } catch (err) {
    console.error('AcceptAll Error:', err);
    m.reply("❌ An error occurred while accepting pending invites.");
  }
};

export default acceptAll;
