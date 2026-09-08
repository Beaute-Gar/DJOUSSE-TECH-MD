const { cmd } = require('../command.cjs');
cmd({ pattern: 'pay', desc: 'Envoyer une demande de paiement', category: 'business', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
const args = m.body.split(' ').slice(1);
const amount = args[0];
const note = args.slice(1).join(' ');
if (!amount || isNaN(amount)) return m.reply('❌ Usage: .pay <montant> [note]');
const user = m.quoted ? m.quoted.sender : null;
try {
const payment = await conn.requestPayment(user || m.chat, { amount: parseInt(amount), currency: 'XOF', note: note || 'Paiement DJOUSSE TECH' });
conn.sendMessage(m.chat, { text: `💰 Demande de paiement envoyée: ${amount} XOF\n${note ? 'Note: '+note : ''}` }, { quoted: m });
} catch (e) {
conn.sendMessage(m.chat, { text: `❌ Paiement non disponible: ${e.message || 'Fonctionnalité limitée sur WhatsApp'}` }, { quoted: m });
}
});