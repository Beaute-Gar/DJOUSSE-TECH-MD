const { cmd } = require('../command.cjs');
const { box, truncate } = require('../lib/djousse-ui.cjs');

/* ═══════════════════════════════════════════════════════════════════════════
   PDF / QR CODE / TRADUCTION / FUSEAUX HORAIRES
   PDF        : pdfkit (déjà une dépendance) — génération locale, aucune API.
   QR code    : paquet 'qrcode' — génération locale, aucune API.
   Traduction : LibreTranslate — open-source, instance publique gratuite.
                Alternative légitime à un scraping non-officiel de Google
                Translate (zone grise de ToS). Auto-hébergeable si le
                quota de l'instance publique devient limitant.
   Heure      : worldtimeapi.org — API publique gratuite, sans clé.
   ═══════════════════════════════════════════════════════════════════════════ */

cmd({
  pattern: 'topdf',
  alias: ['img2pdf'],
  react: '📄',
  desc: 'Convertir une image en PDF',
  category: 'tools',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const target = m.quoted?.type === 'imageMessage' ? m.quoted : (m.type === 'imageMessage' ? m : null);
  if (!target) return reply('❌ Réponds (quote) à une image avec .topdf, ou envoie une image avec .topdf en légende.');

  try {
    await m.react('🕐').catch(() => {});
    const buffer = await target.download();
    if (!buffer) throw new Error('Téléchargement de l\'image impossible.');

    const PDFDocument = require('pdfkit');
    const chunks = [];
    const doc = new PDFDocument({ autoFirstPage: false });
    doc.on('data', (c) => chunks.push(c));
    const done = new Promise((resolve) => doc.on('end', resolve));

    const img = doc.openImage(buffer);
    doc.addPage({ size: [img.width, img.height] });
    doc.image(buffer, 0, 0, { width: img.width, height: img.height });
    doc.end();
    await done;

    const pdfBuffer = Buffer.concat(chunks);
    await conn.sendMessage(m.chat, { document: pdfBuffer, mimetype: 'application/pdf', fileName: 'document.pdf' }, { quoted: m });
    await m.react('✅').catch(() => {});
  } catch (e) {
    await m.react('❌').catch(() => {});
    reply(box('❌ *ERREUR*', [{ raw: truncate(e.message, 200) }]));
  }
});

cmd({
  pattern: 'qrcode',
  alias: ['qrgen', 'genqr'],
  react: '🔳',
  desc: 'Générer un QR code à partir d\'un texte',
  category: 'tools',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  if (!q) return reply(box('🔳 *GÉNÉRER UN QR CODE*', [{ label: 'Utilisation', value: '.qrcode <texte ou lien>' }]));
  try {
    const QRCode = require('qrcode');
    const buffer = await QRCode.toBuffer(q, { width: 512, margin: 2 });
    await conn.sendMessage(m.chat, { image: buffer, caption: '🔳 QR code généré' }, { quoted: m });
  } catch (e) {
    reply(box('❌ *ERREUR*', [{ raw: truncate(e.message, 200) }]));
  }
});

const LANG_ALIASES = { fr: 'fr', francais: 'fr', français: 'fr', en: 'en', anglais: 'en', english: 'en', es: 'es', espagnol: 'es', de: 'de', allemand: 'de', it: 'it', italien: 'it', pt: 'pt', portugais: 'pt', ar: 'ar', arabe: 'ar', zh: 'zh', chinois: 'zh' };

cmd({
  pattern: 'traduire',
  alias: ['translate', 'trad'],
  react: '🌍',
  desc: 'Traduire un texte',
  category: 'tools',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  if (!q) {
    return reply(box('🌍 *TRADUCTION*', [
      { label: 'Utilisation', value: '.traduire <langue> <texte>' },
      { label: 'Exemple', value: '.traduire en Bonjour tout le monde' },
      { label: 'Langues', value: Object.keys(LANG_ALIASES).join(', ') },
    ]));
  }
  const parts = q.trim().split(/\s+/);
  const langInput = parts[0].toLowerCase();
  const target = LANG_ALIASES[langInput];
  const text = target ? parts.slice(1).join(' ') : q;
  const targetLang = target || 'en';
  if (!text) return reply('❌ Précise le texte à traduire après la langue. Exemple : .traduire en Bonjour');

  try {
    const res = await fetch('https://libretranslate.com/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: 'auto', target: targetLang, format: 'text' }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    if (!data.translatedText) throw new Error(data.error || 'Traduction indisponible pour le moment.');
    reply(box('🌍 *TRADUCTION*', [
      { label: 'Vers', value: targetLang },
      { raw: data.translatedText },
    ]));
  } catch (e) {
    reply(box('❌ *ERREUR*', [
      { raw: truncate(e.message, 200) },
      { raw: '_L\'instance publique LibreTranslate peut être temporairement limitée._' },
    ]));
  }
});

cmd({
  pattern: 'heure',
  alias: ['time', 'fuseauhoraire'],
  react: '🕐',
  desc: 'Heure actuelle dans une ville/région',
  category: 'tools',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  if (!q) {
    return reply(box('🕐 *HEURE PAR FUSEAU*', [
      { label: 'Utilisation', value: '.heure <Continent/Ville>' },
      { label: 'Exemple', value: '.heure Africa/Douala' },
      { label: 'Exemple', value: '.heure Europe/Paris' },
      { raw: '_Format IANA : Continent/Ville (liste : https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)_' },
    ]));
  }
  try {
    const tz = q.trim().replace(/\s+/g, '_');
    const res = await fetch('https://worldtimeapi.org/api/timezone/' + encodeURIComponent(tz), { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error('Fuseau horaire introuvable : "' + q + '". Utilise le format Continent/Ville (ex: Africa/Douala).');
    const data = await res.json();
    const dt = new Date(data.datetime);
    reply(box('🕐 *' + tz.replace('_', ' ') + '*', [
      { label: 'Heure locale', value: dt.toLocaleString('fr-FR', { timeZone: data.timezone }) },
      { label: 'Décalage UTC', value: data.utc_offset },
      { label: 'Heure d\'été', value: data.dst ? 'Oui' : 'Non' },
    ]));
  } catch (e) {
    reply(box('❌ *ERREUR*', [{ raw: truncate(e.message, 200) }]));
  }
});
