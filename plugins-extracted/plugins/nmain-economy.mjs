import config from '../config.cjs';

const economyData = {};
const lastClaimedDaily = {};
const bankData = {};
const goldData = {};

const checkUserAccount = (userId) => {
  if (!economyData[userId]) economyData[userId] = { balance: 0 };
  if (!bankData[userId]) bankData[userId] = { balance: 0 };
  if (!goldData[userId]) goldData[userId] = { balance: 0 };
};

const sendReply = (m, message) => m.reply(message);

const formatCurrency = (amount) => `$${amount.toLocaleString()}`;

// Wallet Command
const showWallet = (m) => {
  const userId = m.sender;
  checkUserAccount(userId);

  const wallet = formatCurrency(economyData[userId].balance);
  const bank = formatCurrency(bankData[userId].balance);
  const gold = goldData[userId].balance;

  sendReply(m, `â•­â”€â”€â”€ã€” á´¡á´€ÊŸÊŸá´‡á´› ã€•â”€â”€â”€â•®\n` +
    `â”‚ ðŸ’µ Wallet: ${wallet}\n` +
    `â”‚ ðŸ¦ Bank: ${bank}\n` +
    `â”‚ âœ¨ Gold: ${gold}G\n` +
    `â•°â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•¯\n\ná´˜á´á´¡á´‡Ê€á´‡á´… Ê™Ê DJOUSSSE`);
};

// Gold Commands
const checkGold = (m) => {
  const userId = m.sender;
  checkUserAccount(userId);

  const gold = goldData[userId].balance;
  sendReply(m, `âœ¨ Êá´á´œÊ€ É¢á´ÊŸá´… Ê™á´€ÊŸá´€É´á´„á´‡: ${gold}G\n\ná´˜á´á´¡á´‡Ê€á´‡á´… Ê™Ê DJOUSSSE`);
};

const earnGold = (m, amount) => {
  const userId = m.sender;
  checkUserAccount(userId);

  if (amount <= 0) return sendReply(m, "âŒ á´‡É´á´›á´‡Ê€ á´€ á´˜á´sÉªá´›Éªá´ á´‡ É¢á´ÊŸá´… á´€á´á´á´œÉ´á´›.");
  
  goldData[userId].balance += amount;
  sendReply(m, `âš¡ Êá´á´œ á´‡á´€Ê€É´á´‡á´… ${amount}G É¢á´ÊŸá´…!\ná´›á´á´›á´€ÊŸ: ${goldData[userId].balance}G\n\ná´˜á´á´¡á´‡Ê€á´‡á´… Ê™Ê DJOUSSSE`);
};

// Balance Command
const checkBalance = (m) => {
  const userId = m.sender;
  checkUserAccount(userId);
  sendReply(m, `â•”â•â•â•â•â—‡\nâ•‘ *DJOUSSE-TECH-MD ECONOMY*\nâ•‘ ðŸ’µ *Balance:* ${formatCurrency(economyData[userId].balance)}\nâ•‘ ðŸ¥³ Enjoy!\nâ•šâ•â•â•â•â•â•â•â•â•â•â•â•â•\n\ná´˜á´á´¡á´‡Ê€á´‡á´… Ê™Ê DJOUSSSE`);
};

// Earn Money
const earnMoney = (m, amount) => {
  const userId = m.sender;
  checkUserAccount(userId);

  if (amount <= 0) return sendReply(m, "âŒ Please provide a valid positive amount.");

  economyData[userId].balance += amount;
  sendReply(m, `âœ… You earned ${formatCurrency(amount)}!\nðŸ’° New Balance: ${formatCurrency(economyData[userId].balance)}\n\ná´˜á´á´¡á´‡Ê€á´‡á´… Ê™Ê DJOUSSSE`);
};

// Spend
const spendMoney = (m, amount) => {
  const userId = m.sender;
  checkUserAccount(userId);

  if (amount <= 0) return sendReply(m, "âŒ Provide a valid amount.");
  if (economyData[userId].balance < amount) return sendReply(m, `ðŸš« Not enough funds. Balance: ${formatCurrency(economyData[userId].balance)}`);

  economyData[userId].balance -= amount;
  sendReply(m, `ðŸ§¾ You spent ${formatCurrency(amount)}.\nðŸ’° New Balance: ${formatCurrency(economyData[userId].balance)}\n\ná´˜á´á´¡á´‡Ê€á´‡á´… Ê™Ê DJOUSSSE`);
};

// Deposit
const depositMoney = (m, amount) => {
  const userId = m.sender;
  checkUserAccount(userId);

  if (amount <= 0 || economyData[userId].balance < amount) return sendReply(m, "âŒ Insufficient wallet balance.");

  economyData[userId].balance -= amount;
  bankData[userId].balance += amount;

  sendReply(m, `ðŸ¦ Deposited ${formatCurrency(amount)} to bank.\nðŸ’¼ New Wallet: ${formatCurrency(economyData[userId].balance)}\n\ná´˜á´á´¡á´‡Ê€á´‡á´… Ê™Ê DJOUSSSE`);
};

// Withdraw
const withdrawMoney = (m, amount) => {
  const userId = m.sender;
  checkUserAccount(userId);

  if (amount <= 0 || bankData[userId].balance < amount) return sendReply(m, "âŒ Not enough bank balance.");

  bankData[userId].balance -= amount;
  economyData[userId].balance += amount;

  sendReply(m, `ðŸ’¸ Withdrawn ${formatCurrency(amount)} from bank.\nðŸ’¼ Wallet: ${formatCurrency(economyData[userId].balance)}\n\ná´˜á´á´¡á´‡Ê€á´‡á´… Ê™Ê DJOUSSSE`);
};

// Transfer
const transferMoney = (m, amount, recipientId) => {
  const userId = m.sender;
  checkUserAccount(userId);
  checkUserAccount(recipientId);

  if (amount <= 0 || economyData[userId].balance < amount) return sendReply(m, `âŒ Invalid amount or insufficient funds.`);

  economyData[userId].balance -= amount;
  economyData[recipientId].balance += amount;

  sendReply(m, `ðŸ¤ Transferred ${formatCurrency(amount)} to ${recipientId}.\nðŸª™ New Balance: ${formatCurrency(economyData[userId].balance)}\n\ná´˜á´á´¡á´‡Ê€á´‡á´… Ê™Ê DJOUSSSE`);
};

// Daily Reward
const claimDaily = (m) => {
  const userId = m.sender;
  checkUserAccount(userId);

  const now = Date.now();
  const lastClaim = lastClaimedDaily[userId] || 0;
  const timeSince = now - lastClaim;

  if (timeSince < 86400000) {
    const remaining = 86400000 - timeSince;
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    return sendReply(m, `â³ Wait ${hours}h ${minutes}m to claim again.`);
  }

  const reward = 100;
  economyData[userId].balance += reward;
  lastClaimedDaily[userId] = now;

  sendReply(m, `ðŸŽ Daily reward: ${formatCurrency(reward)}\nðŸ’° New Balance: ${formatCurrency(economyData[userId].balance)}\n\ná´˜á´á´¡á´‡Ê€á´‡á´… Ê™Ê DJOUSSSE`);
};

// Leaderboard
const showLeaderboard = (m) => {
  const sorted = Object.entries(economyData).sort(([, a], [, b]) => b.balance - a.balance).slice(0, 5);
  if (sorted.length === 0) return sendReply(m, "No data yet.");

  const board = sorted.map(([uid, { balance }], i) => `${i + 1}. ${uid}: ${formatCurrency(balance)}`).join("\n");
  sendReply(m, `ðŸ† á´›á´á´˜ 5 á´œsá´‡Ê€s:\n${board}\n\ná´˜á´á´¡á´‡Ê€á´‡á´… Ê™Ê DJOUSSSE`);
};

// Command handler
const economy = async (m, gss) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
  const text = m.body.slice(prefix.length + cmd.length).trim();

  // Group command check
  if (!m.isGroup && ['balance', 'earn', 'spend', 'deposit', 'withdraw', 'transfer', 'daily', 'leaderboard', 'wallet', 'gold', 'earngold'].includes(cmd)) {
    return sendReply(m, "âŒ This is a group-only command.");
  }

  if (cmd === 'balance') return checkBalance(m);
  if (cmd === 'earn' && text) return earnMoney(m, parseInt(text));
  if (cmd === 'spend' && text) return spendMoney(m, parseInt(text));
  if (cmd === 'deposit' && text) return depositMoney(m, parseInt(text));
  if (cmd === 'withdraw' && text) return withdrawMoney(m, parseInt(text));
  if (cmd === 'transfer' && text) {
    const [to, amountStr] = text.split(' ');
    return transferMoney(m, parseInt(amountStr), to);
  }
  if (cmd === 'daily') return claimDaily(m);
  if (cmd === 'leaderboard') return showLeaderboard(m);
  if (cmd === 'wallet') return showWallet(m);
  if (cmd === 'gold') return checkGold(m);
  if (cmd === 'earngold' && text) return earnGold(m, parseInt(text));
};

export default economy;

