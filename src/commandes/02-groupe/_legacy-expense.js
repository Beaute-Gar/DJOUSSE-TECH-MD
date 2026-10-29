'use strict';

const fs = require('fs');
const path = require('path');
const dataFile = path.join(require('../../config/paths').PLUGIN_DATA, 'expenses.json');

function loadExpenses() {
    try { return JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch { return {}; }
}
function saveExpenses(data) {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

module.exports = {
    commands: ['expense', 'expenses'],
    description: 'Group expense tracker and bill splitter (like Splitwise)',
    usage: '.expense add 500 Dinner | .expense split 1200 3 Uber | .expense balances | .expense list',
    permission: 'public',
    group: true,
    private: false,

    run: async (sock, message, args, ctx) => {
        const { jid, sender, contextInfo } = ctx;

        let rawCmd = (message.message?.extendedTextMessage?.text
            || message.message?.conversation || '').trim().split(/\s+/)[0].replace(/^\./, '').toLowerCase();
        if (rawCmd === 'expense' || rawCmd === 'expenses') {
            const actions = {
                add: 'addexpense',
                split: 'splitbill',
                settle: 'settle',
                clear: 'clearexpenses',
                balances: 'balances',
                list: 'expense',
            };
            const action = String(args[0] || '').toLowerCase();
            if (actions[action]) {
                rawCmd = actions[action];
                args = args.slice(1);
            } else {
                if (action) {
                    return sock.sendMessage(jid, {
                        text: 'Usage : `.expense add|list|balances|split|settle|clear`.',
                        contextInfo
                    }, { quoted: message });
                }
                rawCmd = 'expense';
            }
        }

        const expenses = loadExpenses();
        if (!expenses[jid]) expenses[jid] = { entries: [], currency: 'KES' };
        const group = expenses[jid];

        if (rawCmd === 'clearexpenses') {
            group.entries = [];
            saveExpenses(expenses);
            return sock.sendMessage(jid, { text: '🗑️ *All expenses cleared.*', contextInfo }, { quoted: message });
        }

        if (rawCmd === 'addexpense') {
            const amount = parseFloat(args[0]);
            if (isNaN(amount) || amount <= 0) {
                return sock.sendMessage(jid, {
                    text: '❌ *Usage:* `.expense add <amount> <description>`\n\n*Example:* `.expense add 500 Lunch at Java`',
                    contextInfo
                }, { quoted: message });
            }

            const desc = args.slice(1).join(' ').trim() || 'Expense';
            const num = sender.split('@')[0];

            group.entries.push({
                amount,
                description: desc,
                paidBy: sender,
                paidByNum: num,
                timestamp: Date.now(),
                type: 'expense'
            });
            saveExpenses(expenses);

            const total = group.entries.reduce((s, e) => s + e.amount, 0);

            return sock.sendMessage(jid, {
                text: `💰 *Expense Added!*\n\n💵 *Amount:* ${group.currency} ${amount.toLocaleString()}\n📝 *Description:* ${desc}\n👤 *Paid by:* @${num}\n\n📊 *Group Total:* ${group.currency} ${total.toLocaleString()}`,
                mentions: [sender],
                contextInfo
            }, { quoted: message });
        }

        if (rawCmd === 'splitbill') {
            const amount = parseFloat(args[0]);
            const people = parseInt(args[1]);

            if (isNaN(amount) || amount <= 0 || isNaN(people) || people < 2) {
                return sock.sendMessage(jid, {
                    text: '❌ *Usage:* `.expense split <total> <people> [description]`\n\n*Example:* `.expense split 1200 4 Dinner`',
                    contextInfo
                }, { quoted: message });
            }

            const desc = args.slice(2).join(' ').trim() || 'Bill Split';
            const perPerson = (amount / people).toFixed(2);

            return sock.sendMessage(jid, {
                text: `💳 *Bill Split*\n\n📝 *${desc}*\n💵 *Total:* ${group.currency} ${amount.toLocaleString()}\n👥 *People:* ${people}\n\n💰 *Each pays:* ${group.currency} ${parseFloat(perPerson).toLocaleString()}\n\n_Use \`.expense add ${perPerson} ${desc}\` to log your share._`,
                contextInfo
            }, { quoted: message });
        }

        if (rawCmd === 'settle') {
            const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const amount = parseFloat(args[0]);

            if (isNaN(amount) || amount <= 0 || !mentioned.length) {
                return sock.sendMessage(jid, {
                    text: '❌ *Usage:* `.expense settle <amount> @person`\n\n*Example:* `.expense settle 250 @user` (means you paid them back)',
                    contextInfo
                }, { quoted: message });
            }

            const settledWith = mentioned[0];
            const fromNum = sender.split('@')[0];
            const toNum = settledWith.split('@')[0];

            group.entries.push({
                amount: -amount,
                description: `Settlement: @${fromNum} → @${toNum}`,
                paidBy: sender,
                paidByNum: fromNum,
                settledWith,
                timestamp: Date.now(),
                type: 'settlement'
            });
            saveExpenses(expenses);

            return sock.sendMessage(jid, {
                text: `✅ *Settlement Recorded*\n\n@${fromNum} paid ${group.currency} ${amount.toLocaleString()} to @${toNum}`,
                mentions: [sender, settledWith],
                contextInfo
            }, { quoted: message });
        }

        if (rawCmd === 'balances') {
            const totals = {};
            for (const entry of group.entries) {
                if (!totals[entry.paidBy]) totals[entry.paidBy] = 0;
                totals[entry.paidBy] += entry.amount;
            }

            const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
            if (!sorted.length) {
                return sock.sendMessage(jid, { text: '📊 No expenses recorded yet.\n\nAdd one with `.expense add 500 Lunch`', contextInfo }, { quoted: message });
            }

            const totalSpent = sorted.reduce((s, [, v]) => s + v, 0);
            const avg = totalSpent / sorted.length;

            const balances = sorted.map(([user, spent]) => {
                const num = user.split('@')[0];
                const diff = spent - avg;
                const status = diff > 0 ? `is owed ${group.currency} ${Math.abs(diff).toFixed(0)}` : `owes ${group.currency} ${Math.abs(diff).toFixed(0)}`;
                return `@${num}: Spent ${group.currency} ${spent.toLocaleString()} → ${status}`;
            }).join('\n');

            const mentions = sorted.map(([user]) => user);

            return sock.sendMessage(jid, {
                text: `📊 *Group Balances*\n\n💵 *Total spent:* ${group.currency} ${totalSpent.toLocaleString()}\n👤 *Average:* ${group.currency} ${avg.toFixed(0)}\n\n${balances}\n\n_Settle up: \`.expense settle 250 @person\`_`,
                mentions,
                contextInfo
            }, { quoted: message });
        }

        if (['expenses', 'expense'].includes(rawCmd)) {
            if (!group.entries.length) {
                return sock.sendMessage(jid, {
                    text: '💰 *Expense Tracker*\n\nNo expenses yet!\n\n*Actions:*\n• `.expense add 500 Lunch`\n• `.expense split 1200 4 Dinner`\n• `.expense balances`\n• `.expense settle 250 @user`\n• `.expense clear`',
                    contextInfo
                }, { quoted: message });
            }

            const recent = group.entries.slice(-10).reverse();
            const list = recent.map((e, i) => {
                const date = new Date(e.timestamp).toLocaleDateString();
                const sign = e.type === 'settlement' ? '🔄' : '💵';
                return `${i + 1}. ${sign} ${group.currency} ${Math.abs(e.amount).toLocaleString()} — ${e.description}\n   _@${e.paidByNum} • ${date}_`;
            }).join('\n\n');

            const total = group.entries.reduce((s, e) => s + e.amount, 0);

            return sock.sendMessage(jid, {
                text: `💰 *Recent Expenses*\n\n${list}\n\n📊 *Total:* ${group.currency} ${total.toLocaleString()}\n\n_See all balances: \`.expense balances\`_`,
                contextInfo
            }, { quoted: message });
        }
    }
};
