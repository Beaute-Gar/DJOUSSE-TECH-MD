const welcomeMessages = new Map();

export function enableAutoWelcome(sock) {
  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    if (action !== 'add') return;
    for (const jid of participants) {
      const delay = Math.floor(Math.random() * 4000) + 3000;
      await new Promise(r => setTimeout(r, delay));
      const custom = welcomeMessages.get(id) || 'Bienvenue @user !';
      const msg = custom.replace(/@user/g, '@' + jid.split('@')[0]);
      await sock.sendMessage(id, { text: msg, mentions: [jid] });
    }
  });
}

export function setWelcomeMessage(groupId, msg) {
  welcomeMessages.set(groupId, msg);
}
