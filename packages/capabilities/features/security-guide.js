import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawGet } from '../../infrastructure/database/database.js';
const log = createLogger('SECGUIDE');

export const SECURITY_CHECKS = [
  { id: '2fa', name: 'Double vérification (2FA)', link: 'whatsapp://settings/security/two-step-verification' },
  { id: 'security_code', name: 'Vérifier code de sécurité', link: 'whatsapp://settings/security' },
  { id: 'privacy_profile', name: 'Photo de profil privée', link: 'whatsapp://settings/privacy' },
  { id: 'privacy_lastseen', name: 'Dernière connexion', link: 'whatsapp://settings/privacy' },
  { id: 'privacy_readreceipts', name: 'Confirmation de lecture', link: 'whatsapp://settings/privacy' },
  { id: 'privacy_groups', name: 'Qui peut m\'ajouter aux groupes', link: 'whatsapp://settings/privacy' },
  { id: 'privacy_status', name: 'Confidentialité du statut', link: 'whatsapp://settings/privacy' },
  { id: 'blocked', name: 'Contacts bloqués', link: 'whatsapp://settings/privacy' },
  { id: 'disappearing', name: 'Messages temporaires', link: 'whatsapp://settings/privacy' },
];

export function initSecurityGuide() {
  rawRun(`CREATE TABLE IF NOT EXISTS security_checks (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, link TEXT NOT NULL,
    description TEXT DEFAULT '', icon TEXT DEFAULT '🔐'
  )`);
  for (const check of SECURITY_CHECKS) {
    const icon = {
      '2fa': '🔐', 'security_code': '🔑', 'privacy_profile': '🖼️',
      'privacy_lastseen': '👁️', 'privacy_readreceipts': '✅',
      'privacy_groups': '👥', 'privacy_status': '📱',
      'blocked': '🚫', 'disappearing': '⏳',
    }[check.id] || '🔐';
    rawRun('INSERT OR IGNORE INTO security_checks (id, name, link, icon) VALUES (?, ?, ?, ?)',
      check.id, check.name, check.link, icon);
  }
}

export function getSecurityMenu() {
  initSecurityGuide();
  const checks = SECURITY_CHECKS;
  let msg = `🔐 *Guide de Sécurité WhatsApp*\n\n`;
  msg += `Configure ta sécurité directement dans l'app WhatsApp :\n\n`;
  for (const check of checks) {
    const icon = {
      '2fa': '🔐', 'security_code': '🔑', 'privacy_profile': '🖼️',
      'privacy_lastseen': '👁️', 'privacy_readreceipts': '✅',
      'privacy_groups': '👥', 'privacy_status': '📱',
      'blocked': '🚫', 'disappearing': '⏳',
    }[check.id] || '🔐';
    msg += `${icon} *${check.name}*\n   \`${check.link}\`\n\n`;
  }
  msg += `\n📱 *Copie le lien et colle-le dans WhatsApp pour accéder directement au réglage.*`;
  return msg;
}

export function getSecurityCheck(type) {
  return SECURITY_CHECKS.find(c => c.id === type) || null;
}

export function generateSecureAccountLink(jid) {
  const phone = jid.split('@')[0];
  return {
    twoStep: `whatsapp://settings/security/two-step-verification`,
    securityCode: `whatsapp://settings/security`,
    privacy: `whatsapp://settings/privacy`,
    report: `https://wa.me/${phone}?text=SE%C3%91ALER`,
  };
}
