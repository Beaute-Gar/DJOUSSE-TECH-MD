import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('PAY');

const triggers = [
  /paiement/i, /payer/i, /pay/i, /combien.*coûte/i, /coût/i, /tarif/i,
  /facture/i, /transaction/i, /paiement/i, /payment/i
];

const PRICES = {
  'bot': 5000, 'premium': 15000, 'business': 50000,
  'groupe': 'gratuit', 'commande': 'gratuit', 'aide': 'gratuit'
};

export function enablePay(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat) continue;
      if (!triggers.some(p => p.test(text))) continue;

      const lower = text.toLowerCase();
      let response = '💰 *Paiements DJOUSSE TECH*\n\n';

      if (lower.includes('tarif') || lower.includes('combien') || lower.includes('coût') || lower.includes('prix')) {
        response += '📋 *Tarifs:*\n';
        response += '  🤖 Bot de base: 5 000 FCFA\n';
        response += '  ⭐ Premium: 15 000 FCFA\n';
        response += '  🏢 Business: 50 000 FCFA\n';
        response += '  👥 Groupe: Gratuit\n\n';
        response += '💳 *Moyens:* Orange Money, MTN Mobile Money, CinetPay\n';
        response += '📞 Contact: ' + (global.__sessionOwnerNumber || '') + '';
      } else if (lower.includes('payer') || lower.includes('paiement')) {
        response += '📱 Pour effectuer un paiement:\n';
        response += '1️⃣ Envoie le montant à *Orange Money: ' + (global.__sessionOwnerNumber || '') + '*\n';
        response += '2️⃣ Envoie le code de transaction ici\n';
        response += '3️⃣ Confirmation sous 5 minutes\n\n';
        response += 'Ou utilise CinetPay: [lien à venir]';
      } else {
        response += 'Je peux t\'aider avec les paiements.\n\n';
        response += '💰 Dis "tarif" pour voir nos prix\n';
        response += '💳 Dis "payer" pour effectuer un paiement';
      }

      try { await sock.sendMessage(chat, { text: response }); } catch (_) {}
    }
  });

  log.info('Module pay actif');
}
