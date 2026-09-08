const { cmd } = require('../command.cjs');
const sharp = require('sharp');

const EFFECTS = {
  naruto: { bg: '#1a0a00', from: '#ff6600', to: '#ffcc00', shadow: '#ff6600', label: 'Naruto Shippuden' },
  dragonball: { bg: '#001a2a', from: '#ff8c00', to: '#ffd700', shadow: '#ff8c00', label: 'Dragon Ball' },
  onepiece: { bg: '#1a0000', from: '#cc0000', to: '#ff4444', shadow: '#cc0000', label: 'One Piece' },
  '3dcomic': { bg: '#0a0a1a', from: '#ff00ff', to: '#00ffff', shadow: '#ff00ff', label: '3D Comic' },
  marvel: { bg: '#1a0000', from: '#cc0000', to: '#ffffff', shadow: '#cc0000', label: 'Marvel' },
  deadpool: { bg: '#1a0000', from: '#cc0000', to: '#ffffff', shadow: '#cc0000', label: 'Deadpool' },
  blackpink: { bg: '#1a0a1a', from: '#ff69b4', to: '#ffffff', shadow: '#ff69b4', label: 'Blackpink' },
  harrypotter: { bg: '#1a1200', from: '#ffd700', to: '#8b4513', shadow: '#ffd700', label: 'Harry Potter' },
  neon: { bg: '#0a0a1a', from: '#00f5ff', to: '#ff00e5', shadow: '#00f5ff', label: 'Neon' },
  glitch: { bg: '#0a0a0a', from: '#ff0000', to: '#00ff00', shadow: '#ff0000', label: 'Glitch' },
  rainbow: { bg: '#0a0a1a', from: '#ff0000', to: '#8b00ff', shadow: '#ff0000', label: 'Rainbow' },
  glass: { bg: '#0a1a2a', from: '#87ceeb', to: '#ffffff', shadow: '#87ceeb', label: 'Glass' },
  frostedglass: { bg: '#e8f4f8', from: '#4a90d9', to: '#ffffff', shadow: '#4a90d9', label: 'Frosted Glass' },
  neonglass: { bg: '#0a0a1a', from: '#00ff88', to: '#00ccff', shadow: '#00ff88', label: 'Neon Glass' },
  gold: { bg: '#1a1200', from: '#ffd700', to: '#ff8c00', shadow: '#ffd700', label: 'Gold' },
  silver: { bg: '#1a1a1a', from: '#c0c0c0', to: '#ffffff', shadow: '#c0c0c0', label: 'Silver' },
  diamond: { bg: '#0a1a2a', from: '#b9f2ff', to: '#ffffff', shadow: '#b9f2ff', label: 'Diamond' },
  fire: { bg: '#1a0500', from: '#ff4500', to: '#ffcc00', shadow: '#ff4500', label: 'Fire' },
  water: { bg: '#001a3a', from: '#0066cc', to: '#00ccff', shadow: '#0066cc', label: 'Water' },
  smoke: { bg: '#1a1a1a', from: '#808080', to: '#404040', shadow: '#808080', label: 'Smoke' },
  ice: { bg: '#001a2a', from: '#00d4ff', to: '#ffffff', shadow: '#00d4ff', label: 'Ice' },
  crystal: { bg: '#0a0a2a', from: '#e0e0ff', to: '#ffffff', shadow: '#e0e0ff', label: 'Crystal' },
  luxury: { bg: '#1a0a00', from: '#ffd700', to: '#b8860b', shadow: '#ffd700', label: 'Luxury' },
  modern: { bg: '#0a0a0a', from: '#00ccff', to: '#ffffff', shadow: '#00ccff', label: 'Modern' },
  christmas: { bg: '#1a0000', from: '#cc0000', to: '#00cc00', shadow: '#cc0000', label: 'Christmas' },
  halloween: { bg: '#1a0a00', from: '#ff6600', to: '#000000', shadow: '#ff6600', label: 'Halloween' },
  graffiti: { bg: '#1a1a0a', from: '#ff00ff', to: '#00ff00', shadow: '#ff00ff', label: 'Graffiti' },
  sand: { bg: '#f4e4c1', from: '#c2a060', to: '#8b7355', shadow: '#c2a060', label: 'Sand' },
  sky: { bg: '#87ceeb', from: '#ffffff', to: '#4a90d9', shadow: '#ffffff', label: 'Sky' },
  space: { bg: '#000011', from: '#9933ff', to: '#ff66cc', shadow: '#9933ff', label: 'Space' },
};

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

function buildSvg(text, effect) {
  const s = EFFECTS[effect];
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
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="${s.bg}"/>
  <text x="50%" y="55%" font-family="Arial Black, Impact, sans-serif" font-size="${fontSize}" font-weight="900"
    fill="url(#grad)" text-anchor="middle" dominant-baseline="middle" filter="url(#glow)"
    style="letter-spacing: 4px;">${safeText}</text>
  <text x="50%" y="88%" font-family="Arial, sans-serif" font-size="18" fill="${s.shadow}" opacity="0.5"
    text-anchor="middle">DJOUSSE TECH</text>
</svg>`.trim();
}

async function generateLogo(conn, m, text, effect) {
  if (!text) {
    const list = Object.keys(EFFECTS).join(', ');
    return m.reply('🎨 *EFFETS LOGO*\n\nUtilisation: .<effet> <texte>\nExemple: .naruto DJOUSSE\n\nEffets: ' + list);
  }
  try {
    const svg = buildSvg(text, effect);
    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    await conn.sendMessage(m.chat, {
      image: buf,
      caption: `🎨 *${EFFECTS[effect].label}* — "${text}"`,
    }, { quoted: m });
  } catch (e) {
    m.reply('❌ Erreur: ' + e.message);
  }
}

const cmds = [
  'naruto', 'dragonball', 'onepiece', '3dcomic', 'marvel', 'deadpool',
  'blackpink', 'harrypotter', 'neon', 'glitch', 'rainbow', 'glass',
  'frostedglass', 'neonglass', 'gold', 'silver', 'diamond', 'fire',
  'water', 'smoke', 'ice', 'crystal', 'luxury', 'modern',
  'christmas', 'halloween', 'graffiti', 'sand', 'sky', 'space'
];

for (const effect of cmds) {
  cmd({
    pattern: effect,
    desc: EFFECTS[effect].label + ' text effect',
    category: 'logo',
    filename: __filename,
  }, async (conn, m, commands, { q }) => {
    await generateLogo(conn, m, q, effect);
  });
}

cmd({
  pattern: 'logolist',
  desc: 'List all logo effects',
  category: 'logo',
  filename: __filename,
}, async (conn, m) => {
  const list = cmds.map(c => `┃✦ .${c} — ${EFFECTS[c].label}`).join('\n');
  m.reply('🎨 *EFFECTS LOGO*\n\n' + list + '\n\nUtilisation: .<effet> <texte>');
});
