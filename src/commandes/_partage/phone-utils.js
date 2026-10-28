'use strict';
/**
 * Shim DJOUSSE : '../lib/phone-utils'
 *   resolvePhoneJid(x) → JID WhatsApp normalisé depuis un numéro brut
 *   getCountry(phone)  → indicatif + nom de zone (approximatif)
 */
function digits(s) { return String(s || '').replace(/\D/g, ''); }

function resolvePhoneJid(x) {
  const d = digits(x);
  if (!d) return null;
  if (String(x).includes('@')) return String(x);
  if (d.length < 8) return null;
  return `${d}@s.whatsapp.net`;
}

const ZONES = [
  ['237', 'Cameroun'], ['225', 'Côte d\'Ivoire'], ['221', 'Sénégal'], ['223', 'Mali'],
  ['226', 'Burkina Faso'], ['228', 'Togo'], ['229', 'Bénin'], ['233', 'Ghana'],
  ['234', 'Nigeria'], ['254', 'Kenya'], ['255', 'Tanzanie'], ['256', 'Ouganda'],
  ['27', 'Afrique du Sud'], ['33', 'France'], ['1', 'USA/Canada'], ['44', 'Royaume-Uni'],
  ['91', 'Inde'], ['86', 'Chine'], ['81', 'Japon'], ['7', 'Russie'],
];

function getCountry(phone) {
  const d = digits(phone);
  for (const [code, nom] of ZONES) {
    if (d.startsWith(code)) return { code, nom, phone: d };
  }
  return { code: '', nom: 'Inconnu', phone: d };
}

module.exports = { resolvePhoneJid, getCountry, digits };
