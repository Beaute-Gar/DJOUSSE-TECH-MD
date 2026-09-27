'use strict';
const { cmd } = require('../command.cjs');
const { boxWithFooter } = require('../lib/djousse-ui.cjs');
const fetch = require('node-fetch');

const LOGOS = {
  '3dcomic': 'https://en.ephoto360.com/create-online-3d-comic-style-text-effects-817.html',
  'dragonball': 'https://en.ephoto360.com/create-dragon-ball-style-text-effects-online-809.html',
  'naruto': 'https://en.ephoto360.com/naruto-style-text-effect-online-808.html',
  'joker': 'https://en.ephoto360.com/joker-style-text-effect-online-807.html',
  'avenger': 'https://en.ephoto360.com/avengers-style-text-effect-online-806.html',
  'thor': 'https://en.ephoto360.com/thor-style-text-effect-online-805.html',
  'spiderman': 'https://en.ephoto360.com/spider-man-style-text-effect-online-804.html',
  'deadpool': 'https://en.ephoto360.com/deadpool-text-effect-online-803.html',
  'batman': 'https://en.ephoto360.com/batman-text-effect-online-802.html',
  'hacker': 'https://en.ephoto360.com/create-black-hacker-text-effect-online-801.html',
  'horror': 'https://en.ephoto360.com/create-horror-text-effect-online-800.html',
  'magma': 'https://en.ephoto360.com/create-magma-text-effect-online-799.html',
  'matrix': 'https://en.ephoto360.com/matrix-style-text-effect-online-798.html',
  'neon': 'https://en.ephoto360.com/create-neon-light-text-effect-online-797.html',
  'ice': 'https://en.ephoto360.com/ice-text-effect-online-796.html',
  'fire': 'https://en.ephoto360.com/fire-text-effect-online-795.html',
  'thunder': 'https://en.ephoto360.com/thunder-text-effect-online-794.html',
  'carbon': 'https://en.ephoto360.com/carbon-text-effect-online-793.html',
  'robot': 'https://en.ephoto360.com/robot-text-effect-online-792.html',
  'sunset': 'https://en.ephoto360.com/sunset-text-effect-online-791.html',
  'sakura': 'https://en.ephoto360.com/sakura-text-effect-online-790.html',
  'boom': 'https://en.ephoto360.com/boom-text-effect-online-789.html',
  'valentine': 'https://en.ephoto360.com/valentine-text-effect-online-788.html',
  'christmas': 'https://en.ephoto360.com/christmas-text-effect-online-787.html',
  'halloween': 'https://en.ephoto360.com/halloween-text-effect-online-786.html',
  'glitch': 'https://en.ephoto360.com/glitch-text-effect-online-785.html',
  'retro': 'https://en.ephoto360.com/retro-text-effect-online-784.html',
  'vintage': 'https://en.ephoto360.com/vintage-text-effect-online-783.html',
  'graffiti': 'https://en.ephoto360.com/graffiti-text-effect-online-782.html',
  'water': 'https://en.ephoto360.com/water-text-effect-online-781.html',
  'lava': 'https://en.ephoto360.com/lava-text-effect-online-780.html',
  'golden': 'https://en.ephoto360.com/golden-text-effect-online-779.html',
  'silver': 'https://en.ephoto360.com/silver-text-effect-online-778.html',
};

const API = 'https://api-pink-venom.vercel.app/api/logo';

cmd({ pattern: 'logo', desc: 'Generateur de logos/text effects', category: 'logo', filename: __filename },
async (conn, mek, m, { q, reply }) => {
  const args = (q || '').trim().split(/\s+/);
  const style = (args[0] || '').toLowerCase();
  const text = args.slice(1).join(' ');
  if (!style || !text) {
    const list = Object.keys(LOGOS).join(', ');
    return reply(boxWithFooter('LOGO MAKER', [
      { raw: 'Usage : *.logo <style> <texte>*' },
      { blank: true },
      { raw: `Styles disponibles : ${list}` }
    ]));
  }
  if (!LOGOS[style]) return reply(boxWithFooter('ERREUR', [{ raw: `❌ Style inconnu : ${style}` }]));
  try {
    await reply(boxWithFooter('LOGO', [{ raw: `🎨 Génération du logo "${style}"...` }]));
    const url = `${API}?url=${encodeURIComponent(LOGOS[style])}&name=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data?.result?.download_url) return reply(boxWithFooter('ERREUR', [{ raw: '❌ Échec de la génération.' }]));
    await conn.sendMessage(mek.remoteJid, { image: { url: data.result.download_url }, caption: `🎨 *${style.toUpperCase()}* — DJOUSSE TECH` }, { quoted: mek });
  } catch (e) { reply(boxWithFooter('ERREUR', [{ raw: `❌ ${e.message}` }])); }
});

cmd({ pattern: 'logolist', desc: 'Liste des styles de logos', category: 'logo', filename: __filename },
async (conn, mek, m, { reply }) => {
  const styles = Object.keys(LOGOS);
  const lines = styles.map(s => `┃ ⚡ \`.logo ${s}\``);
  reply(boxWithFooter('STYLES DE LOGOS', [...lines, { blank: true }, { raw: `Total : ${styles.length} styles` }]));
});
