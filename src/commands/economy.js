import { ensureEconomy, getEconomy, addCoins, removeCoins, transferCoins, setLastDaily, getRichList, rawRun } from '../lib/database.js';
import { jidToNumber, numberToJid, formatNumber } from '../lib/utils.js';

export const name = 'economy';
export const aliases = ['eco', 'wallet', 'solde'];
export const category = 'Économie';
export const desc = 'Gère ton portefeuille de DTE Coins.';
export const usage = '.economy [solde|give|depot|retrait|top|daily]';
export const cooldown = 2;

const DAILY_AMOUNT = 500;
const DAILY_COOLDOWN = 86400;
const COIN = '🪙';
const BANK = '🏦';

export async function handler(m, ctx) {
  const { args, senderJid } = ctx;
  const sub = args[0]?.toLowerCase() || 'solde';

  ensureEconomy(senderJid);

  switch (sub) {
    case 'solde': case 'balance': case 'bal': return _solde(m, senderJid);
    case 'depot': case 'deposit': case 'dep': return _depot(m, senderJid, args[1]);
    case 'retrait': case 'withdraw': case 'ret': return _retrait(m, senderJid, args[1]);
    case 'give': case 'send': case 'transfert': return _transfert(m, ctx, args[1], args[2]);
    case 'top': case 'richlist': case 'classement': return _richList(m);
    case 'daily': case 'journalier': return _daily(m, senderJid);
    default:
      return m.reply(`${COIN} *DTE Economy*\n\nSous-commandes:\n▸ .eco solde\n▸ .eco depot <montant>\n▸ .eco retrait <montant>\n▸ .eco give @user <montant>\n▸ .eco top\n▸ .eco daily`);
  }
}

async function _solde(m, jid) {
  const eco = getEconomy(jid);
  const total = (eco.money || 0) + (eco.bank || 0);
  await m.reply(`${COIN} *Portefeuille*\n\n👤 ${m.pushName || ''}\n${COIN} Portefeuille: *${formatNumber(eco.money || 0)}*\n${BANK} Banque: *${formatNumber(eco.bank || 0)}*\n💰 Total: *${formatNumber(total)}*`);
}

async function _depot(m, jid, amountStr) {
  const amount = _parseAmount(amountStr);
  if (!amount) return m.reply('❌ Montant invalide.');
  const eco = getEconomy(jid);
  if ((eco.money || 0) < amount) return m.reply(`❌ Solde insuffisant. Tu as ${formatNumber(eco.money || 0)}.`);
  removeCoins(jid, amount);
  rawRun('UPDATE economy SET bank = bank + ? WHERE jid = ?', amount, jid);
  await m.reply(`${BANK} ${formatNumber(amount)} déposés !`);
}

async function _retrait(m, jid, amountStr) {
  const amount = _parseAmount(amountStr);
  if (!amount) return m.reply('❌ Montant invalide.');
  const eco = getEconomy(jid);
  if ((eco.bank || 0) < amount) return m.reply(`❌ Solde banque insuffisant.`);
  rawRun('UPDATE economy SET bank = MAX(0, bank - ?) WHERE jid = ?', amount, jid);
  addCoins(jid, amount);
  await m.reply(`${COIN} ${formatNumber(amount)} retirés !`);
}

async function _transfert(m, ctx, targetArg, amountStr) {
  const amount = _parseAmount(amountStr);
  if (!amount) return m.reply('❌ Usage: .eco give @user <montant>');
  let targetJid = ctx.mentionedJid?.[0];
  if (!targetJid && targetArg) {
    const num = targetArg.replace(/\D/g, '');
    if (num.length >= 9) targetJid = numberToJid(num);
  }
  if (!targetJid) return m.reply('❌ Mentionne ou donne le numéro.');
  if (targetJid === ctx.senderJid) return m.reply('😅 À toi-même ?');
  try {
    transferCoins(ctx.senderJid, targetJid, amount);
    await m.reply(`${COIN} ${formatNumber(amount)} envoyés à +${jidToNumber(targetJid)}`);
  } catch (err) {
    await m.reply(`❌ ${err.message}`);
  }
}

async function _richList(m) {
  const list = getRichList(10);
  if (!list.length) return m.reply('📊 Aucun utilisateur.');
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  let text = `🏆 *Top Richesses*\n\n`;
  list.forEach((row, i) => {
    const num = jidToNumber(row.jid);
    text += `${medals[i] || `${i+1}.`} ${num ? '+' + num.substring(0, 6) + '***' : 'Inconnu'} — ${formatNumber(row.total)} coins\n`;
  });
  await m.reply(text);
}

async function _daily(m, jid) {
  const eco = getEconomy(jid);
  const now = Math.floor(Date.now() / 1000);
  const diff = now - (eco.last_daily || 0);
  if (diff < DAILY_COOLDOWN) {
    const h = Math.floor((DAILY_COOLDOWN - diff) / 3600);
    const min = Math.floor(((DAILY_COOLDOWN - diff) % 3600) / 60);
    return m.reply(`⏳ Reviens dans ${h}h ${min}min.`);
  }
  const bonus = Math.floor(Math.random() * 200);
  const total = DAILY_AMOUNT + bonus;
  addCoins(jid, total);
  setLastDaily(jid, now);
  await m.reply(`🎁 *Récompense quotidienne*\n\n${COIN} +${formatNumber(DAILY_AMOUNT)} (base)\n✨ +${formatNumber(bonus)} (bonus)\n💰 Total: ${formatNumber(total)}`);
}

function _parseAmount(str) {
  if (!str) return 0;
  const n = parseInt(str.replace(/[^\d]/g, ''), 10);
  return isNaN(n) || n <= 0 ? 0 : n;
}
