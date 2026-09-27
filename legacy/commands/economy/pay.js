const { cmd } = require('../command.cjs');
const { getUser, updateUser } = require('./economy-db');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'transfer',
  desc: 'Transfer coins to another user!',
  category: 'economy',
  filename: __filename,
}, async (conn, m, args, config) => {
  if (!args[0] || !args[1]) {
    return m.reply(boxWithFooter('ERROR', [{ raw: 'Usage: `.pay @user <amount>`. Transfer protocol requires target and amount.' }]));
  }

  let target = args[0].replace(/[@]/g, '') + '@s.whatsapp.net';
  const amount = parseInt(args[1]);

  if (isNaN(amount) || amount <= 0) {
    return m.reply(boxWithFooter('ERROR', [{ raw: 'Invalid amount detected. Transfer rejected. Please specify positive integer.' }]));
  }

  if (target === m.sender) {
    return m.reply(boxWithFooter('ERROR', [{ raw: 'Self-transfer detected. Cannot pay yourself.' }]));
  }

  const senderUser = getUser(m.sender);
  if (amount > (senderUser.coins || 0)) {
    return m.reply(boxWithFooter('ERROR', [
      { label: 'Available', value: `${senderUser.coins || 0} coins` },
      { raw: 'Transfer amount exceeds balance.' },
    ]));
  }

  const targetUser = getUser(target);

  senderUser.coins = (senderUser.coins || 0) - amount;
  senderUser.transactions = (senderUser.transactions || 0) + 1;
  updateUser(m.sender, senderUser);

  targetUser.coins = (targetUser.coins || 0) + amount;
  targetUser.transactions = (targetUser.transactions || 0) + 1;
  updateUser(target, targetUser);

  m.reply(boxWithFooter('TRANSFER COMPLETE', [
    { label: 'Sent', value: `${amount} coins to @${target.split('@')[0]}` },
    { label: 'Your Balance', value: `${senderUser.coins} coins` },
  ]));
});
