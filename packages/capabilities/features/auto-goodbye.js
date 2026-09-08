const goodbyeMessages = new Map();

export function enableAutoGoodbye(sock) {
  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    if (action !== 'remove') return;
    for (const jid of participants) {
      const delay = Math.floor(Math.random() * 3000) + 2000;
      await new Promise(r => setTimeout(r, delay));
      const custom = goodbyeMessages.get(id) || 'Au revoir @user !';
      const msg = custom.replace(/@user/g, '@' + jid.split('@')[0]);
      await sock.sendMessage(id, { text: msg, mentions: [jid] });
    }
  });
}

export function setGoodbyeMessage(groupId, msg) {
  goodbyeMessages.set(groupId, msg);
}
