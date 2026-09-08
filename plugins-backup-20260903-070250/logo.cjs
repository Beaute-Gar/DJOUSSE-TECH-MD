const { cmd } = require('../command.cjs');
const sharp = require('sharp');
const { box } = require('../lib/djousse-ui.cjs');

const STYLES = {
  neon: { bg: '#0a0a1a', from: '#00f5ff', to: '#ff00e5', shadow: '#00f5ff' },
  gold: { bg: '#1a1200', from: '#ffd700', to: '#ff8c00', shadow: '#ffd700' },
  fire: { bg: '#1a0500', from: '#ff4500', to: '#ffcc00', shadow: '#ff4500' },
  ice: { bg: '#001a2a', from: '#00d4ff', to: '#ffffff', shadow: '#00d4ff' },
  matrix: { bg: '#000800', from: '#00ff41', to: '#00ff41', shadow: '#00ff41' },
};

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

function buildSvg(text, style) {
  const s = STYLES[style] || STYLES.neon;
  const width = 900, height = 400;
  const fontSize = text.length > 12 ? 70 : text.length > 8 ? 95 : 130;
  const safeText = escapeXml(text.slice(0, 20));
  return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${s.from}"/>
      <stop offset="100%" stop-color="${s.to}"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="10" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="${s.bg}"/>
  <text x="50%" y="55%" font-family="Arial Black, sans-serif" font-size="${fontSize}" font-weight="900"
    fill="url(#grad)" text-anchor="middle" dominant-baseline="middle" filter="url(#glow)"
    style="letter-spacing: 4px;">${safeText}</text>
  <text x="50%" y="88%" font-family="Arial, sans-serif" font-size="18" fill="${s.shadow}" opacity="0.6"
    text-anchor="middle">DJOUSSE TECH EVOLUTION</text>
</svg>`.trim();
}

cmd({ pattern: 'logo', alias: ['textlogo'], react: '🎨', desc: 'Générer un logo texte stylisé', category: 'tools', filename: __filename }, async (conn, m, commands, { q, reply }) => {
  const styleNames = Object.keys(STYLES).join(', ');
  if (!q) {
    return reply(box('🎨 *GÉNÉRATEUR DE LOGO*', [
      { label: 'Utilisation', value: '.logo <texte> [style]' },
      { label: 'Exemple', value: '.logo DJOUSSE neon' },
      { label: 'Styles', value: styleNames },
    ]));
  }
  try {
    const parts = q.trim().split(/\s+/);
    const lastWord = parts[parts.length - 1].toLowerCase();
    const hasStyle = Object.prototype.hasOwnProperty.call(STYLES, lastWord);
    const style = hasStyle ? lastWord : 'neon';
    const text = hasStyle ? parts.slice(0, -1).join(' ') : q.trim();
    if (!text) return reply('❌ Fournis un texte à styliser. Exemple : .logo DJOUSSE neon');

    const svg = buildSvg(text, style);
    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    await conn.sendMessage(m.chat, {
      image: buf,
      caption: `🎨 *Logo "${text}"* — style *${style}*\n\n_Styles dispo : ${styleNames}_`,
    }, { quoted: m });
  } catch (e) {
    reply(box('❌ *ERREUR*', [{ raw: '```' + e.message + '```' }]));
  }
});
