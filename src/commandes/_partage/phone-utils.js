'use strict';
/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  phone-utils.js — Utilitaires numéros de téléphone (E.164)
 * ═══════════════════════════════════════════════════════════════════════════
 *  - resolvePhoneJid(x) → JID WhatsApp normalisé depuis un numéro brut
 *  - getCountry(phone)  → indicatif + nom de pays (couverture mondiale)
 *  - digits(s)          → nettoie une chaîne en ne gardant que les chiffres
 *  - listZones()        → renvoie la liste complète triée (utile .allowcodes)
 *  - getZoneByCode(c)   → cherche une zone par code exact
 *
 *  ⚠️ Correction importante : les préfixes sont testés du PLUS LONG au PLUS
 *  COURT, sinon '+1242' (Bahamas) renverrait 'États-Unis / Canada' (+1),
 *  et '+237' (Cameroun) pourrait matcher un préfixe plus court par erreur.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/* ─── Utilitaires de base ──────────────────────────────────────────────── */

function digits(s) {
  return String(s || '').replace(/\D/g, '');
}

/**
 * Normalise un numéro / JID WhatsApp.
 * @param {string|number} x - numéro brut ('+237 6XX...'), JID ('...@s.whatsapp.net') ou ID
 * @returns {string|null} JID WhatsApp ou null si invalide
 */
function resolvePhoneJid(x) {
  if (x === null || x === undefined) return null;
  const raw = String(x).trim();
  if (!raw) return null;
  // JID déjà formé
  if (raw.includes('@')) return raw;
  const d = digits(raw);
  if (!d) return null;
  if (d.length < 8) return null;   // trop court pour être un numéro complet
  if (d.length > 15) return null;  // max E.164
  return `${d}@s.whatsapp.net`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ZONES — Indicatifs téléphoniques mondiaux (E.164)
   Source : Union Internationale des Télécommunications (ITU)
   Tri par zone géographique, puis alphabétique
   ═══════════════════════════════════════════════════════════════════════════ */

const ZONES = [
  /* ─── Zone 1 : Amérique du Nord & Caraïbes ─────────────────────────── */
  ['1', 'États-Unis / Canada'],
  ['1242', 'Bahamas'],
  ['1246', 'Barbade'],
  ['1264', 'Anguilla'],
  ['1268', 'Antigua-et-Barbuda'],
  ['1284', 'Îles Vierges britanniques'],
  ['1340', 'Îles Vierges américaines'],
  ['1345', 'Îles Caïmans'],
  ['1441', 'Bermudes'],
  ['1473', 'Grenade'],
  ['1649', 'Turks-et-Caïcos'],
  ['1658', 'Jamaïque'],
  ['1664', 'Montserrat'],
  ['1670', 'Îles Mariannes du Nord'],
  ['1671', 'Guam'],
  ['1684', 'Samoa américaines'],
  ['1721', 'Saint-Martin (Pays-Bas)'],
  ['1758', 'Sainte-Lucie'],
  ['1767', 'Dominique'],
  ['1784', 'Saint-Vincent-et-les-Grenadines'],
  ['1787', 'Porto Rico'],
  ['1809', 'République dominicaine'],
  ['1829', 'République dominicaine'],
  ['1849', 'République dominicaine'],
  ['1868', 'Trinité-et-Tobago'],
  ['1869', 'Saint-Christophe-et-Niévès'],
  ['1876', 'Jamaïque'],

  /* ─── Zone 2 : Afrique ──────────────────────────────────────────────── */
  ['20', 'Égypte'],
  ['211', 'Soudan du Sud'],
  ['212', 'Maroc'],
  ['213', 'Algérie'],
  ['216', 'Tunisie'],
  ['218', 'Libye'],
  ['220', 'Gambie'],
  ['221', 'Sénégal'],
  ['222', 'Mauritanie'],
  ['223', 'Mali'],
  ['224', 'Guinée'],
  ['225', 'Côte d\'Ivoire'],
  ['226', 'Burkina Faso'],
  ['227', 'Niger'],
  ['228', 'Togo'],
  ['229', 'Bénin'],
  ['230', 'Maurice'],
  ['231', 'Liberia'],
  ['232', 'Sierra Leone'],
  ['233', 'Ghana'],
  ['234', 'Nigeria'],
  ['235', 'Tchad'],
  ['236', 'République centrafricaine'],
  ['237', 'Cameroun'],
  ['238', 'Cap-Vert'],
  ['239', 'Sao Tomé-et-Principe'],
  ['240', 'Guinée équatoriale'],
  ['241', 'Gabon'],
  ['242', 'République du Congo'],
  ['243', 'République démocratique du Congo'],
  ['244', 'Angola'],
  ['245', 'Guinée-Bissau'],
  ['246', 'Territoire britannique de l\'océan Indien'],
  ['247', 'Ascension'],
  ['248', 'Seychelles'],
  ['249', 'Soudan'],
  ['250', 'Rwanda'],
  ['251', 'Éthiopie'],
  ['252', 'Somalie'],
  ['253', 'Djibouti'],
  ['254', 'Kenya'],
  ['255', 'Tanzanie'],
  ['256', 'Ouganda'],
  ['257', 'Burundi'],
  ['258', 'Mozambique'],
  ['260', 'Zambie'],
  ['261', 'Madagascar'],
  ['262', 'La Réunion / Mayotte'],
  ['263', 'Zimbabwe'],
  ['264', 'Namibie'],
  ['265', 'Malawi'],
  ['266', 'Lesotho'],
  ['267', 'Botswana'],
  ['268', 'Eswatini'],
  ['269', 'Comores'],
  ['27', 'Afrique du Sud'],
  ['290', 'Sainte-Hélène'],
  ['291', 'Érythrée'],
  ['297', 'Aruba'],
  ['298', 'Îles Féroé'],
  ['299', 'Groenland'],

  /* ─── Zone 3-4 : Europe ─────────────────────────────────────────────── */
  ['30', 'Grèce'],
  ['31', 'Pays-Bas'],
  ['32', 'Belgique'],
  ['33', 'France'],
  ['34', 'Espagne'],
  ['36', 'Hongrie'],
  ['39', 'Italie / Vatican'],
  ['40', 'Roumanie'],
  ['41', 'Suisse'],
  ['43', 'Autriche'],
  ['44', 'Royaume-Uni'],
  ['45', 'Danemark'],
  ['46', 'Suède'],
  ['47', 'Norvège / Svalbard'],
  ['48', 'Pologne'],
  ['49', 'Allemagne'],
  ['350', 'Gibraltar'],
  ['351', 'Portugal'],
  ['352', 'Luxembourg'],
  ['353', 'Irlande'],
  ['354', 'Islande'],
  ['355', 'Albanie'],
  ['356', 'Malte'],
  ['357', 'Chypre'],
  ['358', 'Finlande / Åland'],
  ['359', 'Bulgarie'],
  ['370', 'Lituanie'],
  ['371', 'Lettonie'],
  ['372', 'Estonie'],
  ['373', 'Moldavie'],
  ['374', 'Arménie'],
  ['375', 'Biélorussie'],
  ['376', 'Andorre'],
  ['377', 'Monaco'],
  ['378', 'Saint-Marin'],
  ['379', 'Cité du Vatican'],
  ['380', 'Ukraine'],
  ['381', 'Serbie'],
  ['382', 'Monténégro'],
  ['383', 'Kosovo'],
  ['385', 'Croatie'],
  ['386', 'Slovénie'],
  ['387', 'Bosnie-Herzégovine'],
  ['389', 'Macédoine du Nord'],
  ['420', 'Tchéquie'],
  ['421', 'Slovaquie'],
  ['423', 'Liechtenstein'],

  /* ─── Zone 5 : Amérique latine ──────────────────────────────────────── */
  ['500', 'Îles Malouines'],
  ['501', 'Belize'],
  ['502', 'Guatemala'],
  ['503', 'Salvador'],
  ['504', 'Honduras'],
  ['505', 'Nicaragua'],
  ['506', 'Costa Rica'],
  ['507', 'Panama'],
  ['508', 'Saint-Pierre-et-Miquelon'],
  ['509', 'Haïti'],
  ['51', 'Pérou'],
  ['52', 'Mexique'],
  ['53', 'Cuba'],
  ['54', 'Argentine'],
  ['55', 'Brésil'],
  ['56', 'Chili'],
  ['57', 'Colombie'],
  ['58', 'Venezuela'],
  ['590', 'Guadeloupe / Saint-Barthélemy / Saint-Martin'],
  ['591', 'Bolivie'],
  ['592', 'Guyana'],
  ['593', 'Équateur'],
  ['594', 'Guyane française'],
  ['595', 'Paraguay'],
  ['596', 'Martinique'],
  ['597', 'Suriname'],
  ['598', 'Uruguay'],
  ['599', 'Curaçao / Bonaire / Sint-Maarten'],

  /* ─── Zone 6 : Océanie & Pacifique ──────────────────────────────────── */
  ['60', 'Malaisie'],
  ['61', 'Australie / Îles Cocos / Christmas'],
  ['62', 'Indonésie'],
  ['63', 'Philippines'],
  ['64', 'Nouvelle-Zélande'],
  ['65', 'Singapour'],
  ['66', 'Thaïlande'],
  ['670', 'Timor oriental'],
  ['672', 'Antarctique / Norfolk'],
  ['673', 'Brunei'],
  ['674', 'Nauru'],
  ['675', 'Papouasie-Nouvelle-Guinée'],
  ['676', 'Tonga'],
  ['677', 'Salomon'],
  ['678', 'Vanuatu'],
  ['679', 'Fidji'],
  ['680', 'Palaos'],
  ['681', 'Wallis-et-Futuna'],
  ['682', 'Îles Cook'],
  ['683', 'Niue'],
  ['685', 'Samoa'],
  ['686', 'Kiribati'],
  ['687', 'Nouvelle-Calédonie'],
  ['688', 'Tuvalu'],
  ['689', 'Polynésie française'],
  ['690', 'Tokelau'],
  ['691', 'Micronésie'],
  ['692', 'Îles Marshall'],

  /* ─── Zone 7 : Russie / Kazakhstan ──────────────────────────────────── */
  ['7', 'Russie / Kazakhstan'],

  /* ─── Zone 8 : Asie de l'Est ────────────────────────────────────────── */
  ['81', 'Japon'],
  ['82', 'Corée du Sud'],
  ['84', 'Vietnam'],
  ['850', 'Corée du Nord'],
  ['852', 'Hong Kong'],
  ['853', 'Macao'],
  ['855', 'Cambodge'],
  ['856', 'Laos'],
  ['86', 'Chine'],
  ['880', 'Bangladesh'],
  ['886', 'Taïwan'],

  /* ─── Zone 9 : Asie du Sud / Moyen-Orient ───────────────────────────── */
  ['90', 'Turquie'],
  ['91', 'Inde'],
  ['92', 'Pakistan'],
  ['93', 'Afghanistan'],
  ['94', 'Sri Lanka'],
  ['95', 'Birmanie (Myanmar)'],
  ['960', 'Maldives'],
  ['961', 'Liban'],
  ['962', 'Jordanie'],
  ['963', 'Syrie'],
  ['964', 'Irak'],
  ['965', 'Koweït'],
  ['966', 'Arabie saoudite'],
  ['967', 'Yémen'],
  ['968', 'Oman'],
  ['970', 'Palestine'],
  ['971', 'Émirats arabes unis'],
  ['972', 'Israël'],
  ['973', 'Bahreïn'],
  ['974', 'Qatar'],
  ['975', 'Bhoutan'],
  ['976', 'Mongolie'],
  ['977', 'Népal'],
  ['98', 'Iran'],
  ['992', 'Tadjikistan'],
  ['993', 'Turkménistan'],
  ['994', 'Azerbaïdjan'],
  ['995', 'Géorgie'],
  ['996', 'Kirghizistan'],
  ['998', 'Ouzbékistan'],
];

/* ═══════════════════════════════════════════════════════════════════════════
   RECHERCHE DE ZONE — corrigée (préfixes longs d'abord)
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Table triée une seule fois par longueur de préfixe décroissante.
 * '+1242' doit matcher 'Bahamas' avant 'États-Unis / Canada' (+1).
 * '+237' doit matcher 'Cameroun' avant un hypothétique '+2' absent.
 */
const ZONES_SORTED = [...ZONES].sort((a, b) => b[0].length - a[0].length);

/**
 * Retourne l'indicatif + le nom du pays pour un numéro.
 * @param {string|number} phone - numéro (avec ou sans +, espaces, tirets)
 * @returns {{ code: string, nom: string, phone: string }}
 */
function getCountry(phone) {
  const d = digits(phone);
  if (!d) return { code: '', nom: 'Inconnu', phone: '' };
  for (const [code, nom] of ZONES_SORTED) {
    if (d.startsWith(code)) return { code, nom, phone: d };
  }
  return { code: '', nom: 'Inconnu', phone: d };
}

/**
 * Recherche exacte d'une zone par son code (utile pour .allowcodes).
 * @param {string} code
 * @returns {{ code: string, nom: string } | null}
 */
function getZoneByCode(code) {
  const c = digits(code);
  const hit = ZONES.find(([k]) => k === c);
  return hit ? { code: hit[0], nom: hit[1] } : null;
}

/**
 * Retourne la liste complète des zones (copie défensive).
 * Triée alphabétiquement par nom de pays.
 */
function listZones() {
  return [...ZONES]
    .map(([code, nom]) => ({ code, nom }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

/* ─── Exports ──────────────────────────────────────────────────────────── */

module.exports = {
  resolvePhoneJid,
  getCountry,
  getZoneByCode,
  listZones,
  digits,
  ZONES,
};