'use strict';
/**
 * ══════════════════════════════════════════════════════════════════
 * COMMANDES PORTÉES DE TEDDY-XMD — familles « logo » & « lookup »
 * ──────────────────────────────────────────────────────────────────
 * LOGOS (23, effets texte) : arena boomlg cat devil didong dragonball
 *   glitch gold greenneon harrypotter incandescent lightglow naruto neon
 *   neonlight purple snow summer thunder transformer wall water whitegold
 *
 * Les effets utilisent ephoto360/textpro via le paquet npm public
 * « mumaker » (installé, version épinglée). Chaque effet a été TESTÉ
 * EN RÉEL : 23 sur 24 de ceux de TEDDY répondent.
 *
 * LOOKUPS (3) : biblie (bible-api.com), describe (Urban Dictionary),
 *               elements (table périodique, api.popcat.xyz)
 *
 * NON PORTÉS : thor (renvoie « undefined »), hacker (template d'image
 * absent → 404), gif (template mort), technews (API privée d'un autre
 * bot), paste (jeton Telegraph en dur dans TEDDY), terminate (sabotage
 * de groupe), channel (lien WhatsApp d'un tiers), cast (doublon .broadcast),
 * githubs (doublon .github), runtime (doublon .uptime).
 * ══════════════════════════════════════════════════════════════════
 */

/* effet : [backend, URL] — tester en réel le 13/10/2026 */
const LOGOS = {
  arena: ['textpro', 'https://en.ephoto360.com/create-cover-arena-of-valor-by-mastering-360.html'],
  boomlg: ['ephoto', 'https://en.ephoto360.com/boom-text-comic-style-text-effect-675.html'],
  cat: ['textpro', 'https://textpro.me/write-text-on-foggy-window-online-free-1015.html'],
  devil: ['textpro', 'https://textpro.me/create-neon-devil-wings-text-effect-online-free-1014.html'],
  didong: ['ephoto', 'https://ephoto360.com/tao-anh-che-vui-tu-choi-cuoc-goi-voi-ten-cua-930.html'],
  dragonball: ['ephoto', 'https://ephoto360.com/tao-hieu-ung-chu-phong-cach-dragon-ball-truc-tuyen-1000.html'],
  glitch: ['textpro', 'https://textpro.me/create-impressive-glitch-text-effects-online-1027.html'],
  gold: ['ephoto', 'https://en.ephoto360.com/modern-gold-4-213.html'],
  greenneon: ['textpro', 'https://textpro.me/green-neon-text-effect-874.html'],
  harrypotter: ['textpro', 'https://textpro.me/create-harry-potter-text-effect-online-1025.html'],
  incandescent: ['ephoto', 'https://en.ephoto360.com/text-effects-incandescent-bulbs-219.html'],
  lightglow: ['textpro', 'https://textpro.me/create-light-glow-sliced-text-effect-online-1068.html'],
  naruto: ['ephoto', 'https://en.ephoto360.com/naruto-shippuden-logo-style-text-effect-online-808.html'],
  neon: ['textpro', 'https://textpro.me/neon-text-effect-online-879.html'],
  neonlight: ['textpro', 'https://textpro.me/create-glowing-neon-light-text-effect-online-free-1061.html'],
  purple: ['ephoto', 'https://en.ephoto360.com/purple-text-effect-online-100.html'],
  snow: ['textpro', 'https://textpro.me/create-beautiful-3d-snow-text-effect-online-1101.html'],
  summer: ['textpro', 'https://textpro.me/create-sunset-light-text-effects-online-for-free-1124.html'],
  thunder: ['textpro', 'https://textpro.me/online-thunder-text-effect-generator-1031.html'],
  transformer: ['textpro', 'https://textpro.me/create-a-transformer-text-effect-online-1035.html'],
  wall: ['textpro', 'https://textpro.me/break-wall-text-effect-871.html'],
  water: ['ephoto', 'https://en.ephoto360.com/create-water-effect-text-online-295.html'],
  whitegold: ['textpro', 'https://textpro.me/elegant-white-gold-3d-text-effect-online-free-1070.html'],
};

let mumaker = null;
try { mumaker = require('mumaker'); } catch { /* optionnel */ }

function registerPortedLogo(cmd, deps) {
  const { config, send } = deps;

  for (const [nom, [kind, url]] of Object.entries(LOGOS)) {
    cmd(nom, {
      cat: 5, desc: `Logo « ${nom} » (effet texte)`, usage: `${nom} <texte>`, icon: '🎨',
    }, async (c) => {
      const texte = (c.q || '').trim();
      if (!texte) return c.error(['TEXTE MANQUANT', `${config.prefix}${nom.toUpperCase()} <TEXTE>`]);
      if (!mumaker) return c.error(['MODULE ABSENT', 'npm install mumaker']);
      try {
        const res = kind === 'ephoto' ? await mumaker.ephoto(url, texte) : await mumaker.textpro(url, texte);
        if (!res?.image) return c.error(['GÉNÉRATION ÉCHOUÉE', 'Le service est momentanément indisponible.']);
        await send(c.sock, c.from, { image: { url: res.image }, caption: `🎨 ${texte} — DJOUSSE TECH` }, { quoted: c.msg });
      } catch (e) {
        await c.error([`${nom.toUpperCase()} ÉCHEC`, e.message]);
      }
    });
  }

  /* vue d'ensemble */
  cmd('logolist', { cat: 5, desc: 'Voir tous les effets de logo', usage: 'logolist', icon: '📋' }, async (c) => {
    const { buildFrame, bullet } = deps;
    return c.reply(buildFrame('EFFETS LOGO', [
      bullet('NOMBRE', String(Object.keys(LOGOS).length)),
      Object.keys(LOGOS).map((n) => `· ${n}`).join(' '),
    ]));
  });
}

/* ══════════════ lookups (APIs publiques gratuites) ══════════════ */
function registerPortedLookup(cmd, deps) {
  const { config, send, buildFrame, bullet } = deps;

  /* bible */
  /* bible-api.com n'accepte que les livres anglais : on traduit les plus courants */
  const LIVRES_FR = {
    'genèse': 'genesis', 'exode': 'exodus', 'lévitique': 'leviticus', 'nombre': 'numbers',
    'deutéronome': 'deuteronomy', 'josué': 'joshua', 'juges': 'judges', 'ruth': 'ruth',
    'psaume': 'psalms', 'psaumes': 'psalms', 'proverbes': 'proverbs', 'ecclésiaste': 'ecclesiastes',
    'Ésaïe': 'isaiah', 'esaie': 'isaiah', 'ésaïe': 'isaiah', 'jérémie': 'jeremiah', 'jeremie': 'jeremiah',
    'matthieu': 'matthew', 'marc': 'mark', 'luc': 'luke', 'jean': 'john', 'actes': 'acts',
    'romains': 'romans', 'corinthiens': 'corinthians', 'galates': 'galates', 'philippiens': 'philippians',
    'hébreux': 'hebrews', 'jacques': 'james', 'apocalypse': 'revelation',
  };
  const traduitRef = (ref) => {
    const mots = String(ref).trim().split(/(\s+)/);
    return mots
      .map((m) => {
        const bas = m.toLowerCase().replace(/[1-3]\s*$/, '').trim();
        const en = LIVRES_FR[m.toLowerCase()] || LIVRES_FR[bas];
        return en || m;
      })
      .join('');
  };
  cmd('biblie', { cat: 8, desc: 'Verset de la Bible (bible-api.com)', usage: 'biblie <référence> (ex: john 3:16)', icon: '📖' }, async (c) => {
    const ref = (c.q || '').trim();
    if (!ref) return c.error(['RÉFÉRENCE MANQUANTE', `${config.prefix}BIBLIE jean 3:16`]);
    try {
      const r = await fetch(`https://bible-api.com/${encodeURIComponent(traduitRef(ref))}`, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) return c.error(['RÉFÉRENCE INCONNUE', `${ref} (essaie en anglais : john 3:16)`]);
      const d = await r.json();
      const versets = (d.verses || []).map((v) => `${v.verse}. ${String(v.text).trim()}`);
      if (!versets.length) return c.error(['AUCUN VERSET', ref]);
      await c.reply(buildFrame(`${d.translation_name} — ${d.reference}`, versets.slice(0, 60)));
    } catch (e) { await c.error(['BIBLIE ÉCHEC', e.message]); }
  });

  /* Urban Dictionary */
  cmd('describe', { cat: 8, desc: 'Définition (Urban Dictionary)', usage: 'describe <mot>', icon: '📚' }, async (c) => {
    const mot = (c.q || '').trim();
    if (!mot) return c.error(['MOT MANQUANT', `${config.prefix}DESCRIBE <MOT>`]);
    try {
      const r = await fetch(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(mot)}`, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) return c.error(['SERVICE INDISPONIBLE', String(r.status)]);
      const d = await r.json();
      const list = d.list || [];
      if (!list.length) return c.error(['AUCUNE DÉFINITION', mot]);
      const top = list[0];
      const lignes = list.slice(0, 3).map((x, i) =>
        `${i + 1}. ${String(x.definition).replace(/\[|\]/g, '').slice(0, 300)} (+${x.thumbs_up} / -${x.thumbs_down})`);
      return c.reply(buildFrame(`${mot.toUpperCase()} (Urban Dictionary)`, lignes));
    } catch (e) { await c.error(['DESCRIBE ÉCHEC', e.message]); }
  });

  /* tableau périodique */
  cmd('elements', { cat: 8, desc: 'Élément du tableau périodique', usage: 'elements <nom|symbole>', icon: '⚗️' }, async (c) => {
    const q = (c.q || '').trim();
    if (!q) return c.error(['ÉLÉMENT MANQUANT', `${config.prefix}ELEMENTS hydrogen`]);
    try {
      const r = await fetch(`https://api.popcat.xyz/periodic-table?element=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) return c.error(['ÉLÉMENT INCONNU', q]);
      const d = await r.json();
      return c.reply(buildFrame(`${d.name} (${d.symbol})`, [
        bullet('NUMÉRO ATOMIQUE', String(d.atomic_number)),
        bullet('MASSE', String(d.atomic_mass)),
        bullet('PÉRIODE', String(d.period)),
        bullet('PHASE', String(d.phase)),
        bullet('DÉCOUVERT', String(d.discovered_by || '—')),
        bullet('RÉSUMÉ', String(d.summary || '—').slice(0, 200)),
      ]));
    } catch (e) { await c.error(['ELEMENTS ÉCHEC', e.message]); }
  });
}

module.exports = { registerPortedLogo, registerPortedLookup, LOGOS };
