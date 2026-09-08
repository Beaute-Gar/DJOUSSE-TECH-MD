import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawGet, rawAll } from '../../infrastructure/database/database.js';
const log = createLogger('PAYLINKS');

export function initPaymentLinks() {
  rawRun(`CREATE TABLE IF NOT EXISTS payment_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_jid TEXT NOT NULL,
    method TEXT NOT NULL, identifier TEXT, is_default INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  )`);
}

export function getWhatsAppPayLink(phone, amount, note = '') {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const noteEncoded = encodeURIComponent(note);
  return {
    upi: `whatsapp://pay?phone=${cleanPhone}&amount=${amount}&note=${noteEncoded}`,
    payLink: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Paiement de ${amount} XAF - ${note}`)}`,
    message: `💳 *Paiement*\n\nMontant : ${amount} XAF\nDestinataire : +${cleanPhone}\n\n🔗 Lien de paiement WhatsApp :\nwhatsapp://pay?phone=${cleanPhone}&amount=${amount}\n\n📱 Clique sur le lien ci-dessus pour payer via WhatsApp Pay.`,
  };
}

export function generatePaymentDeepLink(method, params) {
  const schemes = {
    'whatsapp_pay': (p) => `whatsapp://pay?phone=${p.phone}&amount=${p.amount}`,
    'cinetpay': (p) => p.url || null,
    'mobile_money': (p) => `tel:*126*${p.code || ''}#`,
    'orange_money': (p) => `tel:#150*${p.phone || ''}*${p.amount || ''}#`,
    'mtn_money': (p) => `tel:*126*${p.amount || ''}*${p.phone || ''}#`,
  };
  return schemes[method]?.(params) || null;
}

export function getPaymentGuide() {
  return `💳 *Guide des Paiements*\n\n` +
    `1️⃣ *Mobile Money (CinetPay)*\n   .pay <montant> <article>\n\n` +
    `2️⃣ *WhatsApp Pay*\n   whatsapp://pay?phone=237XXXXXXXXX&amount=1000\n\n` +
    `3️⃣ *Orange Money direct*\n   Compose #150# sur ton téléphone\n\n` +
    `4️⃣ *MTN Mobile Money*\n   Compose *126# sur ton téléphone\n\n` +
    `📱 Les liens WhatsApp Pay s'ouvrent directement dans l'app WhatsApp.`;
}

export function getSupportedPaymentMethods(region = 'Africa/Douala') {
  return [
    { id: 'cinetpay', name: 'CinetPay (Orange Money, MTN, Moov)', type: 'bot', available: true },
    { id: 'whatsapp_pay', name: 'WhatsApp Pay (Meta Pay)', type: 'deep_link', available: false, note: 'Disponible dans certains pays uniquement' },
    { id: 'orange_money', name: 'Orange Money (USSD)', type: 'ussd', available: true },
    { id: 'mtn_money', name: 'MTN Mobile Money (USSD)', type: 'ussd', available: true },
  ];
}
