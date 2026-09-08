import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawGet, rawAll } from '../../infrastructure/database/database.js';
const log = createLogger('CALLLINKS');

export function initCallLinks() {
  rawRun(`CREATE TABLE IF NOT EXISTS call_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT, caller_jid TEXT NOT NULL,
    target_jid TEXT, call_type TEXT NOT NULL, link TEXT,
    created_at INTEGER NOT NULL, status TEXT DEFAULT 'link_created'
  )`);
}

export function generateCallLink(phone, type = 'voice') {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const scheme = type === 'video' ? 'videocall' : 'call';
  const link = `whatsapp://${scheme}?phone=${cleanPhone}`;
  return {
    link,
    phone: cleanPhone,
    type,
    message: `📞 *${type === 'video' ? 'Appel Vidéo' : 'Appel Vocal'}*\n\nClique sur le lien ci-dessous pour lancer l'appel dans WhatsApp :\n\n${link}\n\n📱 Le lien s'ouvre automatiquement dans l'app WhatsApp.`
  };
}

export function generateGroupCallLink(adminJid, groupName = 'Discussion') {
  const id = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const link = `https://call.whatsapp.com/voice/${id}`;
  rawRun('INSERT INTO call_history (caller_jid, call_type, link, created_at, status) VALUES (?, ?, ?, ?, ?)',
    adminJid, 'group_voice', link, Date.now(), 'link_created');
  return {
    link,
    id,
    message: `📞 *Appel de groupe : ${groupName}*\n\n🔗 Lien d'appel :\n${link}\n\nPartage ce lien avec les participants pour qu'ils rejoignent l'appel.`
  };
}

export function getCallHistory(jid, limit = 10) {
  initCallLinks();
  return rawAll('SELECT * FROM call_history WHERE caller_jid = ? ORDER BY created_at DESC LIMIT ?', jid, limit);
}

export function getWhatsAppDeepLink(type, param) {
  const schemes = {
    'call': (p) => `whatsapp://call?phone=${p}`,
    'video': (p) => `whatsapp://videocall?phone=${p}`,
    'chat': (p) => `https://wa.me/${p}`,
    'settings': () => 'whatsapp://settings',
    'security': () => 'whatsapp://settings/security',
    '2fa': () => 'whatsapp://settings/security/two-step-verification',
    'privacy': () => 'whatsapp://settings/privacy',
    'storage': () => 'whatsapp://settings/storage',
  };
  const fn = schemes[type];
  if (!fn) return null;
  return fn(param);
}

export function generateDeepLinkMenu(jid) {
  const phone = jid.split('@')[0];
  return {
    calls: {
      voice: `whatsapp://call?phone=${phone}`,
      video: `whatsapp://videocall?phone=${phone}`,
    },
    settings: {
      security: 'whatsapp://settings/security',
      privacy: 'whatsapp://settings/privacy',
      storage: 'whatsapp://settings/storage',
    },
  };
}

export function formatDeepLinkMessage(jid, type) {
  const phone = jid.split('@')[0];
  const messages = {
    'call': `📞 *Appel vocal*\n\nClique pour appeler :\n\`whatsapp://call?phone=${phone}\`\n\n👉 Copie le lien et colle-le dans WhatsApp pour lancer l'appel.`,
    'video': `📹 *Appel vidéo*\n\nClique pour lancer un appel vidéo :\n\`whatsapp://videocall?phone=${phone}\`\n\n👉 Copie le lien et colle-le dans WhatsApp.`,
    '2fa': `🔐 *Double vérification (2FA)*\n\nPour activer la double vérification sur ton compte WhatsApp :\n\n1. Ouvre WhatsApp\n2. Va dans *Paramètres > Compte > Confirmation à deux étapes*\n3. Active avec un code PIN à 6 chiffres\n\n👉 Lien direct : \`whatsapp://settings/security/two-step-verification\``,
    'security_code': `🔑 *Code de sécurité*\n\nPour vérifier ton code de sécurité WhatsApp :\n\n1. Ouvre la discussion\n2. Appuie sur le nom du contact\n3. Va dans *Chiffrement > Code de sécurité*\n4. Scanne le QR code ou compare les 60 chiffres\n\n👉 Lien direct : \`whatsapp://settings/security\``,
    'pay': `💳 *Paiement WhatsApp*\n\nPour effectuer un paiement via WhatsApp :\n\n1. Ouvre WhatsApp\n2. Va dans *Paramètres > Paiements*\n3. Ajoute ton mode de paiement\n\n👉 Lien direct : \`whatsapp://settings/payments\``,
  };
  return messages[type] || null;
}
