import fs from 'fs';
import config from '../config.cjs';

const economyFile = './mydata/economy.json';

function loadEconomy() {
  try {
    if (fs.existsSync(economyFile)) {
      return JSON.parse(fs.readFileSync(economyFile, 'utf8'));
    }
  } catch {}
  return {};
}

function saveEconomy(data) {
  fs.writeFileSync(economyFile, JSON.stringify(data, null, 2));
}

const economy = async (m, gss) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
  const args = m.body.slice(prefix.length + cmd.length).trim().split(' ');
  const sender = m.sender;

  if (!['balance', 'daily', 'work', 'leaderboard', 'pay'].includes(cmd)) return;

  const data = loadEconomy();
  if (!data[sender]) data[sender] = { money: 0, lastDaily: 0, lastWork: 0 };

  if (cmd === 'balance') {
    const bal = data[sender].money;
    return m.reply(`💰 *Your Balance:* ${bal} coins`);
  }

  if (cmd === 'daily') {
    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000;
    if (now - data[sender].lastDaily < cooldown) {
      const remaining = cooldown - (now - data[sender].lastDaily);
      const hours = Math.floor(remaining / 3600000);
      const mins = Math.floor((remaining % 3600000) / 60000);
      return m.reply(`⏰ You already claimed daily!\nWait ${hours}h ${mins}m`);
    }
    const reward = Math.floor(Math.random() * 500) + 100;
    data[sender].money += reward;
    data[sender].lastDaily = now;
    saveEconomy(data);
    return m.reply(`✅ *Daily claimed!*\n💰 +${reward} coins\n📊 Total: ${data[sender].money}`);
  }

  if (cmd === 'work') {
    const now = Date.now();
    const cooldown = 60 * 60 * 1000;
    if (now - data[sender].lastWork < cooldown) {
      const remaining = cooldown - (now - data[sender].lastWork);
      const mins = Math.floor(remaining / 60000);
      return m.reply(`⏰ Wait ${mins}m before working again!`);
    }
    const jobs = ['programmer', 'designer', 'writer', 'chef', 'driver'];
    const job = jobs[Math.floor(Math.random() * jobs.length)];
    const reward = Math.floor(Math.random() * 300) + 50;
    data[sender].money += reward;
    data[sender].lastWork = now;
    saveEconomy(data);
    return m.reply(`💼 *Worked as ${job}!*\n💰 +${reward} coins\n📊 Total: ${data[sender].money}`);
  }

  if (cmd === 'leaderboard') {
    const sorted = Object.entries(data)
      .sort(([, a], [, b]) => b.money - a.money)
      .slice(0, 10);
    let text = '🏆 *ECONOMY LEADERBOARD*\n\n';
    sorted.forEach(([jid, info], i) => {
      const num = jid.split('@')[0];
      text += `${i + 1}. @${num} — ${info.money} coins\n`;
    });
    const mentions = sorted.map(([jid]) => jid);
    return m.reply(text, m.from, { mentions });
  }

  if (cmd === 'pay') {
    const amount = parseInt(args[0]);
    const target = args[1]?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    if (!amount || !target || isNaN(amount) || amount <= 0) {
      return m.reply(`Usage: ${prefix}pay <amount> @user`);
    }
    if (data[sender].money < amount) {
      return m.reply(`❌ Not enough coins! You have ${data[sender].money}`);
    }
    if (!data[target]) data[target] = { money: 0, lastDaily: 0, lastWork: 0 };
    data[sender].money -= amount;
    data[target].money += amount;
    saveEconomy(data);
    return m.reply(`✅ Paid ${amount} coins to @${target.split('@')[0]}`);
  }
};

export default economy;
